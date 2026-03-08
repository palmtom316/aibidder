import type { ReactNode } from "react";

type ModuleIntroStat = {
  label: string;
  value: ReactNode;
};

type ModuleIntroCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  stats?: ModuleIntroStat[];
  actions?: ReactNode;
};

export function ModuleIntroCard({
  eyebrow,
  title,
  description,
  stats = [],
  actions,
}: ModuleIntroCardProps) {
  return (
    <section className="surface-card stack">
      <div className="panel-header">
        <div className="stack compact">
          <p className="eyebrow">{eyebrow}</p>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        {actions ? <div className="inline-actions">{actions}</div> : null}
      </div>

      {stats.length ? (
        <div className="summary-list">
          {stats.map((item) => (
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
