"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { copyText } from "@/components/interactive";
import { StatusPill } from "@/components/status";
import { addDays, formatLongDate } from "@/lib/dates";
import { formatUsdc } from "@/lib/money";
import { renderFollowUp } from "@/lib/followups";
import { COMM_LABEL, TONE_LABEL, type Tone, type WorkspaceData } from "@/lib/types";
import { saveFollowUp } from "@/server/actions";

const tones: Tone[] = ["friendly", "professional", "firm"];

export function FollowUpsView({ data, selectedId }: { data: WorkspaceData; selectedId?: string }) {
  const router = useRouter();
  const candidates = data.invoices.filter((invoice) => invoice.paymentStatus !== "archived");
  const initial = candidates.find((invoice) => invoice.id === selectedId) || candidates.find((invoice) => invoice.needsAttention) || candidates[0];
  const [invoiceId, setInvoiceId] = useState(initial?.id || "");
  const invoice = candidates.find((item) => item.id === invoiceId) || null;
  const [tone, setTone] = useState<Tone>(data.settings.defaultTone);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [snoozeUntil, setSnoozeUntil] = useState(addDays(data.today, 3));
  const [responseNote, setResponseNote] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const generated = useMemo(() => {
    if (!invoice) return "";
    return renderFollowUp({
      tone,
      clientName: invoice.clientName,
      reference: invoice.reference,
      description: invoice.description,
      amountLabel: formatUsdc(invoice.amountCents),
      currency: invoice.currency,
      dueLabel: formatLongDate(invoice.dueDate),
      recipientAddress: invoice.recipientAddress,
      networkName: data.settings.networkName,
      ownerName: data.settings.ownerName,
      businessName: data.settings.businessName,
      email: data.settings.email,
    });
  }, [data.settings, invoice, tone]);
  const key = invoice ? `${invoice.id}:${tone}` : "";
  const body = edits[key] ?? generated;

  function run(intent: "draft" | "snoozed" | "sent" | "responded") {
    if (!invoice) return;
    setMessage("");
    startTransition(async () => {
      const result = await saveFollowUp({ invoiceId: invoice.id, tone, body, intent, snoozeUntil, responseNote });
      setMessage(result.ok ? result.message || "Saved." : result.error);
      if (result.ok) router.refresh();
    });
  }

  return (
    <section>
      <div className="page-title">
        <div>
          <p className="eyebrow"><i /> Follow-up assistant</p>
          <h1>Say the precise thing. Send it yourself.</h1>
        </div>
      </div>
      <div className="split">
        <section className="panel">
          <h2>Invoices</h2>
          <div className="stack">
            {candidates.map((item) => (
              <button type="button" key={item.id} className="action-card" onClick={() => setInvoiceId(item.id)} style={{ textAlign: "left", borderColor: item.id === invoiceId ? "rgba(214,242,92,0.7)" : undefined }}>
                <strong>{item.reference} · {item.clientName}</strong>
                <p className="dim">{COMM_LABEL[item.communicationStatus]} · due {formatLongDate(item.dueDate)}</p>
                <StatusPill status={item.paymentStatus} pastDue={item.pastDue} />
              </button>
            ))}
          </div>
        </section>
        <section className="panel">
          {invoice ? (
            <>
              <p className="eyebrow"><i /> {invoice.reference}</p>
              <h2>{invoice.clientName}</h2>
              <p>{formatUsdc(invoice.remainingCents)} {invoice.currency} remaining · due {formatLongDate(invoice.dueDate)}</p>
              <div className="chips" role="tablist" aria-label="Tone">
                {tones.map((item) => (
                  <button key={item} type="button" className={`chip ${tone === item ? "on" : ""}`} onClick={() => setTone(item)}>{TONE_LABEL[item]}</button>
                ))}
              </div>
              <label className="field">
                <span>Draft</span>
                <textarea value={body} onChange={(event) => setEdits((current) => ({ ...current, [key]: event.target.value }))} />
              </label>
              <p className="note">Templates use this invoice. Nothing is emailed from SettleSignal.</p>
              <div className="cta-row">
                <button type="button" className="btn-primary" onClick={async () => setMessage(await copyText(body) ? "Copied." : "Copy failed. Select the draft and copy it manually.")}>Copy</button>
                <button type="button" className="btn-ghost" disabled={pending} onClick={() => run("draft")}>Save draft</button>
                <button type="button" className="btn-ghost" disabled={pending} onClick={() => run("sent")}>Mark sent</button>
              </div>
              <div className="form-grid">
                <label className="field">
                  <span>Snooze until</span>
                  <input type="date" value={snoozeUntil} onChange={(event) => setSnoozeUntil(event.target.value)} />
                </label>
                <button type="button" className="btn-ghost" disabled={pending} onClick={() => run("snoozed")}>Snooze</button>
                <label className="field">
                  <span>Client response</span>
                  <textarea value={responseNote} onChange={(event) => setResponseNote(event.target.value)} placeholder="What did they say? This does not mark the invoice paid." />
                </label>
                <button type="button" className="btn-ghost" disabled={pending} onClick={() => run("responded")}>Record response</button>
              </div>
              <p className="announce" role="status">{message}</p>
              <h2>Communication timeline</h2>
              <ul className="timeline">
                {invoice.followUps.length === 0 ? <li>No follow-up recorded yet.</li> : null}
                {invoice.followUps.map((item) => (
                  <li key={item.id}>
                    <strong>{TONE_LABEL[item.tone]} · {item.status}</strong>
                    <p>{item.responseNote || item.body}</p>
                  </li>
                ))}
              </ul>
            </>
          ) : <p className="empty">Create an invoice before preparing a follow-up.</p>}
        </section>
      </div>
    </section>
  );
}
