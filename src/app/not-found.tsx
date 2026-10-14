import Link from "next/link";

export default function NotFound() {
  return (
    <main className="section">
      <p className="eyebrow"><i /> Missing record</p>
      <h1 className="display">That page is not in the ledger.</h1>
      <Link className="btn-primary" href="/workspace">Back to the workspace</Link>
    </main>
  );
}
