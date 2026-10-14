"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#07090c",
          color: "#f4f1ea",
          fontFamily: "system-ui, sans-serif",
          padding: 24,
        }}
      >
        <main style={{ maxWidth: 560, textAlign: "center" }}>
          <p style={{ letterSpacing: "0.16em", color: "#d6f25c", fontSize: 12 }}>SETTLESIGNAL</p>
          <h1 style={{ fontSize: 40, margin: "12px 0" }}>The page hit an unexpected error.</h1>
          <p style={{ color: "#93a0aa" }}>No payment data was changed by this error. Reloading returns you to the workspace.</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20 }}>
            <button type="button" onClick={() => reset()} style={{ background: "#d6f25c", color: "#14180c", border: 0, borderRadius: 999, padding: "12px 20px", fontWeight: 600 }}>
              Try again
            </button>
            <a href="/" style={{ border: "1px solid rgba(244,241,234,0.3)", borderRadius: 999, padding: "12px 20px", color: "#f4f1ea" }}>
              Back to home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
