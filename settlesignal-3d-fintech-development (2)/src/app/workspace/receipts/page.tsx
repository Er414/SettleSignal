import type { Metadata } from "next";
import { ReceiptsView } from "@/components/workspace/ReceiptsView";
import { loadWorkspace } from "@/server/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Receipts" };

export default async function ReceiptsPage() {
  const data = await loadWorkspace();
  return <ReceiptsView data={data} />;
}
