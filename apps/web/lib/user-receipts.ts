import "server-only";

import { createAuthenticatedClient } from "./auth-server";
import type { DashboardFilters } from "./dashboard-filters";
import {
  isPublicReceipt,
  isStrictTimestamp,
  PUBLIC_RECEIPT_COLUMNS,
  type PublicReceipt,
} from "./public-receipt";
import { isReceiptId } from "./receipt-id";

export const DASHBOARD_PAGE_SIZE = 8;

export interface SavedReceipt {
  receiptId: string;
  savedAt: string;
  receipt: PublicReceipt;
}

export interface SavedReceiptPage {
  items: SavedReceipt[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function listSavedReceipts(
  filters: DashboardFilters = { verdict: "all", cluster: "all", page: 1 },
): Promise<SavedReceiptPage> {
  const client = await createAuthenticatedClient();
  let query = client.database
    .from("user_receipts")
    .select(
      `receipt_id,saved_at,verification_receipts!inner(${PUBLIC_RECEIPT_COLUMNS})`,
      { count: "exact" },
    )
    .order("saved_at", { ascending: false })
    .order("receipt_id", { ascending: true });

  if (filters.verdict !== "all") {
    query = query.eq("verification_receipts.verdict", filters.verdict);
  }
  if (filters.cluster !== "all") {
    query = query.eq("verification_receipts.cluster", filters.cluster);
  }

  const from = (filters.page - 1) * DASHBOARD_PAGE_SIZE;
  const to = from + DASHBOARD_PAGE_SIZE - 1;
  const { data, error, count } = await query.range(from, to);

  if (error || !Array.isArray(data) || !isValidCount(count)) {
    throw new Error("Saved receipts are unavailable");
  }

  const items = data.map(parseSavedReceiptRow);
  return {
    items,
    total: count,
    page: filters.page,
    pageSize: DASHBOARD_PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(count / DASHBOARD_PAGE_SIZE)),
  };
}

function parseSavedReceiptRow(value: unknown): SavedReceipt {
  if (
    !isRecord(value) ||
    typeof value.receipt_id !== "string" ||
    !isReceiptId(value.receipt_id) ||
    typeof value.saved_at !== "string" ||
    !isStrictTimestamp(value.saved_at)
  ) {
    throw new Error("Saved receipt data is invalid");
  }

  const relation: unknown = value.verification_receipts;
  const joinedReceipt: unknown = Array.isArray(relation)
    ? relation.length === 1
      ? relation[0]
      : null
    : relation;
  if (
    !isPublicReceipt(joinedReceipt) ||
    joinedReceipt.receipt_id !== value.receipt_id
  ) {
    throw new Error("Saved receipt data is invalid");
  }

  return {
    receiptId: value.receipt_id,
    savedAt: value.saved_at,
    receipt: joinedReceipt,
  };
}

function isValidCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
