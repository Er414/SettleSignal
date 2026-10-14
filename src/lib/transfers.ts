export function liveTransferKey(network: string, hash: string): string {
  return `live:${network}:${hash.trim().toLowerCase()}`;
}

export function demoTransferKey(invoiceId: string, fixtureId: string): string {
  return `demo:${invoiceId}:${fixtureId}`;
}

export function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if ("code" in error && (error as { code?: string }).code === "23505") return true;
  if ("cause" in error) return isUniqueViolation((error as { cause?: unknown }).cause);
  return false;
}
