"use server";

import { and, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { activities, followUps, invoices, payments, workspaceSettings } from "@/db/schema";
import { DEMO_FIXTURES, demoSettlementCents, evaluateArcTransfer, explorerTxUrl, networkById } from "@/lib/arc";
import { isIsoDate, todayInTimeZone } from "@/lib/dates";
import { isTxHash, nextReference, validateInvoiceInput, validateSettingsInput } from "@/lib/domain";
import { formatUsdc } from "@/lib/money";
import { demoTransferKey, isUniqueViolation, liveTransferKey } from "@/lib/transfers";
import type { ActionResult, FollowStatus, Tone, Workflow } from "@/lib/types";
import { activeRpcUrl, fetchArcSnapshot } from "./arc-rpc";
import { ensureWorkspace, resetWorkspace } from "./seed";

function refresh() {
  revalidatePath("/workspace", "layout");
}

async function logActivity(invoiceId: string | null, kind: string, message: string) {
  await db.insert(activities).values({ invoiceId, kind, message });
}

export async function createInvoice(form: {
  clientName: string;
  clientEmail: string;
  clientCompany: string;
  description: string;
  amount: string;
  issueDate: string;
  dueDate: string;
  recipientAddress: string;
  notes: string;
  currency: string;
  workflow: Workflow;
}): Promise<ActionResult> {
  const parsed = validateInvoiceInput(form);
  if (!parsed.ok) return { ok: false, error: "Check the highlighted fields.", fieldErrors: parsed.fieldErrors };
  if (form.workflow !== "draft" && form.workflow !== "open") return { ok: false, error: "Choose draft or open." };
  try {
    await ensureWorkspace();
    const existing = await db.select({ reference: invoices.reference }).from(invoices);
    const reference = nextReference(existing.map((row) => row.reference));
    const [created] = await db
      .insert(invoices)
      .values({ ...parsed.value, reference, workflow: form.workflow })
      .returning({ id: invoices.id });
    await logActivity(created.id, "invoice", `${reference} ${form.workflow === "draft" ? "saved as a draft" : "opened for tracking"}.`);
    refresh();
    return { ok: true, id: created.id, message: form.workflow === "draft" ? "Draft saved." : "Invoice is now being tracked." };
  } catch (error) {
    console.error(error);
    return { ok: false, error: "The invoice could not be saved." };
  }
}

export async function updateInvoice(id: string, form: {
  clientName: string;
  clientEmail: string;
  clientCompany: string;
  description: string;
  amount: string;
  issueDate: string;
  dueDate: string;
  recipientAddress: string;
  notes: string;
  currency: string;
}): Promise<ActionResult> {
  const parsed = validateInvoiceInput(form);
  if (!parsed.ok) return { ok: false, error: "Check the highlighted fields.", fieldErrors: parsed.fieldErrors };
  try {
    const [existing] = await db.select().from(invoices).where(eq(invoices.id, id));
    if (!existing) return { ok: false, error: "That invoice is no longer available." };
    await db.update(invoices).set({ ...parsed.value, updatedAt: new Date() }).where(eq(invoices.id, id));
    await logActivity(id, "invoice", `${existing.reference} details were updated.`);
    refresh();
    return { ok: true, id, message: "Invoice updated." };
  } catch (error) {
    console.error(error);
    return { ok: false, error: "The invoice could not be updated." };
  }
}

export async function setWorkflow(id: string, workflow: Workflow): Promise<ActionResult> {
  if (workflow !== "draft" && workflow !== "open" && workflow !== "archived" && workflow !== "verification_pending") {
    return { ok: false, error: "That status change is not available." };
  }
  try {
    const [existing] = await db.select().from(invoices).where(eq(invoices.id, id));
    if (!existing) return { ok: false, error: "That invoice is no longer available." };
    await db.update(invoices).set({ workflow, updatedAt: new Date() }).where(eq(invoices.id, id));
    const label = workflow === "archived" ? "archived" : workflow === "open" ? "returned to open tracking" : workflow === "draft" ? "moved back to draft" : "marked verification pending";
    await logActivity(id, "workflow", `${existing.reference} was ${label}.`);
    refresh();
    return { ok: true, message: `${existing.reference} ${label}.` };
  } catch (error) {
    console.error(error);
    return { ok: false, error: "The invoice status could not be changed." };
  }
}

export async function saveFollowUp(input: {
  invoiceId: string;
  tone: Tone;
  body: string;
  intent: FollowStatus;
  snoozeUntil?: string;
  responseNote?: string;
}): Promise<ActionResult> {
  const body = input.body.trim();
  if (input.tone !== "friendly" && input.tone !== "professional" && input.tone !== "firm") {
    return { ok: false, error: "Choose a follow-up tone." };
  }
  if (body.length < 12 || body.length > 4000) return { ok: false, error: "Write a follow-up before saving it." };
  try {
    await ensureWorkspace();
    const [settings] = await db.select().from(workspaceSettings).limit(1);
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, input.invoiceId));
    if (!invoice || !settings) return { ok: false, error: "That invoice is no longer available." };
    if (invoice.workflow === "draft" || invoice.workflow === "archived") {
      return { ok: false, error: "Issue the invoice before preparing a follow-up." };
    }
    const today = todayInTimeZone(settings.timezone);
    let snoozeUntil: string | null = null;
    let responseNote = "";
    let sentAt: Date | null = null;
    if (input.intent === "snoozed") {
      if (!input.snoozeUntil || !isIsoDate(input.snoozeUntil) || input.snoozeUntil < today) {
        return { ok: false, error: "Choose a snooze date today or later." };
      }
      snoozeUntil = input.snoozeUntil;
    }
    if (input.intent === "sent") sentAt = new Date();
    if (input.intent === "responded") {
      responseNote = (input.responseNote || "").trim();
      if (responseNote.length < 2 || responseNote.length > 2000) return { ok: false, error: "Record what the client said." };
      sentAt = new Date();
    }
    const [latest] = await db.select().from(followUps).where(eq(followUps.invoiceId, invoice.id)).orderBy(desc(followUps.updatedAt)).limit(1);
    if (latest && (latest.status === "draft" || (input.intent !== "draft" && latest.status !== "responded"))) {
      await db
        .update(followUps)
        .set({
          tone: input.tone,
          body,
          status: input.intent,
          snoozeUntil,
          responseNote,
          sentAt: input.intent === "sent" || input.intent === "responded" ? sentAt : latest.sentAt,
          updatedAt: new Date(),
        })
        .where(eq(followUps.id, latest.id));
    } else {
      await db.insert(followUps).values({
        invoiceId: invoice.id,
        tone: input.tone,
        body,
        status: input.intent,
        snoozeUntil,
        responseNote,
        sentAt,
      });
    }
    const message =
      input.intent === "sent"
        ? `${invoice.reference} follow-up marked sent manually. SettleSignal did not contact the client.`
        : input.intent === "snoozed"
          ? `${invoice.reference} follow-up snoozed until ${snoozeUntil}.`
          : input.intent === "responded"
            ? `Client response recorded for ${invoice.reference}. Payment status was not changed.`
            : `Follow-up draft saved for ${invoice.reference}.`;
    await logActivity(invoice.id, "followup", message);
    refresh();
    return { ok: true, message };
  } catch (error) {
    console.error(error);
    return { ok: false, error: "The follow-up could not be saved." };
  }
}

export async function applyDemoSettlement(invoiceId: string, fixtureId: string): Promise<ActionResult> {
  const fixture = DEMO_FIXTURES.find((item) => item.id === fixtureId);
  if (!fixture) return { ok: false, error: "Choose a labelled demo fixture." };
  try {
    await ensureWorkspace();
    const [settings] = await db.select().from(workspaceSettings).limit(1);
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
    if (!invoice || !settings) return { ok: false, error: "That invoice is no longer available." };
    if (invoice.workflow === "draft" || invoice.workflow === "archived") {
      return { ok: false, error: "Issue the invoice before recording a demo settlement." };
    }
    const key = demoTransferKey(invoice.id, fixture.id);
    const recorded = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
      const existing = await tx
        .select({ id: payments.id })
        .from(payments)
        .where(and(eq(payments.invoiceId, invoice.id), eq(payments.txHash, `demo-fixture:${fixture.id}`), eq(payments.countsTowardBalance, true)))
        .limit(1);
      const keyed = await tx.select({ id: payments.id }).from(payments).where(eq(payments.transferKey, key)).limit(1);
      if (existing.length || keyed.length) return false;
      const counted = await tx.select().from(payments).where(eq(payments.invoiceId, invoice.id));
      const paid = counted.filter((row) => row.countsTowardBalance).reduce((sum, row) => sum + row.amountCents, 0);
      const remaining = Math.max(0, invoice.amountCents - paid);
      const amount = demoSettlementCents(fixture.id, remaining);
      if (amount <= 0) return false;
      const network = networkById(settings.network);
      await tx.insert(payments).values({
        invoiceId: invoice.id,
        amountCents: amount,
        currency: invoice.currency,
        network: network.id,
        recipientAddress: invoice.recipientAddress,
        txHash: `demo-fixture:${fixture.id}`,
        kind: "demo",
        isDemo: true,
        countsTowardBalance: true,
        explorerUrl: "",
        summary: `${fixture.title}. ${fixture.detail}`,
        checksJson: JSON.stringify([
          { id: "demo", label: "Labelled demonstration", passed: true, detail: "Arc was not queried. This is not a live settlement." },
          { id: "chain", label: "On-chain verification", passed: false, detail: "Demo receipts must stay marked as samples." },
        ]),
        transferKey: key,
      });
      return amount;
    });
    if (recorded === false) return { ok: false, error: "That demo fixture is already recorded on this invoice, or nothing remains. It was not counted again." };
    const amount = recorded;
    if (invoice.workflow === "verification_pending") {
      await db.update(invoices).set({ workflow: "open", updatedAt: new Date() }).where(eq(invoices.id, invoice.id));
    } else {
      await db.update(invoices).set({ updatedAt: new Date() }).where(eq(invoices.id, invoice.id));
    }
    await logActivity(invoice.id, "demo", `Demo settlement of ${formatUsdc(amount)} ${invoice.currency} recorded on ${invoice.reference}. Not verified on Arc.`);
    refresh();
    return { ok: true, message: "Demo settlement recorded. It is not an Arc verification." };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "That demo fixture is already recorded on this invoice. It was not counted again." };
    console.error(error);
    return { ok: false, error: "The demo settlement could not be recorded." };
  }
}

export async function verifyOnArc(invoiceId: string, hash: string, networkId: string): Promise<ActionResult> {
  const txHash = hash.trim();
  if (!isTxHash(txHash)) return { ok: false, error: "Enter a transaction hash: 0x followed by 64 hex characters." };
  const network = networkById(networkId);
  if (network.id !== networkId) return { ok: false, error: "Choose Arc Testnet or Arc mainnet." };
  try {
    await ensureWorkspace();
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
    if (!invoice) return { ok: false, error: "That invoice is no longer available." };
    if (invoice.workflow === "draft" || invoice.workflow === "archived") {
      return { ok: false, error: "Issue the invoice before verifying a payment." };
    }
    if (invoice.currency !== "USDC") return { ok: false, error: "Live verification is available for USDC invoices only." };
    const counted = await db.select().from(payments).where(eq(payments.invoiceId, invoice.id));
    const paid = counted.filter((row) => row.countsTowardBalance).reduce((sum, row) => sum + row.amountCents, 0);
    const remaining = Math.max(0, invoice.amountCents - paid);
    const snapshot = await fetchArcSnapshot(network.id, txHash);
    const decision = evaluateArcTransfer({
      expectedChainId: network.chainId,
      expectedRecipient: invoice.recipientAddress,
      remainingCents: remaining,
      safetyCapCents: 200_000_000,
      snapshot,
    });
    const verified = decision.outcome === "verified" && decision.amountCents > 0;
    const key = liveTransferKey(network.id, txHash);
    if (verified) {
      const credited = await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
        const prior = await tx
          .select({ id: payments.id })
          .from(payments)
          .where(
            and(
              eq(payments.network, network.id),
              eq(payments.kind, "live"),
              eq(payments.countsTowardBalance, true),
              sql`lower(${payments.txHash}) = ${txHash.toLowerCase()}`,
            ),
          )
          .limit(1);
        if (prior.length) return false;
        await tx.insert(payments).values({
          invoiceId: invoice.id,
          amountCents: decision.amountCents,
          currency: "USDC",
          network: network.id,
          recipientAddress: invoice.recipientAddress,
          txHash,
          kind: "live",
          isDemo: false,
          countsTowardBalance: true,
          explorerUrl: snapshot.txFound ? explorerTxUrl(network.explorerUrl, txHash) : "",
          summary: decision.summary,
          checksJson: JSON.stringify(decision.checks),
          transferKey: key,
        });
        await tx.update(invoices).set({ workflow: "open", updatedAt: new Date() }).where(eq(invoices.id, invoice.id));
        return true;
      });
      if (!credited) {
        return { ok: false, error: "This transfer is already recorded. It was not counted again." };
      }
      await logActivity(invoice.id, "verify", `Arc lookup verified ${formatUsdc(decision.amountCents)} USDC for ${invoice.reference}.`);
      refresh();
      return { ok: true, message: decision.summary };
    }
    await db.insert(payments).values({
      invoiceId: invoice.id,
      amountCents: 0,
      currency: "USDC",
      network: network.id,
      recipientAddress: invoice.recipientAddress,
      txHash,
      kind: decision.outcome === "failed_checks" ? "rejected" : "unverified",
      isDemo: false,
      countsTowardBalance: false,
      explorerUrl: snapshot.txFound ? explorerTxUrl(network.explorerUrl, txHash) : "",
      summary: decision.summary,
      checksJson: JSON.stringify(decision.checks),
    });
    await db.update(invoices).set({ workflow: "verification_pending", updatedAt: new Date() }).where(eq(invoices.id, invoice.id));
    await logActivity(
      invoice.id,
      "verify",
      verified
        ? `Arc lookup verified ${formatUsdc(decision.amountCents)} USDC for ${invoice.reference}.`
        : `Arc lookup did not verify ${invoice.reference}. ${decision.summary}`,
    );
    refresh();
    return { ok: true, message: decision.summary };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "This transfer is already recorded. It was not counted again." };
    console.error(error);
    return { ok: false, error: "The lookup could not be completed. Nothing was marked paid." };
  }
}

export async function updateSettings(input: {
  businessName: string;
  ownerName: string;
  email: string;
  timezone: string;
  reminderLeadDays: number;
  defaultTone: string;
  network: string;
  recipientAddress: string;
}): Promise<ActionResult> {
  const parsed = validateSettingsInput(input);
  if (!parsed.ok) return { ok: false, error: "Check the highlighted fields.", fieldErrors: parsed.fieldErrors };
  try {
    await ensureWorkspace();
    await db
      .update(workspaceSettings)
      .set({ ...parsed.value, displayCurrency: "USDC", updatedAt: new Date() })
      .where(eq(workspaceSettings.id, "default"));
    await logActivity(null, "settings", `Workspace settings saved. Live lookups use ${networkById(parsed.value.network).name}.`);
    refresh();
    return { ok: true, message: "Settings saved." };
  } catch (error) {
    console.error(error);
    return { ok: false, error: "Settings could not be saved." };
  }
}

export async function resetDemo(): Promise<ActionResult> {
  try {
    await resetWorkspace();
    refresh();
    return { ok: true, message: "Demonstration data has been reset." };
  } catch (error) {
    console.error(error);
    return { ok: false, error: "The demonstration data could not be reset." };
  }
}

export async function activeLookupHost(networkId: string): Promise<string> {
  const network = networkById(networkId);
  try {
    return new URL(activeRpcUrl(network.id)).host;
  } catch {
    return network.rpcUrl;
  }
}
