"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function ActiveNavLink({
  children,
  className = "",
  href,
}: {
  children: ReactNode;
  className?: string;
  href: Route;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`nav-link${active ? " nav-link--active" : ""}${className ? ` ${className}` : ""}`}
      href={href}
    >
      {children}
    </Link>
  );
}
