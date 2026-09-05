import Link from "next/link";

const boundaryCopy = {
  malformed: {
    title: "Receipt link is invalid.",
    message:
      "EventSeal receipt IDs begin with es_ followed by 64 lowercase hexadecimal characters.",
  },
  unavailable: {
    title: "Receipt lookup is unavailable.",
    message:
      "The receipt could not be checked safely. Try again before relying on this link.",
  },
  missing: {
    title: "Receipt not found.",
    message:
      "No public receipt exists for this ID. Check the complete link or verify the transaction again.",
  },
} as const;

export function PublicReceiptBoundary({
  state,
}: {
  state: keyof typeof boundaryCopy;
}) {
  const copy = boundaryCopy[state];

  return (
    <main className={`receipt-boundary receipt-boundary--${state}`}>
      <div className="receipt-boundary__content">
        <div className="receipt-boundary__mark" aria-hidden="true">
          <span />
          <span />
        </div>
        <h1>{copy.title}</h1>
        <p>{copy.message}</p>
        <Link className="receipt-boundary__action" href="/verify">
          Verify a transaction
        </Link>
      </div>
    </main>
  );
}
