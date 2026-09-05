"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (error.digest) {
      console.error("Dashboard error digest:", error.digest);
    }
  }, [error]);

  return (
    <main className="dashboard-boundary">
      <div className="dashboard-boundary__content">
        <p className="eyebrow">Private account dashboard</p>
        <h1>The dashboard could not load.</h1>
        <p>
          No receipt data was changed. Try loading your saved evidence again.
        </p>
        <button className="primary-button" type="button" onClick={reset}>
          Try again
        </button>
      </div>
    </main>
  );
}
