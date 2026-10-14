import type { Metadata } from "next";
import { DashboardView } from "@/components/workspace/DashboardView";
import { loadWorkspace } from "@/server/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const data = await loadWorkspace();
  return <DashboardView data={data} />;
}
