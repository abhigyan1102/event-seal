import { describe, expect, it, vi } from "vitest";

import { createRedirectRejectingFetch } from "./redirect-safe-fetch";

describe("redirect-rejecting fetch", () => {
  it("overrides redirect handling before forwarding a request", async () => {
    const response = new Response(null, { status: 204 });
    const fetchFn = vi.fn(() =>
      Promise.resolve(response),
    ) as unknown as typeof fetch;
    const secureFetch = createRedirectRejectingFetch(fetchFn);

    await expect(
      secureFetch("https://eventseal.insforge.test/functions/verify-event", {
        method: "POST",
        redirect: "follow",
      }),
    ).resolves.toBe(response);

    expect(fetchFn).toHaveBeenCalledWith(
      "https://eventseal.insforge.test/functions/verify-event",
      expect.objectContaining({ method: "POST", redirect: "error" }),
    );
  });
});
