"use client";

export default function DashboardError({ reset }: { reset: () => void }) {
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
