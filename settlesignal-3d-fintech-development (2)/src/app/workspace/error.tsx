"use client";

export default function WorkspaceError({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="panel">
      <h1>The workspace could not load.</h1>
      <p>The database may be unavailable. Nothing on screen was marked paid.</p>
      <button type="button" className="btn-primary" onClick={reset}>Try again</button>
    </section>
  );
}
