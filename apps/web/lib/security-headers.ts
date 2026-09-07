export interface SecurityHeader {
  key: string;
  value: string;
}

export function createContentSecurityPolicy(
  nonce: string,
  environment: string | undefined = process.env.NODE_ENV,
): string {
  const isDevelopment = environment === "development";

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'` +
      (isDevelopment ? " 'unsafe-eval'" : ""),
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' blob: data:",
    "font-src 'self' data:",
    "connect-src 'self'" + (isDevelopment ? " ws:" : ""),
    "manifest-src 'self'",
    "media-src 'none'",
    "worker-src 'self' blob:",
  ].join("; ");
}

export function createSecurityHeaders(
  environment: string | undefined = process.env.NODE_ENV,
): SecurityHeader[] {
  const headers: SecurityHeader[] = [
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value:
        "browsing-topics=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
    },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
  ];

  if (environment === "production") {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  }

  return headers;
}
