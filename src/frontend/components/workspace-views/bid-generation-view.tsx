import type { GeneratedSection, GenerationJob } from "../../lib/api";
import type { FormSubmitHandler, StateSetter, VoidAction } from "./shared";
import { ModuleIntro } from "./module-intro";
import { formatJobStatus, parseEvidenceSummary } from "./utils";

type BidGenerationViewProps = {
  generationJobs: GenerationJob[];
  selectedGenerationJob: GenerationJob | null;
  selectedGenerationJobId: number | null;
  generatedSections: GeneratedSection[];
  generationJobName: string;
  generationTargetSections: string;
  selectedProjectId: number | null;
  token: string | null;
  busyLabel: string;
  setGenerationJobName: (value: string) => void;
  setGenerationTargetSections: (value: string) => void;
  setSelectedGenerationJobId: StateSetter<number | null>;
  handleCreateGenerationJob: FormSubmitHandler;
  handleApproveGenerationOutline: VoidAction;
};

export function BidGenerationView({
  generationJobs,
  selectedGenerationJob,
  selectedGenerationJobId,
  generatedSections,
  generationJobName,
  generationTargetSections,
  selectedProjectId,
  token,
  busyLabel,
  setGenerationJobName,
  setGenerationTargetSections,
  setSelectedGenerationJobId,
  handleCreateGenerationJob,
  handleApproveGenerationOutline,
}: BidGenerationViewProps) {
  return (
    <section className="workspace-stack">
      <ModuleIntro
        title="内容编写"
        description="先生成章节框架，再逐章补齐投标内容、证据和表述细节。"
        metrics={[
          { label: "编写任务", value: generationJobs.length },
          { label: "已生成章节", value: generatedSections.length },
          { label: "当前状态", value: selectedGenerationJob ? formatJobStatus(selectedGenerationJob.status) : "未开始" },
        ]}
        actions={
          <button
            className="ghost-button"
            disabled={!token || !selectedGenerationJob || Boolean(busyLabel) || selectedGenerationJob.status === "approved"}
            onClick={() => void handleApproveGenerationOutline()}
            type="button"
          >
            {selectedGenerationJob?.status === "approved" ? "框架已确认" : "确认章节框架"}
          </button>
        }
      />

      <div className="workspace-grid workspace-grid-2">
        <form className="surface-card stack" onSubmit={handleCreateGenerationJob}>
          <div className="panel-header compact">
            <div>
              <p className="eyebrow">编写任务</p>
              <h3>创建章节编写任务</h3>
            </div>
            <span className="badge">{generationJobs.length} 条</span>
          </div>
          <label>
            任务名称
            <input value={generationJobName} onChange={(event) => setGenerationJobName(event.target.value)} />
          </label>
          <label>
            目标章节数
            <input
              min="0"
              type="number"
              value={generationTargetSections}
              onChange={(event) => setGenerationTargetSections(event.target.value)}
            />
          </label>
          <button className="primary-button" disabled={!token || !selectedProjectId || Boolean(busyLabel)} type="submit">
            开始生成章节草稿
          </button>
          <label>
            查看任务
            <select
              value={selectedGenerationJobId ?? ""}
              onChange={(event) => void setSelectedGenerationJobId(Number(event.target.value) || null)}
            >
              <option value="">请选择任务</option>
              {generationJobs.map((row) => (
                <option key={row.id} value={row.id}>
                  #{row.id} · {row.job_name}
                </option>
              ))}
            </select>
          </label>
          <div className="mini-list">
            {generationJobs.map((row) => (
              <div className="mini-item" key={row.id}>
                <strong>{row.job_name}</strong>
                <span>{formatJobStatus(row.status)}</span>
              </div>
            ))}
          </div>
        </form>

        <section className="surface-card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">章节草稿</p>
              <h3>{selectedGenerationJob ? selectedGenerationJob.job_name : "等待选择编写任务"}</h3>
            </div>
            <span className="badge">{generatedSections.length} 章</span>
          </div>
          <div className="stack">
            <div className="info-block">
              <strong>当前进度</strong>
              <p>
                {selectedGenerationJob
                  ? `状态：${formatJobStatus(selectedGenerationJob.status)}，目标章节：${selectedGenerationJob.target_sections}`
                  : "先创建或选择一个编写任务。"}
              </p>
              <div className="inline-actions">
                <button
                  className="ghost-button"
                  disabled={!token || !selectedGenerationJob || Boolean(busyLabel) || selectedGenerationJob.status === "approved"}
                  onClick={() => void handleApproveGenerationOutline()}
                  type="button"
                >
                  {selectedGenerationJob?.status === "approved" ? "框架已确认" : "确认章节框架"}
                </button>
              </div>
            </div>
            {generatedSections.length ? (
              <div className="scroll-box">
                {generatedSections.map((section) => {
                  const evidence = parseEvidenceSummary(section.evidence_summary_json);
                  return (
                    <article className="result-card" key={section.id}>
                      <header>
                        <strong>{section.title}</strong>
                        <span>
                          {formatJobStatus(section.status)} · {evidence.length} 条证据
                        </span>
                      </header>
                      <p>{section.draft_text}</p>
                      <div className="mini-list">
                        {evidence.map((item, index) => (
                          <div className="mini-item" key={`${section.id}-${index}`}>
                            <strong>{item.requirement_type}</strong>
                            <span>
                              {item.source_anchor} · {item.priority}
                            </span>
                          </div>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="info-block">
                <strong>暂无章节草稿</strong>
                <p>创建编写任务后，这里会显示已生成的章节草稿和证据来源。</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
