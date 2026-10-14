import { db } from "@/db";
import { activities, followUps, invoices, payments, workspaceSettings } from "@/db/schema";
import { ARC_NETWORKS } from "@/lib/arc";
import { addDays, formatLongDate, todayInTimeZone } from "@/lib/dates";
import { renderFollowUp } from "@/lib/followups";
import { formatUsdc } from "@/lib/money";
import { ensureSchema } from "./migrate";

const RECIPIENT = "0x1111111111111111111111111111111111111111";

export async function ensureWorkspace() {
  await ensureSchema();
  const existing = await db.select({ id: workspaceSettings.id }).from(workspaceSettings).limit(1);
  if (existing.length > 0) return;
  await db.transaction(async (tx) => {
    const again = await tx.select({ id: workspaceSettings.id }).from(workspaceSettings).limit(1);
    if (again.length > 0) return;
    await insertDemo(tx);
  });
}

export async function resetWorkspace() {
  await ensureSchema();
  await db.transaction(async (tx) => {
    await tx.delete(activities);
    await tx.delete(invoices);
    await tx.delete(workspaceSettings);
    await insertDemo(tx);
  });
}

type Executor = Pick<typeof db, "insert">;

async function insertDemo(tx: Executor) {
  const today = todayInTimeZone("America/New_York");
  const networkName = ARC_NETWORKS["arc-testnet"].name;
  await tx.insert(workspaceSettings).values({
    id: "default",
    businessName: "Avery Lang Studio",
    ownerName: "Avery Lang",
    email: "avery@langstudio.co",
    timezone: "America/New_York",
    displayCurrency: "USDC",
    reminderLeadDays: 5,
    defaultTone: "professional",
    network: "arc-testnet",
    recipientAddress: RECIPIENT,
  });

  const rows = [
    {
      reference: "SS-2401",
      clientName: "Maya Chen",
      clientEmail: "maya@northline.studio",
      clientCompany: "Northline Atelier",
      description: "Brand system, guidelines, and launch kit",
      amountCents: 480000,
      issueDate: addDays(today, -28),
      dueDate: addDays(today, -6),
      workflow: "open",
      notes: "Final files delivered. A revised usage sheet was sent the same week.",
    },
    {
      reference: "SS-2402",
      clientName: "Jonah Ellis",
      clientEmail: "jonah@harborandco.com",
      clientCompany: "Harbor & Co",
      description: "Marketing site sprint",
      amountCents: 215000,
      issueDate: addDays(today, -10),
      dueDate: addDays(today, 3),
      workflow: "open",
      notes: "Staging link approved. Launch is waiting on their copy deck.",
    },
    {
      reference: "SS-2403",
      clientName: "Priya Shah",
      clientEmail: "priya@kiteanalytics.com",
      clientCompany: "Kite Analytics",
      description: "Internal reporting dashboard",
      amountCents: 640000,
      issueDate: addDays(today, -4),
      dueDate: addDays(today, 16),
      workflow: "open",
      notes: "Milestone two is in review. Follow-up is snoozed until after their board meeting.",
    },
    {
      reference: "SS-2404",
      clientName: "Adewale Okonkwo",
      clientEmail: "billing@lumenhealth.co",
      clientCompany: "Lumen Health",
      description: "Advisory retainer",
      amountCents: 180000,
      issueDate: addDays(today, -21),
      dueDate: addDays(today, -2),
      workflow: "open",
      notes: "A partial demo settlement is on file. The balance is still open.",
    },
    {
      reference: "SS-2405",
      clientName: "Elena Voss",
      clientEmail: "elena@fieldnote.press",
      clientCompany: "Fieldnote Press",
      description: "Editorial illustration set",
      amountCents: 90000,
      issueDate: addDays(today, -45),
      dueDate: addDays(today, -18),
      workflow: "open",
      notes: "Closed in the workspace with a labelled demo settlement. Not verified on Arc.",
    },
    {
      reference: "SS-2406",
      clientName: "Chris Adelman",
      clientEmail: "chris@atlaspress.co",
      clientCompany: "Atlas Press",
      description: "Catalog redesign, not yet issued",
      amountCents: 320000,
      issueDate: today,
      dueDate: addDays(today, 21),
      workflow: "draft",
      notes: "Waiting on the page count before this leaves draft.",
    },
    {
      reference: "SS-2407",
      clientName: "Nina Park",
      clientEmail: "nina.park@sablerobotics.com",
      clientCompany: "Sable Robotics",
      description: "Motion study and interface prototype",
      amountCents: 275000,
      issueDate: addDays(today, -14),
      dueDate: addDays(today, -1),
      workflow: "verification_pending",
      notes: "Client sent a hash by email. It has not been confirmed on Arc.",
    },
  ];

  const inserted = await tx.insert(invoices).values(rows.map((row) => ({ ...row, currency: "USDC", recipientAddress: RECIPIENT }))).returning();
  const byRef = new Map(inserted.map((row) => [row.reference, row]));
  const northline = byRef.get("SS-2401");
  const harbor = byRef.get("SS-2402");
  const kite = byRef.get("SS-2403");
  const lumen = byRef.get("SS-2404");
  const fieldnote = byRef.get("SS-2405");
  const sable = byRef.get("SS-2407");
  if (!northline || !harbor || !kite || !lumen || !fieldnote || !sable) return;

  const draftFor = (row: typeof northline, tone: "friendly" | "professional" | "firm") =>
    renderFollowUp({
      tone,
      clientName: row.clientName,
      reference: row.reference,
      description: row.description,
      amountLabel: formatUsdc(row.amountCents),
      currency: "USDC",
      dueLabel: formatLongDate(row.dueDate),
      recipientAddress: RECIPIENT,
      networkName,
      ownerName: "Avery Lang",
      businessName: "Avery Lang Studio",
      email: "avery@langstudio.co",
    });

  await tx.insert(followUps).values([
    {
      invoiceId: northline.id,
      tone: "professional",
      body: draftFor(northline, "professional"),
      status: "sent",
      sentAt: new Date(Date.now() - 4 * 86400000),
      responseNote: "",
    },
    {
      invoiceId: harbor.id,
      tone: "friendly",
      body: draftFor(harbor, "friendly"),
      status: "draft",
      responseNote: "",
    },
    {
      invoiceId: kite.id,
      tone: "professional",
      body: draftFor(kite, "professional"),
      status: "snoozed",
      snoozeUntil: addDays(today, 6),
      responseNote: "",
    },
    {
      invoiceId: lumen.id,
      tone: "professional",
      body: draftFor(lumen, "professional"),
      status: "responded",
      sentAt: new Date(Date.now() - 3 * 86400000),
      responseNote: "Accounts payable will release the balance this Friday. No transaction hash yet.",
    },
  ]);

  await tx.insert(payments).values([
    {
      invoiceId: lumen.id,
      amountCents: 60000,
      currency: "USDC",
      network: "arc-testnet",
      recipientAddress: RECIPIENT,
      txHash: "demo-fixture:signal-partial",
      transferKey: `demo:${lumen.id}:signal-partial`,
      kind: "demo",
      isDemo: true,
      countsTowardBalance: true,
      explorerUrl: "",
      summary: "Labelled demo settlement for part of the retainer. Arc was not queried.",
      checksJson: JSON.stringify([
        { id: "demo", label: "Labelled demonstration", passed: true, detail: "Created inside SettleSignal. Not an Arc lookup." },
        { id: "chain", label: "On-chain verification", passed: false, detail: "Demo records are not evidence of payment." },
      ]),
    },
    {
      invoiceId: fieldnote.id,
      amountCents: 90000,
      currency: "USDC",
      network: "arc-testnet",
      recipientAddress: RECIPIENT,
      txHash: "demo-fixture:signal-complete",
      transferKey: `demo:${fieldnote.id}:signal-complete`,
      kind: "demo",
      isDemo: true,
      countsTowardBalance: true,
      explorerUrl: "",
      summary: "Labelled demo settlement for the full illustration invoice. Not verified on Arc.",
      checksJson: JSON.stringify([
        { id: "demo", label: "Labelled demonstration", passed: true, detail: "Created inside SettleSignal. Not an Arc lookup." },
        { id: "chain", label: "On-chain verification", passed: false, detail: "Do not present this sample as a verified receipt." },
      ]),
    },
    {
      invoiceId: sable.id,
      amountCents: 0,
      currency: "USDC",
      network: "arc-testnet",
      recipientAddress: RECIPIENT,
      txHash: "0xabababababababababababababababababababababababababababababababab",
      kind: "unverified",
      isDemo: false,
      countsTowardBalance: false,
      explorerUrl: "",
      summary: "Hash stored from a client email. No Arc lookup has confirmed this transfer.",
      checksJson: JSON.stringify([
        { id: "stored", label: "Hash stored", passed: true, detail: "The hash is on the invoice for review." },
        { id: "verified", label: "Settlement verified", passed: false, detail: "A stored hash is not a successful verification." },
      ]),
    },
  ]);

  await tx.insert(activities).values([
    { invoiceId: northline.id, kind: "followup", message: "Professional follow-up for SS-2401 marked sent. Payment status unchanged." },
    { invoiceId: lumen.id, kind: "demo", message: "Demo settlement of 600.00 USDC recorded on SS-2404. Not an Arc verification." },
    { invoiceId: lumen.id, kind: "followup", message: "Client response recorded for SS-2404. The invoice was not marked paid." },
    { invoiceId: fieldnote.id, kind: "demo", message: "Demo settlement recorded for SS-2405. Sample receipt only." },
    { invoiceId: sable.id, kind: "verify", message: "Unverified hash stored for SS-2407. Settlement is still pending." },
    { invoiceId: null, kind: "workspace", message: "Demonstration workspace ready. Records live in this server's database." },
  ]);
}
