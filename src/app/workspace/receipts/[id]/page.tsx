import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/workspace/PrintButton";
import { networkById } from "@/lib/arc";
import { formatDateTime, formatLongDate } from "@/lib/dates";
import { formatUsdc } from "@/lib/money";
import { loadReceipt } from "@/server/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Receipt" };

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, receipt } = await loadReceipt(id);
  if (!receipt) notFound();
  if (!receipt.eligible) {
    return (
      <section className="panel">
        <h1>This record is not a receipt.</h1>
        <p>{receipt.payment.summary}</p>
        <p className="note">Unverified and rejected lookups are kept for review. They are not evidence of settlement.</p>
        <Link className="btn-ghost" href={`/workspace/verify?invoice=${receipt.invoice.id}`}>Back to verification</Link>
      </section>
    );
  }
  const network = networkById(receipt.payment.network);
  return (
    <article className="receipt-wrap">
      <div className="cta-row no-print">
        <PrintButton />
        <a className="btn-ghost" href={`/api/receipts/${receipt.payment.id}`}>Download text</a>
        <Link className="btn-ghost" href={`/workspace/invoices/${receipt.invoice.id}`}>Back to invoice</Link>
      </div>
      <section className="receipt-sheet">
        <span className={receipt.sample ? "stamp sample" : "stamp live"}>{receipt.sample ? "Sample · not verified on Arc" : "Verified on Arc"}</span>
        <h1>{receipt.sample ? "Sample receipt" : "Payment receipt"}</h1>
        <p>{data.settings.businessName}<br />{data.settings.ownerName}<br />{data.settings.email}</p>
        <dl>
          <dt>Invoice</dt><dd>{receipt.invoice.reference}</dd>
          <dt>Client</dt><dd>{receipt.invoice.clientName}</dd>
          <dt>Company</dt><dd>{receipt.invoice.clientCompany || "—"}</dd>
          <dt>Work</dt><dd>{receipt.invoice.description}</dd>
          <dt>Invoice total</dt><dd>{formatUsdc(receipt.invoice.amountCents)} {receipt.invoice.currency}</dd>
          <dt>This payment</dt><dd>{formatUsdc(receipt.payment.amountCents)} {receipt.payment.currency}</dd>
          <dt>Remaining</dt><dd>{formatUsdc(receipt.invoice.remainingCents)} {receipt.invoice.currency}</dd>
          <dt>Issued</dt><dd>{formatLongDate(receipt.invoice.issueDate)}</dd>
          <dt>Due</dt><dd>{formatLongDate(receipt.invoice.dueDate)}</dd>
          <dt>Network</dt><dd>{network.name} · chain {network.chainId}</dd>
          <dt>Recipient</dt><dd>{receipt.payment.recipientAddress || "Not recorded"}</dd>
          <dt>Reference</dt><dd>{receipt.payment.txHash || "Not recorded"}</dd>
          <dt>Explorer</dt><dd>{receipt.payment.explorerUrl ? <a href={receipt.payment.explorerUrl}>{receipt.payment.explorerUrl}</a> : "Not available for this record"}</dd>
          <dt>Recorded</dt><dd>{formatDateTime(receipt.payment.createdAt, data.settings.timezone)}</dd>
        </dl>
        <p>{receipt.sample ? "This sample was generated from a labelled demonstration. It is not evidence that a transfer settled on Arc." : "This receipt reflects a live Arc lookup that passed chain, receipt, recipient, and amount checks."}</p>
        <p>{receipt.payment.summary}</p>
      </section>
    </article>
  );
}
