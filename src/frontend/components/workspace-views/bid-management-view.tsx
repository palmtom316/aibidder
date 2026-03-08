import type { SubmissionRecord } from "../../lib/api";
import type { FormSubmitHandler, VoidAction } from "./shared";
import { ModuleIntro } from "./module-intro";
import { formatDate, formatSubmissionStatus } from "./utils";

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
      <ModuleIntro
        title="项目归档"
        description="登记投标结果、归档已提交文件，并把可复用内容沉淀到后续项目。"
        metrics={[
          { label: "归档记录", value: submissionRecords.length },
          { label: "当前状态", value: formatSubmissionStatus(submissionStatus || "draft") },
          { label: "筛选条件", value: submissionFilterStatus === "all" ? "全部状态" : formatSubmissionStatus(submissionFilterStatus) },
        ]}
      />

      <div className="workspace-grid workspace-grid-2">
        <section className="surface-card stack">
          <div className="panel-header compact">
            <div>
              <p className="eyebrow">归档登记</p>
              <h3>新增项目记录</h3>
            </div>
            <span className="badge">{submissionRecords.length} 条</span>
          </div>
          <form className="stack" onSubmit={handleCreateSubmissionRecord}>
            <label>
              记录标题
              <input value={submissionTitle} onChange={(event) => setSubmissionTitle(event.target.value)} />
            </label>
            <label>
              当前状态
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
              新增归档记录
            </button>
          </form>

          <form className="stack" onSubmit={handleApplySubmissionFilters}>
            <div className="panel-header compact">
              <div>
                <p className="eyebrow">筛选</p>
                <h3>查找归档记录</h3>
              </div>
            </div>
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
              <button className="ghost-button" type="button" onClick={() => void handleResetSubmissionFilters()}>
                重置筛选
              </button>
              <button className="ghost-button" disabled={!token || Boolean(busyLabel)} type="submit">
                应用筛选
              </button>
            </div>
          </form>

          <div className="mini-list">
            {submissionRecords.map((row) => (
              <div className="mini-item" key={row.id}>
                <strong>{row.title}</strong>
                <span>{formatSubmissionStatus(row.status)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="surface-card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">归档清单</p>
              <h3>结果回灌与后续复用</h3>
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
                        {formatSubmissionStatus(row.status)} · {formatDate(row.created_at)}
                      </span>
                    </header>
                    <p>
                      {row.status === "won"
                        ? "这条记录可以沉淀为优秀标书样本。"
                        : "这条记录可以回灌到资料准备中，供后续项目继续复用。"}
                    </p>
                    <div className="inline-actions">
                      <button
                        className="ghost-button"
                        disabled={!token || Boolean(busyLabel) || row.status === "draft"}
                        onClick={() => void handleFeedSubmissionRecordToLibrary(row.id)}
                        type="button"
                      >
                        {row.status === "won" ? "沉淀为优秀标书" : "回灌到资料准备"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="info-block">
                <strong>暂无符合条件的记录</strong>
                <p>登记投标结果后，可按状态、关键词和时间范围筛选并一键回灌到资料准备。</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
