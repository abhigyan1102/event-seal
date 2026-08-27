const MIN_PKCE_VERIFIER_LENGTH = 43;
const MAX_PKCE_VERIFIER_LENGTH = 128;
const MAX_OAUTH_CODE_LENGTH = 2_048;

export interface OAuthStartData {
  url: `${string}:${string}`;
  codeVerifier: string;
}

export interface OAuthCallbackData {
  code: string;
  verifier: string;
}

export function parseOAuthStart(
  value: { url?: unknown; codeVerifier?: unknown } | null | undefined,
): OAuthStartData | null {
  if (
    typeof value?.url !== "string" ||
    !isHttpsUrl(value.url) ||
    typeof value.codeVerifier !== "string" ||
    !isValidVerifier(value.codeVerifier)
  ) {
    return null;
  }
  return {
    url: value.url as `${string}:${string}`,
    codeVerifier: value.codeVerifier,
  };
}

export function parseOAuthCallback(
  searchParams: URLSearchParams,
  verifier: string | undefined,
): OAuthCallbackData | null {
  const code = searchParams.get("insforge_code");
  if (
    searchParams.has("error") ||
    !code ||
    code.length > MAX_OAUTH_CODE_LENGTH ||
    !verifier ||
    !isValidVerifier(verifier)
  ) {
    return null;
  }
  return { code, verifier };
}

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "github.com" &&
      url.pathname === "/login/oauth/authorize"
    );
  } catch {
    return false;
  }
}

function isValidVerifier(value: string): boolean {
  return (
    value.length >= MIN_PKCE_VERIFIER_LENGTH &&
    value.length <= MAX_PKCE_VERIFIER_LENGTH
  );
}
