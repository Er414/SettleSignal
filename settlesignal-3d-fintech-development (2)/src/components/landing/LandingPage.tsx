"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Menu, X } from "lucide-react";
import { Logo } from "@/components/brand";
import { copyText } from "@/components/interactive";
import { SceneFrame } from "@/components/scene/SceneFrame";
import { StatusPill, VerificationBadge } from "@/components/status";
import { assembleInvoice } from "@/lib/domain";
import { renderFollowUp } from "@/lib/followups";
import { photos, videoCredit } from "@/lib/media";
import { formatUsdc } from "@/lib/money";
import type { PaymentView, Workflow } from "@/lib/types";

const phrases = ["Track every invoice.", "Follow up with confidence.", "Verify every payment.", "Keep proof of settlement."];
const stages = [
  { id: "created", index: "01", label: "Invoice created", state: "INVOICE CREATED" },
  { id: "outstanding", index: "02", label: "Payment outstanding", state: "FOLLOW-UP READY" },
  { id: "submitted", index: "03", label: "Submitted for verification", state: "PAYMENT VERIFICATION" },
  { id: "verified", index: "04", label: "Receipt available", state: "SETTLEMENT CONFIRMED" },
] as const;

type StageId = (typeof stages)[number]["id"];

const sampleBase = {
  id: "sample-invoice",
  reference: "SS-DEMO",
  clientName: "Northline Atelier",
  clientEmail: "studio@northline.example",
  clientCompany: "Northline",
  description: "Brand system and launch kit",
  amountCents: 240000,
  currency: "USDC",
  issueDate: "2026-03-12",
  dueDate: "2026-04-02",
  recipientAddress: "0x1111111111111111111111111111111111111111",
  notes: "Illustrative sample. Not part of the workspace ledger.",
  createdAt: "2026-03-12T15:00:00.000Z",
  updatedAt: "2026-04-02T15:00:00.000Z",
};

const samplePayment = (kind: PaymentView["kind"], counts: boolean): PaymentView => ({
  id: kind === "demo" ? "sample-demo" : "sample-pending",
  invoiceId: sampleBase.id,
  amountCents: counts ? 240000 : 0,
  currency: "USDC",
  network: "arc-testnet",
  recipientAddress: sampleBase.recipientAddress,
  txHash: counts ? "demo-fixture:landing-sample" : "0xsample",
  kind,
  isDemo: kind === "demo",
  countsTowardBalance: counts,
  explorerUrl: "",
  summary: counts ? "Labelled sample settlement. Arc was not queried." : "Stored hash. Not a verification.",
  checks: [],
  createdAt: "2026-04-08T15:00:00.000Z",
});

function sampleView(stage: StageId) {
  const workflow: Workflow = stage === "created" ? "draft" : stage === "submitted" ? "verification_pending" : "open";
  const payments = stage === "verified" ? [samplePayment("demo", true)] : stage === "submitted" ? [samplePayment("unverified", false)] : [];
  return assembleInvoice({
    ...sampleBase,
    workflow,
    payments,
    followUps: [],
    today: "2026-04-10",
    leadDays: 5,
  });
}

const stageCopy: Record<StageId, string> = {
  created: "The invoice exists as a draft. It is not chased, and it does not change the open balance.",
  outstanding: "The balance is open. A client promise does not reduce it. The follow-up below is generated from this sample.",
  submitted: "A hash can be stored while checks run. Until chain, receipt, recipient, and amount all pass, it stays unverified.",
  verified: "This frame shows a labelled sample receipt state. It does not query Arc and does not write to your ledger.",
};

const faqs = [
  ["Does SettleSignal send follow-ups for me?", "No. Drafts are generated from the invoice so you can edit and copy them. Marking a message sent only records that you sent it yourself."],
  ["Is a client promise the same as payment?", "No. Communication status and payment status are separate. A reply can be recorded without reducing the balance."],
  ["Is payment verification live?", "The lookup calls Arc's public RPC for the network you select. A hash is unverified until chain ID, successful receipt, recipient, and amount all pass. If the RPC is unreachable, nothing is marked paid. The landing demonstration does not perform that lookup."],
  ["Can the same transfer be counted twice?", "No. A live transfer is keyed by network and hash. A repeated or overlapping submission is rejected and is not added to the balance again."],
  ["What is a sample receipt?", "Demo settlements can print a receipt watermarked as a sample. They are not evidence of an Arc transfer. Verified receipts appear only after a live lookup passes."],
  ["Where is the data stored?", "This deployment keeps one demonstration ledger in PostgreSQL on this server. It survives a reload. It is not a personal account and does not sync across devices."],
];

const typeWords = ["owed", "settled", "verified", "outstanding", "due", "collected", "confirmed"];

function TypeWord() {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [chars, setChars] = useState(typeWords[0].length);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (reduced) return;
    const word = typeWords[index];
    let delay = deleting ? 40 : 75;
    if (!deleting && chars === word.length) delay = 1600;
    else if (deleting && chars === 0) delay = 350;
    const timer = window.setTimeout(() => {
      if (!deleting) {
        if (chars === word.length) setDeleting(true);
        else setChars((value) => value + 1);
      } else if (chars === 0) {
        setDeleting(false);
        setIndex((value) => (value + 1) % typeWords.length);
      } else {
        setChars((value) => value - 1);
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [chars, deleting, index, reduced]);

  if (reduced) return <>{typeWords[0]}</>;
  return <>{typeWords[index].slice(0, chars)}</>;
}

function WordLine({ text, delay }: { text: string; delay: number }) {
  const reduced = useReducedMotion();
  const words = text.split(" ");
  return (
    <span className="display-line">
      {words.map((word, index) => (
        <motion.span
          className="word"
          key={`${word}-${index}`}
          initial={reduced ? false : { opacity: 0, y: 22, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.7, delay: delay + index * 0.07, ease: [0.22, 1, 0.36, 1] }}
        >
          {word}{" "}
        </motion.span>
      ))}
    </span>
  );
}

export function LandingPage() {
  const reduced = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const [phrase, setPhrase] = useState(0);
  const [stage, setStage] = useState<StageId>("outstanding");
  const [copied, setCopied] = useState("");
  const [videoOn, setVideoOn] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const invoice = useMemo(() => sampleView(stage), [stage]);
  const draft = renderFollowUp({
    tone: "professional",
    clientName: sampleBase.clientName,
    reference: sampleBase.reference,
    description: sampleBase.description,
    amountLabel: formatUsdc(sampleBase.amountCents),
    currency: "USDC",
    dueLabel: "Apr 2, 2026",
    recipientAddress: sampleBase.recipientAddress,
    networkName: "Arc Testnet",
    ownerName: "Avery Lang",
    businessName: "Avery Lang Studio",
    email: "avery@langstudio.co",
  });
  const active = stages.find((item) => item.id === stage) ?? stages[1];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setPhrase((value) => (value + 1) % phrases.length), 2800);
    return () => window.clearInterval(id);
  }, [reduced]);

  const links = [
    ["#workflow", "How it works"],
    ["#product", "Product"],
    ["#verification", "Verification"],
    ["#faq", "FAQ"],
  ] as const;

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className={`site-header ${scrolled ? "scrolled" : ""}`}>
        <Logo />
        <nav className="nav-links" aria-label="Landing">
          {links.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
        </nav>
        <div className="header-actions">
          <Link className="btn-primary btn-small" href="/workspace">Launch app</Link>
          <button type="button" className="icon-btn landing-toggle" aria-expanded={menu} aria-label="Open menu" onClick={() => setMenu((value) => !value)}>
            {menu ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>
      {menu ? (
        <div className="landing-menu">
          {links.map(([href, label]) => <a key={href} href={href} onClick={() => setMenu(false)}>{label}</a>)}
          <Link href="/workspace" onClick={() => setMenu(false)}>Launch app</Link>
        </div>
      ) : null}
      <main id="main">
        <section className="hero">
          <div className="meta-strip">
            <span>INVOICE MANAGEMENT / PAYMENT VERIFICATION</span>
            <span>ARC TESTNET 5042002</span>
            <span>USDC</span>
            <span>DEMO LEDGER</span>
          </div>
          <div className="hero-grid">
            <div>
              <h1 className="display">
                <span className="sr-only">Know what's owed. Know what's settled.</span>
                <span className="display-visual" aria-hidden="true">
                  <WordLine text="Know what's" delay={0.05} />
                  <span className="display-line type-line">
                    <em className="type-word"><TypeWord />.</em>
                    {!reduced ? <span className="type-caret" /> : null}
                  </span>
                </span>
              </h1>
              <p className="lede">Track unpaid invoices, follow up with confidence, and keep trustworthy evidence of payments in one workspace.</p>
              <p className="phrase-cycle">
                <span className="sr-only">{phrases.join(" ")}</span>
                <span aria-hidden="true" key={reduced ? "still" : phrase}>{phrases[reduced ? 0 : phrase]}</span>
              </p>
              <div className="cta-row">
                <Link className="btn-primary" href="/workspace">Get started <ArrowRight size={16} /></Link>
                <a className="btn-ghost" href="#workflow">Explore how it works</a>
              </div>
            </div>
            <div className="hero-rail" aria-label="Illustrative settlement stages">
              <p className="index-no">ILLUSTRATIVE DEMO · NOT A LIVE TRANSFER</p>
              <div className="flow-rail">
                {stages.map((item) => (
                  <button key={item.id} type="button" className={`flow-node ${stage === item.id ? "on" : ""}`} aria-pressed={stage === item.id} onClick={() => setStage(item.id)}>
                    <span>{item.index}</span>
                    <strong>{item.label}</strong>
                  </button>
                ))}
              </div>
              <div className="signal-track" aria-hidden="true"><i style={{ width: `${((stages.findIndex((item) => item.id === stage) + 1) / stages.length) * 100}%` }} /></div>
              <p className="state-label">{active.state}</p>
              <p>{stageCopy[stage]}</p>
              <p className="hash">{invoice.reference} · {formatUsdc(invoice.remainingCents)} {invoice.currency} remaining</p>
            </div>
          </div>
        </section>

        <section className="section" id="problem">
          <div className="section-head">
            <div>
              <p className="eyebrow"><i /> The problem</p>
              <h2>The work can be finished. <em>The payment is still a question.</em></h2>
            </div>
            <p className="quiet">Unpaid invoices, missed reminders, and a hash in an email thread are three different problems. A promise to pay is not a settlement, and a finished animation is not proof.</p>
          </div>
          <div className="problem-grid">
            <article><span>01</span><strong>Open balances hide in memory.</strong><p>Due dates pass while the record of who owes what stays in a spreadsheet or a sent folder.</p></article>
            <article><span>02</span><strong>Follow-up starts from scratch.</strong><p>The amount, due date, and recipient should already be in the note you send.</p></article>
            <article><span>03</span><strong>A hash is not a receipt.</strong><p>Until the network, recipient, and amount check out, the invoice is still open.</p></article>
          </div>
        </section>

        <section className="section" id="workflow">
          <div className="section-head">
            <div>
              <p className="eyebrow"><i /> How it works</p>
              <h2>Track. Follow up. Verify. Prove.</h2>
            </div>
          </div>
          <div className="workflow">
            {[
              ["01", "Track", "See who is unpaid, due soon, overdue, or only partly recorded.", "/workspace"],
              ["02", "Follow up", "Draft a friendly, professional, or firm note. You send it.", "/workspace/follow-ups"],
              ["03", "Verify", "Look up an Arc hash, or run a demo that stays labelled as a demo.", "/workspace/verify"],
              ["04", "Prove", "Print a sample or a verified receipt. Mock data never wears a verified stamp.", "/workspace/receipts"],
            ].map(([index, title, copy, href]) => (
              <article className="step" key={index}>
                <b>{index}</b>
                <div>
                  <strong>{title}</strong>
                  <p className="quiet">{copy}</p>
                  <Link href={href}>Open in the app</Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="section" id="settlement">
          <div className="section-head">
            <div>
              <p className="eyebrow"><i /> Settlement flow</p>
              <h2>Four stages. One sample. No invented balance.</h2>
            </div>
            <p className="quiet">The figures come from the same status rules as the dashboard. Switching stages does not create an invoice or a transfer.</p>
          </div>
          <div className="evidence-grid">
            <div className="panel">
              <div className="flow-rail">
                {stages.map((item) => (
                  <button key={item.id} type="button" className={`flow-node ${stage === item.id ? "on" : ""}`} aria-pressed={stage === item.id} onClick={() => setStage(item.id)}>
                    <span>{item.index}</span>
                    <strong>{item.label}</strong>
                  </button>
                ))}
              </div>
              <div className="sample-record">
                <div className="stack">
                  <StatusPill status={invoice.paymentStatus} pastDue={invoice.pastDue} />
                  <VerificationBadge label={invoice.verificationLabel} />
                </div>
                <p className="money">{formatUsdc(invoice.remainingCents)} <small>remaining of {formatUsdc(invoice.amountCents)}</small></p>
                <p>{stageCopy[stage]}</p>
                {stage !== "created" ? (
                  <>
                    <p className="index-no">FOLLOW-UP SUGGESTION · TEMPLATE, NOT SENT</p>
                    <pre className="draft-preview">{draft}</pre>
                    <button type="button" className="btn-ghost btn-small" onClick={async () => setCopied(await copyText(draft) ? "Copied the sample draft." : "Copy failed.")}>Copy sample draft</button>
                    <p className="announce" role="status">{copied}</p>
                  </>
                ) : null}
              </div>
            </div>
            <SceneFrame variant="compact" />
          </div>
        </section>

        <section className="section" id="product">
          <div className="section-head">
            <div>
              <p className="eyebrow"><i /> Product</p>
              <h2>The workspace is the product. This page only points at it.</h2>
            </div>
          </div>
          <div className="module-grid">
            {[
              ["Invoices", "Create, edit, search, filter, archive, and export CSV.", "/workspace/invoices"],
              ["Follow-ups", "Three tones, a timeline, snooze, and a recorded reply.", "/workspace/follow-ups"],
              ["Verification", "Public Arc lookup. No seed phrase. No double count.", "/workspace/verify"],
              ["Receipts", "Sample watermark or a verified receipt. Never both at once.", "/workspace/receipts"],
            ].map(([title, copy, href]) => (
              <Link className="module-card lift" key={title} href={href}>
                <span className="index-no">OPEN</span>
                <strong>{title}</strong>
                <p className="quiet">{copy}</p>
              </Link>
            ))}
          </div>
          <div className="photo-grid" style={{ marginTop: 18 }}>
            {photos.map((photo) => (
              <figure className="photo-card" key={photo.src}>
                <Image src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} />
                <figcaption>
                  <strong>{photo.caption}</strong>
                  <small> {photo.credit}, Pexels</small>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="section" id="verification">
          <div className="section-head">
            <div>
              <p className="eyebrow"><i /> Evidence</p>
              <h2>What is implemented, and what is not claimed.</h2>
            </div>
          </div>
          <div className="evidence-grid">
            <article className="module-card">
              <span className="index-no">IMPLEMENTED</span>
              <strong>Invoice tracking, drafts, Arc lookup, receipts, CSV.</strong>
              <p className="quiet">Live lookup uses the documented Arc endpoints. Testnet is chain 5042002. Mainnet is chain 5042. USDC is read from the 18-decimal system transfer, not mixed with the 6-decimal interface. A failed or missing lookup does not mark an invoice paid.</p>
              <p className="quiet">Seeded settlements in the workspace are labelled demos. Verified-on-Arc starts at zero until a lookup passes.</p>
            </article>
            <div className="cinema-media">
              {!reduced && videoOn && !videoFailed ? (
                <video autoPlay muted loop playsInline poster={videoCredit.poster} onError={() => setVideoFailed(true)}>
                  <source src={videoCredit.src} type="video/mp4" />
                </video>
              ) : (
                <Image src="/images/hero-poster.jpg" alt="Still of a glass ring used when the atmospheric video is paused." width={1672} height={941} />
              )}
              <p>Atmospheric loop · not a transaction</p>
              {!videoOn && !reduced ? <button type="button" className="btn-ghost btn-small cinema-load" onClick={() => setVideoOn(true)}>Load atmospheric loop</button> : null}
            </div>
          </div>
        </section>

        <section className="section" id="faq">
          <div className="section-head">
            <div>
              <p className="eyebrow"><i /> FAQ</p>
              <h2>The practical answers.</h2>
            </div>
          </div>
          <div className="faq">
            {faqs.map(([question, answer]) => (
              <details key={question}>
                <summary>{question}</summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="section close-band">
          <p className="eyebrow"><i /> Open the ledger</p>
          <h2>Test the workflow on the seeded workspace.</h2>
          <div className="cta-row">
            <Link className="btn-primary" href="/workspace">Get started</Link>
            <a className="btn-ghost" href="#settlement">Review the sample stages</a>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <Logo />
        <p>SettleSignal is a demonstration ledger on this server. It is not a bank, a wallet, or a production billing system.</p>
        <p>Photographs by {photos.map((photo) => photo.credit).join(", ")}. Atmospheric loop by {videoCredit.creator}, Pexels License. Arc network facts from the official connection reference.</p>
        <p><a href="https://docs.arc.io/arc/references/connect-to-arc">Arc network reference</a> · <a href="https://docs.arc.io/arc/references/contract-addresses">Contract addresses</a></p>
      </footer>
    </>
  );
}
