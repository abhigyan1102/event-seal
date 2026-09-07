import "server-only";

import type { TransactionInspection } from "@eventseal/sdk";
import { createClient } from "@insforge/sdk";

import {
  createInspectionRoute,
  InspectionAdapterError,
} from "../../../lib/inspection-route";
import { parseServiceUrl } from "../../../lib/auth-config-values";
import { createProtectedFunctionInvokeOptions } from "../../../lib/internal-function-auth";
import { createRedirectRejectingFetch } from "../../../lib/redirect-safe-fetch";

export const runtime = "nodejs";

const handlePost = createInspectionRoute(async (input) => {
  const anonKey = process.env.INSFORGE_ANON_KEY?.trim();
  const invokeOptions = createProtectedFunctionInvokeOptions(
    input,
    process.env.EVENTSEAL_INTERNAL_API_SECRET,
  );

  if (!anonKey || !invokeOptions) {
    throw new InspectionAdapterError("NOT_CONFIGURED");
  }

  let baseUrl: string;
  try {
    baseUrl = parseServiceUrl(
      process.env.INSFORGE_BASE_URL,
      "INSFORGE_BASE_URL",
    );
  } catch {
    throw new InspectionAdapterError("NOT_CONFIGURED");
  }

  const client = createClient({
    baseUrl,
    anonKey,
    fetch: createRedirectRejectingFetch(),
  });
  const { data, error } = await client.functions.invoke<TransactionInspection>(
    "inspect-transaction",
    invokeOptions,
  );

  if (error || !data) {
    throw new InspectionAdapterError("UPSTREAM_FAILED");
  }

  return data;
});

export const POST = handlePost;
