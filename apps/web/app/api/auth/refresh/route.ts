import { createRefreshAuthRouter } from "@insforge/sdk/ssr";

import { getAuthConfig } from "../../../../lib/auth-config";
import { authCookieOptions } from "../../../../lib/auth-server";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    const config = getAuthConfig();
    const router = createRefreshAuthRouter({
      baseUrl: config.baseUrl,
      anonKey: config.anonKey,
      options: authCookieOptions(config.secureCookies),
    });
    return await router.POST(request);
  } catch {
    return Response.json(
      { error: "Authentication is not configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
