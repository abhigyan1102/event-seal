import { updateSession } from "@insforge/sdk/ssr/middleware";
import type { CookieStore } from "@insforge/sdk/ssr";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getAuthConfig } from "./lib/auth-config";
import { authCookieOptions } from "./lib/auth-server";
import { createContentSecurityPolicy } from "./lib/security-headers";

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const contentSecurityPolicy = createContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);

  try {
    const config = getAuthConfig();
    await updateSession({
      baseUrl: config.baseUrl,
      anonKey: config.anonKey,
      // The SDK writes refreshed values into the current request so Server
      // Components observe the same session as the outgoing response.
      requestCookies: request.cookies as unknown as CookieStore,
      responseCookies: response.cookies,
      options: authCookieOptions(config.secureCookies),
    });
  } catch {
    // Pages remain available anonymously when auth is not configured.
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
