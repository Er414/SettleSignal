import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { activities, followUps, invoices, payments, workspaceSettings } from "@/db/schema";
import { networkById, rpcHost } from "@/lib/arc";
import { assembleInvoice, buildActions, buildMetrics } from "@/lib/domain";
import { todayInTimeZone } from "@/lib/dates";
import { formatUsdc } from "@/lib/money";
import type {
  ActivityView,
  Check,
  FollowStatus,
  FollowUpView,
  PaymentKind,
  PaymentView,
  SettingsView,
  Tone,
  Workflow,
  WorkspaceData,
} from "@/lib/types";
import { activeRpcUrl } from "./arc-rpc";
import { ensureWorkspace } from "./seed";
import { requireWorkspaceAccess } from "./access";

function iso(value: Date | string | null | undefined): string {
  if (!value) return new Date(0).toISOString();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

function parseChecks(raw: string): Check[] {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const row = item as Record<string, unknown>;
      if (typeof row.id !== "string" || typeof row.label !== "string" || typeof row.detail !== "string" || typeof row.passed !== "boolean") {
        return [];
      }
      return [{ id: row.id, label: row.label, passed: row.passed, detail: row.detail }];
    });
  } catch {
    return [];
  }
}

function asWorkflow(value: string): Workflow {
  if (value === "draft" || value === "open" || value === "verification_pending" || value === "archived") return value;
  return "open";
}

function asTone(value: string): Tone {
  if (value === "friendly" || value === "professional" || value === "firm") return value;
  return "professional";
}

function asFollowStatus(value: string): FollowStatus {
  if (value === "draft" || value === "snoozed" || value === "sent" || value === "responded") return value;
  return "draft";
}

function asKind(value: string): PaymentKind {
  if (value === "demo" || value === "live" || value === "unverified" || value === "rejected") return value;
  return "unverified";
}

export async function loadWorkspace(): Promise<WorkspaceData> {
  await requireWorkspaceAccess();
  await ensureWorkspace();
  const [settingsRow] = await db.select().from(workspaceSettings).limit(1);
  if (!settingsRow) throw new Error("Workspace settings missing");
  const network = networkById(settingsRow.network);
  const rpcUrl = activeRpcUrl(network.id);
  const settings: SettingsView = {
    businessName: settingsRow.businessName,
    ownerName: settingsRow.ownerName,
    email: settingsRow.email,
    timezone: settingsRow.timezone,
    displayCurrency: settingsRow.displayCurrency,
    reminderLeadDays: settingsRow.reminderLeadDays,
    defaultTone: asTone(settingsRow.defaultTone),
    network: network.id,
    recipientAddress: settingsRow.recipientAddress,
    networkName: network.name,
    chainId: network.chainId,
    explorerUrl: network.explorerUrl,
    rpcHost: rpcHost(rpcUrl),
    faucetUrl: network.faucetUrl,
    docsUrl: network.docsUrl,
    dataMode: "Demonstration ledger stored in PostgreSQL on this server. It does not sync to a personal account.",
  };
  const today = todayInTimeZone(settings.timezone);
  const [invoiceRows, paymentRows, followRows, activityRows] = await Promise.all([
    db.select().from(invoices),
    db.select().from(payments),
    db.select().from(followUps),
    db.select().from(activities).orderBy(desc(activities.createdAt)).limit(12),
  ]);

  const paymentViews: PaymentView[] = paymentRows.map((row) => ({
    id: row.id,
    invoiceId: row.invoiceId,
    amountCents: row.amountCents,
    currency: row.currency,
    network: row.network,
    recipientAddress: row.recipientAddress,
    txHash: row.txHash,
    kind: asKind(row.kind),
    isDemo: row.isDemo,
    countsTowardBalance: row.countsTowardBalance,
    explorerUrl: row.explorerUrl,
    summary: row.summary,
    checks: parseChecks(row.checksJson),
    createdAt: iso(row.createdAt),
  }));
  const followViews: FollowUpView[] = followRows.map((row) => ({
    id: row.id,
    invoiceId: row.invoiceId,
    tone: asTone(row.tone),
    body: row.body,
    status: asFollowStatus(row.status),
    snoozeUntil: row.snoozeUntil,
    sentAt: row.sentAt ? iso(row.sentAt) : null,
    responseNote: row.responseNote,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  }));
  const invoiceViews = invoiceRows
    .map((row) =>
      assembleInvoice({
        id: row.id,
        reference: row.reference,
        clientName: row.clientName,
        clientEmail: row.clientEmail,
        clientCompany: row.clientCompany,
        description: row.description,
        amountCents: row.amountCents,
        currency: row.currency,
        issueDate: row.issueDate,
        dueDate: row.dueDate,
        recipientAddress: row.recipientAddress,
        workflow: asWorkflow(row.workflow),
        notes: row.notes,
        createdAt: iso(row.createdAt),
        updatedAt: iso(row.updatedAt),
        payments: paymentViews.filter((payment) => payment.invoiceId === row.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
        followUps: followViews.filter((item) => item.invoiceId === row.id).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
        today,
        leadDays: settings.reminderLeadDays,
      }),
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.reference.localeCompare(b.reference));
  const activityViews: ActivityView[] = activityRows.map((row) => ({
    id: row.id,
    invoiceId: row.invoiceId,
    kind: row.kind,
    message: row.message,
    createdAt: iso(row.createdAt),
  }));
  return {
    settings,
    today,
    invoices: invoiceViews,
    activities: activityViews,
    metrics: buildMetrics(invoiceViews),
    actions: buildActions(invoiceViews),
  };
}

export async function findInvoice(id: string) {
  const data = await loadWorkspace();
  return { data, invoice: data.invoices.find((invoice) => invoice.id === id) ?? null };
}

export function receiptDocument(data: WorkspaceData, paymentId: string) {
  const payment = data.invoices.flatMap((invoice) => invoice.payments.map((item) => ({ invoice, payment: item }))).find((item) => item.payment.id === paymentId);
  if (!payment) return null;
  if (!payment.payment.countsTowardBalance || (payment.payment.kind !== "demo" && payment.payment.kind !== "live")) return { eligible: false as const, payment: payment.payment, invoice: payment.invoice };
  const sample = payment.payment.kind === "demo";
  const lines = [
    sample ? "SAMPLE RECEIPT — NOT VERIFIED ON ARC" : "PAYMENT RECEIPT — VERIFIED ON ARC",
    "",
    data.settings.businessName,
    data.settings.ownerName,
    data.settings.email,
    "",
    `Invoice: ${payment.invoice.reference}`,
    `Client: ${payment.invoice.clientName}`,
    payment.invoice.clientCompany ? `Company: ${payment.invoice.clientCompany}` : "",
    `Description: ${payment.invoice.description}`,
    `Invoice total: ${formatUsdc(payment.invoice.amountCents)} ${payment.invoice.currency}`,
    `This payment: ${formatUsdc(payment.payment.amountCents)} ${payment.payment.currency}`,
    `Workspace remaining: ${formatUsdc(payment.invoice.remainingCents)} ${payment.invoice.currency}`,
    `Network: ${networkById(payment.payment.network).name}`,
    `Recipient: ${payment.payment.recipientAddress || "Not recorded"}`,
    `Reference: ${payment.payment.txHash || "Not recorded"}`,
    payment.payment.explorerUrl ? `Explorer: ${payment.payment.explorerUrl}` : "Explorer: not available for this record",
    `Recorded: ${payment.payment.createdAt}`,
    "",
    sample
      ? "This sample was generated from a labelled demonstration. It is not evidence that a transfer settled on Arc."
      : "This receipt reflects a live Arc lookup that passed recipient, receipt, chain, and amount checks in SettleSignal.",
    payment.payment.summary,
  ].filter((line) => line !== "");
  return {
    eligible: true as const,
    sample,
    invoice: payment.invoice,
    payment: payment.payment,
    text: `${lines.join("\n")}\n`,
    filename: sample ? `SettleSignal-${payment.invoice.reference}-sample.txt` : `SettleSignal-${payment.invoice.reference}-verified.txt`,
  };
}

export async function loadReceipt(paymentId: string) {
  const data = await loadWorkspace();
  return { data, receipt: receiptDocument(data, paymentId) };
}

export async function invoiceCsv(): Promise<string> {
  const { toCsv } = await import("@/lib/csv");
  const { STATUS_LABEL, COMM_LABEL } = await import("@/lib/types");
  const { formatUsdc } = await import("@/lib/money");
  const data = await loadWorkspace();
  return toCsv(
    ["reference", "client", "company", "email", "description", "amount", "currency", "paid", "remaining", "issue_date", "due_date", "status", "communication", "recipient", "verification"],
    data.invoices.map((invoice) => [
      invoice.reference,
      invoice.clientName,
      invoice.clientCompany,
      invoice.clientEmail,
      invoice.description,
      formatUsdc(invoice.amountCents),
      invoice.currency,
      formatUsdc(invoice.paidCents),
      formatUsdc(invoice.remainingCents),
      invoice.issueDate,
      invoice.dueDate,
      STATUS_LABEL[invoice.paymentStatus],
      COMM_LABEL[invoice.communicationStatus],
      invoice.recipientAddress,
      invoice.verificationLabel,
    ]),
  );
}

export async function getSettingsRow() {
  await ensureWorkspace();
  const [row] = await db.select().from(workspaceSettings).where(eq(workspaceSettings.id, "default"));
  return row;
}
