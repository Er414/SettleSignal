"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function AccessForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!configured || pending) return;

    setPending(true);
    try {
      const response = await fetch("/api/access/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(result?.error || "Sign-in failed. Check the password and try again.");
        return;
      }
      setPassword("");
      router.replace("/workspace");
      router.refresh();
    } catch {
      setError("The sign-in request could not be completed. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="access-title">
      <p className="eyebrow"><i /> WORKSPACE ACCESS</p>
      <h2 id="access-title">Sign in</h2>
      <p>Enter the private workspace password to continue.</p>
      {!configured ? (
        <p className="announce" role="status">
          Access is disabled until both SETTLESIGNAL_ADMIN_PASSWORD and SETTLESIGNAL_ADMIN_SECRET are configured in this Vercel project environment. Use a password of at least 12 characters and an independent secret of at least 32 characters, then redeploy.
        </p>
      ) : null}
      <form className="form-grid" onSubmit={submit}>
        <label className="field">
          <span>Workspace password</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={12}
            maxLength={4096}
            disabled={!configured || pending}
          />
        </label>
        {error ? <p className="err" role="alert">{error}</p> : null}
        <button className="btn-primary" type="submit" disabled={!configured || pending || password.length < 12}>
          {pending ? "Checking…" : "Open workspace"}
        </button>
      </form>
      <p className="note">The password is checked on the server. It is not stored in the browser.</p>
    </section>
  );
}
