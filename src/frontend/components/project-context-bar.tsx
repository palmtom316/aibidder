import type { AppShellProjectContext } from "./app-shell";

import { StatusBadge } from "./ui/status-badge";

type ProjectContextBarProps = {
  context: AppShellProjectContext;
};

export function ProjectContextBar({ context }: ProjectContextBarProps) {
  const { projectName, deadlineLabel = null, stageLabel = null, reminderLabel = null } = context;

  return (
    <section className="surface-card workspace-stack compact" aria-label="当前项目概况">
      <div className="workspace-header compact">
        <div className="stack compact">
          <p className="eyebrow">当前项目</p>
          <h2>{projectName || "请先选择一个投标项目"}</h2>
        </div>
        {stageLabel ? <StatusBadge label={stageLabel} tone="neutral" withDot /> : null}
      </div>

      <div className="workspace-grid workspace-grid-2">
        <div className="info-block">
          <span>截止时间</span>
          <strong>{deadlineLabel || "待补充"}</strong>
        </div>
        <div className="info-block">
          <span>提醒</span>
          <strong>{reminderLabel || "暂时没有需要特别注意的事项"}</strong>
        </div>
      </div>
    </section>
  );
}
