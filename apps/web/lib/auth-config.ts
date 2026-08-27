import "server-only";

import { parseAuthConfig, type AuthConfig } from "./auth-config-values";

export function getAuthConfig(
  env: NodeJS.ProcessEnv = process.env,
): AuthConfig {
  return parseAuthConfig(env);
}
