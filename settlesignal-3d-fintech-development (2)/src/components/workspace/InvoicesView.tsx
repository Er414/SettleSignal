"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { InvoiceForm, emptyDraft, type InvoiceDraft } from "@/components/workspace/InvoiceForm";
import { StatusPill, VerificationBadge } from "@/components/status";
import { formatLongDate } from "@/lib/dates";
import { formatUsdc } from "@/lib/money";
import { COMM_LABEL, type PaymentStatus, type WorkspaceData } from "@/lib/types";
import { createInvoice } from "@/server/actions";

const filters: Array<{ id: string; label: string }> = [
  { id: "active", label: "Active" },
  { id: "attention", label: "Needs attention" },
  { id: "draft", label: "Draft" },
  { id: "unpaid", label: "Unpaid" },
  { id: "due_soon", label: "Due soon" },
  { id: "overdue", label: "Overdue" },
  { id: "partially_paid", label: "Partial" },
  { id: "verification_pending", label: "Pending" },
  { id: "paid", label: "Paid" },
  { id: "archived", label: "Archived" },
];

export function InvoicesView({ data, startOpen }: { data: WorkspaceData; startOpen: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("active");
  const [sort, setSort] = useState("due");
  const [open, setOpen] = useState(startOpen);
  const [draft, setDraft] = useState<InvoiceDraft>(emptyDraft(data.today, data.settings.recipientAddress));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = data.invoices.filter((invoice) => {
      const haystack = [invoice.reference, invoice.clientName, invoice.clientCompany, invoice.clientEmail, invoice.description].join(" ").toLowerCase();
      if (needle && !haystack.includes(needle)) return false;
      if (filter === "active") return invoice.paymentStatus !== "archived";
      if (filter === "attention") return invoice.needsAttention;
      if (filter === "overdue") return invoice.pastDue || invoice.paymentStatus === "overdue";
      return invoice.paymentStatus === (filter as PaymentStatus);
    });
    return filtered.sort((a, b) => {
      if (sort === "amount") return b.amountCents - a.amountCents;
      if (sort === "client") return a.clientName.localeCompare(b.clientName);
      if (sort === "status") return a.paymentStatus.localeCompare(b.paymentStatus);
      return a.dueDate.localeCompare(b.dueDate);
    });
  }, [data.invoices, filter, query, sort]);

  function save(workflow: "draft" | "open") {
    setErrors({});
    setMessage("");
    startTransition(async () => {
      const result = await createInvoice({ ...draft, workflow });
      if (!result.ok) {
        setErrors(result.fieldErrors || {});
        setMessage(result.error);
        return;
      }
      setOpen(false);
      setDraft(emptyDraft(data.today, data.settings.recipientAddress));
      if (result.id) router.push(`/workspace/invoices/${result.id}`);
      router.refresh();
    });
  }

  return (
    <section>
      <div className="page-title">
        <div>
          <p className="eyebrow"><i /> Invoices</p>
          <h1>Who still owes the work.</h1>
        </div>
        <div className="header-actions">
          <a className="btn-ghost" href="/api/export/invoices">Export CSV</a>
          <button type="button" className="btn-primary" onClick={() => setOpen(true)}>New invoice</button>
        </div>
      </div>
      <div className="toolbar">
        <label className="search">
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search client, reference, or work" aria-label="Search invoices" />
        </label>
        <label className="field" style={{ minWidth: 160 }}>
          <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort invoices">
            <option value="due">Sort by due date</option>
            <option value="amount">Sort by amount</option>
            <option value="client">Sort by client</option>
            <option value="status">Sort by status</option>
          </select>
        </label>
      </div>
      <div className="chips" role="tablist" aria-label="Invoice filters">
        {filters.map((item) => (
          <button key={item.id} type="button" className={`chip ${filter === item.id ? "on" : ""}`} onClick={() => setFilter(item.id)}>{item.label}</button>
        ))}
      </div>
      <div className="ledger">
        <div className="ledger-head">
          <span>Invoice</span><span>Client</span><span>Remaining</span><span>Due</span><span>Status</span><span>Follow-up</span>
        </div>
        {rows.length === 0 ? <p className="empty">No invoices match this view.</p> : null}
        {rows.map((invoice) => (
          <Link className="ledger-row" key={invoice.id} href={`/workspace/invoices/${invoice.id}`}>
            <span className="who"><strong>{invoice.reference}</strong><span>{invoice.description}</span></span>
            <span className="who"><strong>{invoice.clientName}</strong><span>{invoice.clientCompany || invoice.clientEmail}</span></span>
            <span className="hash">{formatUsdc(invoice.remainingCents)} {invoice.currency}</span>
            <span>{formatLongDate(invoice.dueDate)}</span>
            <span className="stack">
              <StatusPill status={invoice.paymentStatus} pastDue={invoice.pastDue} />
              <VerificationBadge label={invoice.verificationLabel} />
            </span>
            <span className="dim desktop-only">{COMM_LABEL[invoice.communicationStatus]}</span>
            <span className="dim mobile-only">{COMM_LABEL[invoice.communicationStatus]}</span>
          </Link>
        ))}
      </div>
      {open ? (
        <div className="drawer-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="new-invoice" onClick={(event) => event.stopPropagation()}>
            <h2 id="new-invoice">New invoice</h2>
            <p className="note">Saving a draft does not start follow-up tracking. Issuing it does.</p>
            <InvoiceForm value={draft} errors={errors} onChange={setDraft} />
            <p className="announce" role="status">{message}</p>
            <div className="cta-row">
              <button type="button" className="btn-primary" disabled={pending} onClick={() => save("open")}>Save and track</button>
              <button type="button" className="btn-ghost" disabled={pending} onClick={() => save("draft")}>Save draft</button>
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
