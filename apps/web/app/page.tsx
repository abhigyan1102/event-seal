import type { Metadata } from "next";

import { ProductHome } from "../components/product-home";

export const metadata: Metadata = {
  title: "EventSeal — Verify Solana events before your backend acts",
  description:
    "Check finalized Solana transaction evidence against trusted event identity and issue a shareable verification receipt.",
};

export default function HomePage() {
  return <ProductHome />;
}
