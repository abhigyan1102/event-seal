import type {
  EventFormat,
  SolanaCluster,
  VerifyEventInput,
} from "../packages/sdk/src/index.ts";

import { verifyAndPersist } from "./_shared/verify-and-persist.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-EventSeal-Webhook-Secret",
};

interface HeliusTransaction {
  signature?: string;
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const webhookSecret = Deno.env.get("EVENTSEAL_WEBHOOK_SECRET");
  if (!webhookSecret) {
    return json({ error: "Webhook authentication is not configured" }, 500);
  }
  if (request.headers.get("X-EventSeal-Webhook-Secret") !== webhookSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  let payload: HeliusTransaction[];
  try {
    payload = (await request.json()) as HeliusTransaction[];
  } catch {
    return json({ error: "Request body must be valid JSON" }, 400);
  }
  if (!Array.isArray(payload)) {
    return json({ error: "Expected an array of transactions" }, 400);
  }

  try {
    const configuration = readConfiguration();
    const signatures = [
      ...new Set(
        payload.flatMap((transaction) =>
          transaction.signature ? [transaction.signature] : [],
        ),
      ),
    ];
    const results = await Promise.all(
      signatures.map((signature) =>
        verifyAndPersist({ ...configuration, signature }),
      ),
    );

    return json({ processed: results.length, results }, 200);
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error ? error.message : "Webhook processing failed",
      },
      500,
    );
  }
}

function readConfiguration(): Omit<VerifyEventInput, "signature"> {
  const cluster = Deno.env.get("EVENTSEAL_CLUSTER") as
    SolanaCluster | undefined;
  const expectedProgramId = Deno.env.get("EVENTSEAL_EXPECTED_PROGRAM_ID");
  const format = Deno.env.get("EVENTSEAL_EVENT_FORMAT") as
    EventFormat | undefined;
  const discriminator = Deno.env.get("EVENTSEAL_EVENT_DISCRIMINATOR");

  if (!cluster || !expectedProgramId || !format || !discriminator) {
    throw new Error(
      "EVENTSEAL_CLUSTER, EVENTSEAL_EXPECTED_PROGRAM_ID, EVENTSEAL_EVENT_FORMAT, and EVENTSEAL_EVENT_DISCRIMINATOR are required.",
    );
  }

  return {
    cluster,
    expectedProgramId,
    event: { format, discriminator },
    commitment: "finalized",
    rpcUrl: Deno.env.get("SOLANA_RPC_URL"),
  };
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
