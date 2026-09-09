"use client";

import { usePathname } from "next/navigation";
import { useState, type MouseEvent, type ReactNode } from "react";

type PendingNavigation = {
  fromPath: string;
  targetPath: string;
};

const ROUTE_LABELS: Record<string, string> = {
  "/": "Opening the EventSeal overview.",
  "/docs": "Opening the developer guide.",
  "/verify": "Opening the verifier.",
};

function internalDestination(event: MouseEvent<HTMLDivElement>) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }

  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const anchor = target.closest<HTMLAnchorElement>("a[href]");
  if (
    !anchor ||
    anchor.target === "_blank" ||
    anchor.hasAttribute("download")
  ) {
    return;
  }

  const destination = new URL(anchor.href, window.location.href);
  const current = new URL(window.location.href);

  if (
    destination.origin !== current.origin ||
    destination.pathname === current.pathname
  ) {
    return;
  }

  return `${destination.pathname}${destination.search}`;
}

export function RouteTransitionBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [pending, setPending] = useState<PendingNavigation>();
  const activePending = pending?.fromPath === pathname ? pending : undefined;

  function handleNavigation(event: MouseEvent<HTMLDivElement>) {
    const targetPath = internalDestination(event);
    if (!targetPath) {
      return;
    }

    setPending({ fromPath: pathname, targetPath });
  }

  const routeLabel = activePending
    ? (ROUTE_LABELS[
        new URL(activePending.targetPath, window.location.href).pathname
      ] ?? "Opening EventSeal.")
    : undefined;

  return (
    <div
      className="route-transition-boundary"
      data-navigation-pending={activePending ? "true" : undefined}
      onClickCapture={handleNavigation}
    >
      <div
        className="route-transition-boundary__current"
        aria-hidden={activePending ? true : undefined}
        inert={activePending ? true : undefined}
      >
        {children}
      </div>
      {routeLabel && (
        <div
          className="route-transition"
          role="status"
          aria-label={routeLabel}
          aria-live="polite"
        >
          <div className="route-transition__bar">EventSeal</div>
          <div className="route-transition__body">
            <p>{routeLabel}</p>
            <span aria-hidden="true" />
          </div>
        </div>
      )}
    </div>
  );
}
