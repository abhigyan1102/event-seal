import { describe, expect, it } from "vitest";

import {
  createProtectedFunctionInvokeOptions,
  INTERNAL_API_SECRET_HEADER,
} from "./internal-function-auth";

describe("protected InsForge function options", () => {
  it("attaches the server-owned secret without changing the request body", () => {
    const body = { signature: "1".repeat(64), cluster: "devnet" };

    expect(
      createProtectedFunctionInvokeOptions(body, "server-owned-secret"),
    ).toEqual({
      body,
      headers: {
        [INTERNAL_API_SECRET_HEADER]: "server-owned-secret",
      },
    });
  });

  it.each([undefined, "", "   "])(
    "rejects missing configuration %j",
    (configuredSecret) => {
      expect(
        createProtectedFunctionInvokeOptions({}, configuredSecret),
      ).toBeNull();
    },
  );
});
