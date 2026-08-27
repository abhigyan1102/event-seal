import { createAuthActions } from "@insforge/sdk/ssr";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getAuthConfig } from "../../../../lib/auth-config";
import { OAUTH_PKCE_COOKIE } from "../../../../lib/auth-constants";
import { authCookieOptions } from "../../../../lib/auth-server";
import { parseOAuthCallback } from "../../../../lib/oauth-boundary";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  let config;
  try {
    config = getAuthConfig();
  } catch {
    return NextResponse.json(
      { error: "OAuth is not configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const successUrl = new URL("/verify?auth=signed_in", config.appUrl);
  const failureUrl = new URL("/verify?auth=oauth_failed", config.appUrl);
  const response = NextResponse.redirect(successUrl);
  response.headers.set("Cache-Control", "no-store");

  const callback = parseOAuthCallback(
    request.nextUrl.searchParams,
    request.cookies.get(OAUTH_PKCE_COOKIE)?.value,
  );
  if (!callback) {
    response.headers.set("Location", failureUrl.toString());
    clearPkceCookie(response, config.secureCookies);
    return response;
  }

  try {
    const auth = createAuthActions({
      baseUrl: config.baseUrl,
      anonKey: config.anonKey,
      requestCookies: request.cookies,
      responseCookies: response.cookies,
      options: authCookieOptions(config.secureCookies),
    });
    const { error } = await auth.exchangeOAuthCode(
      callback.code,
      callback.verifier,
    );
    if (error) response.headers.set("Location", failureUrl.toString());
  } catch {
    response.headers.set("Location", failureUrl.toString());
  }

  clearPkceCookie(response, config.secureCookies);
  return response;
}

function clearPkceCookie(response: NextResponse, secure: boolean): void {
  response.cookies.set(OAUTH_PKCE_COOKIE, "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/api/auth/callback",
    expires: new Date(0),
    maxAge: 0,
  });
}
