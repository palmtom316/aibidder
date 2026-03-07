import type { WorkbenchOverview } from "../lib/api";

type ModuleStripProps = {
  modules: WorkbenchOverview["modules"];
};

export function ModuleStrip({ modules }: ModuleStripProps) {
  return (
    <section className="module-strip">
      {modules.map((module) => (
        <article className="module-card" key={module.module_key}>
          <div className="module-card-header">
            <strong>{module.title}</strong>
            <span className={`badge ${module.status === "ready" ? "badge-success" : ""}`}>{module.status}</span>
          </div>
          <p>{module.description}</p>
          <div className="module-card-footer">
            <span>{module.module_key}</span>
            <strong>{module.count}</strong>
          </div>
        </article>
      ))}
    </section>
  );
}
