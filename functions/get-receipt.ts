import { createAdminClient } from "npm:@insforge/sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default async function handler(request: Request): Promise<Response> {
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "GET")
    return json({ error: "Method not allowed" }, 405);

  const receiptId = new URL(request.url).searchParams.get("receiptId");
  if (!receiptId) return json({ error: "receiptId is required" }, 400);

  const baseUrl = Deno.env.get("INSFORGE_BASE_URL");
  const apiKey = Deno.env.get("INSFORGE_API_KEY");
  if (!baseUrl || !apiKey) {
    return json({ error: "Receipt storage is not configured" }, 500);
  }

  const client = createAdminClient({
    baseUrl,
    apiKey,
  });
  const { data, error } = await client.database
    .from("verification_receipts")
    .select("*")
    .eq("receipt_id", receiptId)
    .maybeSingle();

  if (error) return json({ error: error.message }, 500);
  if (!data) return json({ error: "Receipt not found" }, 404);
  return json(data, 200);
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
