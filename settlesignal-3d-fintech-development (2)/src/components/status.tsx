import { STATUS_LABEL, type PaymentStatus, type VerificationLabel } from "@/lib/types";

export function StatusPill({ status, pastDue = false }: { status: PaymentStatus; pastDue?: boolean }) {
  const extra = pastDue && status !== "overdue" && status !== "paid" && status !== "draft" && status !== "archived" ? " · past due" : "";
  return <span className={`pill pill-${status}`}>{STATUS_LABEL[status]}{extra}</span>;
}

const VERIFY_TEXT: Record<VerificationLabel, string | null> = {
  none: null,
  demo: "Demo record",
  live: "Verified on Arc",
  "live-partial": "Partial Arc verification",
  pending: "Unverified hash",
};

export function VerificationBadge({ label }: { label: VerificationLabel }) {
  const text = VERIFY_TEXT[label];
  if (!text) return null;
  return <span className={`badge badge-${label}`}>{text}</span>;
}
