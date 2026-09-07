import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ProductHome } from "./product-home";

vi.mock("@gsap/react", () => ({ useGSAP: () => undefined }));
vi.mock("gsap", () => ({
  default: {
    registerPlugin: vi.fn(),
    matchMedia: () => ({ add: vi.fn(), revert: vi.fn() }),
    utils: { toArray: () => [] },
  },
}));
vi.mock("gsap/ScrollTrigger", () => ({ ScrollTrigger: {} }));

describe("ProductHome", () => {
  it("explains the product without overstating inconclusive evidence", () => {
    const html = renderToStaticMarkup(<ProductHome />);

    expect(html).toContain("Verify Solana events before your backend acts.");
    expect(html).toContain("Finalized first.");
    expect(html).toContain("Identity, not inference.");
    expect(html).toContain("Missing or unreliable RPC evidence");
    expect(html).toContain("never presented as verified");
  });

  it("provides working paths to the verifier and project documentation", () => {
    const html = renderToStaticMarkup(<ProductHome />);

    expect(html).toContain('href="/verify"');
    expect(html).toContain('href="/docs"');
  });
});
