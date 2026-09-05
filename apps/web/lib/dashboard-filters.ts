import type { SolanaCluster, VerificationVerdict } from "@eventseal/sdk";
import type { Route } from "next";

const MAX_DASHBOARD_PAGE = 10_000;

export type DashboardVerdict = "all" | VerificationVerdict;
export type DashboardCluster = "all" | SolanaCluster;

export interface DashboardFilters {
  verdict: DashboardVerdict;
  cluster: DashboardCluster;
  page: number;
}

type SearchParams = Record<string, string | string[] | undefined>;

export function parseDashboardFilters(
  searchParams: SearchParams,
): DashboardFilters {
  return {
    verdict: parseVerdict(singleValue(searchParams.verdict)),
    cluster: parseCluster(singleValue(searchParams.cluster)),
    page: parsePage(singleValue(searchParams.page)),
  };
}

export function dashboardHref(filters: DashboardFilters, page: number): Route {
  const params = new URLSearchParams();
  if (filters.verdict !== "all") params.set("verdict", filters.verdict);
  if (filters.cluster !== "all") params.set("cluster", filters.cluster);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return (query ? `/dashboard?${query}` : "/dashboard") as Route;
}

function singleValue(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function parseVerdict(value: string | undefined): DashboardVerdict {
  return value === "verified" ||
    value === "rejected" ||
    value === "indeterminate"
    ? value
    : "all";
}

function parseCluster(value: string | undefined): DashboardCluster {
  return value === "mainnet-beta" || value === "devnet" || value === "testnet"
    ? value
    : "all";
}

function parsePage(value: string | undefined): number {
  if (!value || !/^\d+$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 && page <= MAX_DASHBOARD_PAGE
    ? page
    : 1;
}
