import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  listSavedReceipts: vi.fn(),
  dashboardView: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("../../lib/auth-server", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));
vi.mock("../../lib/user-receipts", () => ({
  listSavedReceipts: mocks.listSavedReceipts,
}));
vi.mock("../../components/dashboard-view", () => ({
  DashboardView: (props: unknown) => {
    mocks.dashboardView(props);
    return <div>Account receipt ledger</div>;
  },
}));
vi.mock("../auth/actions", () => ({
  signInWithGitHub: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import DashboardPage from "./page";

const receiptPage = {
  items: [],
  total: 16,
  page: 2,
  pageSize: 8,
  totalPages: 2,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ id: "signed-in-user" });
  mocks.listSavedReceipts.mockResolvedValue(receiptPage);
});

describe("DashboardPage", () => {
  it("requires authentication before reading private receipt history", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const page = await DashboardPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(page);

    expect(html).toContain("Your saved evidence stays tied to your account.");
    expect(html).toContain("Sign in with GitHub");
    expect(mocks.listSavedReceipts).not.toHaveBeenCalled();
  });

  it("passes canonical filters and the bounded result to the dashboard", async () => {
    const page = await DashboardPage({
      searchParams: Promise.resolve({
        verdict: "rejected",
        cluster: "devnet",
        page: "2",
        user_id: "another-user",
      }),
    });
    expect(renderToStaticMarkup(page)).toContain("Account receipt ledger");
    expect(mocks.listSavedReceipts).toHaveBeenCalledWith({
      verdict: "rejected",
      cluster: "devnet",
      page: 2,
    });
    expect(mocks.dashboardView).toHaveBeenCalledWith({
      filters: { verdict: "rejected", cluster: "devnet", page: 2 },
      receiptPage,
    });
  });

  it("fails closed without exposing backend errors", async () => {
    mocks.listSavedReceipts.mockRejectedValue(
      new Error("private database details"),
    );
    const page = await DashboardPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(page);

    expect(html).toContain("Saved receipts are unavailable.");
    expect(html).toContain("No receipt data was displayed");
    expect(html).not.toContain("private database details");
  });

  it("redirects an out-of-range page to the final bounded page", async () => {
    mocks.listSavedReceipts.mockResolvedValue({
      items: [],
      total: 1,
      page: 9,
      pageSize: 8,
      totalPages: 1,
    });

    await expect(
      DashboardPage({
        searchParams: Promise.resolve({
          verdict: "verified",
          cluster: "devnet",
          page: "9",
        }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith(
      "/dashboard?verdict=verified&cluster=devnet",
    );
  });
});
