import "@fontsource-variable/outfit";
import "@fontsource-variable/geist";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { AuthControls } from "../components/auth-controls";
import { ActiveNavLink } from "../components/active-nav-link";
import { getCurrentUser } from "../lib/auth-server";

import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "EventSeal — Verify Solana events",
  description:
    "Inspect finalized transaction evidence before your backend acts on a Solana event.",
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <html lang="en">
      <body>
        <header className="global-nav">
          <nav className="global-nav__inner" aria-label="Primary navigation">
            <Link
              className="brand"
              href="/verify"
              aria-label="EventSeal verifier"
            >
              EventSeal
            </Link>
            <ActiveNavLink href="/verify">Verify</ActiveNavLink>
            <a
              className="nav-link nav-link--external"
              href="https://github.com/abhigyan1102/event-seal"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
              <span aria-hidden="true">↗</span>
            </a>
            <AuthControls user={user} />
          </nav>
        </header>
        <div className="app-shell">{children}</div>
        <footer className="site-footer">
          <div className="site-footer__inner">
            <strong>EventSeal</strong>
            <a
              href="https://github.com/abhigyan1102/event-seal"
              target="_blank"
              rel="noreferrer"
            >
              GitHub <span aria-hidden="true">↗</span>
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
