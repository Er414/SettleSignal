import { ARC_NETWORKS, type ChainSnapshot, type RpcLog } from "@/lib/arc";
import type { NetworkId } from "@/lib/types";

export function activeRpcUrl(network: NetworkId): string {
  const fallback = ARC_NETWORKS[network].rpcUrl;
  const override = network === "arc-mainnet" ? process.env.ARC_MAINNET_RPC_URL : process.env.ARC_TESTNET_RPC_URL;
  if (!override) return fallback;
  try {
    const url = new URL(override);
    if (url.protocol !== "https:" && url.protocol !== "http:") return fallback;
    return url.toString();
  } catch {
    return fallback;
  }
}

async function rpc(url: string, method: string, params: unknown[]): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`RPC returned HTTP ${response.status}`);
  const body = (await response.json()) as { result?: unknown; error?: { message?: string } };
  if (body.error) throw new Error(body.error.message || "RPC error");
  return body.result ?? null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function parseChainId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number.parseInt(value, value.startsWith("0x") ? 16 : 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseLogs(value: unknown): RpcLog[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = asRecord(item);
    if (!row || typeof row.address !== "string" || typeof row.data !== "string" || !Array.isArray(row.topics)) return [];
    const topics = row.topics.filter((topic): topic is string => typeof topic === "string");
    return [{ address: row.address, data: row.data, topics }];
  });
}

export async function fetchArcSnapshot(network: NetworkId, hash: string): Promise<ChainSnapshot> {
  const url = activeRpcUrl(network);
  try {
    const [chainId, txRaw, receiptRaw] = await Promise.all([
      rpc(url, "eth_chainId", []),
      rpc(url, "eth_getTransactionByHash", [hash]),
      rpc(url, "eth_getTransactionReceipt", [hash]),
    ]);
    const tx = asRecord(txRaw);
    const receipt = asRecord(receiptRaw);
    const status = receipt?.status;
    return {
      rpcOk: true,
      chainId: parseChainId(chainId),
      txFound: Boolean(tx),
      receiptFound: Boolean(receipt),
      receiptStatus: typeof status === "string" || typeof status === "number" ? status : null,
      txTo: typeof tx?.to === "string" ? tx.to : null,
      txValue: typeof tx?.value === "string" ? tx.value : null,
      logs: parseLogs(receipt?.logs),
    };
  } catch (error) {
    return {
      rpcOk: false,
      rpcError: error instanceof Error ? error.message : "Arc RPC unavailable",
      chainId: null,
      txFound: false,
      receiptFound: false,
      receiptStatus: null,
      txTo: null,
      txValue: null,
      logs: [],
    };
  }
}
