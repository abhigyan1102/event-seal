import type { Metadata } from "next";

import { ArcSettlementVerifier } from "../../components/arc-settlement-verifier";

export const metadata: Metadata = {
  title: "Arc USDC settlement | EventSeal",
  description:
    "Verify a finalized Arc USDC transfer against trusted sender, recipient, and amount expectations before releasing value.",
};

export default function ArcSettlementPage() {
  return <ArcSettlementVerifier />;
}
