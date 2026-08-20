const DEFAULT_ALLOWED_HEADERS = ["Content-Type", "Authorization"] as const;

export function corsHeaders(
  methods: readonly string[],
  extraAllowedHeaders: readonly string[] = [],
): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": methods.join(", "),
    "Access-Control-Allow-Headers": [
      ...DEFAULT_ALLOWED_HEADERS,
      ...extraAllowedHeaders,
    ].join(", "),
  };
}

export function optionsResponse(headers: Record<string, string>): Response {
  return new Response(null, { status: 204, headers });
}

export function jsonResponse(
  body: unknown,
  status: number,
  headers: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

export function errorResponse(
  error: string,
  status: number,
  headers: Record<string, string>,
): Response {
  return jsonResponse({ error }, status, headers);
}
