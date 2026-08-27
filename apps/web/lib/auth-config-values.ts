const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

export interface AuthConfig {
  baseUrl: string;
  anonKey: string;
  appUrl: string;
  secureCookies: boolean;
}

export function parseAuthConfig(
  env: Readonly<Record<string, string | undefined>>,
): AuthConfig {
  const baseUrl = parseServiceUrl(env.INSFORGE_BASE_URL, "INSFORGE_BASE_URL");
  const anonKey = env.INSFORGE_ANON_KEY?.trim();
  if (!anonKey) {
    throw new Error("INSFORGE_ANON_KEY is not configured");
  }

  const configuredAppUrl = env.EVENTSEAL_APP_URL?.trim();
  if (!configuredAppUrl && env.NODE_ENV === "production") {
    throw new Error("EVENTSEAL_APP_URL is not configured");
  }

  const appUrl = parseAppUrl(
    configuredAppUrl || "http://localhost:3000",
    "EVENTSEAL_APP_URL",
  );

  return {
    baseUrl,
    anonKey: anonKey.trim(),
    appUrl,
    secureCookies: new URL(appUrl).protocol === "https:",
  };
}

function parseServiceUrl(value: string | undefined, name: string): string {
  if (!value?.trim()) throw new Error(`${name} is not configured`);
  return parseAppUrl(value, name);
}

function parseAppUrl(value: string, name: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }

  const isLocalHttp =
    url.protocol === "http:" && LOCAL_HOSTNAMES.has(url.hostname);
  if (url.protocol !== "https:" && !isLocalHttp) {
    throw new Error(`${name} must use HTTPS outside local development`);
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(`${name} must be an origin without credentials or a query`);
  }
  if (url.pathname !== "/") {
    throw new Error(`${name} must not include a path`);
  }

  return url.toString().replace(/\/$/, "");
}
