import type { LayoutJob, RenderedOutput } from "../../lib/api";
import type { FormSubmitHandler, StateSetter } from "./shared";
import { ModuleIntro } from "./module-intro";
import { formatJobStatus, formatOutputType, formatStoragePath } from "./utils";

type LayoutFinalizeViewProps = {
  layoutJobs: LayoutJob[];
  selectedLayoutJob: LayoutJob | null;
  selectedLayoutJobId: number | null;
  renderedOutputs: RenderedOutput[];
  layoutJobName: string;
  layoutTemplateName: string;
  selectedProjectId: number | null;
  token: string | null;
  busyLabel: string;
  setLayoutJobName: (value: string) => void;
  setLayoutTemplateName: (value: string) => void;
  setSelectedLayoutJobId: StateSetter<number | null>;
  handleCreateLayoutJob: FormSubmitHandler;
  handleDownloadRenderedOutput: (outputId: number, versionTag: string, outputType: string) => Promise<void> | void;
};

export function LayoutFinalizeView({
  layoutJobs,
  selectedLayoutJob,
  selectedLayoutJobId,
  renderedOutputs,
  layoutJobName,
  layoutTemplateName,
  selectedProjectId,
  token,
  busyLabel,
  setLayoutJobName,
  setLayoutTemplateName,
  setSelectedLayoutJobId,
  handleCreateLayoutJob,
  handleDownloadRenderedOutput,
}: LayoutFinalizeViewProps) {
  return (
    <section className="workspace-stack">
      <ModuleIntro
        title="排版导出"
        description="套用企业模板、核对版式和封签信息，导出可提交的最终文件。"
        metrics={[
          { label: "排版任务", value: layoutJobs.length },
          { label: "导出成果", value: renderedOutputs.length },
          { label: "当前状态", value: selectedLayoutJob ? formatJobStatus(selectedLayoutJob.status) : "未开始" },
        ]}
      />

      <div className="workspace-grid workspace-grid-2">
        <form className="surface-card stack" onSubmit={handleCreateLayoutJob}>
          <div className="panel-header compact">
            <div>
              <p className="eyebrow">排版任务</p>
              <h3>创建排版导出任务</h3>
            </div>
            <span className="badge">{layoutJobs.length} 条</span>
          </div>
          <label>
            任务名称
            <input value={layoutJobName} onChange={(event) => setLayoutJobName(event.target.value)} />
          </label>
          <label>
            套用模板
            <input value={layoutTemplateName} onChange={(event) => setLayoutTemplateName(event.target.value)} />
          </label>
          <button className="primary-button" disabled={!token || !selectedProjectId || Boolean(busyLabel)} type="submit">
            开始排版导出
          </button>
          <label>
            查看排版任务
            <select
              value={selectedLayoutJobId ?? ""}
              onChange={(event) => void setSelectedLayoutJobId(Number(event.target.value) || null)}
            >
              <option value="">请选择排版任务</option>
              {layoutJobs.map((row) => (
                <option key={row.id} value={row.id}>
                  #{row.id} · {row.job_name}
                </option>
              ))}
            </select>
          </label>
          <div className="mini-list">
            {layoutJobs.map((row) => (
              <div className="mini-item" key={row.id}>
                <strong>{row.job_name}</strong>
                <span>{row.template_name}</span>
              </div>
            ))}
          </div>
        </form>

        <section className="surface-card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">导出成果</p>
              <h3>{selectedLayoutJob ? selectedLayoutJob.job_name : "等待选择排版任务"}</h3>
            </div>
            <span className="badge">{renderedOutputs.length} 份</span>
          </div>
          <div className="stack">
            <div className="info-block">
              <strong>排版状态</strong>
              <p>
                {selectedLayoutJob
                  ? `模板：${selectedLayoutJob.template_name}，状态：${formatJobStatus(selectedLayoutJob.status)}`
                  : "先创建或选择一个排版任务。"}
              </p>
            </div>
            {renderedOutputs.length ? (
              <div className="scroll-box">
                {renderedOutputs.map((output) => (
                  <article className="result-card" key={output.id}>
                    <header>
                      <strong>{formatOutputType(output.output_type)}</strong>
                      <span>{output.version_tag}</span>
                    </header>
                    <p>{`已生成文件：${formatStoragePath(output.storage_path)}`}</p>
                    <div className="inline-actions">
                      <button
                        className="ghost-button"
                        disabled={!token || Boolean(busyLabel)}
                        onClick={() => void handleDownloadRenderedOutput(output.id, output.version_tag, output.output_type)}
                        type="button"
                      >
                        下载导出文件
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="info-block">
                <strong>暂无导出文件</strong>
                <p>排版完成后，这里会显示输出文件路径和版本号。</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
