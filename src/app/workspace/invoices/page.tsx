import type { Metadata } from "next";
import { InvoicesView } from "@/components/workspace/InvoicesView";
import { loadWorkspace } from "@/server/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Invoices" };

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const params = await searchParams;
  const data = await loadWorkspace();
  return <InvoicesView data={data} startOpen={params.new === "1"} />;
}
