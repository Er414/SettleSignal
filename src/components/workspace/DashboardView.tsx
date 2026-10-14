"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CountUp } from "@/components/interactive";
import { SceneFrame } from "@/components/scene/SceneFrame";
import { StatusPill, VerificationBadge } from "@/components/status";
import { formatDateTime, formatLongDate } from "@/lib/dates";
import { formatUsdc } from "@/lib/money";
import type { WorkspaceData } from "@/lib/types";

export function DashboardView({ data }: { data: WorkspaceData }) {
  const [showIntro, setShowIntro] = useState(false);
  useEffect(() => {
    setShowIntro(window.localStorage.getItem("settlesignal.intro.dismissed") !== "1");
  }, []);
  const open = data.invoices.filter((invoice) => invoice.remainingCents > 0 && invoice.paymentStatus !== "draft" && invoice.paymentStatus !== "archived");
  const max = Math.max(...open.map((invoice) => invoice.remainingCents), 1);
  const metrics = [
    ["Open balance", data.metrics.outstandingCents, "Remaining after recorded payments, including labelled demos."],
    ["Overdue", data.metrics.overdueCount, "Past due and not fully recorded."],
    ["Due soon", data.metrics.dueSoonCount, `Due within ${data.settings.reminderLeadDays} days.`],
    ["Verified on Arc", data.metrics.verifiedCents, "Live lookups only. Demo settlements are excluded."],
    ["Needs a follow-up", data.metrics.attentionCount, "Open invoices waiting on a message or a reply."],
  ] as const;

  return (
    <section>
      {showIntro ? (
        <div className="panel intro" style={{ marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <p className="eyebrow"><i /> How SettleSignal works</p>
            <ol className="how-steps">
              <li><strong>Create an invoice</strong> · client, amount, due date, USDC recipient. <Link href="/workspace/invoices?new=1">Create one</Link></li>
              <li><strong>Follow up</strong> · a three-tone draft is written from the invoice. You copy and send it yourself. <Link href="/workspace/follow-ups">Open drafts</Link></li>
              <li><strong>Verify</strong> · enter the client&apos;s Arc transaction hash, or run a labelled demo that never touches the chain. <Link href="/workspace/verify">Verify a hash</Link></li>
              <li><strong>Receipt</strong> · samples are watermarked as samples; only a passed lookup earns a verified receipt. <Link href="/workspace/receipts">See receipts</Link></li>
            </ol>
            <p className="note">This is one demonstration ledger in the server&apos;s PostgreSQL database. It survives a reload, but it is not a personal account and does not sync across devices. A client reply never reduces a balance, and a demo settlement is never presented as Arc verification.</p>
          </div>
          <button
            type="button"
            className="btn-ghost btn-small"
            onClick={() => {
              window.localStorage.setItem("settlesignal.intro.dismissed", "1");
              setShowIntro(false);
            }}
          >
            Got it
          </button>
        </div>
      ) : null}
      <div className="page-title">
        <div>
          <p className="eyebrow"><i /> Today, {formatLongDate(data.today)}</p>
          <h1>What still needs a signal.</h1>
        </div>
        <Link className="btn-primary" href="/workspace/invoices?new=1">New invoice</Link>
      </div>
      <div className="metric-grid">
        {metrics.map(([label, value, detail], index) => (
          <article className="metric rise" key={label}>
            <span>{label}</span>
            {index === 1 || index === 2 || index === 4 ? <strong className="money">{value}</strong> : <CountUp cents={value} />}
            <em>{detail}</em>
          </article>
        ))}
      </div>
      <div className="split">
        <section className="panel">
          <p className="eyebrow"><i /> Action queue</p>
          <h2>Do this next.</h2>
          {data.actions.length === 0 ? <p className="empty">Nothing is waiting. Open invoices will appear here when they need a follow-up or a check.</p> : null}
          {data.actions.map((action) => (
            <Link className="action-card" key={action.id} href={action.href}>
              <strong>{action.title}</strong>
              <p className="quiet">{action.detail}</p>
              <span className="index-no">{action.label}</span>
            </Link>
          ))}
        </section>
        <div className="stack">
          <SceneFrame variant="compact" confirmed={data.metrics.verifiedCents > 0} />
          <section className="panel">
            <p className="eyebrow"><i /> Outstanding</p>
            <h2>Open balances</h2>
            <div className="bars">
              {open.length === 0 ? <p className="empty">No open balance in the workspace.</p> : null}
              {open.slice(0, 6).map((invoice) => (
                <Link className="bar-row" key={invoice.id} href={`/workspace/invoices/${invoice.id}`}>
                  <span>{invoice.clientName}</span>
                  <span className="bar-track"><span className="bar-fill" style={{ width: `${(invoice.remainingCents / max) * 100}%` }} /></span>
                  <b className="hash">{formatUsdc(invoice.remainingCents)}</b>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
      <div className="split" style={{ marginTop: 14 }}>
        <section className="panel">
          <p className="eyebrow"><i /> Recent activity</p>
          <ul className="activity">
            {data.activities.map((item) => (
              <li key={item.id}>
                <span className="dim">{formatDateTime(item.createdAt, data.settings.timezone)}</span>
                <span>{item.message}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel">
          <p className="eyebrow"><i /> Open invoices</p>
          <div className="stack">
            {data.invoices.filter((invoice) => invoice.paymentStatus !== "archived" && invoice.paymentStatus !== "paid").slice(0, 5).map((invoice) => (
              <Link key={invoice.id} href={`/workspace/invoices/${invoice.id}`} className="action-card">
                <div className="stack">
                  <strong>{invoice.reference} · {invoice.clientName}</strong>
                  <span className="dim">{formatUsdc(invoice.remainingCents)} {invoice.currency} remaining · due {formatLongDate(invoice.dueDate)}</span>
                  <span className="stack" style={{ gridAutoFlow: "column", justifyContent: "start" }}>
                    <StatusPill status={invoice.paymentStatus} pastDue={invoice.pastDue} />
                    <VerificationBadge label={invoice.verificationLabel} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
