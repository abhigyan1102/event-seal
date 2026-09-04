import "server-only";

import { createClient } from "@insforge/sdk";
import type { VerificationResult } from "@eventseal/sdk";

import {
  createVerifyRoute,
  VerificationAdapterError,
} from "../../../lib/verify-route";
import { parseServiceUrl } from "../../../lib/auth-config-values";

export const runtime = "nodejs";

const handlePost = createVerifyRoute(async (input) => {
  const anonKey = process.env.INSFORGE_ANON_KEY?.trim();

  if (!anonKey) {
    throw new VerificationAdapterError("NOT_CONFIGURED");
  }

  let baseUrl: string;
  try {
    baseUrl = parseServiceUrl(
      process.env.INSFORGE_BASE_URL,
      "INSFORGE_BASE_URL",
    );
  } catch {
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
