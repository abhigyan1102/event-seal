export default function DashboardLoading() {
  return (
    <main className="dashboard-boundary" aria-busy="true" aria-live="polite">
      <div className="dashboard-boundary__content">
        <div className="loading-line loading-line--title" />
        <div className="loading-line" />
        <p>Preparing your receipt dashboard.</p>
      </div>
    </main>
  );
}
