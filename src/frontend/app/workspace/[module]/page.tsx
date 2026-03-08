import { notFound } from "next/navigation";

import { WorkspaceHome, type WorkspaceModule } from "../../page";

const ALLOWED_MODULES: WorkspaceModule[] = [
  "knowledge-library",
  "tender-analysis",
  "bid-generation",
  "bid-review",
  "layout-finalize",
  "bid-management",
];

export default async function WorkspaceModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  if (!ALLOWED_MODULES.includes(module as WorkspaceModule)) {
    notFound();
  }

  return <WorkspaceHome forcedModule={module as WorkspaceModule} />;
}
