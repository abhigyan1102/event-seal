import type { VerifyEventInput } from "../packages/sdk/src/index.ts";

import { verifyAndPersist } from "./_shared/verify-and-persist.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default async function handler(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let input: VerifyEventInput;
  try {
    const body: unknown = await request.json();
    if (!isVerifyEventInput(body)) {
      return json(
        { error: "Request body does not match VerifyEventInput" },
        400,
      );
    }
    input = body;
  } catch {
    return json({ error: "Request body must be valid JSON" }, 400);
  }

  try {
    const result = await verifyAndPersist(input);
    return json(result, 200);
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Verification failed" },
      500,
    );
  }
}

function isVerifyEventInput(value: unknown): value is VerifyEventInput {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<VerifyEventInput>;
  return (
    typeof candidate.signature === "string" &&
    (candidate.cluster === "mainnet-beta" ||
      candidate.cluster === "devnet" ||
      candidate.cluster === "testnet") &&
    typeof candidate.expectedProgramId === "string" &&
    Boolean(candidate.event) &&
    (candidate.event?.format === "anchor-log" ||
      candidate.event?.format === "anchor-cpi") &&
    typeof candidate.event?.discriminator === "string"
  );
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
