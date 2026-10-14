import Link from "next/link";
import { formatLongDate } from "@/lib/dates";
import { formatUsdc } from "@/lib/money";
import { networkById } from "@/lib/arc";
import type { WorkspaceData } from "@/lib/types";

export function ReceiptsView({ data }: { data: WorkspaceData }) {
  const records = data.invoices.flatMap((invoice) => invoice.payments.map((payment) => ({ invoice, payment })));
  const receipts = records.filter((item) => item.payment.countsTowardBalance && (item.payment.kind === "live" || item.payment.kind === "demo"));
  const attempts = records.filter((item) => !item.payment.countsTowardBalance);
  return (
    <section>
      <div className="page-title">
        <div>
          <p className="eyebrow"><i /> Receipts</p>
          <h1>Evidence, labelled honestly.</h1>
        </div>
      </div>
      <div className="split">
        <section className="panel">
          <h2>Available receipts</h2>
          {receipts.length === 0 ? <p className="empty">No sample or verified receipt yet.</p> : null}
          {receipts.map(({ invoice, payment }) => (
            <Link key={payment.id} href={`/workspace/receipts/${payment.id}`} className="action-card">
              <strong>{payment.kind === "live" ? "Verified on Arc" : "Sample · not verified"} · {invoice.reference}</strong>
              <p>{invoice.clientName} · {formatUsdc(payment.amountCents)} {payment.currency} · {networkById(payment.network).name}</p>
              <span className="dim">{formatLongDate(payment.createdAt.slice(0, 10))}</span>
            </Link>
          ))}
        </section>
        <section className="panel">
          <h2>Not receipts</h2>
          <p className="note">Unverified and rejected lookups stay here so they are not mistaken for proof.</p>
          {attempts.length === 0 ? <p className="empty">No unverified attempts.</p> : null}
          {attempts.map(({ invoice, payment }) => (
            <article key={payment.id} className="action-card">
              <strong>{invoice.reference} · {payment.kind}</strong>
              <p>{payment.summary}</p>
              <Link href={`/workspace/verify?invoice=${invoice.id}`}>Review verification</Link>
            </article>
          ))}
        </section>
      </div>
    </section>
  );
}
