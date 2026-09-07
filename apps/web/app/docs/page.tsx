import type { Metadata } from "next";

import { DeveloperDocs } from "../../components/developer-docs";

export const metadata: Metadata = {
  title: "EventSeal",
  description:
    "Integrate EventSeal inspection, verification verdicts, and public Solana event receipts.",
};

export default function DocsPage() {
  return <DeveloperDocs />;
}
