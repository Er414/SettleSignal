import type { ReactNode } from "react";
import { Shell } from "@/components/workspace/Shell";
import { Unavailable } from "@/components/workspace/Unavailable";
import { loadWorkspace } from "@/server/queries";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  try {
    const data = await loadWorkspace();
    return <Shell settings={data.settings}>{children}</Shell>;
  } catch (error) {
    console.error("Workspace unavailable", error);
    return <Unavailable />;
  }
}
