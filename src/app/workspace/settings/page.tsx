import type { Metadata } from "next";
import { SettingsView } from "@/components/workspace/SettingsView";
import { loadWorkspace } from "@/server/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const data = await loadWorkspace();
  return <SettingsView settings={data.settings} />;
}
