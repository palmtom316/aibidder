import type { ReviewIssue, ReviewRun } from "../../lib/api";
import type { FormSubmitHandler, NumberAction, StateSetter, VoidAction } from "./shared";

type BidReviewViewProps = {
  reviewRuns: ReviewRun[];
  selectedReviewRun: ReviewRun | null;
  selectedReviewRunId: number | null;
  reviewIssues: ReviewIssue[];
  reviewRunName: string;
  reviewMode: string;
  selectedProjectId: number | null;
  token: string | null;
  busyLabel: string;
  setReviewRunName: (value: string) => void;
  setReviewMode: (value: string) => void;
  setSelectedReviewRunId: StateSetter<number | null>;
  handleCreateReviewRun: FormSubmitHandler;
  handleConfirmReviewRunPass: VoidAction;
  handleRemediateReviewIssue: NumberAction;
};

export function BidReviewView({
  reviewRuns,
  selectedReviewRun,
  selectedReviewRunId,
  reviewIssues,
  reviewRunName,
  reviewMode,
  selectedProjectId,
  token,
  busyLabel,
  setReviewRunName,
  setReviewMode,
  setSelectedReviewRunId,
  handleCreateReviewRun,
  handleConfirmReviewRunPass,
  handleRemediateReviewIssue,
}: BidReviewViewProps) {
  const blockingIssues = reviewIssues.filter((item) => item.is_blocking).length;

  return (
    <section className="workspace-stack">
      <div className="workspace-grid workspace-grid-2">
        <form className="surface-card stack" onSubmit={handleCreateReviewRun}>
          <div className="panel-header compact">
            <div>
              <p className="eyebrow">标书评审</p>
              <h3>Review</h3>
            </div>
            <span className="badge">{reviewRuns.length}</span>
          </div>
          <label>
            任务名
            <input value={reviewRunName} onChange={(event) => setReviewRunName(event.target.value)} />
          </label>
          <label>
            模式
            <select value={reviewMode} onChange={(event) => setReviewMode(event.target.value)}>
              <option value="simulated_scoring">模拟评分</option>
              <option value="compliance_review">合规性审查</option>
              <option value="disqualification_check">废标分析</option>
            </select>
          </label>
          <button className="primary-button" disabled={!token || !selectedProjectId || Boolean(busyLabel)} type="submit">
            创建评审任务
          </button>
          <label>
            查看评审
            <select
              value={selectedReviewRunId ?? ""}
              onChange={(event) => void setSelectedReviewRunId(Number(event.target.value) || null)}
            >
              <option value="">请选择评审任务</option>
              {reviewRuns.map((row) => (
                <option key={row.id} value={row.id}>
                  #{row.id} · {row.run_name}
                </option>
              ))}
            </select>
          </label>
          <div className="mini-list">
            {reviewRuns.map((row) => (
              <div className="mini-item" key={row.id}>
                <strong>{row.run_name}</strong>
                <span>{row.review_mode} · {row.status}</span>
              </div>
            ))}
          </div>
        </form>

        <section className="surface-card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">评审结果</p>
              <h3>{selectedReviewRun ? selectedReviewRun.run_name : "等待选择评审任务"}</h3>
            </div>
            <span className="badge">{reviewIssues.length} 条问题</span>
          </div>
          <div className="stack">
            <div className="info-block">
              <strong>综合结论</strong>
              <p>
                {selectedReviewRun
                  ? `状态：${selectedReviewRun.status}，模拟评分：${selectedReviewRun.simulated_score ?? "--"}，阻塞问题：${selectedReviewRun.blocking_issue_count}`
                  : "先创建或选择一个评审任务。"}
              </p>
              <div className="inline-actions">
                <button
                  className="ghost-button"
                  disabled={!token || !selectedReviewRun || Boolean(busyLabel) || selectedReviewRun.blocking_issue_count > 0 || selectedReviewRun.status === "approved"}
                  onClick={() => void handleConfirmReviewRunPass()}
                  type="button"
                >
                  {selectedReviewRun?.status === "approved" ? "已确认通过" : "确认评审通过"}
                </button>
              </div>
            </div>
            {reviewIssues.length ? (
              <>
                <div className={`message-box ${blockingIssues > 0 ? "message-warning" : "message-success"}`}>
                  <strong>{blockingIssues > 0 ? "存在需打回问题" : "当前无阻塞问题"}</strong>
                  <p>
                    {blockingIssues > 0
                      ? `建议优先处理 ${blockingIssues} 个阻塞问题，再进入排版定稿。`
                      : "可以继续推进排版定稿或投标文件归档。"}
                  </p>
                </div>
                <div className="scroll-box">
                  {reviewIssues.map((issue) => (
                    <article className="result-card" key={issue.id}>
                      <header>
                        <strong>{issue.title}</strong>
                        <span>
                          {issue.severity} · {issue.category} · {issue.is_blocking ? "阻塞" : "提示"}
                        </span>
                      </header>
                      <p>{issue.detail}</p>
                      <div className="inline-actions">
                        <span className="badge">{issue.status}</span>
                        <button
                          className="ghost-button"
                          disabled={!token || Boolean(busyLabel) || issue.generated_section_id === null || issue.status === "resolved"}
                          onClick={() => void handleRemediateReviewIssue(issue.id)}
                          type="button"
                        >
                          {issue.generated_section_id === null ? "仅提示" : issue.status === "resolved" ? "已重写" : "打回重写"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <div className="info-block">
                <strong>暂无问题单</strong>
                <p>执行评审后，这里会展示合规、评分、废标分析等问题清单。</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
