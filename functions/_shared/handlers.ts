import type {
  VerificationResult,
  VerifyEventInput,
} from "../../packages/sdk/src/index.ts";

import {
  corsHeaders,
  errorResponse,
  jsonResponse,
  optionsResponse,
} from "./http.ts";
import {
  applyServerRpcUrl,
  validateHeliusPayload,
  validateReceiptId,
  validateVerifyEventInput,
  validateWebhookConfiguration,
} from "./validation.ts";

type GetEnv = (name: string) => string | undefined;

const HELIUS_WEBHOOK_MAX_SIGNATURES = 25;
const HELIUS_WEBHOOK_VERIFY_CONCURRENCY = 4;
const WEBHOOK_SECRET_ENCODER = new TextEncoder();

interface Logger {
  error(message: string, ...details: unknown[]): void;
}

interface VerifyEventHandlerDependencies {
  getEnv: GetEnv;
  logger: Logger;
  verifyAndPersist(input: VerifyEventInput): Promise<VerificationResult>;
}

interface ReceiptLookupResult {
  data: unknown;
  error: { message: string } | null;
}

interface ReceiptQueryBuilder {
  select(columns: string): {
    eq(
      column: string,
      value: string,
    ): {
      maybeSingle(): Promise<ReceiptLookupResult>;
    };
  };
}

interface ReceiptDatabaseClient {
  database: {
    from(table: string): ReceiptQueryBuilder;
  };
}

interface GetReceiptHandlerDependencies {
  getEnv: GetEnv;
  logger: Logger;
  createAdminClient(options: {
    baseUrl: string;
    apiKey: string;
  }): ReceiptDatabaseClient;
}

interface HeliusWebhookHandlerDependencies {
  getEnv: GetEnv;
  logger: Logger;
  verifyAndPersist(input: VerifyEventInput): Promise<VerificationResult>;
}

type HeliusWebhookVerificationResult =
  | {
      signature: string;
      status: "verified";
      result: VerificationResult;
    }
  | {
      signature: string;
      status: "failed";
      error: "Verification failed";
    };

export function createVerifyEventHandler({
  getEnv,
  logger,
  verifyAndPersist,
}: VerifyEventHandlerDependencies): (request: Request) => Promise<Response> {
  const responseHeaders = corsHeaders(["POST", "OPTIONS"]);

  return async function handler(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") {
      return optionsResponse(responseHeaders);
    }
    if (request.method !== "POST") {
      return errorResponse("Method not allowed", 405, responseHeaders);
    }

    let input: VerifyEventInput;
    try {
      const body: unknown = await request.json();
      const validation = validateVerifyEventInput(body);
      if (!validation.ok) {
        return errorResponse(validation.error, 400, responseHeaders);
      }
      const serverRpcInput = applyServerRpcUrl(
        validation.value,
        getEnv("SOLANA_RPC_URL"),
      );
      if (!serverRpcInput.ok) {
        logger.error(
          "EventSeal verification configuration invalid",
          serverRpcInput.error,
        );
        return errorResponse(
          "Verification is not configured",
          500,
          responseHeaders,
        );
      }
      input = serverRpcInput.value;
    } catch {
      return errorResponse(
        "Request body must be valid JSON",
        400,
        responseHeaders,
      );
    }

    try {
      const result = await verifyAndPersist(input);
      return jsonResponse(result, 200, responseHeaders);
    } catch (error) {
      logger.error("EventSeal verification failed", error);
      return errorResponse("Verification failed", 500, responseHeaders);
    }
  };
}

export function createGetReceiptHandler({
  createAdminClient,
  getEnv,
  logger,
}: GetReceiptHandlerDependencies): (request: Request) => Promise<Response> {
  const responseHeaders = corsHeaders(["GET", "OPTIONS"]);

  return async function handler(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") return optionsResponse(responseHeaders);
    if (request.method !== "GET")
      return errorResponse("Method not allowed", 405, responseHeaders);

    const receiptId = validateReceiptId(
      new URL(request.url).searchParams.get("receiptId"),
    );
    if (!receiptId.ok)
      return errorResponse(receiptId.error, 400, responseHeaders);

    const baseUrl = getEnv("INSFORGE_BASE_URL");
    const apiKey = getEnv("INSFORGE_API_KEY");
    if (!baseUrl || !apiKey) {
      return errorResponse(
        "Receipt storage is not configured",
        500,
        responseHeaders,
      );
    }

    try {
      const client = createAdminClient({
        baseUrl,
        apiKey,
      });
      const { data, error } = await client.database
        .from("verification_receipts")
        .select("*")
        .eq("receipt_id", receiptId.value)
        .maybeSingle();

      if (error) {
        logger.error("EventSeal receipt lookup failed", error);
        return errorResponse("Receipt lookup failed", 500, responseHeaders);
      }
      if (data === null || data === undefined)
        return errorResponse("Receipt not found", 404, responseHeaders);
      return jsonResponse(data, 200, responseHeaders);
    } catch (error) {
      logger.error("EventSeal receipt lookup failed", error);
      return errorResponse("Receipt lookup failed", 500, responseHeaders);
    }
  };
}

export function createHeliusWebhookHandler({
  getEnv,
  logger,
  verifyAndPersist,
}: HeliusWebhookHandlerDependencies): (request: Request) => Promise<Response> {
  const responseHeaders = corsHeaders(
    ["POST", "OPTIONS"],
    ["X-EventSeal-Webhook-Secret"],
  );

  return async function handler(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") {
      return optionsResponse(responseHeaders);
    }
    if (request.method !== "POST") {
      return errorResponse("Method not allowed", 405, responseHeaders);
    }

    const webhookSecret = getEnv("EVENTSEAL_WEBHOOK_SECRET");
    if (!webhookSecret || webhookSecret.trim().length === 0) {
      return errorResponse(
        "Webhook authentication is not configured",
        500,
        responseHeaders,
      );
    }
    if (
      !timingSafeEqual(
        request.headers.get("X-EventSeal-Webhook-Secret") ?? "",
        webhookSecret,
      )
    ) {
      return errorResponse("Unauthorized", 401, responseHeaders);
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return errorResponse(
        "Request body must be valid JSON",
        400,
        responseHeaders,
      );
    }
    const payloadValidation = validateHeliusPayload(payload);
    if (!payloadValidation.ok) {
      return errorResponse(payloadValidation.error, 400, responseHeaders);
    }
    if (payloadValidation.value.length > HELIUS_WEBHOOK_MAX_SIGNATURES) {
      return errorResponse(
        `Webhook payload must include no more than ${HELIUS_WEBHOOK_MAX_SIGNATURES} unique signatures`,
        400,
        responseHeaders,
      );
    }

    try {
      const configuration = readHeliusConfiguration(getEnv);
      const results = await mapWithConcurrency(
        payloadValidation.value,
        HELIUS_WEBHOOK_VERIFY_CONCURRENCY,
        async (signature): Promise<HeliusWebhookVerificationResult> => {
          try {
            return {
              signature,
              status: "verified",
              result: await verifyAndPersist({ ...configuration, signature }),
            };
          } catch (error) {
            logger.error("EventSeal webhook signature verification failed", {
              error,
              signature,
            });
            return {
              signature,
              status: "failed",
              error: "Verification failed",
            };
          }
        },
      );

      return jsonResponse(
        {
          failed: results.filter((result) => result.status === "failed").length,
          processed: results.length,
          results,
        },
        200,
        responseHeaders,
      );
    } catch (error) {
      logger.error("EventSeal webhook processing failed", error);
      return errorResponse("Webhook processing failed", 500, responseHeaders);
    }
  };
}

function readHeliusConfiguration(
  getEnv: GetEnv,
): Omit<VerifyEventInput, "signature"> {
  const configuration = validateWebhookConfiguration({
    EVENTSEAL_CLUSTER: getEnv("EVENTSEAL_CLUSTER"),
    EVENTSEAL_EXPECTED_PROGRAM_ID: getEnv("EVENTSEAL_EXPECTED_PROGRAM_ID"),
    EVENTSEAL_EVENT_FORMAT: getEnv("EVENTSEAL_EVENT_FORMAT"),
    EVENTSEAL_EVENT_DISCRIMINATOR: getEnv("EVENTSEAL_EVENT_DISCRIMINATOR"),
    SOLANA_RPC_URL: getEnv("SOLANA_RPC_URL"),
  });

  if (!configuration.ok) {
    throw new Error(configuration.error);
  }

  return configuration.value;
}

function timingSafeEqual(left: string, right: string): boolean {
  const leftBytes = WEBHOOK_SECRET_ENCODER.encode(left);
  const rightBytes = WEBHOOK_SECRET_ENCODER.encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return difference === 0;
}

async function mapWithConcurrency<T, U>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T) => Promise<U>,
): Promise<U[]> {
  const results: U[] = new Array(items.length);
  let nextIndex = 0;

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (true) {
        const index = nextIndex;
        nextIndex += 1;

        if (index >= items.length) return;
        results[index] = await mapper(items[index] as T);
      }
    },
  );

  await Promise.all(workers);
  return results;
}
