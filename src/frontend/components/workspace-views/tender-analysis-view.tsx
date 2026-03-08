import type { DecompositionRun, DocumentRecord, Project } from "../../lib/api";
import type { FormSubmitHandler, StateSetter } from "./shared";
import { ModuleIntro } from "./module-intro";
import { parseDecompositionSummary, formatDate, formatJobStatus } from "./utils";

type TenderAnalysisViewProps = {
  decompositionRuns: DecompositionRun[];
  selectedDecompositionRun: DecompositionRun | null;
  selectedDocument: DocumentRecord | null;
  selectedProject: Project | null;
  selectedProjectId: number | null;
  decompositionRunName: string;
  decompositionSourceMarkdown: string;
  decompositionSourcePreviewUrl: string | null;
  decompositionPreviewBusy: boolean;
  token: string | null;
  busyLabel: string;
  setDecompositionRunName: (value: string) => void;
  setSelectedDecompositionRunId: StateSetter<number | null>;
  handleCreateDecompositionRun: FormSubmitHandler;
  handleDownloadDocumentArtifact: (documentId: number, artifactType: string, filename: string) => Promise<void> | void;
};

export function TenderAnalysisView({
  decompositionRuns,
  selectedDecompositionRun,
  selectedDocument,
  selectedProject,
  selectedProjectId,
  decompositionRunName,
  decompositionSourceMarkdown,
  decompositionSourcePreviewUrl,
  decompositionPreviewBusy,
  token,
  busyLabel,
  setDecompositionRunName,
  setSelectedDecompositionRunId,
  handleCreateDecompositionRun,
  handleDownloadDocumentArtifact,
}: TenderAnalysisViewProps) {
  const summary = selectedDecompositionRun ? parseDecompositionSummary(selectedDecompositionRun.summary_json) : null;

  return (
    <section className="workspace-stack">
      <ModuleIntro
        title="招标分析"
        description="把招标文件拆成资格条件、评分点和风险条款，方便后续编写与校核。"
        metrics={[
          { label: "分析任务", value: decompositionRuns.length },
          { label: "当前项目", value: selectedProject?.name ?? "未选择" },
          { label: "当前进度", value: selectedDecompositionRun ? `${selectedDecompositionRun.progress_pct}%` : "未开始" },
        ]}
        actions={
          <>
            {selectedDecompositionRun?.source_document_id ? (
              <button
                className="ghost-button"
                disabled={!token || !selectedProjectId || Boolean(busyLabel)}
                onClick={() =>
                  void handleDownloadDocumentArtifact(
                    selectedDecompositionRun.source_document_id!,
                    "markdown",
                    `document-${selectedDecompositionRun.source_document_id}.md`,
                  )
                }
                type="button"
              >
                下载解析稿
              </button>
            ) : null}
          </>
        }
      />

      <div className="workspace-grid workspace-grid-2">
        <section className="surface-card">
          <div className="panel-header compact">
            <div>
              <p className="eyebrow">分析任务</p>
              <h3>创建并查看招标分析</h3>
            </div>
            <span className="badge">{decompositionRuns.length} 条</span>
          </div>
          <form className="stack" onSubmit={handleCreateDecompositionRun}>
            <label>
              任务名称
              <input value={decompositionRunName} onChange={(event) => setDecompositionRunName(event.target.value)} />
            </label>
            <button className="primary-button" disabled={!token || !selectedProjectId || Boolean(busyLabel)} type="submit">
              开始分析招标文件
            </button>
          </form>
          <div className="mini-list">
            {decompositionRuns.map((row) => (
              <button
                className={`list-item ${selectedDecompositionRun?.id === row.id ? "list-item-active" : ""}`}
                key={row.id}
                onClick={() => void setSelectedDecompositionRunId(row.id)}
                type="button"
              >
                <div>
                  <strong>{row.run_name}</strong>
                  <p>{formatJobStatus(row.status)} · {row.progress_pct}%</p>
                </div>
                <span>{formatDate(row.created_at)}</span>
              </button>
            ))}
          </div>
          <div className="info-block">
            <strong>原文对照</strong>
            <p>优先查看解析稿，再对照原招标文件，确认条款是否拆解完整。</p>
            {selectedDecompositionRun?.source_document_id ? (
              <div className="inline-actions">
                <button
                  className="ghost-button"
                  disabled={!token || !selectedProjectId || Boolean(busyLabel)}
                  onClick={() =>
                    void handleDownloadDocumentArtifact(
                      selectedDecompositionRun.source_document_id!,
                      "source",
                      selectedDocument?.filename || `document-${selectedDecompositionRun.source_document_id}`,
                    )
                  }
                  type="button"
                >
                  下载原文
                </button>
                <button
                  className="ghost-button"
                  disabled={!token || !selectedProjectId || Boolean(busyLabel)}
                  onClick={() =>
                    void handleDownloadDocumentArtifact(
                      selectedDecompositionRun.source_document_id!,
                      "markdown",
                      `document-${selectedDecompositionRun.source_document_id}.md`,
                    )
                  }
                  type="button"
                >
                  下载解析稿
                </button>
              </div>
            ) : null}
          </div>
          <div className="scroll-box">
            <strong>{decompositionPreviewBusy ? "正在读取原文…" : "原文与解析预览"}</strong>
            {decompositionSourcePreviewUrl ? (
              <iframe className="document-preview-frame" src={decompositionSourcePreviewUrl} title="招标文件 PDF 预览" />
            ) : null}
            <pre className="code-box">{decompositionSourceMarkdown || "当前任务暂无可预览的解析稿。"}</pre>
          </div>
        </section>

        <section className="surface-card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">分析结果</p>
              <h3>{selectedDecompositionRun ? selectedDecompositionRun.run_name : "等待选择分析任务"}</h3>
            </div>
            <span className="badge">{summary?.totals?.items ?? 0} 项</span>
          </div>
          {!summary ? (
            <div className="stack">
              <div className="info-block">
                <strong>当前项目</strong>
                <p>{selectedProject ? selectedProject.name : "未选择项目"}</p>
              </div>
              <div className="info-block">
                <strong>下一步建议</strong>
                <p>建议先在“资料准备”中上传招标文件，再发起一次招标分析。</p>
              </div>
            </div>
          ) : (
            <div className="stack">
              <div className="summary-list">
                <div className="summary-item">
                  <span>解析章节</span>
                  <strong>{summary.totals?.sections ?? 0}</strong>
                </div>
                <div className="summary-item">
                  <span>拆解条目</span>
                  <strong>{summary.totals?.items ?? 0}</strong>
                </div>
              </div>
              <div className="workspace-grid workspace-grid-2">
                {summary.categories.map((category) => (
                  <article className="result-card" key={category.category_key}>
                    <header>
                      <strong>{category.label}</strong>
                      <span>{category.count} 项</span>
                    </header>
                    {category.items.length === 0 ? (
                      <p>暂无命中内容</p>
                    ) : (
                      category.items.map((item) => (
                        <div className="info-block" key={`${category.category_key}-${item.source_anchor}-${item.title}`}>
                          <strong>{item.title}</strong>
                          <p>{item.source_excerpt}</p>
                          <p>锚点：{item.source_anchor} · 第 {item.page} 页 · 优先级 {item.priority}</p>
                        </div>
                      ))
                    )}
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
