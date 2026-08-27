import { describe, expect, it } from "vitest";

import { parseAuthConfig } from "./auth-config-values";

const configuredEnv = {
  INSFORGE_BASE_URL: "https://example.insforge.app",
  INSFORGE_ANON_KEY: "anon-key",
  EVENTSEAL_APP_URL: "https://eventseal.example",
};

describe("parseAuthConfig", () => {
  it("accepts HTTPS origins and enables secure cookies", () => {
    expect(parseAuthConfig(configuredEnv)).toEqual({
      baseUrl: "https://example.insforge.app",
      anonKey: "anon-key",
      appUrl: "https://eventseal.example",
      secureCookies: true,
    });
  });

  it("allows local HTTP for development", () => {
    expect(
      parseAuthConfig({
        ...configuredEnv,
        EVENTSEAL_APP_URL: "http://localhost:3000",
      }).secureCookies,
    ).toBe(false);
  });

  it("rejects non-local HTTP and credential-bearing URLs", () => {
    expect(() =>
      parseAuthConfig({
        ...configuredEnv,
        EVENTSEAL_APP_URL: "http://eventseal.example",
      }),
    ).toThrow("must use HTTPS");
    expect(() =>
      parseAuthConfig({
        ...configuredEnv,
        INSFORGE_BASE_URL: "https://user:pass@example.insforge.app",
      }),
    ).toThrow("without credentials");
    expect(() =>
      parseAuthConfig({
        ...configuredEnv,
        EVENTSEAL_APP_URL: "https://eventseal.example/app",
      }),
    ).toThrow("must not include a path");
  });

  it("requires an explicit production app origin", () => {
    expect(() =>
      parseAuthConfig({
        INSFORGE_BASE_URL: configuredEnv.INSFORGE_BASE_URL,
        INSFORGE_ANON_KEY: configuredEnv.INSFORGE_ANON_KEY,
        NODE_ENV: "production",
      }),
    ).toThrow("EVENTSEAL_APP_URL is not configured");
  });
});
