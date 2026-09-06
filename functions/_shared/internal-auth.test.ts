import { describe, expect, it } from "vitest";

import {
  authenticateInternalRequest,
  INTERNAL_API_SECRET_HEADER,
  timingSafeSecretEqual,
} from "./internal-auth.ts";

const secret = "test-internal-secret";

function request(value?: string): Request {
  return new Request("https://eventseal.test/functions/protected", {
    method: "POST",
    headers: value ? { [INTERNAL_API_SECRET_HEADER]: value } : undefined,
  });
}

describe("internal function authentication", () => {
  it("accepts only the exact configured secret", async () => {
    const getEnv = (name: string) =>
      name === "EVENTSEAL_INTERNAL_API_SECRET" ? secret : undefined;

    await expect(
      authenticateInternalRequest(request(secret), getEnv),
    ).resolves.toEqual({ ok: true });
    await expect(
      authenticateInternalRequest(request(`${secret}x`), getEnv),
    ).resolves.toEqual({
      ok: false,
      error: "Unauthorized",
      status: 401,
    });
    await expect(
      authenticateInternalRequest(request(), getEnv),
    ).resolves.toEqual({
      ok: false,
      error: "Unauthorized",
      status: 401,
    });
  });

  it.each([undefined, "", "   "])(
    "fails closed when configuration is %j",
    async (configuredSecret) => {
      await expect(
        authenticateInternalRequest(request(secret), (name) =>
          name === "EVENTSEAL_INTERNAL_API_SECRET"
            ? configuredSecret
            : undefined,
        ),
      ).resolves.toEqual({
        ok: false,
        error: "Internal authentication is not configured",
        status: 500,
      });
    },
  );

  it("compares fixed-length digests for equal and unequal values", async () => {
    await expect(timingSafeSecretEqual(secret, secret)).resolves.toBe(true);
    await expect(timingSafeSecretEqual("short", secret)).resolves.toBe(false);
  });
});
