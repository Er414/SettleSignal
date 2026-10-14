"use client";

export type InvoiceDraft = {
  clientName: string;
  clientEmail: string;
  clientCompany: string;
  description: string;
  amount: string;
  issueDate: string;
  dueDate: string;
  recipientAddress: string;
  notes: string;
  currency: string;
};

export function emptyDraft(today: string, recipient: string): InvoiceDraft {
  return {
    clientName: "",
    clientEmail: "",
    clientCompany: "",
    description: "",
    amount: "",
    issueDate: today,
    dueDate: today,
    recipientAddress: recipient,
    notes: "",
    currency: "USDC",
  };
}

export function InvoiceForm({
  value,
  errors,
  onChange,
}: {
  value: InvoiceDraft;
  errors?: Record<string, string>;
  onChange: (value: InvoiceDraft) => void;
}) {
  function set<K extends keyof InvoiceDraft>(key: K, next: InvoiceDraft[K]) {
    onChange({ ...value, [key]: next });
  }
  return (
    <div className="form-grid">
      <label className="field">
        <span>Client name</span>
        <input value={value.clientName} onChange={(event) => set("clientName", event.target.value)} aria-invalid={Boolean(errors?.clientName)} required />
        {errors?.clientName ? <em className="err">{errors.clientName}</em> : null}
      </label>
      <label className="field">
        <span>Email</span>
        <input type="email" value={value.clientEmail} onChange={(event) => set("clientEmail", event.target.value)} aria-invalid={Boolean(errors?.clientEmail)} required />
        {errors?.clientEmail ? <em className="err">{errors.clientEmail}</em> : null}
      </label>
      <label className="field">
        <span>Company</span>
        <input value={value.clientCompany} onChange={(event) => set("clientCompany", event.target.value)} />
      </label>
      <label className="field">
        <span>Description</span>
        <input value={value.description} onChange={(event) => set("description", event.target.value)} aria-invalid={Boolean(errors?.description)} required />
        {errors?.description ? <em className="err">{errors.description}</em> : null}
      </label>
      <label className="field">
        <span>Amount in USDC</span>
        <input inputMode="decimal" value={value.amount} onChange={(event) => set("amount", event.target.value)} placeholder="4800.00" aria-invalid={Boolean(errors?.amount)} required />
        {errors?.amount ? <em className="err">{errors.amount}</em> : null}
      </label>
      <label className="field">
        <span>Issue date</span>
        <input type="date" value={value.issueDate} onChange={(event) => set("issueDate", event.target.value)} aria-invalid={Boolean(errors?.issueDate)} required />
        {errors?.issueDate ? <em className="err">{errors.issueDate}</em> : null}
      </label>
      <label className="field">
        <span>Due date</span>
        <input type="date" value={value.dueDate} onChange={(event) => set("dueDate", event.target.value)} aria-invalid={Boolean(errors?.dueDate)} required />
        {errors?.dueDate ? <em className="err">{errors.dueDate}</em> : null}
      </label>
      <label className="field">
        <span>Payment recipient</span>
        <input value={value.recipientAddress} onChange={(event) => set("recipientAddress", event.target.value)} placeholder="0x…" spellCheck={false} aria-invalid={Boolean(errors?.recipientAddress)} />
        {errors?.recipientAddress ? <em className="err">{errors.recipientAddress}</em> : <em className="note">Required before a live Arc lookup. Leave blank only for a draft.</em>}
      </label>
      <label className="field">
        <span>Notes</span>
        <textarea value={value.notes} onChange={(event) => set("notes", event.target.value)} />
        {errors?.notes ? <em className="err">{errors.notes}</em> : null}
      </label>
    </div>
  );
}
