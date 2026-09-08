import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("explains all three outcomes through keyboard-operated examples", async ({
  page,
}) => {
  await page.goto("/");
  const carousel = page.getByRole("region", {
    name: "Verification outcome examples",
  });
  await expect(
    carousel.getByRole("heading", { name: "No reward should follow." }),
  ).toBeVisible();
  const next = carousel.getByRole("button", { name: "Next example" });
  await next.focus();
  await page.keyboard.press("Enter");
  await expect(next).toBeFocused();
  await expect(
    carousel.getByRole("heading", { name: "The evidence checks out." }),
  ).toBeVisible();
  await expect(
    carousel.getByText(/Your application still applies its own authorization/),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press("Space");
  await expect(
    carousel.getByRole("heading", { name: "Wait for reliable evidence." }),
  ).toBeVisible();
  await expect(carousel.getByText(/never presented as verified/)).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press("Enter");
  await expect(
    carousel.getByRole("heading", { name: "No reward should follow." }),
  ).toBeVisible();
  await carousel.getByRole("button", { name: "Previous example" }).click();
  await expect(
    carousel.getByRole("heading", { name: "Wait for reliable evidence." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pause evidence animation" }).click();
  await expect(
    page.getByRole("button", { name: "Resume evidence animation" }),
  ).toBeVisible();
});

test("keeps the first view compact and every workflow step readable with reduced motion", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: width > 700 ? 720 : 844 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    const title = page.getByRole("heading", { level: 1 });
    const lines = await title.evaluate(
      (element) =>
        element.getBoundingClientRect().height /
        parseFloat(getComputedStyle(element).lineHeight),
    );
    expect(lines).toBeLessThanOrEqual(3.1);
    await expect(
      page.getByRole("link", { name: "Verify a transaction" }),
    ).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width !== 320) {
      await page.screenshot({
        path: testInfo.outputPath(`homepage-${width}.png`),
      });
    }
    for (const name of [
      "Inspect the transaction.",
      "Verify your expected event.",
      "Keep a shareable receipt.",
    ]) {
      const heading = page.getByRole("heading", { name });
      await heading.scrollIntoViewIfNeeded();
      await expect(heading).toBeInViewport();
      await expect(heading.locator("..").locator("p").first()).toBeVisible();
    }
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});
