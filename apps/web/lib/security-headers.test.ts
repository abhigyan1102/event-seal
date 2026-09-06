import { describe, expect, it } from "vitest";

import {
  createContentSecurityPolicy,
  createSecurityHeaders,
} from "./security-headers";

describe("web security headers", () => {
  it("sets the production browser boundary without development eval", () => {
    const headers = new Map(
      createSecurityHeaders("production").map(({ key, value }) => [key, value]),
    );
    const policy = headers.get("Content-Security-Policy");

    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'self'");
    expect(policy).toContain("script-src 'self' 'unsafe-inline'");
    expect(policy).not.toContain("'unsafe-eval'");
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

  it("allows React development evaluation without enabling HSTS locally", () => {
    expect(createContentSecurityPolicy("development")).toContain(
      "'unsafe-eval'",
    );
    expect(
      createSecurityHeaders("development").some(
        ({ key }) => key === "Strict-Transport-Security",
      ),
    ).toBe(false);
  });
});
