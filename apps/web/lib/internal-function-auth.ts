export const INTERNAL_API_SECRET_HEADER = "X-EventSeal-Internal-Secret";

export interface ProtectedFunctionInvokeOptions<T> {
  body: T;
  headers: Record<typeof INTERNAL_API_SECRET_HEADER, string>;
}

export function createProtectedFunctionInvokeOptions<T>(
  body: T,
  configuredSecret: string | undefined,
): ProtectedFunctionInvokeOptions<T> | null {
  if (!configuredSecret || configuredSecret.trim().length === 0) return null;

  return {
    body,
    headers: { [INTERNAL_API_SECRET_HEADER]: configuredSecret },
  };
}
