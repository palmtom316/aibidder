import type { ReviewIssue, ReviewRun } from "../../lib/api";
import type { FormSubmitHandler, NumberAction, StateSetter, VoidAction } from "./shared";
import { ModuleIntro } from "./module-intro";
import { formatJobStatus, formatReviewCategory, formatReviewMode, formatReviewSeverity } from "./utils";

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
      <ModuleIntro
        title="校核定稿"
        description="重点检查评分风险、废标项和内容遗漏，确认是否可以进入最终排版。"
        metrics={[
          { label: "校核任务", value: reviewRuns.length },
          { label: "待处理问题", value: reviewIssues.length },
          { label: "阻塞问题", value: blockingIssues },
        ]}
        actions={
          <button
            className="ghost-button"
            disabled={!token || !selectedReviewRun || Boolean(busyLabel) || selectedReviewRun.blocking_issue_count > 0 || selectedReviewRun.status === "approved"}
            onClick={() => void handleConfirmReviewRunPass()}
            type="button"
          >
            {selectedReviewRun?.status === "approved" ? "已确认通过" : "确认可以定稿"}
          </button>
        }
      />

      <div className="workspace-grid workspace-grid-2">
        <form className="surface-card stack" onSubmit={handleCreateReviewRun}>
          <div className="panel-header compact">
            <div>
              <p className="eyebrow">校核任务</p>
              <h3>创建校核检查</h3>
            </div>
            <span className="badge">{reviewRuns.length} 条</span>
          </div>
          <label>
            任务名称
            <input value={reviewRunName} onChange={(event) => setReviewRunName(event.target.value)} />
          </label>
          <label>
            校核方式
            <select value={reviewMode} onChange={(event) => setReviewMode(event.target.value)}>
              <option value="simulated_scoring">模拟评分</option>
              <option value="compliance_review">合规审查</option>
              <option value="disqualification_check">废标风险排查</option>
            </select>
          </label>
          <button className="primary-button" disabled={!token || !selectedProjectId || Boolean(busyLabel)} type="submit">
            开始校核
          </button>
          <label>
            查看校核结果
            <select
              value={selectedReviewRunId ?? ""}
              onChange={(event) => void setSelectedReviewRunId(Number(event.target.value) || null)}
            >
              <option value="">请选择校核任务</option>
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
                <span>{formatReviewMode(row.review_mode)} · {formatJobStatus(row.status)}</span>
              </div>
            ))}
          </div>
        </form>

        <section className="surface-card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">问题清单</p>
              <h3>{selectedReviewRun ? selectedReviewRun.run_name : "等待选择校核任务"}</h3>
            </div>
            <span className="badge">{reviewIssues.length} 条问题</span>
          </div>
          <div className="stack">
            <div className="info-block">
              <strong>综合结论</strong>
              <p>
                {selectedReviewRun
                  ? `状态：${formatJobStatus(selectedReviewRun.status)}，模拟评分：${selectedReviewRun.simulated_score ?? "--"}，阻塞问题：${selectedReviewRun.blocking_issue_count}`
                  : "先创建或选择一个校核任务。"}
              </p>
              <div className="inline-actions">
                <button
                  className="ghost-button"
                  disabled={!token || !selectedReviewRun || Boolean(busyLabel) || selectedReviewRun.blocking_issue_count > 0 || selectedReviewRun.status === "approved"}
                  onClick={() => void handleConfirmReviewRunPass()}
                  type="button"
                >
                  {selectedReviewRun?.status === "approved" ? "已确认通过" : "确认可以定稿"}
                </button>
              </div>
            </div>
            {reviewIssues.length ? (
              <>
                <div className={`message-box ${blockingIssues > 0 ? "message-warning" : "message-success"}`}>
                  <strong>{blockingIssues > 0 ? "还有重点问题要先处理" : "当前没有阻塞问题"}</strong>
                  <p>
                    {blockingIssues > 0
                      ? `建议优先处理 ${blockingIssues} 个阻塞问题，再进入排版导出。`
                      : "可以继续推进排版导出或项目归档。"}
                  </p>
                </div>
                <div className="scroll-box">
                  {reviewIssues.map((issue) => (
                    <article className="result-card" key={issue.id}>
                      <header>
                        <strong>{issue.title}</strong>
                        <span>
                          {formatReviewSeverity(issue.severity)} · {formatReviewCategory(issue.category)} · {issue.is_blocking ? "阻塞" : "提示"}
                        </span>
                      </header>
                      <p>{issue.detail}</p>
                      <div className="inline-actions">
                        <span className="badge">{formatJobStatus(issue.status)}</span>
                        <button
                          className="ghost-button"
                          disabled={!token || Boolean(busyLabel) || issue.generated_section_id === null || issue.status === "resolved"}
                          onClick={() => void handleRemediateReviewIssue(issue.id)}
                          type="button"
                        >
                          {issue.generated_section_id === null ? "仅提示" : issue.status === "resolved" ? "已处理" : "退回重写"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <div className="info-block">
                <strong>暂无问题单</strong>
                <p>执行校核后，这里会展示合规、评分和废标风险问题清单。</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
