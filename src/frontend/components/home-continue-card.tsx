type HomeContinueCardProps = {
  title: string;
  stepLabel?: string;
  cueLabel?: string;
  detail: string;
  actionLabel?: string;
  disabled?: boolean;
  onAction: () => void;
};

export function HomeContinueCard({
  title,
  stepLabel,
  cueLabel,
  detail,
  actionLabel = "继续处理",
  disabled = false,
  onAction,
}: HomeContinueCardProps) {
  return (
    <section className="surface-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">继续处理</p>
          <h3>{title}</h3>
          {stepLabel ? <p>{stepLabel}</p> : null}
        </div>
      </div>
      <div className="stack compact">
        <p>{detail}</p>
        {cueLabel ? <p><strong>当前提示：</strong>{cueLabel}</p> : null}
        <div>
          <button className="primary-button" disabled={disabled} onClick={onAction} type="button">
            {actionLabel}
          </button>
        </div>
      </div>
    </section>
  );
}
