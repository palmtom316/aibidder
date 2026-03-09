import { ModuleIntro } from "./module-intro";
import { KnowledgeLibraryV2Panel } from "./knowledge-library-v2-panel";
import type {
  DocumentRecord,
  EvidenceSearchResult,
  EvidenceUnit,
  HistoricalBid,
  HistoricalBidSection,
  HistoricalReusePack,
  HistoricalReuseUnit,
  Project,
} from "../../lib/api";
import type { FormSubmitHandler, NumberAction, StateSetter, VoidAction } from "./shared";
import { formatDate, formatDocumentType, formatJobStatus, formatProjectType, formatRiskLevel } from "./utils";

type KnowledgeLibraryViewProps = {
  projects: Project[];
  documents: DocumentRecord[];
  historicalBids: HistoricalBid[];
  selectedProject: Project | null;
  selectedProjectId: number | null;
  selectedDocument: DocumentRecord | null;
  selectedDocumentId: number | null;
  selectedHistoricalBid: HistoricalBid | null;
  evidenceResults: EvidenceSearchResult[];
  documentEvidenceUnits: EvidenceUnit[];
  historicalSections: HistoricalBidSection[];
  historicalReuseUnits: HistoricalReuseUnit[];
  reusePack: HistoricalReusePack | null;
  importDocumentId: number | null;
  historicalSourceType: string;
  historicalProjectType: string;
  historicalRegion: string;
  historicalYear: string;
  historicalRecommended: boolean;
  reuseSectionType: string;
  leakageSectionId: string;
  leakageDraftText: string;
  leakageForbiddenTerms: string;
  leakageReuseUnitIds: string;
  leakageResult: { ok: boolean; matched_terms: string[] } | null;
  projectName: string;
  uploadType: string;
  evidenceQuery: string;
  evidenceDocumentType: string;
  token: string | null;
  busyLabel: string;
  message: string;
  setProjectName: StateSetter<string>;
  setUploadType: StateSetter<string>;
  setUploadFile: StateSetter<File | null>;
  setEvidenceQuery: StateSetter<string>;
  setEvidenceDocumentType: StateSetter<string>;
  setImportDocumentId: StateSetter<number | null>;
  setSelectedHistoricalBidId: StateSetter<number | null>;
  setHistoricalSourceType: StateSetter<string>;
  setHistoricalProjectType: StateSetter<string>;
  setHistoricalRegion: StateSetter<string>;
  setHistoricalYear: StateSetter<string>;
  setHistoricalRecommended: StateSetter<boolean>;
  setReuseSectionType: StateSetter<string>;
  setLeakageSectionId: StateSetter<string>;
  setLeakageDraftText: StateSetter<string>;
  setLeakageForbiddenTerms: StateSetter<string>;
  setLeakageReuseUnitIds: StateSetter<string>;
  onActivateModule: (module: "tender-analysis" | "bid-generation") => void;
  onOpenCopilot: VoidAction;
  handleCreateProject: FormSubmitHandler;
  handleUploadDocument: FormSubmitHandler;
  handleLoadEvidenceUnits: NumberAction;
  handleSearchEvidence: FormSubmitHandler;
  handleImportHistoricalBid: FormSubmitHandler;
  handleLoadHistoricalArtifacts: VoidAction;
  handleRebuildSections: VoidAction;
  handleRebuildReuseUnits: VoidAction;
  handleSearchReuse: FormSubmitHandler;
  handleVerifyLeakage: FormSubmitHandler;
};

export function KnowledgeLibraryView({
  projects,
  documents,
  historicalBids,
  selectedProject,
  selectedProjectId,
  selectedDocument,
  selectedDocumentId,
  selectedHistoricalBid,
  evidenceResults,
  documentEvidenceUnits,
  historicalSections,
  historicalReuseUnits,
  reusePack,
  importDocumentId,
  historicalSourceType,
  historicalProjectType,
  historicalRegion,
  historicalYear,
  historicalRecommended,
  reuseSectionType,
  leakageSectionId,
  leakageDraftText,
  leakageForbiddenTerms,
  leakageReuseUnitIds,
  leakageResult,
  projectName,
  uploadType,
  evidenceQuery,
  evidenceDocumentType,
  token,
  busyLabel,
  message,
  setProjectName,
  setUploadType,
  setUploadFile,
  setEvidenceQuery,
  setEvidenceDocumentType,
  setImportDocumentId,
  setSelectedHistoricalBidId,
  setHistoricalSourceType,
  setHistoricalProjectType,
  setHistoricalRegion,
  setHistoricalYear,
  setHistoricalRecommended,
  setReuseSectionType,
  setLeakageSectionId,
  setLeakageDraftText,
  setLeakageForbiddenTerms,
  setLeakageReuseUnitIds,
  onActivateModule,
  onOpenCopilot,
  handleCreateProject,
  handleUploadDocument,
  handleLoadEvidenceUnits,
  handleSearchEvidence,
  handleImportHistoricalBid,
  handleLoadHistoricalArtifacts,
  handleRebuildSections,
  handleRebuildReuseUnits,
  handleSearchReuse,
  handleVerifyLeakage,
}: KnowledgeLibraryViewProps) {
  return (
    <>
      <section className="workspace-stack">
        <ModuleIntro
          title="资料准备"
          description="先把招标文件、资质、人员、设备、业绩和历史样本补齐，后续分析和编写会更顺。"
          metrics={[
            { label: "项目数", value: projects.length },
            { label: "已收资料", value: documents.length },
            { label: "历史样本", value: historicalBids.length },
          ]}
          actions={
            <>
              <button className="ghost-button" onClick={() => onActivateModule("tender-analysis")} type="button">
                进入招标分析
              </button>
              <button className="ghost-button" onClick={() => onActivateModule("bid-generation")} type="button">
                进入内容编写
              </button>
              <button className="primary-button" onClick={() => void onOpenCopilot()} type="button">
                打开助手
              </button>
            </>
          }
        />

        <div className="workspace-grid workspace-grid-2">
          <section className="surface-card">
            <div className="panel-header">
              <div>
                <p className="eyebrow">当前概况</p>
                <h3>本项目资料准备情况</h3>
              </div>
              <span className="badge">{selectedProject ? selectedProject.name : "未选择项目"}</span>
            </div>
            <div className="summary-list">
              <div className="summary-item">
                <span>项目数</span>
                <strong>{projects.length}</strong>
              </div>
              <div className="summary-item">
                <span>文档数</span>
                <strong>{documents.length}</strong>
              </div>
              <div className="summary-item">
                <span>历史样本</span>
                <strong>{historicalBids.length}</strong>
              </div>
            </div>
          </section>

          <section className="surface-card">
            <div className="panel-header">
              <div>
                <p className="eyebrow">当前提醒</p>
                <h3>最近进展与待办</h3>
              </div>
              <span className="badge">{busyLabel || "可继续处理"}</span>
            </div>
            <div className="stack">
              <div className="info-block">
                <strong>最新提示</strong>
                <p>{message}</p>
              </div>
              <div className="info-block">
                <strong>当前文档</strong>
                <p>{selectedDocument ? `${selectedDocument.filename} · ${formatDocumentType(selectedDocument.document_type)}` : "未选择文档"}</p>
              </div>
              <div className="info-block">
                <strong>当前历史样本</strong>
                <p>{selectedHistoricalBid ? `#${selectedHistoricalBid.id} · ${formatProjectType(selectedHistoricalBid.project_type)}` : "未选择历史样本"}</p>
              </div>
            </div>
          </section>
        </div>
      </section>
      <section className="workspace-stack">
        <KnowledgeLibraryV2Panel token={token} selectedProjectId={selectedProjectId} documents={documents} />
      </section>
      <details className="surface-card">
        <summary>兼容入口（旧版资料台账与历史样本）</summary>
        <section className="workspace-stack">
        <div className="workspace-grid workspace-grid-3">
          <section className="surface-card">
            <div className="panel-header">
              <div>
                <p className="eyebrow">项目与文档</p>
                <h3>项目与资料</h3>
              </div>
              <span className="badge">{selectedProject ? selectedProject.name : "未选择"}</span>
            </div>
            <form className="inline-form" onSubmit={handleCreateProject}>
              <input
                placeholder="新项目名称"
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
              />
              <button className="primary-button" disabled={!token || Boolean(busyLabel)} type="submit">
                新建项目
              </button>
            </form>
            <form className="stack" onSubmit={handleUploadDocument}>
              <div className="two-column">
                <label>
                  文档类型
                  <select value={uploadType} onChange={(event) => setUploadType(event.target.value)}>
                    <option value="tender">招标文件</option>
                    <option value="norm">规范文件</option>
                    <option value="proposal">投标文件</option>
                  </select>
                </label>
                <label>
                  上传文件
                  <input type="file" onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} />
                </label>
              </div>
              <button
                className="primary-button"
                disabled={!token || !selectedProjectId || Boolean(busyLabel)}
                type="submit"
              >
                上传资料
              </button>
            </form>
            <div className="list">
              {documents.map((document) => (
                <button
                  className={`list-item ${selectedDocumentId === document.id ? "list-item-active" : ""}`}
                  key={document.id}
                  onClick={() => void handleLoadEvidenceUnits(document.id)}
                  type="button"
                >
                  <div>
                    <strong>{document.filename}</strong>
                    <p>
                      #{document.id} · {formatDocumentType(document.document_type)}
                    </p>
                  </div>
                  <span>{formatDate(document.created_at)}</span>
                </button>
              ))}
            </div>
          </section>

        </div>

      </section>

      <section className="workspace-stack">
        <section className="surface-card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">证据检索</p>
              <h3>证据与条款检索</h3>
            </div>
            <span className="badge">{evidenceResults.length} 命中</span>
          </div>
          <form className="stack" onSubmit={handleSearchEvidence}>
            <div className="three-column">
              <label>
                关键词
                <input
                  value={evidenceQuery}
                  onChange={(event) => setEvidenceQuery(event.target.value)}
                  placeholder="例如：工期、资格要求、质量目标"
                />
              </label>
              <label>
                文档范围
                <select value={evidenceDocumentType} onChange={(event) => setEvidenceDocumentType(event.target.value)}>
                  <option value="">全部真值文档</option>
                  <option value="tender">招标文件</option>
                  <option value="norm">规范文件</option>
                </select>
              </label>
              <div className="align-end">
                <button
                  className="primary-button"
                  disabled={!token || !selectedProjectId || !evidenceQuery.trim() || Boolean(busyLabel)}
                  type="submit"
                >
                  开始检索
                </button>
              </div>
            </div>
          </form>
          <div className="workspace-grid workspace-grid-2">
            <div className="scroll-box">
              <strong>检索结果</strong>
              {evidenceResults.map((row) => (
                <article className="result-card" key={row.id}>
                  <header>
                    <strong>{row.section_title}</strong>
                    <span>
                      {row.filename} · p.{row.page_start}
                    </span>
                  </header>
                  <p>{row.content}</p>
                </article>
              ))}
            </div>
            <div className="scroll-box">
              <strong>当前文档证据片段</strong>
              {documentEvidenceUnits.map((row) => (
                <article className="result-card" key={row.id}>
                  <header>
                    <strong>{row.section_title}</strong>
                    <span>
                      证据片段 · {row.anchor}
                    </span>
                  </header>
                  <p>{row.content}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </section>

      <section className="workspace-stack">
        <div className="workspace-grid workspace-grid-3">
          <section className="surface-card">
            <div className="panel-header">
              <div>
                <p className="eyebrow">历史样本</p>
                <h3>导入历史投标成果</h3>
              </div>
              <span className="badge">{historicalBids.length} 份</span>
            </div>
            <form className="stack" onSubmit={handleImportHistoricalBid}>
              <label>
                选择已上传资料
                <select
                  value={importDocumentId ?? ""}
                  onChange={(event) => setImportDocumentId(Number(event.target.value) || null)}
                >
                  <option value="">请选择文档</option>
                  {documents.map((document) => (
                    <option key={document.id} value={document.id}>
                      #{document.id} · {document.filename}
                    </option>
                  ))}
                </select>
              </label>
              <div className="two-column">
                <label>
                  来源类型
                  <input value={historicalSourceType} onChange={(event) => setHistoricalSourceType(event.target.value)} />
                </label>
                <label>
                  工程类型
                  <input value={historicalProjectType} onChange={(event) => setHistoricalProjectType(event.target.value)} />
                </label>
              </div>
              <div className="two-column">
                <label>
                  区域
                  <input value={historicalRegion} onChange={(event) => setHistoricalRegion(event.target.value)} />
                </label>
                <label>
                  年份
                  <input value={historicalYear} onChange={(event) => setHistoricalYear(event.target.value)} />
                </label>
              </div>
              <label className="checkbox-row">
                <input
                  checked={historicalRecommended}
                  onChange={(event) => setHistoricalRecommended(event.target.checked)}
                  type="checkbox"
                />
                标记为推荐样本
              </label>
              <button className="primary-button" disabled={!token || !importDocumentId || Boolean(busyLabel)} type="submit">
                导入历史标书
              </button>
            </form>

            <label>
              当前历史标书
              <select
                value={selectedHistoricalBid?.id ?? ""}
                onChange={(event) => setSelectedHistoricalBidId(Number(event.target.value) || null)}
              >
                <option value="">请选择历史标书</option>
                {historicalBids.map((item) => (
                  <option key={item.id} value={item.id}>
                    #{item.id} · 文档 #{item.document_id} · {formatProjectType(item.project_type)}
                  </option>
                ))}
              </select>
            </label>
            <div className="button-row">
              <button className="ghost-button" onClick={() => void handleLoadHistoricalArtifacts()} type="button">
                刷新详情
              </button>
              <button className="ghost-button" onClick={() => void handleRebuildSections()} type="button">
                重建章节切分
              </button>
              <button className="ghost-button" onClick={() => void handleRebuildReuseUnits()} type="button">
                重建复用片段
              </button>
            </div>
          </section>

          <section className="surface-card workspace-span-2">
            <div className="panel-header">
              <div>
                <p className="eyebrow">历史复用</p>
                <h3>历史复用与串项校验</h3>
              </div>
              <span className="badge">{selectedHistoricalBid ? `#${selectedHistoricalBid.id}` : "未选择"}</span>
            </div>
            <form className="stack" onSubmit={handleSearchReuse}>
              <div className="three-column">
                <label>
                  工程类型
                  <input value={historicalProjectType} onChange={(event) => setHistoricalProjectType(event.target.value)} />
                </label>
                <label>
                  章节类型
                  <input value={reuseSectionType} onChange={(event) => setReuseSectionType(event.target.value)} />
                </label>
                <div className="align-end">
                  <button className="primary-button" disabled={!token || Boolean(busyLabel)} type="submit">
                    检索复用建议
                  </button>
                </div>
              </div>
            </form>
            <div className="workspace-grid workspace-grid-3">
              <div className="scroll-box">
                <strong>可直接复用</strong>
                {reusePack?.safe_reuse?.map((item) => (
                  <article className="result-card" key={item.id}>
                    <header>
                      <strong>#{item.id}</strong>
                      <span>{formatRiskLevel(item.risk_level)}</span>
                    </header>
                    <p>{item.sanitized_text}</p>
                  </article>
                ))}
              </div>
              <div className="scroll-box">
                <strong>需替换信息</strong>
                {reusePack?.slot_reuse?.map((item) => (
                  <article className="result-card" key={item.id}>
                    <header>
                      <strong>#{item.id}</strong>
                      <span>{formatRiskLevel(item.risk_level)}</span>
                    </header>
                    <p>{item.sanitized_text}</p>
                  </article>
                ))}
              </div>
              <div className="scroll-box">
                <strong>仅保留写法</strong>
                {reusePack?.style_only?.map((item) => (
                  <article className="result-card" key={item.id}>
                    <header>
                      <strong>#{item.id}</strong>
                      <span>{formatRiskLevel(item.risk_level)}</span>
                    </header>
                    <p>{item.sanitized_text}</p>
                  </article>
                ))}
              </div>
            </div>

            <form className="stack" onSubmit={handleVerifyLeakage}>
              <div className="two-column">
                <label>
                  章节编号
                  <input value={leakageSectionId} onChange={(event) => setLeakageSectionId(event.target.value)} />
                </label>
                <label>
                  复用片段编号
                  <input
                    value={leakageReuseUnitIds}
                    onChange={(event) => setLeakageReuseUnitIds(event.target.value)}
                    placeholder="1,2,3"
                  />
                </label>
              </div>
              <label>
                禁止沿用词
                <input
                  value={leakageForbiddenTerms}
                  onChange={(event) => setLeakageForbiddenTerms(event.target.value)}
                  placeholder="旧项目名,旧业主名"
                />
              </label>
              <label>
                待检查草稿
                <textarea rows={5} value={leakageDraftText} onChange={(event) => setLeakageDraftText(event.target.value)} />
              </label>
              <button className="primary-button" disabled={!token || !selectedProjectId || Boolean(busyLabel)} type="submit">
                校验历史污染
              </button>
              {leakageResult ? (
                <div className={`message-box ${leakageResult.ok ? "message-success" : "message-warning"}`}>
                  <strong>{leakageResult.ok ? "未命中旧项目痕迹" : "命中历史污染"}</strong>
                  <p>{leakageResult.matched_terms.join("、") || "无"}</p>
                </div>
              ) : null}
            </form>

            <div className="workspace-grid workspace-grid-2">
              <div className="scroll-box">
                <strong>历史章节</strong>
                {historicalSections.map((section) => (
                  <article className="result-card" key={section.id}>
                    <header>
                      <strong>{section.title}</strong>
                      <span>{section.section_type}</span>
                    </header>
                    <p>{section.raw_text.slice(0, 180)}</p>
                  </article>
                ))}
              </div>
              <div className="scroll-box">
                <strong>复用片段</strong>
                {historicalReuseUnits.map((unit) => (
                  <article className="result-card" key={unit.id}>
                    <header>
                      <strong>#{unit.id}</strong>
                      <span>
                        复用方式 · ${formatRiskLevel(unit.risk_level)}
                      </span>
                    </header>
                    <p>{unit.sanitized_text}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </div>
        </section>
      </details>
    </>
  );
}
