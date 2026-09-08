import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("copies the exact setup and SDK examples, including clipboard failure feedback", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/docs");
  for (const label of [
    "Local setup commands",
    "Inspect transaction example",
    "Verify event example",
    "Handle verification verdict example",
  ]) {
    const code = page.getByLabel(label, { exact: true });
    const expected = await code.textContent();
    await page
      .getByRole("button", { name: `Copy ${label.toLowerCase()}`, exact: true })
      .click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(expected);
    await expect(code.locator("..").getByRole("status")).toHaveText(
      "Copied to clipboard.",
    );
  }
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: () => Promise.reject(new Error("Clipboard unavailable")),
      },
    });
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Copy local setup commands", exact: true })
    .click();
  await expect(
    page.getByText("Copy unavailable. Select the code to copy it manually."),
  ).toBeVisible();
  await expect(
    page.getByLabel("Local setup commands", { exact: true }),
  ).toContainText("npm run dev");
});

test("supports chapter links, verdict examples, and concepts with the keyboard", async ({
  page,
}) => {
  await page.goto("/docs");
  await page
    .getByRole("navigation", { name: "Documentation chapters" })
    .getByRole("link", { name: "Verify", exact: true })
    .click();
  await expect(page).toHaveURL(/\/docs#verify$/);
  await expect(
    page.getByRole("heading", { name: "Verify your expected event." }),
  ).toBeInViewport();
  await expect(
    page
      .getByRole("navigation", { name: "Verification flow sections" })
      .getByRole("link", { name: "Verify", exact: true }),
  ).toHaveAttribute("aria-current", "location");
  const carousel = page.getByRole("region", { name: "Verdict examples" });
  const next = carousel.getByRole("button", { name: "Next verdict example" });
  await next.focus();
  await page.keyboard.press("Enter");
  await expect(carousel.getByText("TX_FAILED", { exact: true })).toBeVisible();
  await page.keyboard.press("Space");
  await expect(
    carousel.getByText("RPC_UNAVAILABLE", { exact: true }),
  ).toBeVisible();
  await carousel
    .getByRole("button", { name: "Previous verdict example" })
    .click();
  await expect(carousel.getByText("TX_FAILED", { exact: true })).toBeVisible();
  for (const name of ["Public receipts", "Security boundary", "Verdicts"]) {
    const button = page.getByRole("button", { name, exact: true });
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-expanded", "true");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
  const rail = await page.locator(".docs-flow__rail").boundingBox();
  const content = await page.locator(".docs-flow__content").boundingBox();
  expect(rail).not.toBeNull();
  expect(content).not.toBeNull();
  expect(rail!.y + rail!.height).toBeLessThanOrEqual(
    content!.y + content!.height + 1,
  );
});

test("keeps docs readable at laptop and mobile sizes with reduced motion", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: width > 700 ? 720 : 844 });
    await page.goto("/docs");
    await page.evaluate(() => document.fonts.ready);
    const title = page.getByRole("heading", { level: 1 });
    expect(
      await title.evaluate(
        (element) =>
          element.getBoundingClientRect().height /
          parseFloat(getComputedStyle(element).lineHeight),
      ),
    ).toBeLessThanOrEqual(3.1);
    await expect(
      page.getByRole("link", { name: "Start locally", exact: true }),
    ).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width !== 320)
      await page.screenshot({ path: testInfo.outputPath(`docs-${width}.png`) });
    await page
      .getByRole("link", { name: "Start locally", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Start with the repository." }),
    ).toBeInViewport();
    await expect(
      page.getByLabel("Local setup commands", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Security boundary", exact: true })
      .click();
    await expect(
      page.getByText(
        "The internal credential stays on the server. It never enters browser code.",
      ),
    ).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});
