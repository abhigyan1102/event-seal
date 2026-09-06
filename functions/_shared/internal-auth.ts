export const INTERNAL_API_SECRET_HEADER = "X-EventSeal-Internal-Secret";

type GetEnv = (name: string) => string | undefined;

export type InternalAuthenticationResult =
  | { ok: true }
  | {
      ok: false;
      error: "Internal authentication is not configured" | "Unauthorized";
      status: 401 | 500;
    };

const SECRET_ENCODER = new TextEncoder();

export async function authenticateInternalRequest(
  request: Request,
  getEnv: GetEnv,
): Promise<InternalAuthenticationResult> {
  const configuredSecret = getEnv("EVENTSEAL_INTERNAL_API_SECRET");
  if (!configuredSecret || configuredSecret.trim().length === 0) {
    return {
      ok: false,
      error: "Internal authentication is not configured",
      status: 500,
    };
  }

  const suppliedSecret = request.headers.get(INTERNAL_API_SECRET_HEADER) ?? "";
  if (!(await timingSafeSecretEqual(suppliedSecret, configuredSecret))) {
    return { ok: false, error: "Unauthorized", status: 401 };
  }

  return { ok: true };
}

export async function timingSafeSecretEqual(
  left: string,
  right: string,
): Promise<boolean> {
  const [leftDigest, rightDigest] = await Promise.all([
    sha256(left),
    sha256(right),
  ]);
  let difference = 0;

  for (let index = 0; index < leftDigest.length; index += 1) {
    difference |= (leftDigest[index] ?? 0) ^ (rightDigest[index] ?? 0);
  }

  return difference === 0;
}

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", SECRET_ENCODER.encode(value)),
  );
}
