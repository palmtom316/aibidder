import type { ReactNode } from "react";

type ModuleIntroMetric = {
  label: string;
  value: string | number;
};

type ModuleIntroProps = {
  title: string;
  description: string;
  metrics?: ModuleIntroMetric[];
  actions?: ReactNode;
};

export function ModuleIntro({ title, description, metrics = [], actions }: ModuleIntroProps) {
  return (
    <section className="surface-card stack">
      <div className="panel-header">
        <div className="stack compact">
          <p className="eyebrow">当前步骤</p>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        {actions ? <div className="inline-actions">{actions}</div> : null}
      </div>

      {metrics.length ? (
        <div className="summary-list">
          {metrics.map((item) => (
            <div className="summary-item" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
