import type { Metadata } from "next";
import { FollowUpsView } from "@/components/workspace/FollowUpsView";
import { loadWorkspace } from "@/server/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Follow-ups" };

export default async function FollowUpsPage({ searchParams }: { searchParams: Promise<{ invoice?: string }> }) {
  const params = await searchParams;
  const data = await loadWorkspace();
  return <FollowUpsView data={data} selectedId={params.invoice} />;
}
