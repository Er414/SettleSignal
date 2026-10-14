"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { InvoiceForm, type InvoiceDraft } from "@/components/workspace/InvoiceForm";
import { Dialog } from "@/components/interactive";
import { StatusPill, VerificationBadge } from "@/components/status";
import { formatDateTime, formatLongDate } from "@/lib/dates";
import { centsToInput, formatUsdc } from "@/lib/money";
import { COMM_LABEL, TONE_LABEL, type InvoiceView, type SettingsView } from "@/lib/types";
import { setWorkflow, updateInvoice } from "@/server/actions";

export function InvoiceDetailView({ invoice, settings }: { invoice: InvoiceView; settings: SettingsView }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<InvoiceDraft>({
    clientName: invoice.clientName,
    clientEmail: invoice.clientEmail,
    clientCompany: invoice.clientCompany,
    description: invoice.description,
    amount: centsToInput(invoice.amountCents),
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    recipientAddress: invoice.recipientAddress,
    notes: invoice.notes,
    currency: invoice.currency,
  });

  function run(action: () => Promise<{ ok: boolean; error?: string; message?: string; fieldErrors?: Record<string, string> }>) {
    setMessage("");
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setErrors(result.fieldErrors || {});
        setMessage(result.error || "Could not save.");
        return;
      }
      setErrors({});
      setMessage(result.message || "Saved.");
      setEditing(false);
      setConfirm(false);
      router.refresh();
    });
  }

  const next = invoice.paymentStatus === "draft"
    ? { href: "", label: "Issue invoice" }
    : invoice.paymentStatus === "verification_pending"
      ? { href: `/workspace/verify?invoice=${invoice.id}`, label: "Check payment" }
      : invoice.paymentStatus === "paid" && invoice.receipt
        ? { href: `/workspace/receipts/${invoice.receipt.id}`, label: invoice.receipt.kind === "live" ? "View verified receipt" : "View sample receipt" }
        : invoice.needsAttention
          ? { href: `/workspace/follow-ups?invoice=${invoice.id}`, label: "Prepare follow-up" }
          : { href: `/workspace/verify?invoice=${invoice.id}`, label: "Check payment" };

  return (
    <section>
      <div className="page-title">
        <div>
          <p className="eyebrow"><i /> {invoice.reference}</p>
          <h1>{invoice.clientName}</h1>
          <p className="quiet">{invoice.clientCompany ? `${invoice.clientCompany} · ` : ""}{invoice.clientEmail}</p>
        </div>
        <div className="stack">
          <StatusPill status={invoice.paymentStatus} pastDue={invoice.pastDue} />
          <VerificationBadge label={invoice.verificationLabel} />
        </div>
      </div>
      <div className="split">
        <section className="panel">
          <p className="label">Amount</p>
          <p className="money">{formatUsdc(invoice.amountCents)} {invoice.currency}</p>
          <p>Recorded {formatUsdc(invoice.paidCents)} · remaining {formatUsdc(invoice.remainingCents)}</p>
          {invoice.overpaidCents > 0 ? <p>Recorded payments exceed the invoice by {formatUsdc(invoice.overpaidCents)}.</p> : null}
          <p className="dim">Issued {formatLongDate(invoice.issueDate)} · due {formatLongDate(invoice.dueDate)}</p>
          <p>{invoice.description}</p>
          <p className="hash">Recipient {invoice.recipientAddress || "not set"}</p>
          {invoice.notes ? <p className="note">{invoice.notes}</p> : null}
          <p className="note">Follow-up: {COMM_LABEL[invoice.communicationStatus]}. A client reply does not change the payment status.</p>
        </section>
        <section className="panel">
          <p className="eyebrow"><i /> Next</p>
          <h2>{next.label}</h2>
          <div className="cta-row">
            {invoice.paymentStatus === "draft" ? (
              <button type="button" className="btn-primary" disabled={pending} onClick={() => run(() => setWorkflow(invoice.id, "open"))}>Issue invoice</button>
            ) : (
              <Link className="btn-primary" href={next.href}>{next.label}</Link>
            )}
            <button type="button" className="btn-ghost" onClick={() => setEditing(true)}>Edit</button>
            {invoice.workflow === "archived" ? (
              <button type="button" className="btn-ghost" disabled={pending} onClick={() => run(() => setWorkflow(invoice.id, "open"))}>Restore</button>
            ) : (
              <button type="button" className="btn-danger" onClick={() => setConfirm(true)}>Archive</button>
            )}
            {invoice.workflow === "verification_pending" ? (
              <button type="button" className="btn-ghost" disabled={pending} onClick={() => run(() => setWorkflow(invoice.id, "open"))}>Return to open tracking</button>
            ) : null}
          </div>
          <p className="announce" role="status">{message}</p>
        </section>
      </div>
      <div className="split" style={{ marginTop: 14 }}>
        <section className="panel">
          <h2>Timeline</h2>
          <ul className="timeline">
            <li><strong>Invoice created</strong><p className="dim">{formatDateTime(invoice.createdAt, settings.timezone)}</p></li>
            {invoice.followUps.map((item) => (
              <li key={item.id}>
                <strong>{TONE_LABEL[item.tone]} · {item.status}</strong>
                <p>{item.body}</p>
                {item.responseNote ? <p>Client response: {item.responseNote}</p> : null}
                <p className="dim">{formatDateTime(item.updatedAt, settings.timezone)}{item.snoozeUntil ? ` · snoozed until ${formatLongDate(item.snoozeUntil)}` : ""}</p>
              </li>
            ))}
            {invoice.payments.map((payment) => (
              <li key={payment.id}>
                <strong>{payment.isDemo ? "Demo settlement" : payment.kind === "live" ? "Arc verification" : "Verification attempt"} · {formatUsdc(payment.amountCents)} {payment.currency}</strong>
                <p>{payment.summary}</p>
                <p className="hash">{payment.txHash}</p>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel">
          <h2>Payment records</h2>
          {invoice.payments.length === 0 ? <p className="empty">No payment has been recorded.</p> : null}
          {invoice.payments.map((payment) => (
            <article key={payment.id} className="action-card">
              <strong>{payment.kind === "live" ? "Verified on Arc" : payment.isDemo ? "Demo record" : "Not verified"}</strong>
              <p>{payment.summary}</p>
              {payment.countsTowardBalance && (payment.kind === "live" || payment.kind === "demo") ? (
                <Link href={`/workspace/receipts/${payment.id}`}>{payment.kind === "live" ? "Open verified receipt" : "Open sample receipt"}</Link>
              ) : (
                <p className="note">This attempt is not a receipt.</p>
              )}
            </article>
          ))}
        </section>
      </div>
      {editing ? (
        <div className="drawer-backdrop" onClick={() => setEditing(false)} role="presentation">
          <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="edit-invoice" onClick={(event) => event.stopPropagation()}>
            <h2 id="edit-invoice">Edit {invoice.reference}</h2>
            <InvoiceForm value={draft} errors={errors} onChange={setDraft} />
            <div className="cta-row">
              <button type="button" className="btn-primary" disabled={pending} onClick={() => run(() => updateInvoice(invoice.id, draft))}>Save changes</button>
              <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}
      <Dialog open={confirm} title={`Archive ${invoice.reference}?`} onClose={() => setConfirm(false)}>
        <p>Archived invoices leave the active queue. Payment records stay attached and can be restored.</p>
        <div className="cta-row">
          <button type="button" className="btn-danger" disabled={pending} onClick={() => run(() => setWorkflow(invoice.id, "archived"))}>Archive invoice</button>
          <button type="button" className="btn-ghost" onClick={() => setConfirm(false)}>Cancel</button>
        </div>
      </Dialog>
    </section>
  );
}
