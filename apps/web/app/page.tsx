import type { Metadata } from "next";

import { ProductHome } from "../components/product-home";

export const metadata: Metadata = {
  title: "EventSeal",
  description:
    "Check finalized Solana transaction evidence against trusted event identity and issue a shareable verification receipt.",
};

export default function HomePage() {
  return <ProductHome />;
}
