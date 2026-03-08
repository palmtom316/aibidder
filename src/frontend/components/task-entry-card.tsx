import type { ReactNode } from "react";

type TaskEntryCardProps = {
  title: string;
  description: string;
  actionLabel: string;
  meta?: string;
  icon?: ReactNode;
  disabled?: boolean;
  onAction?: () => void;
};

export function TaskEntryCard({
  title,
  description,
  actionLabel,
  meta,
  icon,
  disabled = false,
  onAction,
}: TaskEntryCardProps) {
  return (
    <article className="module-card" aria-label={title}>
      <div className="module-card-header">
        <div className="stack compact">
          <p className="eyebrow">任务入口</p>
          <h3>{title}</h3>
        </div>
        {icon ? <span aria-hidden="true">{icon}</span> : <span className="brand-point-inline" aria-hidden="true" />}
      </div>

      <p>{description}</p>

      <div className="module-card-footer">
        <div className="stack compact">
          <span>{meta || "建议按当前步骤顺序推进"}</span>
        </div>
        <button className="primary-button" disabled={disabled} onClick={onAction} type="button">
          {actionLabel}
        </button>
      </div>
    </article>
  );
}
