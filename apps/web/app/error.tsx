"use client";

export default function ErrorBoundary({ reset }: { reset: () => void }) {
  return (
    <main className="boundary-page">
      <div className="boundary-page__content">
        <h1>The verifier could not load.</h1>
        <p>
          Your request has not been submitted. Try loading the screen again.
        </p>
        <button
          className="primary-button boundary-page__button"
          onClick={reset}
        >
          Try again
        </button>
      </div>
    </main>
  );
}
