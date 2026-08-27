import { describe, expect, it } from "vitest";

import { parseOAuthCallback, parseOAuthStart } from "./oauth-boundary";

const verifier = "v".repeat(43);

describe("OAuth boundary validation", () => {
  it("accepts a secure OAuth start response", () => {
    expect(
      parseOAuthStart({
        url: "https://github.com/login/oauth/authorize",
        codeVerifier: verifier,
      }),
    ).toEqual({
      url: "https://github.com/login/oauth/authorize",
      codeVerifier: verifier,
    });
  });

  it("rejects insecure redirects and invalid PKCE verifiers", () => {
    expect(
      parseOAuthStart({
        url: "http://github.example/oauth",
        codeVerifier: verifier,
      }),
    ).toBeNull();
    expect(
      parseOAuthStart({
        url: "https://attacker.example/oauth",
        codeVerifier: verifier,
      }),
    ).toBeNull();
    expect(
      parseOAuthStart({
        url: "https://github.com/login/oauth/authorize",
        codeVerifier: "short",
      }),
    ).toBeNull();
  });

  it("accepts a bounded callback code with the stored verifier", () => {
    expect(
      parseOAuthCallback(
        new URLSearchParams({ insforge_code: "code" }),
        verifier,
      ),
    ).toEqual({ code: "code", verifier });
  });

  it("rejects provider errors, missing values, and oversized codes", () => {
    expect(
      parseOAuthCallback(new URLSearchParams({ error: "denied" }), verifier),
    ).toBeNull();
    expect(parseOAuthCallback(new URLSearchParams(), verifier)).toBeNull();
    expect(
      parseOAuthCallback(
        new URLSearchParams({ insforge_code: "x".repeat(2_049) }),
        verifier,
      ),
    ).toBeNull();
  });
});
