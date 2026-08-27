import { VerifyWorkspace } from "../../components/verify-workspace";
import { getCurrentUser } from "../../lib/auth-server";

const AUTH_MESSAGES: Record<string, string> = {
  signed_in: "Signed in with GitHub. You can now save issued receipts.",
  oauth_failed: "GitHub sign-in could not be completed. Please try again.",
  oauth_unavailable: "GitHub sign-in is temporarily unavailable.",
};

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ auth?: string }>;
}) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);
  const authMessage = params.auth ? AUTH_MESSAGES[params.auth] : undefined;

  return (
    <>
      {authMessage && (
        <p className="auth-notice" role="status">
          {authMessage}
        </p>
      )}
      <VerifyWorkspace signedIn={Boolean(user)} />
    </>
  );
}
