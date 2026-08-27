"use server";

import { createAuthActions } from "@insforge/sdk/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getAuthConfig } from "../../lib/auth-config";
import { OAUTH_PKCE_COOKIE } from "../../lib/auth-constants";
import { authCookieOptions } from "../../lib/auth-server";
import { parseOAuthStart } from "../../lib/oauth-boundary";

export async function signInWithGitHub(): Promise<never> {
  let destination: `${string}:${string}`;
  let verifier: string;
  let secureCookies: boolean;
  let cookieStore: Awaited<ReturnType<typeof cookies>>;

  try {
    const config = getAuthConfig();
    secureCookies = config.secureCookies;
    cookieStore = await cookies();
    const auth = createAuthActions({
      baseUrl: config.baseUrl,
      anonKey: config.anonKey,
      cookies: cookieStore,
      options: authCookieOptions(config.secureCookies),
    });
    const { data, error } = await auth.signInWithOAuth({
      provider: "github",
      redirectTo: new URL("/api/auth/callback", config.appUrl).toString(),
      skipBrowserRedirect: true,
    });

    const start = parseOAuthStart(data);
    if (error || !start) {
      throw new Error("OAuth initialization failed");
    }
    destination = start.url;
    verifier = start.codeVerifier;
  } catch {
    redirect("/verify?auth=oauth_unavailable");
  }

  cookieStore.set(OAUTH_PKCE_COOKIE, verifier, {
    httpOnly: true,
    secure: secureCookies,
    sameSite: "lax",
    path: "/api/auth/callback",
    maxAge: 10 * 60,
  });
  redirect(destination);
}

export async function signOut(): Promise<never> {
  try {
    const config = getAuthConfig();
    const auth = createAuthActions({
      baseUrl: config.baseUrl,
      anonKey: config.anonKey,
      cookies: await cookies(),
      options: authCookieOptions(config.secureCookies),
    });
    await auth.signOut();
  } finally {
    redirect("/verify");
  }
}
