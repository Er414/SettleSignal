import { nativeUnitsToCents } from "./money";
import type { Check, NetworkId } from "./types";

export const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
export const SYSTEM_EMITTER = "0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE";
export const USDC_ERC20 = "0x3600000000000000000000000000000000000000";

export type ArcNetwork = {
  id: NetworkId;
  name: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
  faucetUrl: string | null;
  docsUrl: string;
  currency: "USDC";
  nativeDecimals: 18;
  erc20Decimals: 6;
};

// Verified against https://docs.arc.io/arc/references/connect-to-arc
// and https://docs.arc.io/integrate/infrastructure on this build.
export const ARC_NETWORKS: Record<NetworkId, ArcNetwork> = {
  "arc-testnet": {
    id: "arc-testnet",
    name: "Arc Testnet",
    chainId: 5042002,
    rpcUrl: "https://rpc.testnet.arc.io",
    explorerUrl: "https://explorer.testnet.arc.io",
    faucetUrl: "https://faucet.circle.com",
    docsUrl: "https://docs.arc.io/arc/references/connect-to-arc",
    currency: "USDC",
    nativeDecimals: 18,
    erc20Decimals: 6,
  },
  "arc-mainnet": {
    id: "arc-mainnet",
    name: "Arc",
    chainId: 5042,
    rpcUrl: "https://rpc.mainnet.arc.io",
    explorerUrl: "https://explorer.arc.io",
    faucetUrl: null,
    docsUrl: "https://docs.arc.io/arc/references/connect-to-arc",
    currency: "USDC",
    nativeDecimals: 18,
    erc20Decimals: 6,
  },
};

export function isNetworkId(value: string): value is NetworkId {
  return value === "arc-testnet" || value === "arc-mainnet";
}

export function networkById(id: string): ArcNetwork {
  return isNetworkId(id) ? ARC_NETWORKS[id] : ARC_NETWORKS["arc-testnet"];
}

export type RpcLog = {
  address: string;
  topics: string[];
  data: string;
};

export type ChainSnapshot = {
  rpcOk: boolean;
  rpcError?: string;
  chainId: number | null;
  txFound: boolean;
  receiptFound: boolean;
  receiptStatus: string | number | null;
  txTo: string | null;
  txValue: string | null;
  logs: RpcLog[];
};

export type VerificationDecision = {
  outcome: "verified" | "not_found" | "failed_checks" | "unavailable";
  amountCents: number;
  coversRemaining: boolean;
  checks: Check[];
  summary: string;
};

export const DEMO_FIXTURES = [
  {
    id: "signal-complete",
    title: "Conceptual full settlement",
    detail: "Records the remaining workspace balance as a labelled demo. It does not query Arc.",
  },
  {
    id: "signal-partial",
    title: "Conceptual partial settlement",
    detail: "Records 40% of the remaining balance, rounded down to the cent, as a labelled demo.",
  },
] as const;

export type DemoFixtureId = (typeof DEMO_FIXTURES)[number]["id"];

export function demoSettlementCents(fixtureId: DemoFixtureId, remaining: number): number {
  if (remaining <= 0) return 0;
  if (fixtureId === "signal-complete") return remaining;
  return Math.max(1, Math.floor(remaining * 0.4));
}

export function topicAddress(topic: string | undefined): string | null {
  if (!topic) return null;
  const hex = topic.toLowerCase().replace(/^0x/, "");
  if (hex.length < 40) return null;
  return `0x${hex.slice(-40)}`;
}

export function parseHexQuantity(value: string | null | undefined): bigint | null {
  if (!value || value === "0x") return 0n;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function successStatus(status: string | number | null): boolean {
  if (typeof status === "number") return status === 1;
  if (!status) return false;
  const normalized = status.toLowerCase();
  return normalized === "0x1" || normalized === "1";
}

function sameAddress(left: string | null | undefined, right: string | null | undefined): boolean {
  if (!left || !right) return false;
  return left.toLowerCase() === right.toLowerCase();
}

export function creditedCentsFromSnapshot(snapshot: ChainSnapshot, recipient: string): { cents: number; source: string } {
  const systemLogs = snapshot.logs.filter(
    (log) =>
      sameAddress(log.address, SYSTEM_EMITTER) &&
      log.topics[0]?.toLowerCase() === TRANSFER_TOPIC &&
      sameAddress(topicAddress(log.topics[2]), recipient),
  );
  if (systemLogs.length) {
    let total = BigInt(0);
    for (const log of systemLogs) {
      const value = parseHexQuantity(log.data);
      if (value === null) return { cents: -1, source: "system-log" };
      total += value;
    }
    return { cents: nativeUnitsToCents(total), source: "system-log" };
  }
  if (sameAddress(snapshot.txTo, recipient)) {
    const value = parseHexQuantity(snapshot.txValue);
    if (value && value > BigInt(0)) return { cents: nativeUnitsToCents(value), source: "native-value" };
  }
  return { cents: 0, source: "none" };
}

export function evaluateArcTransfer(input: {
  expectedChainId: number;
  expectedRecipient: string;
  remainingCents: number;
  safetyCapCents: number;
  snapshot: ChainSnapshot;
}): VerificationDecision {
  const checks: Check[] = [];
  const fail = (outcome: VerificationDecision["outcome"], summary: string, amountCents = 0): VerificationDecision => ({
    outcome,
    amountCents,
    coversRemaining: false,
    checks,
    summary,
  });

  if (!input.snapshot.rpcOk) {
    checks.push({
      id: "rpc",
      label: "Arc RPC responded",
      passed: false,
      detail: input.snapshot.rpcError || "The public RPC could not be reached. Nothing was marked paid.",
    });
    return fail("unavailable", "Lookup unavailable. The invoice remains unverified.");
  }
  checks.push({ id: "rpc", label: "Arc RPC responded", passed: true, detail: "The selected Arc endpoint returned a response." });

  const chainOk = input.snapshot.chainId === input.expectedChainId;
  checks.push({
    id: "chain",
    label: "Chain ID matches the selected Arc network",
    passed: chainOk,
    detail: chainOk
      ? `Chain ID ${input.snapshot.chainId} matches.`
      : `Expected ${input.expectedChainId}, received ${input.snapshot.chainId ?? "no chain id"}.`,
  });
  if (!chainOk) return fail("failed_checks", "The endpoint chain ID does not match the selected Arc network. Nothing was marked paid.");

  checks.push({
    id: "found",
    label: "Transaction exists",
    passed: input.snapshot.txFound,
    detail: input.snapshot.txFound ? "The hash was found on this network." : "No transaction was found for this hash on the selected network.",
  });
  if (!input.snapshot.txFound) return fail("not_found", "Hash not found on the selected Arc network. It stays unverified.");

  const receiptOk = input.snapshot.receiptFound && successStatus(input.snapshot.receiptStatus);
  checks.push({
    id: "receipt",
    label: "Receipt succeeded",
    passed: receiptOk,
    detail: receiptOk
      ? "The receipt status is success. Arc finality is deterministic once the block is committed."
      : "The transaction is missing a successful receipt. A reverted transfer is not a settlement.",
  });
  if (!receiptOk) return fail("failed_checks", "The transaction did not succeed. Nothing was marked paid.");

  const recipientOk = /^0x[a-fA-F0-9]{40}$/.test(input.expectedRecipient);
  checks.push({
    id: "recipient",
    label: "Transfer reached the invoice recipient",
    passed: false,
    detail: recipientOk ? "Checking system Transfer logs and native value." : "The invoice has no valid recipient address.",
  });
  if (!recipientOk) return fail("failed_checks", "Add a recipient address before live verification. Nothing was marked paid.");

  const credit = creditedCentsFromSnapshot(input.snapshot, input.expectedRecipient);
  const erc20Only = input.snapshot.logs.some(
    (log) => sameAddress(log.address, USDC_ERC20) && log.topics[0]?.toLowerCase() === TRANSFER_TOPIC,
  );
  if (credit.cents < 0 || credit.cents > input.safetyCapCents) {
    checks[checks.length - 1] = {
      id: "recipient",
      label: "Transfer reached the invoice recipient",
      passed: false,
      detail: "The decoded amount was implausible, so it was not recorded.",
    };
    return fail("failed_checks", "The decoded amount failed the safety cap. Nothing was marked paid.");
  }
  if (credit.cents <= 0) {
    checks[checks.length - 1] = {
      id: "recipient",
      label: "Transfer reached the invoice recipient",
      passed: false,
      detail: erc20Only
        ? "An ERC-20 log was seen, but official Arc guidance uses the system emitter for settlement. No qualifying system transfer or native value to the recipient was found."
        : "No system Transfer or native value to the invoice recipient was found.",
    };
    return fail("failed_checks", "The transaction does not show USDC arriving at the invoice recipient. Nothing was marked paid.");
  }
  checks[checks.length - 1] = {
    id: "recipient",
    label: "Transfer reached the invoice recipient",
    passed: true,
    detail:
      credit.source === "system-log"
        ? "A system-emitter Transfer to the recipient was found. Value uses 18-decimal native units and was floored to cents."
        : "No system log was present. Native transaction value to the recipient was used and floored to cents.",
  };
  checks.push({
    id: "amount",
    label: "Credited amount is above zero",
    passed: true,
    detail: `${credit.cents} cents will be recorded if every check stays passed.`,
  });
  const coversRemaining = input.remainingCents > 0 ? credit.cents >= input.remainingCents : credit.cents > 0;
  return {
    outcome: "verified",
    amountCents: credit.cents,
    coversRemaining,
    checks,
    summary: coversRemaining
      ? "Live Arc checks passed. This transfer can be recorded as a verified settlement."
      : "Live Arc checks passed for a partial amount. The invoice is not fully settled.",
  };
}

export function explorerTxUrl(explorerUrl: string, hash: string): string {
  return `${explorerUrl.replace(/\/$/, "")}/tx/${hash}`;
}

export function rpcHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "configured RPC";
  }
}
