export default function Loading() {
  return (
    <main className="boundary-page" aria-busy="true" aria-live="polite">
      <div className="boundary-page__content">
        <div className="loading-line loading-line--title" />
        <div className="loading-line" />
        <p>Preparing the verifier.</p>
      </div>
    </main>
  );
}
