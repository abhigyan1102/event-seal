import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import type {
  ArcSettlementRequest,
  ArcSettlementResult,
} from "../../apps/web/lib/arc-settlement";

const transactionHash =
  "0xedaf47800669bd77029f6a779a3c2824a84e2e46385d45d53091a226e65769f0";
const sender = "0xe398777ab152fc44893415a731ceab226478f5ae";
const recipient = "0xbbc2a38ab48fa953ec68ee6115bd518d3a226f6e";

const verifiedResult: ArcSettlementResult = {
  verdict: "verified",
  decision: "release",
  reasonCode: "VERIFIED",
  reason:
    "The finalized Arc transaction contains exactly one expected USDC settlement.",
  network: "arc-testnet",
  chainId: 5_042_002,
  transactionHash,
  usdcContract: "0x3600000000000000000000000000000000000000",
  expected: {
    sender,
    recipient,
    amount: "8.388778",
    amountBaseUnits: "8388778",
  },
  transfer: {
    sender,
    recipient,
    amount: "8.388778",
    amountBaseUnits: "8388778",
    logIndex: 1,
    blockNumber: 61_899_564,
  },
  receiptId: "es_arc_" + "a".repeat(64),
  evidence: [
    {
      check: "arc-chain",
      passed: true,
      detail: "RPC reported Arc Testnet chain 5042002.",
    },
    {
      check: "transaction-finality",
      passed: true,
      detail: "One Arc confirmation is final.",
    },
    {
      check: "expected-amount",
      passed: true,
      detail: "The transfer moved exactly 8.388778 USDC.",
    },
  ],
};

const browserProblems = new WeakMap<Page, string[]>();

test.beforeEach(({ page }) => {
  const problems: string[] = [];
  browserProblems.set(page, problems);
  page.on("pageerror", (error) => problems.push("pageerror: " + error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      problems.push("console: " + message.text());
    }
  });
});

test.afterEach(({ page }) => {
  expect(browserProblems.get(page) ?? []).toEqual([]);
});

test("verifies a live Arc USDC example through the backend decision route", async ({
  page,
}) => {
  let submitted: ArcSettlementRequest | undefined;
  await page.route("**/api/arc/verify-settlement", async (route) => {
    submitted = route.request().postDataJSON() as ArcSettlementRequest;
    await route.fulfill({ status: 200, json: verifiedResult });
  });

  await page.goto("/arc");
  await expect(
    page.getByRole("heading", {
      name: "Prove the payment before you release the value.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Arc", exact: true }),
  ).toHaveAttribute("aria-current", "page");

  await page.getByRole("button", { name: "Load live example" }).click();
  await expect(page.getByLabel("Arc transaction hash")).toHaveValue(
    transactionHash,
  );
  await expect(page.getByLabel("Expected sender")).toHaveValue(sender);
  await expect(page.getByLabel("Expected recipient")).toHaveValue(recipient);
  await expect(page.getByLabel("Expected amount")).toHaveValue("8.388778");

  await page.getByRole("button", { name: "Verify Arc settlement" }).click();
  await expect(page.getByText("release", { exact: true })).toBeVisible();
  await expect(page.getByText("verified", { exact: true })).toBeVisible();
  await expect(page.getByText("8.388778 USDC", { exact: true })).toBeVisible();
  expect(submitted).toEqual({
    transactionHash,
    expectedSender: sender,
    expectedRecipient: recipient,
    expectedAmount: "8.388778",
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("keeps the Arc settlement gate usable at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/arc");
  await page.getByRole("button", { name: "Load live example" }).click();

  await expect(page.getByLabel("Arc transaction hash")).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
