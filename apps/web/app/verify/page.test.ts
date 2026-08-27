import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import VerifyPage from "./page";

vi.mock("../../lib/auth-server", () => ({
  getCurrentUser: vi.fn().mockResolvedValue(null),
}));
vi.mock("../../components/verify-workspace", () => ({
  VerifyWorkspace: () => createElement("main", null, "Verification workspace"),
}));

describe("VerifyPage auth notice", () => {
  it.each([
    "__proto__",
    "constructor",
    "toString",
    "hasOwnProperty",
    "unknown",
    "",
    undefined,
  ])("renders the workspace without a notice for auth=%s", async (auth) => {
    const page = await VerifyPage({ searchParams: Promise.resolve({ auth }) });
    const html = renderToStaticMarkup(page);

    expect(html).toContain("Verification workspace");
    expect(html).not.toContain('role="status"');
  });

  it.each([
    ["signed_in", "Signed in with GitHub. You can now save issued receipts."],
    [
      "oauth_failed",
      "GitHub sign-in could not be completed. Please try again.",
    ],
    ["oauth_unavailable", "GitHub sign-in is temporarily unavailable."],
  ])("preserves the notice for the own key %s", async (auth, message) => {
    const page = await VerifyPage({ searchParams: Promise.resolve({ auth }) });
    const html = renderToStaticMarkup(page);

    expect(html).toContain('role="status"');
    expect(html).toContain(message);
    expect(html).toContain("Verification workspace");
  });
});
