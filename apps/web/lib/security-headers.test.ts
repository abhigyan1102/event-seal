import { describe, expect, it } from "vitest";

import {
  createContentSecurityPolicy,
  createSecurityHeaders,
} from "./security-headers";

describe("web security headers", () => {
  it("sets the static production browser boundary", () => {
    const headers = new Map(
      createSecurityHeaders("production").map(({ key, value }) => [key, value]),
    );
    expect(headers.has("Content-Security-Policy")).toBe(false);
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(headers.get("Permissions-Policy")).toContain("camera=()");
    expect(headers.get("Strict-Transport-Security")).toBe(
      "max-age=63072000; includeSubDomains; preload",
    );
  });

  it("builds a nonce-bound production CSP without unsafe inline execution", () => {
    const policy = createContentSecurityPolicy("test-nonce", "production");

    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'self'");
    expect(policy).toContain(
      "script-src 'self' 'nonce-test-nonce' 'strict-dynamic'",
    );
    expect(policy).toContain("style-src 'self' 'nonce-test-nonce'");
    expect(policy).not.toContain("'unsafe-inline'");
    expect(policy).not.toContain("'unsafe-eval'");
  });

  it("allows React development evaluation without enabling inline scripts", () => {
    const policy = createContentSecurityPolicy("test-nonce", "development");

    expect(policy).toContain("'unsafe-eval'");
    expect(policy).not.toContain("'unsafe-inline'");
    expect(
      createSecurityHeaders("development").some(
        ({ key }) => key === "Strict-Transport-Security",
      ),
    ).toBe(false);
  });
});
