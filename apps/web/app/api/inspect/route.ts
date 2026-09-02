import "server-only";

import type { TransactionInspection } from "@eventseal/sdk";
import { createClient } from "@insforge/sdk";

import {
  createInspectionRoute,
  InspectionAdapterError,
} from "../../../lib/inspection-route";

export const runtime = "nodejs";

const handlePost = createInspectionRoute(async (input) => {
  const baseUrl = process.env.INSFORGE_BASE_URL;
  const anonKey = process.env.INSFORGE_ANON_KEY;

  if (!baseUrl || !anonKey) {
    throw new InspectionAdapterError("NOT_CONFIGURED");
  }

  const client = createClient({ baseUrl, anonKey });
  const { data, error } = await client.functions.invoke<TransactionInspection>(
    "inspect-transaction",
    { body: input },
  );

  if (error || !data) {
    throw new InspectionAdapterError("UPSTREAM_FAILED");
  }

  return data;
});

export const POST = handlePost;
