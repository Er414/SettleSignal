import type { Metadata } from "next";
import { Logo } from "@/components/brand";
import { AccessForm } from "@/components/access/AccessForm";
import { isAccessConfigured } from "@/server/access-token";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Workspace access | SettleSignal",
  robots: { index: false, follow: false },
};

export default function AccessPage() {
  return (
    <main>
      <header className="site-header">
        <Logo href="/" />
      </header>
      <section className="hero">
        <div className="hero-grid">
          <div>
            <p className="eyebrow"><i /> PRIVATE WORKSPACE</p>
            <h1 className="display">Keep every <em>settlement</em> in view.</h1>
            <p className="lede">
              Return to your invoice tracker, follow-up queue, and payment evidence.
              Your workspace is locked until you sign in.
            </p>
            <div className="cta-row">
              <span className="chip">Invoice tracking</span>
              <span className="chip">Payment verification</span>
              <span className="chip">Receipt history</span>
            </div>
          </div>
          <AccessForm configured={isAccessConfigured()} />
        </div>
      </section>
      <footer className="site-footer">
        <p>SettleSignal · A single-owner workspace gate. This does not create separate accounts or workspaces for multiple businesses.</p>
      </footer>
    </main>
  );
}
