import type { SubmissionRecord } from "../../lib/api";
import type { FormSubmitHandler, VoidAction } from "./shared";
import { formatDate } from "./utils";

type BidManagementViewProps = {
  submissionRecords: SubmissionRecord[];
  submissionTitle: string;
  submissionStatus: string;
  submissionFilterStatus: string;
  submissionFilterQuery: string;
  submissionCreatedFrom: string;
  submissionCreatedTo: string;
  selectedProjectId: number | null;
  token: string | null;
  busyLabel: string;
  setSubmissionTitle: (value: string) => void;
  setSubmissionStatus: (value: string) => void;
  setSubmissionFilterStatus: (value: string) => void;
  setSubmissionFilterQuery: (value: string) => void;
  setSubmissionCreatedFrom: (value: string) => void;
  setSubmissionCreatedTo: (value: string) => void;
  handleCreateSubmissionRecord: FormSubmitHandler;
  handleApplySubmissionFilters: FormSubmitHandler;
  handleResetSubmissionFilters: VoidAction;
  handleFeedSubmissionRecordToLibrary: (submissionRecordId: number) => Promise<void> | void;
};

export function BidManagementView({
  submissionRecords,
  submissionTitle,
  submissionStatus,
  submissionFilterStatus,
  submissionFilterQuery,
  submissionCreatedFrom,
  submissionCreatedTo,
  selectedProjectId,
  token,
  busyLabel,
  setSubmissionTitle,
  setSubmissionStatus,
  setSubmissionFilterStatus,
  setSubmissionFilterQuery,
  setSubmissionCreatedFrom,
  setSubmissionCreatedTo,
  handleCreateSubmissionRecord,
  handleApplySubmissionFilters,
  handleResetSubmissionFilters,
  handleFeedSubmissionRecordToLibrary,
}: BidManagementViewProps) {
  return (
    <section className="workspace-stack">
      <div className="workspace-grid workspace-grid-2">
        <form className="surface-card stack" onSubmit={handleCreateSubmissionRecord}>
          <div className="panel-header compact">
            <div>
              <p className="eyebrow">标书管理</p>
              <h3>Bid Management</h3>
            </div>
            <span className="badge">{submissionRecords.length}</span>
          </div>
          <label>
            标题
            <input value={submissionTitle} onChange={(event) => setSubmissionTitle(event.target.value)} />
          </label>
          <label>
            状态
            <select value={submissionStatus} onChange={(event) => setSubmissionStatus(event.target.value)}>
              <option value="draft">草稿</option>
              <option value="ready_for_submission">待提交</option>
              <option value="submitted">已提交</option>
              <option value="won">已中标</option>
              <option value="lost">未中标</option>
              <option value="archived">已归档</option>
            </select>
          </label>
          <button className="primary-button" disabled={!token || !selectedProjectId || Boolean(busyLabel)} type="submit">
            创建管理记录
          </button>
          <form className="stack" onSubmit={handleApplySubmissionFilters}>
            <label>
              状态筛选
              <select value={submissionFilterStatus} onChange={(event) => setSubmissionFilterStatus(event.target.value)}>
                <option value="all">全部状态</option>
                <option value="draft">草稿</option>
                <option value="ready_for_submission">待提交</option>
                <option value="submitted">已提交</option>
                <option value="won">已中标</option>
                <option value="lost">未中标</option>
                <option value="archived">已归档</option>
              </select>
            </label>
            <label>
              关键词
              <input value={submissionFilterQuery} onChange={(event) => setSubmissionFilterQuery(event.target.value)} placeholder="按标题筛选" />
            </label>
            <div className="two-column">
              <label>
                创建起始
                <input type="date" value={submissionCreatedFrom} onChange={(event) => setSubmissionCreatedFrom(event.target.value)} />
              </label>
              <label>
                创建截止
                <input type="date" value={submissionCreatedTo} onChange={(event) => setSubmissionCreatedTo(event.target.value)} />
              </label>
            </div>
            <div className="inline-actions">
              <button className="ghost-button" type="button" onClick={() => void handleResetSubmissionFilters()}>重置筛选</button>
              <button className="ghost-button" disabled={!token || Boolean(busyLabel)} type="submit">应用筛选</button>
            </div>
          </form>
          <div className="mini-list">
            {submissionRecords.map((row) => (
              <div className="mini-item" key={row.id}>
                <strong>{row.title}</strong>
                <span>{row.status}</span>
              </div>
            ))}
          </div>
        </form>

        <section className="surface-card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">管理清单</p>
              <h3>生命周期与回灌</h3>
            </div>
            <span className="badge">{submissionRecords.length} 条</span>
          </div>
          <div className="stack">
            {submissionRecords.length ? (
              <div className="scroll-box">
                {submissionRecords.map((row) => (
                  <article className="result-card" key={row.id}>
                    <header>
                      <strong>{row.title}</strong>
                      <span>
                        {row.status} · {formatDate(row.created_at)}
                      </span>
                    </header>
                    <p>
                      {row.status === "won"
                        ? "可回灌为优秀标书样本。"
                        : "可回灌为历史投标资料，供后续项目复用。"}
                    </p>
                    <div className="inline-actions">
                      <button
                        className="ghost-button"
                        disabled={!token || Boolean(busyLabel) || row.status === "draft"}
                        onClick={() => void handleFeedSubmissionRecordToLibrary(row.id)}
                        type="button"
                      >
                        {row.status === "won" ? "回灌优秀标书" : "回灌资料库"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="info-block">
                <strong>暂无符合条件的记录</strong>
                <p>创建标书管理记录后，可按状态、关键词和时间范围筛选并一键回灌到资料库。</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
