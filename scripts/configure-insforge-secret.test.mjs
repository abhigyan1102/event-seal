import { describe, expect, it, vi } from "vitest";

import {
  configureInsforgeSecret,
  normalizeSecretInput,
  parseSecretCommand,
} from "./configure-insforge-secret.mjs";

const projectConfig = {
  oss_host: "https://eventseal.insforge.test",
  api_key: "test-admin-key",
};

describe("process-safe InsForge secret configuration", () => {
  it("parses only supported actions and safe secret keys", () => {
    expect(
      parseSecretCommand(["add", "EVENTSEAL_INTERNAL_API_SECRET"]),
    ).toEqual({
      action: "add",
      key: "EVENTSEAL_INTERNAL_API_SECRET",
    });
    expect(() => parseSecretCommand(["remove", "SECRET"])).toThrow(/Usage/);
    expect(() => parseSecretCommand(["add", "../secret"])).toThrow(/Usage/);
  });

  it("removes only the secret-manager trailing newline", () => {
    expect(normalizeSecretInput("secret-value\n")).toBe("secret-value");
    expect(() => normalizeSecretInput("secret\nvalue")).toThrow(
      /one non-empty line/,
    );
  });

  it("creates a secret with its value only in the request body", async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, status: 201 }));

    await configureInsforgeSecret(
      {
        action: "add",
        key: "EVENTSEAL_INTERNAL_API_SECRET",
        value: "new-secret",
        projectConfig,
      },
      fetchFn,
    );

    expect(fetchFn).toHaveBeenCalledWith(
      new URL("https://eventseal.insforge.test/api/secrets"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          key: "EVENTSEAL_INTERNAL_API_SECRET",
          value: "new-secret",
        }),
      }),
    );
    expect(JSON.stringify(fetchFn.mock.calls[0][0])).not.toContain(
      "new-secret",
    );
  });

  it("updates a secret without putting its value in the URL", async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, status: 200 }));

    await configureInsforgeSecret(
      {
        action: "update",
        key: "EVENTSEAL_INTERNAL_API_SECRET",
        value: "rotated-secret",
        projectConfig,
      },
      fetchFn,
    );

    const [url, request] = fetchFn.mock.calls[0];
    expect(url.href).toBe(
      "https://eventseal.insforge.test/api/secrets/EVENTSEAL_INTERNAL_API_SECRET",
    );
    expect(url.href).not.toContain("rotated-secret");
    expect(request).toMatchObject({
      method: "PUT",
      body: JSON.stringify({ value: "rotated-secret" }),
    });
  });

  it("rejects an insecure linked host before sending credentials", async () => {
    const fetchFn = vi.fn();

    await expect(
      configureInsforgeSecret(
        {
          action: "add",
          key: "EVENTSEAL_INTERNAL_API_SECRET",
          value: "new-secret",
          projectConfig: {
            ...projectConfig,
            oss_host: "http://eventseal.insforge.test",
          },
        },
        fetchFn,
      ),
    ).rejects.toThrow("Linked InsForge oss_host must use HTTPS.");

    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("reports only the HTTP status when InsForge rejects a request", async () => {
    const fetchFn = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ value: "must-not-be-logged" }),
    }));

    await expect(
      configureInsforgeSecret(
        {
          action: "add",
          key: "SECRET",
          value: "must-not-be-logged",
          projectConfig,
        },
        fetchFn,
      ),
    ).rejects.toThrow("InsForge secret add failed with HTTP 400.");
  });
});
