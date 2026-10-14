import type { Metadata } from "next";
import { VerifyView } from "@/components/workspace/VerifyView";
import { loadWorkspace } from "@/server/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verification" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ invoice?: string }> }) {
  const params = await searchParams;
  const data = await loadWorkspace();
  return <VerifyView data={data} selectedId={params.invoice} />;
}
