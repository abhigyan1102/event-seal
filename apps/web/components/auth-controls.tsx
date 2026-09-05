import type { UserSchema } from "@insforge/sdk";

import { signInWithGitHub, signOut } from "../app/auth/actions";
import { ActiveNavLink } from "./active-nav-link";

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
      <ActiveNavLink className="nav-link--history" href="/dashboard">
        Dashboard
      </ActiveNavLink>
      <form action={signOut}>
        <button className="nav-auth__button" type="submit">
          Sign out
        </button>
      </form>
    </div>
  );
}
