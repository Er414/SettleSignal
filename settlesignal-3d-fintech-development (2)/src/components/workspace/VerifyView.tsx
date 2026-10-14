"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dialog, shortHash } from "@/components/interactive";
import { StatusPill } from "@/components/status";
import { ARC_NETWORKS, DEMO_FIXTURES } from "@/lib/arc";
import { formatUsdc } from "@/lib/money";
import { isTxHash } from "@/lib/domain";
import type { NetworkId, WorkspaceData } from "@/lib/types";
import { applyDemoSettlement, verifyOnArc } from "@/server/actions";

export function VerifyView({ data, selectedId }: { data: WorkspaceData; selectedId?: string }) {
  const router = useRouter();
  const options = data.invoices.filter((invoice) => invoice.paymentStatus !== "archived");
  const [invoiceId, setInvoiceId] = useState(selectedId && options.some((invoice) => invoice.id === selectedId) ? selectedId : options[0]?.id || "");
  const invoice = options.find((item) => item.id === invoiceId) || null;
  const [network, setNetwork] = useState<NetworkId>(data.settings.network);
  const [hash, setHash] = useState("");
  const [demoOpen, setDemoOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const selectedNetwork = ARC_NETWORKS[network];

  function lookup() {
    if (!invoice) return;
    setMessage("");
    startTransition(async () => {
      const result = await verifyOnArc(invoice.id, hash, network);
      setMessage(result.ok ? result.message || "Lookup finished." : result.error);
      if (result.ok) router.refresh();
    });
  }

  function applyDemo(fixtureId: string) {
    if (!invoice) return;
    setMessage("");
    startTransition(async () => {
      const result = await applyDemoSettlement(invoice.id, fixtureId);
      setMessage(result.ok ? result.message || "Demo recorded." : result.error);
      setDemoOpen(false);
      if (result.ok) router.refresh();
    });
  }

  return (
    <section>
      <div className="page-title">
        <div>
          <p className="eyebrow"><i /> Payment verification</p>
          <h1>Unverified until the checks pass.</h1>
        </div>
      </div>
      <div className="split">
        <section className="panel">
          <p className="note">SettleSignal does not ask for a seed phrase, private key, or wallet signature. A live lookup reads the public Arc RPC. A transfer hash that already counted cannot be counted again. A demo fixture never pretends to be that lookup.</p>
          <label className="field">
            <span>Invoice</span>
            <select value={invoiceId} onChange={(event) => setInvoiceId(event.target.value)}>
              {options.map((item) => (
                <option key={item.id} value={item.id}>{item.reference} · {item.clientName} · {formatUsdc(item.remainingCents)} remaining</option>
              ))}
            </select>
          </label>
          {invoice ? (
            <div className="stack">
              <StatusPill status={invoice.paymentStatus} pastDue={invoice.pastDue} />
              <p>Recipient <span className="hash">{invoice.recipientAddress || "missing — add one before a live lookup"}</span></p>
              <p>Remaining {formatUsdc(invoice.remainingCents)} {invoice.currency}</p>
            </div>
          ) : null}
          <label className="field">
            <span>Network</span>
            <select value={network} onChange={(event) => setNetwork(event.target.value as NetworkId)}>
              <option value="arc-testnet">Arc Testnet · chain {ARC_NETWORKS["arc-testnet"].chainId}</option>
              <option value="arc-mainnet">Arc · chain {ARC_NETWORKS["arc-mainnet"].chainId}</option>
            </select>
          </label>
          <p className="note">Lookup host {data.settings.network === network ? data.settings.rpcHost : selectedNetwork.rpcUrl.replace(/^https?:\/\//, "")}. Explorer {selectedNetwork.explorerUrl}. USDC interface {selectedNetwork.currency} at the documented precompile. Gas uses 18 decimals; the ERC-20 interface uses 6. This check reads the 18-decimal system transfer.</p>
          <label className="field">
            <span>Transaction hash</span>
            <input value={hash} onChange={(event) => setHash(event.target.value.trim())} placeholder="0x…" spellCheck={false} aria-invalid={hash.length > 0 && !isTxHash(hash)} />
          </label>
          <div className="cta-row">
            <button type="button" className="btn-primary" disabled={pending || !invoice || !isTxHash(hash)} onClick={lookup}>Look up on Arc</button>
            <button type="button" className="btn-ghost" disabled={!invoice} onClick={() => setDemoOpen(true)}>Run labelled demo</button>
          </div>
          <p className="announce" role="status">{message}</p>
          {selectedNetwork.faucetUrl ? <p><a href={selectedNetwork.faucetUrl}>Circle faucet for testnet USDC</a></p> : null}
          <p><a href={selectedNetwork.docsUrl}>Official Arc connection reference</a></p>
        </section>
        <section className="panel">
          <h2>Latest checks</h2>
          {invoice && invoice.payments[0] ? (
            <>
              <p>{invoice.payments[0].summary}</p>
              <p className="hash">{invoice.payments[0].txHash}</p>
              <div className="checks">
                {invoice.payments[0].checks.map((check) => (
                  <div key={check.id} className={`check ${check.passed ? "pass" : "fail"}`}>
                    <span aria-hidden="true">{check.passed ? "✓" : "–"}</span>
                    <div>
                      <strong>{check.label}</strong>
                      <p>{check.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
              {invoice.payments[0].explorerUrl ? <p><a href={invoice.payments[0].explorerUrl}>Open in Arc explorer</a></p> : null}
              {invoice.receipt ? <p><Link href={`/workspace/receipts/${invoice.receipt.id}`}>{invoice.receipt.kind === "live" ? "Open verified receipt" : "Open sample receipt"}</Link></p> : null}
            </>
          ) : <p className="empty">No lookup has been stored for this invoice.</p>}
          <h2>History</h2>
          <ul className="timeline">
            {invoice?.payments.map((payment) => (
              <li key={payment.id}>
                <strong>{payment.isDemo ? "Demo" : payment.kind} · {shortHash(payment.txHash || "no hash")}</strong>
                <p>{payment.summary}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <Dialog open={demoOpen} title="This demo does not query Arc" onClose={() => setDemoOpen(false)}>
        <p>A labelled fixture records a workspace settlement so you can see the flow. It is not evidence of payment and cannot produce a verified receipt.</p>
        <div className="stack">
          {DEMO_FIXTURES.map((fixture) => (
            <button key={fixture.id} type="button" className="action-card" disabled={pending} onClick={() => applyDemo(fixture.id)}>
              <strong>{fixture.title}</strong>
              <p>{fixture.detail}</p>
            </button>
          ))}
        </div>
      </Dialog>
    </section>
  );
}
