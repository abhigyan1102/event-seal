import type { UserSchema } from "@insforge/sdk";
import Link from "next/link";

import { signInWithGitHub, signOut } from "../app/auth/actions";

export function AuthControls({ user }: { user: UserSchema | null }) {
  if (!user) {
    return (
      <form className="nav-auth" action={signInWithGitHub}>
        <button className="nav-auth__button" type="submit">
          Sign in with GitHub
        </button>
      </form>
    );
  }

  return (
    <div className="nav-auth">
      <Link className="nav-link nav-link--history" href="/history">
        History
      </Link>
      <form action={signOut}>
        <button className="nav-auth__button" type="submit">
          Sign out
        </button>
      </form>
    </div>
  );
}
