import "server-only";

import { createServerClient } from "@insforge/sdk/ssr";
import { cookies } from "next/headers";

import { getAuthConfig } from "./auth-config";

export async function createAuthenticatedClient() {
  const config = getAuthConfig();
  return createServerClient({
    baseUrl: config.baseUrl,
    anonKey: config.anonKey,
    cookies: await cookies(),
    options: authCookieOptions(config.secureCookies),
  });
}

export async function getCurrentUser() {
  try {
    const client = await createAuthenticatedClient();
    const { data, error } = await client.auth.getCurrentUser();
    return error ? null : data.user;
  } catch {
    return null;
  }
}

export function authCookieOptions(secure: boolean) {
  return {
    accessToken: { secure, sameSite: "lax" as const, path: "/" },
    refreshToken: {
      secure,
      sameSite: "lax" as const,
      path: "/",
      httpOnly: true,
    },
  };
}
