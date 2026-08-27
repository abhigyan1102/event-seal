import "server-only";

import { createClient } from "@insforge/sdk";
import type { VerificationResult } from "@eventseal/sdk";

import {
  createVerifyRoute,
  VerificationAdapterError,
} from "../../../lib/verify-route";

export const runtime = "nodejs";

const handlePost = createVerifyRoute(async (input) => {
  const baseUrl = process.env.INSFORGE_BASE_URL;
  const anonKey = process.env.INSFORGE_ANON_KEY;

  if (!baseUrl || !anonKey) {
    throw new VerificationAdapterError("NOT_CONFIGURED");
  }

  const client = createClient({ baseUrl, anonKey });
  const { data, error } = await client.functions.invoke<VerificationResult>(
    "verify-event",
    { body: input },
  );

  if (error || !data) {
    throw new VerificationAdapterError("UPSTREAM_FAILED");
  }

  return data;
});

export const POST = handlePost;
