import { notFound } from "next/navigation";

import { WorkspaceHome } from "../../page";
import { ALLOWED_WORKSPACE_MODULES } from "../../../components/workspace-views/shared";

type AllowedWorkspaceModule = (typeof ALLOWED_WORKSPACE_MODULES)[number];

export default async function WorkspaceModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  if (!ALLOWED_WORKSPACE_MODULES.includes(module as AllowedWorkspaceModule)) {
    notFound();
  }

  return <WorkspaceHome forcedModule={module as AllowedWorkspaceModule} />;
}
