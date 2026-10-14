"use client";

import { useRouter } from "next/navigation";

export function Unavailable() {
  const router = useRouter();
  return (
    <section className="panel" aria-live="polite">
      <p className="eyebrow"><i /> Starting up</p>
      <h1>The workspace ledger is not ready yet.</h1>
      <p>The database may still be initializing. No invoices or payments were lost. Reloading re-runs the setup step automatically.</p>
      <button type="button" className="btn-primary" onClick={() => router.refresh()}>Try again</button>
    </section>
  );
}
