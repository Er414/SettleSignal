"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/interactive";
import { ARC_NETWORKS } from "@/lib/arc";
import { TIMEZONES } from "@/lib/dates";
import type { SettingsView as Settings, Tone } from "@/lib/types";
import { resetDemo, updateSettings } from "@/server/actions";

export function SettingsView({ settings }: { settings: Settings }) {
  const router = useRouter();
  const [form, setForm] = useState(settings);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [pending, startTransition] = useTransition();
  const network = ARC_NETWORKS[form.network];

  function save() {
    setMessage("");
    startTransition(async () => {
      const result = await updateSettings({
        businessName: form.businessName,
        ownerName: form.ownerName,
        email: form.email,
        timezone: form.timezone,
        reminderLeadDays: Number(form.reminderLeadDays),
        defaultTone: form.defaultTone,
        network: form.network,
        recipientAddress: form.recipientAddress,
      });
      if (!result.ok) {
        setErrors(result.fieldErrors || {});
        setMessage(result.error);
        return;
      }
      setErrors({});
      setMessage(result.message || "Saved.");
      router.refresh();
    });
  }

  return (
    <section>
      <div className="page-title">
        <div>
          <p className="eyebrow"><i /> Settings</p>
          <h1>The workspace, not the wallet.</h1>
        </div>
      </div>
      <div className="split">
        <section className="panel">
          <div className="form-grid">
            <label className="field"><span>Business</span><input value={form.businessName} onChange={(event) => setForm({ ...form, businessName: event.target.value })} />{errors.businessName ? <em className="err">{errors.businessName}</em> : null}</label>
            <label className="field"><span>Your name</span><input value={form.ownerName} onChange={(event) => setForm({ ...form, ownerName: event.target.value })} />{errors.ownerName ? <em className="err">{errors.ownerName}</em> : null}</label>
            <label className="field"><span>Email</span><input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />{errors.email ? <em className="err">{errors.email}</em> : null}</label>
            <label className="field">
              <span>Time zone</span>
              <select value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })}>
                {TIMEZONES.map((zone) => <option key={zone}>{zone}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Display currency</span>
              <input value="USDC" readOnly />
            </label>
            <label className="field">
              <span>Due-soon window, days</span>
              <input type="number" min={1} max={30} value={form.reminderLeadDays} onChange={(event) => setForm({ ...form, reminderLeadDays: Number(event.target.value) })} />
              {errors.reminderLeadDays ? <em className="err">{errors.reminderLeadDays}</em> : null}
            </label>
            <label className="field">
              <span>Default follow-up tone</span>
              <select value={form.defaultTone} onChange={(event) => setForm({ ...form, defaultTone: event.target.value as Tone })}>
                <option value="friendly">Friendly reminder</option>
                <option value="professional">Professional follow-up</option>
                <option value="firm">Firm but respectful</option>
              </select>
            </label>
            <label className="field">
              <span>Default payment recipient</span>
              <input value={form.recipientAddress} onChange={(event) => setForm({ ...form, recipientAddress: event.target.value })} spellCheck={false} />
              {errors.recipientAddress ? <em className="err">{errors.recipientAddress}</em> : null}
            </label>
            <label className="field">
              <span>Active network for new lookups</span>
              <select value={form.network} onChange={(event) => setForm({ ...form, network: event.target.value as Settings["network"] })}>
                <option value="arc-testnet">Arc Testnet</option>
                <option value="arc-mainnet">Arc mainnet</option>
              </select>
            </label>
          </div>
          <p className="announce" role="status">{message}</p>
          <button type="button" className="btn-primary" disabled={pending} onClick={save}>Save settings</button>
        </section>
        <section className="panel">
          <p className="eyebrow"><i /> Data mode</p>
          <h2>Demonstration ledger</h2>
          <p>{settings.dataMode}</p>
          <p>No secret credentials are shown here. Live lookups use the public host <span className="hash">{settings.rpcHost}</span>.</p>
          <p>Selected network: {network.name}, chain ID {network.chainId}. Explorer {network.explorerUrl}. {network.faucetUrl ? `Faucet ${network.faucetUrl}.` : "No faucet on mainnet."}</p>
          <p className="note">Changing the network does not re-check old records. A stored hash remains unverified until a new lookup passes.</p>
          <button type="button" className="btn-danger" onClick={() => setConfirm(true)}>Reset demonstration data</button>
        </section>
      </div>
      <Dialog open={confirm} title="Reset demonstration data?" onClose={() => setConfirm(false)}>
        <p>Invoices, follow-ups, and payment records return to the seeded demo. Settings return with them.</p>
        <div className="cta-row">
          <button type="button" className="btn-danger" disabled={pending} onClick={() => startTransition(async () => { const result = await resetDemo(); setMessage(result.ok ? result.message || "Reset." : result.error); setConfirm(false); router.refresh(); })}>Reset</button>
          <button type="button" className="btn-ghost" onClick={() => setConfirm(false)}>Cancel</button>
        </div>
      </Dialog>
    </section>
  );
}
