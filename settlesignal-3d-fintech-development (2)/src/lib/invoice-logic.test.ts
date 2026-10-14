import assert from "node:assert/strict";
import test from "node:test";
import { evaluateArcTransfer, demoSettlementCents, SYSTEM_EMITTER, TRANSFER_TOPIC, USDC_ERC20, type ChainSnapshot } from "./arc";
import { toCsv } from "./csv";
import { addDays } from "./dates";
import { assembleInvoice, derivePaymentStatus, followUpNeedsAttention, validateInvoiceInput } from "./domain";
import { renderFollowUp } from "./followups";
import { formatUsdc, nativeUnitsToCents, parseUsdcToCents } from "./money";
import { demoTransferKey, liveTransferKey } from "./transfers";
import type { FollowUpView, PaymentView } from "./types";

test("money formatting and parsing stay in integer cents", () => {
  assert.equal(formatUsdc(480000), "4,800.00");
  assert.equal(formatUsdc(99), "0.99");
  assert.equal(parseUsdcToCents("4,800.00"), 480000);
  assert.equal(parseUsdcToCents("10.2"), 1020);
  assert.equal(parseUsdcToCents("1.999"), null);
  assert.equal(parseUsdcToCents("0"), null);
  assert.equal(parseUsdcToCents("-4"), null);
  assert.equal(nativeUnitsToCents(4800n * 10n ** 18n), 480000);
  assert.equal(nativeUnitsToCents(10n ** 16n - 1n), 0);
});

test("status transitions keep payment separate from promises", () => {
  assert.equal(derivePaymentStatus({ workflow: "draft", amountCents: 100, paidCents: 100, dueDate: "2026-01-01", today: "2026-02-01", leadDays: 5 }), "draft");
  assert.equal(derivePaymentStatus({ workflow: "archived", amountCents: 100, paidCents: 0, dueDate: "2026-01-01", today: "2026-02-01", leadDays: 5 }), "archived");
  assert.equal(derivePaymentStatus({ workflow: "verification_pending", amountCents: 100, paidCents: 100, dueDate: "2026-01-01", today: "2026-02-01", leadDays: 5 }), "paid");
  assert.equal(derivePaymentStatus({ workflow: "verification_pending", amountCents: 100, paidCents: 0, dueDate: "2026-01-01", today: "2026-02-01", leadDays: 5 }), "verification_pending");
  assert.equal(derivePaymentStatus({ workflow: "open", amountCents: 100, paidCents: 40, dueDate: "2026-01-01", today: "2026-02-01", leadDays: 5 }), "partially_paid");
  assert.equal(derivePaymentStatus({ workflow: "open", amountCents: 100, paidCents: 0, dueDate: "2026-01-01", today: "2026-02-01", leadDays: 5 }), "overdue");
  assert.equal(derivePaymentStatus({ workflow: "open", amountCents: 100, paidCents: 0, dueDate: "2026-02-04", today: "2026-02-01", leadDays: 5 }), "due_soon");
  assert.equal(derivePaymentStatus({ workflow: "open", amountCents: 100, paidCents: 0, dueDate: "2026-03-01", today: "2026-02-01", leadDays: 5 }), "unpaid");
});

test("attention ignores a live snooze and a paid invoice", () => {
  assert.equal(followUpNeedsAttention({ paymentStatus: "overdue", communication: "snoozed", snoozeUntil: "2026-02-10", today: "2026-02-01", pastDue: true }), false);
  assert.equal(followUpNeedsAttention({ paymentStatus: "overdue", communication: "snoozed", snoozeUntil: "2026-01-01", today: "2026-02-01", pastDue: true }), true);
  assert.equal(followUpNeedsAttention({ paymentStatus: "paid", communication: "none", snoozeUntil: null, today: "2026-02-01", pastDue: false }), false);
  assert.equal(followUpNeedsAttention({ paymentStatus: "due_soon", communication: "sent", snoozeUntil: null, today: "2026-02-01", pastDue: false }), false);
  assert.equal(followUpNeedsAttention({ paymentStatus: "overdue", communication: "responded", snoozeUntil: null, today: "2026-02-01", pastDue: true }), true);
});

test("follow-up drafts use the invoice and do not claim it is paid", () => {
  const body = renderFollowUp({
    tone: "firm",
    clientName: "Maya Chen",
    reference: "SS-2401",
    description: "Brand system",
    amountLabel: "4,800.00",
    currency: "USDC",
    dueLabel: "Apr 1, 2026",
    recipientAddress: "0x1111111111111111111111111111111111111111",
    networkName: "Arc Testnet",
    ownerName: "Avery Lang",
    businessName: "Avery Lang Studio",
    email: "avery@langstudio.co",
  });
  assert.match(body, /SS-2401/);
  assert.match(body, /4,800\.00 USDC/);
  assert.match(body, /Maya|Hi Maya|Hello Maya/);
  assert.doesNotMatch(body, /paid in full/i);
  assert.match(body, /transaction hash/i);
});

test("demo fixtures never become live verification amounts", () => {
  assert.equal(demoSettlementCents("signal-complete", 2500), 2500);
  assert.equal(demoSettlementCents("signal-partial", 2500), 1000);
  assert.equal(demoSettlementCents("signal-partial", 1), 1);
  assert.equal(demoSettlementCents("signal-complete", 0), 0);
});

test("Arc verification requires chain, receipt, recipient, and a sane amount", () => {
  const recipient = "0x1111111111111111111111111111111111111111";
  const value = (4800n * 10n ** 18n).toString(16);
  const base: ChainSnapshot = {
    rpcOk: true,
    chainId: 5042002,
    txFound: true,
    receiptFound: true,
    receiptStatus: "0x1",
    txTo: recipient,
    txValue: `0x${value}`,
    logs: [
      {
        address: SYSTEM_EMITTER,
        topics: [TRANSFER_TOPIC, `0x${"22".repeat(32)}`, `0x${recipient.slice(2).padStart(64, "0")}`],
        data: `0x${value}`,
      },
      {
        address: USDC_ERC20,
        topics: [TRANSFER_TOPIC, `0x${"22".repeat(32)}`, `0x${recipient.slice(2).padStart(64, "0")}`],
        data: `0x${(4800n * 10n ** 6n).toString(16)}`,
      },
    ],
  };
  const verified = evaluateArcTransfer({
    expectedChainId: 5042002,
    expectedRecipient: recipient,
    remainingCents: 480000,
    safetyCapCents: 20_000_000,
    snapshot: base,
  });
  assert.equal(verified.outcome, "verified");
  assert.equal(verified.amountCents, 480000);
  assert.equal(verified.coversRemaining, true);

  const wrongChain = evaluateArcTransfer({ ...verifiedInput(base), snapshot: { ...base, chainId: 5042 } });
  assert.equal(wrongChain.outcome, "failed_checks");
  assert.equal(wrongChain.amountCents, 0);

  const reverted = evaluateArcTransfer({ ...verifiedInput(base), snapshot: { ...base, receiptStatus: "0x0" } });
  assert.equal(reverted.outcome, "failed_checks");

  const missing = evaluateArcTransfer({ ...verifiedInput(base), snapshot: { ...base, txFound: false, receiptFound: false, logs: [] } });
  assert.equal(missing.outcome, "not_found");

  const erc20Only = evaluateArcTransfer({
    ...verifiedInput(base),
    snapshot: { ...base, txTo: USDC_ERC20, txValue: "0x0", logs: base.logs.filter((log) => log.address === USDC_ERC20) },
  });
  assert.equal(erc20Only.outcome, "failed_checks");

  const unavailable = evaluateArcTransfer({
    ...verifiedInput(base),
    snapshot: { ...base, rpcOk: false, rpcError: "timeout", txFound: false, logs: [] },
  });
  assert.equal(unavailable.outcome, "unavailable");
});

function verifiedInput(snapshot: ChainSnapshot) {
  return {
    expectedChainId: 5042002,
    expectedRecipient: "0x1111111111111111111111111111111111111111",
    remainingCents: 480000,
    safetyCapCents: 20_000_000,
    snapshot,
  };
}

test("recorded demo payments do not count as live verified totals", () => {
  const followUps: FollowUpView[] = [];
  const demoPayment: PaymentView = {
    id: "p1",
    invoiceId: "i1",
    amountCents: 90000,
    currency: "USDC",
    network: "arc-testnet",
    recipientAddress: "0x1111111111111111111111111111111111111111",
    txHash: "demo-fixture:signal-complete",
    kind: "demo",
    isDemo: true,
    countsTowardBalance: true,
    explorerUrl: "",
    summary: "demo",
    checks: [],
    createdAt: "2026-04-01T00:00:00.000Z",
  };
  const invoice = assembleInvoice({
    id: "i1",
    reference: "SS-1",
    clientName: "Elena Voss",
    clientEmail: "elena@fieldnote.press",
    clientCompany: "Fieldnote",
    description: "Illustrations",
    amountCents: 90000,
    currency: "USDC",
    issueDate: "2026-03-01",
    dueDate: "2026-03-15",
    recipientAddress: "0x1111111111111111111111111111111111111111",
    workflow: "open",
    notes: "",
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
    payments: [demoPayment],
    followUps,
    today: "2026-04-02",
    leadDays: 5,
  });
  assert.equal(invoice.paymentStatus, "paid");
  assert.equal(invoice.livePaidCents, 0);
  assert.equal(invoice.verificationLabel, "demo");
  assert.equal(invoice.receipt?.kind, "demo");
  assert.equal(invoice.needsAttention, false);
});

test("the same transfer key cannot be formed twice", () => {
  const hash = "0xAbCdef0000000000000000000000000000000000000000000000000000000001";
  assert.equal(liveTransferKey("arc-testnet", hash), liveTransferKey("arc-testnet", hash.toLowerCase()));
  assert.notEqual(liveTransferKey("arc-testnet", hash), liveTransferKey("arc-mainnet", hash));
  assert.equal(demoTransferKey("invoice-1", "signal-complete"), "demo:invoice-1:signal-complete");
  assert.notEqual(demoTransferKey("invoice-1", "signal-complete"), demoTransferKey("invoice-2", "signal-complete"));
});

test("invoice validation and csv escaping reject unsafe values", () => {
  const invalid = validateInvoiceInput({
    clientName: "A",
    clientEmail: "not-an-email",
    clientCompany: "",
    description: "ok work",
    amount: "12.345",
    issueDate: "2026-02-31",
    dueDate: "2026-01-01",
    recipientAddress: "0x1234",
    notes: "",
    currency: "USD",
  });
  assert.equal(invalid.ok, false);
  const csv = toCsv(["note"], [["=cmd"], ['say "hi"']]);
  assert.match(csv, /'=cmd/);
  assert.match(csv, /"say ""hi"""/);
  assert.equal(addDays("2026-01-31", 1), "2026-02-01");
});
