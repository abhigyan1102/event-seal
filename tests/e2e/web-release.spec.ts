import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import type { BrowserInspectTransactionInput } from "../../apps/web/lib/inspection-request";
import type { BrowserVerifyEventInput } from "../../apps/web/lib/verification-request";

const signature = "1".repeat(64);
const expectedProgramId = "1".repeat(32);
const discriminator = "0102030405060708";
const receiptId = `es_${"a".repeat(64)}`;

type VerdictFixture = {
  verdict: "verified" | "rejected" | "indeterminate";
  reasonCode: "VERIFIED" | "TX_FAILED" | "RPC_UNAVAILABLE";
  title: string;
  reason: string;
};

const verdictFixtures = [
  {
    verdict: "verified",
    reasonCode: "VERIFIED",
    title: "Event verified",
    reason: "Finalized evidence matched the trusted event identity.",
  },
  {
    verdict: "rejected",
    reasonCode: "TX_FAILED",
    title: "Event rejected",
    reason: "The transaction failed and cannot authorize an event.",
  },
  {
    verdict: "indeterminate",
    reasonCode: "RPC_UNAVAILABLE",
    title: "Verification inconclusive",
    reason: "The RPC could not provide reliable evidence.",
  },
] as const satisfies readonly VerdictFixture[];

const browserProblems = new WeakMap<Page, string[]>();

test.beforeEach(({ page }) => {
  const problems: string[] = [];
  browserProblems.set(page, problems);
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") {
      problems.push(`console: ${message.text()}`);
    }
  });
});

test.afterEach(({ page }) => {
  expect(browserProblems.get(page) ?? []).toEqual([]);
});

test("serves the product homepage and supports keyboard navigation", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", {
      name: "Verify Solana events. Then act.",
    }),
  ).toBeVisible();

  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "EventSeal home" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Verify", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Docs", exact: true }).first(),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "GitHub" }).first(),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Sign in with GitHub" }).first(),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Verify a transaction" }),
  ).toBeFocused();

  await expectNoAxeViolations(page);
});

test("opens developer documentation from the homepage at desktop and 390px", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Read the docs" }).click();
  await expect(page).toHaveURL(/\/docs$/);

  await expect(
    page.getByRole("heading", { name: "Build on verified Solana events." }),
  ).toBeVisible();
  await expect(page.getByText("No verdict. No receipt.")).toBeVisible();
  await expect(page.getByText("Missing evidence never passes.")).toBeVisible();
  await expectNoAxeViolations(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("link", { name: "Read the docs" }).click();
  await expect(page).toHaveURL(/\/docs$/);
  await expect(
    page.getByRole("heading", { name: "Build on verified Solana events." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expectNoAxeViolations(page);
});

test("keeps the public homepage usable at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Verify Solana events. Then act.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Verify a transaction" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expectNoAxeViolations(page);
});

test("serves security headers on pages and API responses", async ({
  page,
  request,
}) => {
  const pageResponse = await page.goto("/verify");
  const firstPageNonce = expectSecurityHeaders(pageResponse);
  const renderedScriptNonces = await page
    .locator("script")
    .evaluateAll((scripts) =>
      scripts
        .map((script) => (script as HTMLScriptElement).nonce ?? "")
        .filter((nonce) => nonce.length > 0),
    );
  expect(renderedScriptNonces.length).toBeGreaterThan(0);
  expect(new Set(renderedScriptNonces)).toEqual(new Set([firstPageNonce]));

  const secondPageResponse = await request.get("/verify");
  const secondPageNonce = expectSecurityHeaders(secondPageResponse);
  expect(secondPageNonce).not.toBe(firstPageNonce);

  const apiResponse = await request.post("/api/inspect", {
    data: "{}",
    headers: { "Content-Type": "text/plain" },
  });
  expect(apiResponse.status()).toBe(415);
  expectSecurityHeaders(apiResponse);
});

test("keeps inspection separate from verification", async ({ page }) => {
  await mockBrowserApis(page, verdictFixtures[0]);
  await page.goto("/verify");

  await expect(
    page.getByRole("button", { name: "Verify trusted event identity" }),
  ).toHaveCount(0);

  await inspectTransaction(page);

  await expect(
    page.getByRole("article", { name: "Transaction inspection" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Inspection has no verification verdict and issues no receipt.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Verify trusted event identity" }),
  ).toBeVisible();
});

for (const fixture of verdictFixtures) {
  test(`renders the ${fixture.verdict} verdict from mocked browser APIs`, async ({
    page,
  }) => {
    await mockBrowserApis(page, fixture);
    await page.goto("/verify");
    await inspectTransaction(page);
    await verifyTrustedIdentity(page);

    const receipt = page.getByRole("article", { name: "Verification result" });
    await expect(
      receipt.getByRole("heading", { name: fixture.title }),
    ).toBeVisible();
    await expect(
      receipt.getByText(fixture.reasonCode, { exact: true }),
    ).toBeVisible();
    await expect(
      receipt.getByText(fixture.reason, { exact: true }),
    ).toBeVisible();

    if (fixture.verdict === "verified") {
      await expect(
        receipt.getByText(
          "Sign in with GitHub to save a private reference to this receipt.",
        ),
      ).toBeVisible();
      await expect(
        receipt.getByRole("button", { name: "Save receipt" }),
      ).toHaveCount(0);
    }

    await expectNoAxeViolations(page);
  });
}

test("fails closed for malformed receipt links and signed-out dashboards", async ({
  page,
}) => {
  await page.goto("/receipts/not-an-eventseal-receipt");
  await expect(
    page.getByRole("heading", { name: "Receipt link is invalid." }),
  ).toBeVisible();
  await expectNoAxeViolations(page);

  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", {
      name: "Your saved evidence stays tied to your account.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in with GitHub" }).last(),
  ).toBeVisible();
  await expectNoAxeViolations(page);
});

test("fits the complete verification flow at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockBrowserApis(page, verdictFixtures[0]);
  await page.goto("/verify");
  await inspectTransaction(page);
  await verifyTrustedIdentity(page);

  await expect(
    page.getByRole("heading", { name: "Event verified" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expectNoAxeViolations(page);
});

async function inspectTransaction(page: Page) {
  await page.getByLabel("Transaction signature").fill(signature);
  await page.getByRole("button", { name: "Inspect transaction" }).click();
  await expect(
    page.getByRole("article", { name: "Transaction inspection" }),
  ).toBeVisible();
}

async function verifyTrustedIdentity(page: Page) {
  await page.getByLabel("Expected program ID").fill(expectedProgramId);
  await page.getByLabel("Event discriminator").fill(discriminator);
  await page
    .getByRole("button", { name: "Verify trusted event identity" })
    .click();
}

async function mockBrowserApis(page: Page, fixture: VerdictFixture) {
  await page.route("**/api/inspect", async (route) => {
    const request = route
      .request()
      .postDataJSON() as BrowserInspectTransactionInput;
    expect(request).toMatchObject({
      signature,
      cluster: "devnet",
    });
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        kind: "transaction-inspection",
        signature: request.signature,
        cluster: request.cluster,
        finality: "finalized",
        execution: "succeeded",
        slot: 42,
        reasonCode: "NO_SUPPORTED_LOG_EVENT",
        invokedPrograms: [expectedProgramId],
        logsStatus: "available",
        candidates: [],
      }),
    });
  });

  await page.route("**/api/verify", async (route) => {
    const request = route.request().postDataJSON() as BrowserVerifyEventInput;
    expect(request).toMatchObject({
      signature,
      cluster: "devnet",
      expectedProgramId,
      event: {
        format: "anchor-log",
        discriminator,
      },
      commitment: "finalized",
    });
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        signature: request.signature,
        cluster: request.cluster,
        expectedProgramId: request.expectedProgramId,
        commitment: "finalized",
        slot: 42,
        verdict: fixture.verdict,
        reasonCode: fixture.reasonCode,
        reason: fixture.reason,
        receiptId: fixture.verdict === "verified" ? receiptId : undefined,
        event:
          fixture.verdict === "verified"
            ? {
                eventPosition: 0,
                emitterProgramId: expectedProgramId,
                eventDataHash: "b".repeat(64),
              }
            : undefined,
        evidence: [
          {
            check: "finality",
            passed: fixture.verdict === "verified",
            detail:
              fixture.verdict === "verified"
                ? "The transaction is finalized."
                : "The verifier did not establish a successful result.",
          },
        ],
      }),
    });
  });
}

async function expectNoAxeViolations(page: Page) {
  const animatedRegions = page.locator("[data-reveal], .feedback-region");
  if ((await animatedRegions.count()) > 0) {
    await expect
      .poll(() =>
        animatedRegions.evaluateAll((elements) =>
          elements.every(
            (element) => getComputedStyle(element).opacity === "1",
          ),
        ),
      )
      .toBe(true);
  }

  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations,
    results.violations
      .map((violation) => `${violation.id}: ${violation.help}`)
      .join("\n"),
  ).toEqual([]);
}

function expectSecurityHeaders(
  response: { headers(): Record<string, string> } | null,
): string {
  expect(response).not.toBeNull();
  const headers = response?.headers() ?? {};
  const policy = headers["content-security-policy"];

  expect(policy).toContain("default-src 'self'");
  expect(policy).toContain("frame-ancestors 'none'");
  expect(policy).toContain("object-src 'none'");
  expect(policy).toContain("'strict-dynamic'");
  expect(policy).not.toContain("'unsafe-inline'");
  expect(policy).not.toContain("'unsafe-eval'");
  const nonce = policy?.match(/'nonce-([^']+)'/)?.[1];
  expect(nonce).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["strict-transport-security"]).toBe(
    "max-age=63072000; includeSubDomains; preload",
  );
  expect(headers["x-powered-by"]).toBeUndefined();

  return nonce ?? "";
}
