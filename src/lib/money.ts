const MAX_CENTS = 1_000_000_000;

export function formatUsdc(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(cents));
  const whole = Math.floor(abs / 100).toString();
  const frac = String(abs % 100).padStart(2, "0");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${grouped}.${frac}`;
}

export function centsToInput(cents: number): string {
  const abs = Math.abs(Math.trunc(cents));
  return `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export function parseUsdcToCents(input: string): number | null {
  const trimmed = input.trim().replace(/,/g, "").replace(/^\$/, "");
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  const cents = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > MAX_CENTS) return null;
  return cents;
}

const ZERO = BigInt(0);
const NATIVE_CENT = BigInt("10000000000000000");

export function nativeUnitsToCents(value: bigint): number {
  if (value <= ZERO) return 0;
  const cents = value / NATIVE_CENT;
  const asNumber = Number(cents);
  if (!Number.isSafeInteger(asNumber)) return -1;
  return asNumber;
}

export function remainingCents(amountCents: number, paidCents: number): number {
  return Math.max(0, Math.trunc(amountCents) - Math.trunc(paidCents));
}

export function overpaidCents(amountCents: number, paidCents: number): number {
  return Math.max(0, Math.trunc(paidCents) - Math.trunc(amountCents));
}
