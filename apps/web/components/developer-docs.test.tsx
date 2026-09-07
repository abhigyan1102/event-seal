import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DeveloperDocs } from "./developer-docs";

vi.mock("@gsap/react", () => ({ useGSAP: () => undefined }));
vi.mock("gsap", () => ({
  default: {
    registerPlugin: vi.fn(),
    matchMedia: () => ({ add: vi.fn(), revert: vi.fn() }),
    utils: { toArray: () => [] },
  },
}));
vi.mock("gsap/ScrollTrigger", () => ({ ScrollTrigger: {} }));

describe("DeveloperDocs", () => {
  it("documents inspection as separate from verification", () => {
    const html = renderToStaticMarkup(<DeveloperDocs />);

    expect(html).toContain("Build on verified Solana events.");
    expect(html).toContain("No verdict. No receipt.");
    expect(html).toContain("Trusted identity goes in.");
    expect(html).toContain("Missing evidence never passes.");
  });

  it("uses the current repository, local port, and public routes", () => {
    const html = renderToStaticMarkup(<DeveloperDocs />);

    expect(html).toContain("abhigyan1102/event-seal.git");
    expect(html).toContain("http://localhost:3000");
    expect(html).toContain("POST /api/inspect");
    expect(html).toContain("POST /api/verify");
    expect(html).toContain("/receipts/es_&lt;sha256&gt;");
    expect(html).toContain('href="/verify"');
  });
});
