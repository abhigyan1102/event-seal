import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { PublicReceiptBoundary } from "../../../components/public-receipt-boundary";
import { PublicReceiptView } from "../../../components/public-receipt-view";
import { getAuthConfig } from "../../../lib/auth-config";
import { getCurrentUser } from "../../../lib/auth-server";
import {
  loadPublicReceipt,
  type PublicReceipt,
} from "../../../lib/public-receipt";

export const runtime = "nodejs";

const lookupReceipt = cache(loadPublicReceipt);

interface ReceiptPageProps {
  params: Promise<{ receiptId: string }>;
}

export async function generateMetadata({
  params,
}: ReceiptPageProps): Promise<Metadata> {
  const { receiptId } = await params;
  const lookup = await lookupReceipt(receiptId);
  if (lookup.status !== "found") {
    const title =
      lookup.status === "missing"
        ? "Receipt not found — EventSeal"
        : lookup.status === "malformed"
          ? "Invalid receipt link — EventSeal"
          : "Receipt unavailable — EventSeal";
    return { title, robots: { index: false, follow: false } };
  }

  const title = metadataTitle(lookup.receipt);
  const description = metadataDescription(lookup.receipt);
  const url = receiptUrl(receiptId);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title,
      description,
      url,
      siteName: "EventSeal",
    },
  };
}

export default async function ReceiptPage({ params }: ReceiptPageProps) {
  const { receiptId } = await params;
  const lookup = await lookupReceipt(receiptId);

  if (lookup.status === "malformed") {
    return <PublicReceiptBoundary state="malformed" />;
  }
  if (lookup.status === "missing") notFound();
  if (lookup.status === "unavailable") {
    return <PublicReceiptBoundary state="unavailable" />;
  }

  const user = await getCurrentUser();
  return (
    <PublicReceiptView
      receipt={lookup.receipt}
      shareUrl={receiptUrl(receiptId)}
      signedIn={Boolean(user)}
    />
  );
}

function metadataTitle(receipt: PublicReceipt): string {
  if (receipt.verdict === "verified")
    return "Verified Solana event — EventSeal";
  if (receipt.verdict === "rejected")
    return "Rejected Solana event — EventSeal";
  return "Inconclusive Solana event receipt — EventSeal";
}

function metadataDescription(receipt: PublicReceipt): string {
  if (receipt.receipt_version === 2) return receipt.reason;
  return `Public legacy EventSeal receipt with a ${receipt.verdict} verdict on ${receipt.cluster}.`;
}

function receiptUrl(receiptId: string): string {
  const { appUrl } = getAuthConfig();
  return new URL(
    `/receipts/${encodeURIComponent(receiptId)}`,
    appUrl,
  ).toString();
}
