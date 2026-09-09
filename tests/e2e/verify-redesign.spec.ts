import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const signature = "1".repeat(64);
const program = "1".repeat(32);
const discriminator = "0102030405060708";

test("keeps the inspect action visible on laptop and mobile with reduced motion", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: width === 1280 ? 720 : 844 });
    await page.goto("/verify");
    await page.evaluate(() => document.fonts.ready);
    const heading = page.getByRole("heading", { level: 1 });
    expect(
      await heading.evaluate(
        (el) =>
          el.getBoundingClientRect().height /
          parseFloat(getComputedStyle(el).lineHeight),
      ),
    ).toBeLessThanOrEqual(3.1);
    await expect(
      page.getByRole("button", { name: "Inspect transaction", exact: true }),
    ).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("button", { name: "Verify trusted event identity" }),
    ).toHaveCount(0);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    if (width !== 320)
      await page.screenshot({
        path: testInfo.outputPath(`verify-${width}.png`),
      });
  }
});

test("candidate selection never supplies trusted identity and changing network clears evidence", async ({
  page,
}) => {
  let verificationCalls = 0;
  await page.route("**/api/verify", (route) => {
    verificationCalls++;
    return route.abort();
  });
  await page.route("**/api/inspect", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        kind: "transaction-inspection",
        signature,
        cluster: "devnet",
        finality: "finalized",
        execution: "succeeded",
        slot: 42,
        reasonCode: "CANDIDATES_FOUND",
        invokedPrograms: [program],
        logsStatus: "available",
        candidates: [
          {
            emitterProgramId: program,
            discriminator,
            eventPosition: 0,
            eventDataHash: "a".repeat(64),
            dataBase64: "AQIDBAUGBwg=",
          },
        ],
      }),
    }),
  );
  await page.goto("/verify");
  await page
    .getByLabel("Transaction signature", { exact: true })
    .fill(signature);
  await page
    .getByRole("button", { name: "Inspect transaction", exact: true })
    .click();
  await expect(
    page.getByRole("article", { name: "Transaction inspection" }),
  ).toBeVisible();
  await page.getByRole("radio").check();
  await page
    .getByText("Advanced: enter trusted event identity", { exact: true })
    .click();
  await expect(
    page.getByLabel("Expected program ID", { exact: true }),
  ).toHaveValue("");
  await expect(
    page.getByLabel("Event discriminator", { exact: true }),
  ).toHaveValue("");
  await page
    .getByRole("button", { name: "Verify trusted event identity" })
    .click();
  await expect(
    page.getByLabel("Expected program ID", { exact: true }),
  ).toBeFocused();
  await expect(
    page.getByLabel("Expected program ID", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  expect(verificationCalls).toBe(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page
    .getByLabel("Solana network", { exact: true })
    .selectOption("testnet");
  await expect(
    page.getByRole("article", { name: "Transaction inspection" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Verify trusted event identity" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Your evidence starts here." }),
  ).toBeVisible();
});

test("shows recoverable request errors and supports verdict explanations by keyboard", async ({
  page,
}) => {
  await page.route("**/api/inspect", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Inspection is temporarily unavailable." }),
    }),
  );
  await page.goto("/verify");
  await page
    .getByRole("button", { name: "Inspect transaction", exact: true })
    .click();
  await expect(
    page.getByLabel("Transaction signature", { exact: true }),
  ).toBeFocused();
  await page
    .getByLabel("Transaction signature", { exact: true })
    .fill(signature);
  await page
    .getByRole("button", { name: "Inspect transaction", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Inspection request failed",
  );
  await expect(
    page.getByLabel("Transaction signature", { exact: true }),
  ).toHaveValue(signature);
  await expect(
    page.getByRole("button", { name: "Inspect transaction", exact: true }),
  ).toBeEnabled();
  const guide = page.getByRole("region", { name: "Understanding verdicts" });
  await guide.getByRole("button", { name: "Next verdict explanation" }).focus();
  await page.keyboard.press("Enter");
  await expect(
    guide.getByRole("button", { name: "Rejected", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Space");
  await expect(
    guide.getByRole("button", { name: "Indeterminate", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  await guide.getByRole("button", { name: "Verified", exact: true }).click();
  await expect(
    guide.getByRole("button", { name: "Verified", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
