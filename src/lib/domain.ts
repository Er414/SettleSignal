import { TIMEZONES, addDays, isIsoDate } from "./dates";
import { overpaidCents, parseUsdcToCents, remainingCents } from "./money";
import type {
  ActionItem,
  CommunicationStatus,
  FollowUpView,
  InvoiceView,
  Metrics,
  PaymentStatus,
  PaymentView,
  Tone,
  VerificationLabel,
  Workflow,
} from "./types";

export function derivePaymentStatus(input: {
  workflow: Workflow;
  amountCents: number;
  paidCents: number;
  dueDate: string;
  today: string;
  leadDays: number;
}): PaymentStatus {
  if (input.workflow === "archived") return "archived";
  if (input.workflow === "draft") return "draft";
  if (input.amountCents > 0 && input.paidCents >= input.amountCents) return "paid";
  if (input.workflow === "verification_pending") return "verification_pending";
  if (input.paidCents > 0 && input.paidCents < input.amountCents) return "partially_paid";
  if (input.dueDate < input.today) return "overdue";
  if (input.dueDate <= addDays(input.today, Math.max(0, input.leadDays))) return "due_soon";
  return "unpaid";
}

export function isPastDue(dueDate: string, today: string, status: PaymentStatus): boolean {
  return dueDate < today && status !== "paid" && status !== "draft" && status !== "archived";
}

export function latestFollowUp(followUps: FollowUpView[]): FollowUpView | null {
  return [...followUps].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0] ?? null;
}

export function deriveCommunication(followUps: FollowUpView[]): CommunicationStatus {
  const latest = latestFollowUp(followUps);
  if (!latest) return "none";
  if (latest.status === "draft") return "draft";
  if (latest.status === "snoozed") return "snoozed";
  if (latest.status === "sent") return "sent";
  return "responded";
}

export function followUpNeedsAttention(input: {
  paymentStatus: PaymentStatus;
  communication: CommunicationStatus;
  snoozeUntil: string | null;
  today: string;
  pastDue: boolean;
}): boolean {
  if (input.paymentStatus === "paid" || input.paymentStatus === "draft" || input.paymentStatus === "archived") {
    return false;
  }
  if (input.communication === "snoozed" && input.snoozeUntil && input.snoozeUntil >= input.today) return false;
  if (input.communication === "responded") return true;
  if (input.communication === "snoozed") return true;
  const waiting =
    input.pastDue ||
    input.paymentStatus === "due_soon" ||
    input.paymentStatus === "verification_pending" ||
    input.paymentStatus === "partially_paid" ||
    input.paymentStatus === "overdue";
  if (!waiting) return false;
  if (input.communication === "none" || input.communication === "draft") return true;
  if (input.communication === "sent") return input.pastDue || input.paymentStatus === "verification_pending";
  return false;
}

export function verificationLabel(input: {
  workflow: Workflow;
  amountCents: number;
  livePaidCents: number;
  demoPaidCents: number;
  payments: PaymentView[];
}): VerificationLabel {
  if (input.livePaidCents >= input.amountCents && input.amountCents > 0) return "live";
  if (input.livePaidCents > 0) return "live-partial";
  if (input.workflow === "verification_pending" || input.payments.some((payment) => payment.kind === "unverified" || payment.kind === "rejected")) {
    return "pending";
  }
  if (input.demoPaidCents > 0) return "demo";
  return "none";
}

export function chooseReceipt(payments: PaymentView[]): InvoiceView["receipt"] {
  const counting = payments.filter((payment) => payment.countsTowardBalance && (payment.kind === "live" || payment.kind === "demo"));
  const live = counting.find((payment) => payment.kind === "live");
  if (live) return { id: live.id, kind: "live" };
  const demo = counting.find((payment) => payment.kind === "demo");
  if (demo) return { id: demo.id, kind: "demo" };
  return null;
}

export function buildMetrics(invoices: InvoiceView[]): Metrics {
  const tracked = invoices.filter((invoice) => invoice.paymentStatus !== "archived" && invoice.paymentStatus !== "draft");
  const open = tracked.filter((invoice) => invoice.paymentStatus !== "paid");
  return {
    outstandingCents: open.reduce((sum, invoice) => sum + invoice.remainingCents, 0),
    overdueCount: invoices.filter((invoice) => invoice.pastDue).length,
    dueSoonCount: tracked.filter((invoice) => invoice.paymentStatus === "due_soon").length,
    verifiedCents: invoices.reduce((sum, invoice) => sum + invoice.livePaidCents, 0),
    recordedCents: invoices.reduce((sum, invoice) => sum + invoice.paidCents, 0),
    attentionCount: invoices.filter((invoice) => invoice.needsAttention).length,
    openCount: open.length,
  };
}

export function buildActions(invoices: InvoiceView[]): ActionItem[] {
  const items: ActionItem[] = [];
  for (const invoice of invoices) {
    if (invoice.paymentStatus === "verification_pending") {
      items.push({
        id: `${invoice.id}-verify`,
        invoiceId: invoice.id,
        priority: 1,
        title: `Check settlement for ${invoice.reference}`,
        detail: `${invoice.clientName} is waiting on verification. A stored hash is not proof of payment.`,
        href: `/workspace/verify?invoice=${invoice.id}`,
        label: "Review verification",
      });
    }
    if (invoice.needsAttention && invoice.communicationStatus === "responded") {
      items.push({
        id: `${invoice.id}-reply`,
        invoiceId: invoice.id,
        priority: 2,
        title: `Review ${invoice.clientName}'s reply`,
        detail: `${invoice.reference} has a recorded response. Payment status is still separate from the reply.`,
        href: `/workspace/follow-ups?invoice=${invoice.id}`,
        label: "Open follow-up",
      });
    } else if (invoice.needsAttention && invoice.pastDue) {
      items.push({
        id: `${invoice.id}-overdue`,
        invoiceId: invoice.id,
        priority: 2,
        title: `Follow up with ${invoice.clientName}`,
        detail: `${invoice.reference} is past due. Prepare a message, then confirm any payment on Arc before treating it as settled.`,
        href: `/workspace/follow-ups?invoice=${invoice.id}`,
        label: "Prepare follow-up",
      });
    } else if (invoice.needsAttention && invoice.paymentStatus === "due_soon") {
      items.push({
        id: `${invoice.id}-soon`,
        invoiceId: invoice.id,
        priority: 3,
        title: `${invoice.reference} is due soon`,
        detail: `${invoice.clientName} has not been sent a reminder from this workspace yet.`,
        href: `/workspace/follow-ups?invoice=${invoice.id}`,
        label: "Prepare reminder",
      });
    } else if (invoice.paymentStatus === "partially_paid" && invoice.remainingCents > 0) {
      items.push({
        id: `${invoice.id}-partial`,
        invoiceId: invoice.id,
        priority: 4,
        title: `Remaining balance on ${invoice.reference}`,
        detail: `${invoice.clientName} still has an open balance after recorded payments.`,
        href: `/workspace/invoices/${invoice.id}`,
        label: "View invoice",
      });
    }
    if (invoice.paymentStatus === "draft") {
      items.push({
        id: `${invoice.id}-draft`,
        invoiceId: invoice.id,
        priority: 5,
        title: `Finish draft ${invoice.reference}`,
        detail: `${invoice.clientName} is not being tracked until this invoice is issued.`,
        href: `/workspace/invoices/${invoice.id}`,
        label: "Open draft",
      });
    }
  }
  return items.sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title)).slice(0, 7);
}

export function assembleInvoice(input: {
  id: string;
  reference: string;
  clientName: string;
  clientEmail: string;
  clientCompany: string;
  description: string;
  amountCents: number;
  currency: string;
  issueDate: string;
  dueDate: string;
  recipientAddress: string;
  workflow: Workflow;
  notes: string;
  createdAt: string;
  updatedAt: string;
  payments: PaymentView[];
  followUps: FollowUpView[];
  today: string;
  leadDays: number;
}): InvoiceView {
  const paidCents = input.payments.filter((payment) => payment.countsTowardBalance).reduce((sum, payment) => sum + payment.amountCents, 0);
  const livePaidCents = input.payments
    .filter((payment) => payment.countsTowardBalance && payment.kind === "live")
    .reduce((sum, payment) => sum + payment.amountCents, 0);
  const demoPaidCents = input.payments
    .filter((payment) => payment.countsTowardBalance && payment.kind === "demo")
    .reduce((sum, payment) => sum + payment.amountCents, 0);
  const paymentStatus = derivePaymentStatus({
    workflow: input.workflow,
    amountCents: input.amountCents,
    paidCents,
    dueDate: input.dueDate,
    today: input.today,
    leadDays: input.leadDays,
  });
  const pastDue = isPastDue(input.dueDate, input.today, paymentStatus);
  const communicationStatus = deriveCommunication(input.followUps);
  const snoozeUntil = latestFollowUp(input.followUps)?.snoozeUntil ?? null;
  return {
    ...input,
    paidCents,
    livePaidCents,
    demoPaidCents,
    remainingCents: remainingCents(input.amountCents, paidCents),
    overpaidCents: overpaidCents(input.amountCents, paidCents),
    paymentStatus,
    pastDue,
    verificationLabel: verificationLabel({
      workflow: input.workflow,
      amountCents: input.amountCents,
      livePaidCents,
      demoPaidCents,
      payments: input.payments,
    }),
    communicationStatus,
    needsAttention: followUpNeedsAttention({
      paymentStatus,
      communication: communicationStatus,
      snoozeUntil,
      today: input.today,
      pastDue,
    }),
    snoozeUntil,
    receipt: chooseReceipt(input.payments),
  };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ADDRESS = /^0x[a-fA-F0-9]{40}$/;

export function validateInvoiceInput(input: {
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
}):
  | {
      ok: true;
      value: {
        clientName: string;
        clientEmail: string;
        clientCompany: string;
        description: string;
        amountCents: number;
        issueDate: string;
        dueDate: string;
        recipientAddress: string;
        notes: string;
        currency: string;
      };
    }
  | { ok: false; fieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {};
  const clientName = input.clientName.trim();
  const clientEmail = input.clientEmail.trim();
  const clientCompany = input.clientCompany.trim();
  const description = input.description.trim();
  const notes = input.notes.trim();
  const recipientAddress = input.recipientAddress.trim();
  const currency = input.currency.trim().toUpperCase();
  if (clientName.length < 2 || clientName.length > 120) fieldErrors.clientName = "Enter the client name.";
  if (!EMAIL.test(clientEmail) || clientEmail.length > 160) fieldErrors.clientEmail = "Enter a valid email address.";
  if (clientCompany.length > 160) fieldErrors.clientCompany = "Company name is too long.";
  if (description.length < 3 || description.length > 500) fieldErrors.description = "Describe the work in a short sentence.";
  if (notes.length > 2000) fieldErrors.notes = "Notes must be under 2,000 characters.";
  const amountCents = parseUsdcToCents(input.amount);
  if (amountCents === null) fieldErrors.amount = "Enter an amount from 0.01 to 10,000,000.00 with at most two decimals.";
  if (!isIsoDate(input.issueDate)) fieldErrors.issueDate = "Choose a valid issue date.";
  if (!isIsoDate(input.dueDate)) fieldErrors.dueDate = "Choose a valid due date.";
  if (isIsoDate(input.issueDate) && isIsoDate(input.dueDate) && input.dueDate < input.issueDate) {
    fieldErrors.dueDate = "Due date cannot be before the issue date.";
  }
  if (recipientAddress && !ADDRESS.test(recipientAddress)) {
    fieldErrors.recipientAddress = "Recipient must be a 0x address with 40 hex characters, or left blank.";
  }
  if (currency !== "USDC") fieldErrors.currency = "Phase 1 settles in USDC only.";
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };
  return {
    ok: true,
    value: {
      clientName,
      clientEmail,
      clientCompany,
      description,
      amountCents: amountCents as number,
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      recipientAddress,
      notes,
      currency,
    },
  };
}

export function validateSettingsInput(input: {
  businessName: string;
  ownerName: string;
  email: string;
  timezone: string;
  reminderLeadDays: number;
  defaultTone: string;
  network: string;
  recipientAddress: string;
}):
  | {
      ok: true;
      value: {
        businessName: string;
        ownerName: string;
        email: string;
        timezone: string;
        reminderLeadDays: number;
        defaultTone: Tone;
        network: "arc-testnet" | "arc-mainnet";
        recipientAddress: string;
      };
    }
  | { ok: false; fieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {};
  const businessName = input.businessName.trim();
  const ownerName = input.ownerName.trim();
  const email = input.email.trim();
  const recipientAddress = input.recipientAddress.trim();
  if (businessName.length < 2 || businessName.length > 120) fieldErrors.businessName = "Enter the business name.";
  if (ownerName.length < 2 || ownerName.length > 120) fieldErrors.ownerName = "Enter your name.";
  if (!EMAIL.test(email)) fieldErrors.email = "Enter a valid email address.";
  if (!input.timezone || input.timezone.length > 80) fieldErrors.timezone = "Choose a time zone.";
  if (!Number.isInteger(input.reminderLeadDays) || input.reminderLeadDays < 1 || input.reminderLeadDays > 30) {
    fieldErrors.reminderLeadDays = "Reminder window must be 1 to 30 days.";
  }
  let defaultTone: Tone = "professional";
  if (input.defaultTone === "friendly" || input.defaultTone === "professional" || input.defaultTone === "firm") {
    defaultTone = input.defaultTone;
  } else {
    fieldErrors.defaultTone = "Choose a follow-up tone.";
  }
  let network: "arc-testnet" | "arc-mainnet" = "arc-testnet";
  if (input.network === "arc-testnet" || input.network === "arc-mainnet") {
    network = input.network;
  } else {
    fieldErrors.network = "Choose an Arc network.";
  }
  if (recipientAddress && !ADDRESS.test(recipientAddress)) {
    fieldErrors.recipientAddress = "Recipient must be a 0x address with 40 hex characters, or left blank.";
  }
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };
  return {
    ok: true,
    value: {
      businessName,
      ownerName,
      email,
      timezone: input.timezone,
      reminderLeadDays: input.reminderLeadDays,
      defaultTone,
      network,
      recipientAddress,
    },
  };
}

export function nextReference(existing: string[]): string {
  const numbers = existing.map((reference) => {
    const match = reference.match(/(\d+)$/);
    return match ? Number(match[1]) : 0;
  });
  return `SS-${Math.max(2400, ...numbers, 0) + 1}`;
}

export function isAddress(value: string): boolean {
  return ADDRESS.test(value.trim());
}

export function isTxHash(value: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(value.trim());
}
