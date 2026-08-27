const RECEIPT_ID_PATTERN = /^es_[0-9a-f]{64}$/;

export function isReceiptId(value: string): boolean {
  return RECEIPT_ID_PATTERN.test(value);
}
