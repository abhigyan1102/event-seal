import Link from "next/link";
import { redirect } from "next/navigation";

import { signInWithGitHub } from "../auth/actions";
import { DashboardView } from "../../components/dashboard-view";
import { getCurrentUser } from "../../lib/auth-server";
import {
  dashboardHref,
  parseDashboardFilters,
} from "../../lib/dashboard-filters";
import {
  listSavedReceipts,
  type SavedReceiptPage,
} from "../../lib/user-receipts";

interface DashboardPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <main className="dashboard-boundary">
        <div className="dashboard-boundary__content">
          <p className="eyebrow">Private account dashboard</p>
          <h1>Your saved evidence stays tied to your account.</h1>
          <p>
            Verification remains public. Sign in only when you want a private,
            reusable list of receipt references.
          </p>
          <form action={signInWithGitHub}>
            <button className="primary-button" type="submit">
              Sign in with GitHub
            </button>
          </form>
        </div>
      </main>
    );
  }

  const filters = parseDashboardFilters(await searchParams);
  let receiptPage: SavedReceiptPage;
  try {
    receiptPage = await listSavedReceipts(filters);
  } catch {
    return (
      <main className="dashboard-boundary">
        <div className="dashboard-boundary__content" role="alert">
          <p className="eyebrow">Private account dashboard</p>
          <h1>Saved receipts are unavailable.</h1>
          <p>
            EventSeal could not load your private history. No receipt data was
            displayed from an incomplete response.
          </p>
          <Link className="primary-button" href="/dashboard">
            Try again
          </Link>
        </div>
      </main>
    );
  }

  if (filters.page > receiptPage.totalPages) {
    redirect(
      dashboardHref(
        filters,
        receiptPage.total === 0 ? 1 : receiptPage.totalPages,
      ),
    );
  }

  return (
    <DashboardView
      filters={filters}
      key={`${filters.verdict}:${filters.cluster}:${filters.page}`}
      receiptPage={receiptPage}
    />
  );
}
