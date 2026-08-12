import { createClient } from "@insforge/sdk";
import type { VerificationResult, VerifyEventInput } from "@eventseal/sdk";

const baseUrl = import.meta.env["VITE_INSFORGE_URL"] as string | undefined;
const anonKey = import.meta.env["VITE_INSFORGE_ANON_KEY"] as string | undefined;

export async function requestVerification(
  input: VerifyEventInput,
): Promise<VerificationResult> {
  if (!baseUrl || !anonKey) {
    throw new Error(
      "Set VITE_INSFORGE_URL and VITE_INSFORGE_ANON_KEY before using the hosted verifier.",
    );
  }

  const client = createClient({ baseUrl, anonKey });
  const { data, error } = await client.functions.invoke<VerificationResult>(
    "verify-event",
    {
      body: input,
    },
  );

  if (error) throw new Error(error.message);
  if (!data) throw new Error("The verifier returned an empty response.");
  return data;
}
