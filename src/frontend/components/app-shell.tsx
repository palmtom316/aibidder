import type { ReactNode } from "react";

import { ProjectContextBar } from "./project-context-bar";

export type AppShellProjectContext = {
  projectName: string | null;
  deadlineLabel?: string | null;
  stageLabel?: string | null;
  reminderLabel?: string | null;
};

type AppShellProps = {
  sidebar: ReactNode;
  title: string;
  subtitle?: string;
  toolbar?: ReactNode;
  copilotTrigger?: ReactNode;
  currentView?: string;
  projectContext?: AppShellProjectContext | null;
  showProjectContext?: boolean;
  children: ReactNode;
  projectName?: string | null;
  deadlineLabel?: string | null;
  phaseLabel?: string | null;
  reminderLabel?: string | null;
};

function resolveProjectContext({
  projectContext,
  projectName,
  deadlineLabel,
  phaseLabel,
  reminderLabel,
}: Pick<AppShellProps, "projectContext" | "projectName" | "deadlineLabel" | "phaseLabel" | "reminderLabel">) {
  if (projectContext) {
    return projectContext;
  }

  if (
    projectName !== undefined ||
    deadlineLabel !== undefined ||
    phaseLabel !== undefined ||
    reminderLabel !== undefined
  ) {
    return {
      projectName: projectName ?? null,
      deadlineLabel: deadlineLabel ?? null,
      stageLabel: phaseLabel ?? null,
      reminderLabel: reminderLabel ?? null,
    };
  }

  return null;
}

export function AppShell({
  sidebar,
  title,
  subtitle,
  toolbar,
  copilotTrigger,
  currentView,
  projectContext = null,
  showProjectContext = true,
  children,
  projectName,
  deadlineLabel,
  phaseLabel,
  reminderLabel,
}: AppShellProps) {
  const resolvedProjectContext = resolveProjectContext({
    projectContext,
    projectName,
    deadlineLabel,
    phaseLabel,
    reminderLabel,
  });

  return (
    <div className="console-shell" data-current-view={currentView}>
      {sidebar}
      <main className="console-main">
        <header className="workspace-header" aria-label="页面标题栏">
          <div className="stack compact">
            <p className="eyebrow">投标工作台</p>
            <h1>{title}</h1>
            {subtitle ? <p className="workspace-subtitle">{subtitle}</p> : null}
          </div>
          <div className="workspace-toolbar">
            {toolbar}
            {copilotTrigger}
          </div>
        </header>

        {showProjectContext && resolvedProjectContext ? <ProjectContextBar context={resolvedProjectContext} /> : null}

        <section className="workspace-stack" aria-label="页面主要内容">
          {children}
        </section>
      </main>
    </div>
  );
}
