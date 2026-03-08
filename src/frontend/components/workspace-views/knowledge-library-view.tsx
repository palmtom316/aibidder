import { HeroPanel } from "../hero-panel";
import { ModuleStrip } from "../module-strip";
import type {
  DocumentRecord,
  EquipmentAsset,
  EvidenceSearchResult,
  EvidenceUnit,
  HistoricalBid,
  HistoricalBidSection,
  HistoricalReusePack,
  HistoricalReuseUnit,
  KnowledgeBaseEntry,
  PersonnelAsset,
  Project,
  ProjectCredential,
  Qualification,
  WorkbenchOverview,
} from "../../lib/api";
import type { FormSubmitHandler, NumberAction, StateSetter, VoidAction } from "./shared";
import { formatDate } from "./utils";

type KnowledgeLibraryViewProps = {
  projects: Project[];
  documents: DocumentRecord[];
  historicalBids: HistoricalBid[];
  workbenchOverview: WorkbenchOverview | null;
  selectedProject: Project | null;
  selectedProjectId: number | null;
  selectedDocument: DocumentRecord | null;
  selectedDocumentId: number | null;
  selectedHistoricalBid: HistoricalBid | null;
  knowledgeBaseEntries: KnowledgeBaseEntry[];
  qualifications: Qualification[];
  personnelAssets: PersonnelAsset[];
  equipmentAssets: EquipmentAsset[];
  projectCredentials: ProjectCredential[];
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
  libraryCategory: string;
  libraryTitle: string;
  libraryOwnerName: string;
  libraryFilterCategory: string;
  libraryFilterQuery: string;
  libraryCreatedFrom: string;
  libraryCreatedTo: string;
  qualificationName: string;
  qualificationLevel: string;
  qualificationCertificateNo: string;
  qualificationValidUntil: string;
  personnelName: string;
  personnelRoleTitle: string;
  personnelCertificateNo: string;
  equipmentName: string;
  equipmentModelNo: string;
  equipmentQuantity: string;
  credentialProjectName: string;
  credentialType: string;
  credentialOwnerName: string;
  evidenceQuery: string;
  evidenceDocumentType: string;
  token: string | null;
  busyLabel: string;
  message: string;
  setProjectName: StateSetter<string>;
  setUploadType: StateSetter<string>;
  setUploadFile: StateSetter<File | null>;
  setLibraryCategory: StateSetter<string>;
  setLibraryTitle: StateSetter<string>;
  setLibraryOwnerName: StateSetter<string>;
  setLibraryFilterCategory: StateSetter<string>;
  setLibraryFilterQuery: StateSetter<string>;
  setLibraryCreatedFrom: StateSetter<string>;
  setLibraryCreatedTo: StateSetter<string>;
  setQualificationName: StateSetter<string>;
  setQualificationLevel: StateSetter<string>;
  setQualificationCertificateNo: StateSetter<string>;
  setQualificationValidUntil: StateSetter<string>;
  setPersonnelName: StateSetter<string>;
  setPersonnelRoleTitle: StateSetter<string>;
  setPersonnelCertificateNo: StateSetter<string>;
  setEquipmentName: StateSetter<string>;
  setEquipmentModelNo: StateSetter<string>;
  setEquipmentQuantity: StateSetter<string>;
  setCredentialProjectName: StateSetter<string>;
  setCredentialType: StateSetter<string>;
  setCredentialOwnerName: StateSetter<string>;
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
  handleCreateLibraryEntry: FormSubmitHandler;
  handleApplyLibraryFilters: FormSubmitHandler;
  handleResetLibraryFilters: VoidAction;
  handleRunLibraryCheck: NumberAction;
  handleCreateQualification: FormSubmitHandler;
  handleDeleteQualification: NumberAction;
  handleCreatePersonnelAsset: FormSubmitHandler;
  handleDeletePersonnelAsset: NumberAction;
  handleCreateEquipmentAsset: FormSubmitHandler;
  handleDeleteEquipmentAsset: NumberAction;
  handleCreateProjectCredential: FormSubmitHandler;
  handleDeleteProjectCredential: NumberAction;
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
  workbenchOverview,
  selectedProject,
  selectedProjectId,
  selectedDocument,
  selectedDocumentId,
  selectedHistoricalBid,
  knowledgeBaseEntries,
  qualifications,
  personnelAssets,
  equipmentAssets,
  projectCredentials,
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
  libraryCategory,
  libraryTitle,
  libraryOwnerName,
  libraryFilterCategory,
  libraryFilterQuery,
  libraryCreatedFrom,
  libraryCreatedTo,
  qualificationName,
  qualificationLevel,
  qualificationCertificateNo,
  qualificationValidUntil,
  personnelName,
  personnelRoleTitle,
  personnelCertificateNo,
  equipmentName,
  equipmentModelNo,
  equipmentQuantity,
  credentialProjectName,
  credentialType,
  credentialOwnerName,
  evidenceQuery,
  evidenceDocumentType,
  token,
  busyLabel,
  message,
  setProjectName,
  setUploadType,
  setUploadFile,
  setLibraryCategory,
  setLibraryTitle,
  setLibraryOwnerName,
  setLibraryFilterCategory,
  setLibraryFilterQuery,
  setLibraryCreatedFrom,
  setLibraryCreatedTo,
  setQualificationName,
  setQualificationLevel,
  setQualificationCertificateNo,
  setQualificationValidUntil,
  setPersonnelName,
  setPersonnelRoleTitle,
  setPersonnelCertificateNo,
  setEquipmentName,
  setEquipmentModelNo,
  setEquipmentQuantity,
  setCredentialProjectName,
  setCredentialType,
  setCredentialOwnerName,
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
  handleCreateLibraryEntry,
  handleApplyLibraryFilters,
  handleResetLibraryFilters,
  handleRunLibraryCheck,
  handleCreateQualification,
  handleDeleteQualification,
  handleCreatePersonnelAsset,
  handleDeletePersonnelAsset,
  handleCreateEquipmentAsset,
  handleDeleteEquipmentAsset,
  handleCreateProjectCredential,
  handleDeleteProjectCredential,
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
        <HeroPanel
          projectCount={projects.length}
          documentCount={documents.length}
          historicalBidCount={historicalBids.length}
        />
        <ModuleStrip modules={workbenchOverview?.modules ?? []} />
        <div className="workspace-grid workspace-grid-2">
          <section className="surface-card">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Overview</p>
                <h3>当前项目上下文</h3>
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
                <span>历史标书</span>
                <strong>{historicalBids.length}</strong>
              </div>
            </div>
            <div className="inline-actions">
              <button className="ghost-button" onClick={() => onActivateModule("tender-analysis")} type="button">
                标书分析
              </button>
              <button className="ghost-button" onClick={() => onActivateModule("bid-generation")} type="button">
                标书生成
              </button>
              <button className="ghost-button" onClick={() => void onOpenCopilot()} type="button">
                打开 Copilot
              </button>
            </div>
          </section>

          <section className="surface-card">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Recent</p>
                <h3>最近活动</h3>
              </div>
              <span className="badge">{busyLabel || "空闲"}</span>
            </div>
            <div className="stack">
              <div className="info-block">
                <strong>最近消息</strong>
                <p>{message}</p>
              </div>
              <div className="info-block">
                <strong>当前文档</strong>
                <p>{selectedDocument ? `${selectedDocument.filename} · ${selectedDocument.document_type}` : "未选择文档"}</p>
              </div>
              <div className="info-block">
                <strong>当前历史标书</strong>
                <p>{selectedHistoricalBid ? `#${selectedHistoricalBid.id} · ${selectedHistoricalBid.project_type}` : "未选择历史标书"}</p>
              </div>
            </div>
          </section>
        </div>
      </section>

      <section className="workspace-stack">
        <div className="workspace-grid workspace-grid-3">
          <section className="surface-card">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Projects</p>
                <h3>项目与文档</h3>
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
                创建
              </button>
            </form>
            <form className="stack" onSubmit={handleUploadDocument}>
              <div className="two-column">
                <label>
                  文档类型
                  <select value={uploadType} onChange={(event) => setUploadType(event.target.value)}>
                    <option value="tender">tender</option>
                    <option value="norm">norm</option>
                    <option value="proposal">proposal</option>
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
                上传文档
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
                      #{document.id} · {document.document_type}
                    </p>
                  </div>
                  <span>{formatDate(document.created_at)}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="surface-card workspace-span-2">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Knowledge Library</p>
                <h3>投标资料库</h3>
              </div>
              <span className="badge">{knowledgeBaseEntries.length} 条资料</span>
            </div>
            <form className="stack" onSubmit={handleCreateLibraryEntry}>
              <div className="three-column three-column-equal">
                <label>
                  资料分类
                  <select value={libraryCategory} onChange={(event) => setLibraryCategory(event.target.value)}>
                    <option value="historical_bid">历史标书</option>
                    <option value="excellent_bid">优秀标书</option>
                    <option value="company_qualification">公司资质</option>
                    <option value="company_performance_asset">公司业绩与资产</option>
                    <option value="personnel_qualification">人员资质</option>
                    <option value="personnel_performance">人员业绩</option>
                  </select>
                </label>
                <label>
                  资料标题
                  <input value={libraryTitle} onChange={(event) => setLibraryTitle(event.target.value)} />
                </label>
                <label>
                  归口部门
                  <input value={libraryOwnerName} onChange={(event) => setLibraryOwnerName(event.target.value)} />
                </label>
              </div>
              <div className="inline-hint">
                <span>当前绑定文档</span>
                <strong>{selectedDocument ? `${selectedDocument.filename} #${selectedDocument.id}` : "未选择文档"}</strong>
              </div>
              <button
                className="primary-button"
                disabled={!token || !selectedProjectId || !libraryTitle.trim() || Boolean(busyLabel)}
                type="submit"
              >
                登记入库并生成检测任务
              </button>
            </form>
            <form className="stack" onSubmit={handleApplyLibraryFilters}>
              <div className="panel-header compact">
                <div>
                  <p className="eyebrow">资料筛选</p>
                  <h3>按分类、关键词、时间范围查询</h3>
                </div>
              </div>
              <div className="three-column three-column-equal">
                <label>
                  分类
                  <select value={libraryFilterCategory} onChange={(event) => setLibraryFilterCategory(event.target.value)}>
                    <option value="all">全部分类</option>
                    <option value="historical_bid">历史标书</option>
                    <option value="excellent_bid">优秀标书</option>
                    <option value="company_qualification">公司资质</option>
                    <option value="company_performance_asset">公司业绩与资产</option>
                    <option value="personnel_qualification">人员资质</option>
                    <option value="personnel_performance">人员业绩</option>
                  </select>
                </label>
                <label>
                  关键词
                  <input value={libraryFilterQuery} onChange={(event) => setLibraryFilterQuery(event.target.value)} placeholder="标题/部门/分类" />
                </label>
                <label>
                  创建时间起
                  <input type="date" value={libraryCreatedFrom} onChange={(event) => setLibraryCreatedFrom(event.target.value)} />
                </label>
              </div>
              <div className="three-column three-column-equal">
                <label>
                  创建时间止
                  <input type="date" value={libraryCreatedTo} onChange={(event) => setLibraryCreatedTo(event.target.value)} />
                </label>
                <div className="inline-hint">
                  <span>当前结果</span>
                  <strong>{knowledgeBaseEntries.length} 条</strong>
                </div>
                <div className="list-actions">
                  <button className="primary-button" disabled={!token || Boolean(busyLabel)} type="submit">
                    应用筛选
                  </button>
                  <button className="ghost-button" disabled={Boolean(busyLabel)} onClick={() => void handleResetLibraryFilters()} type="button">
                    重置
                  </button>
                </div>
              </div>
            </form>
            <div className="list">
              {knowledgeBaseEntries.map((entry) => (
                <div className="list-item static-item" key={entry.id}>
                  <div>
                    <strong>{entry.title}</strong>
                    <p>
                      {entry.category} · {entry.owner_name || "未指定部门"}
                    </p>
                    <p>{entry.detected_summary || "待执行资料检测。"}</p>
                  </div>
                  <div className="list-actions">
                    <span>{entry.detection_status}</span>
                    <button className="ghost-button" onClick={() => void handleRunLibraryCheck(entry.id)} type="button">
                      运行检测
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="workspace-grid workspace-grid-2">
          <form className="surface-card stack" onSubmit={handleCreateQualification}>
            <div className="panel-header compact">
              <div>
                <p className="eyebrow">企业事实表</p>
                <h3>公司资质</h3>
              </div>
              <span className="badge">{qualifications.length}</span>
            </div>
            <label>
              资质名称
              <input value={qualificationName} onChange={(event) => setQualificationName(event.target.value)} />
            </label>
            <div className="two-column">
              <label>
                资质等级
                <input value={qualificationLevel} onChange={(event) => setQualificationLevel(event.target.value)} />
              </label>
              <label>
                证书编号
                <input value={qualificationCertificateNo} onChange={(event) => setQualificationCertificateNo(event.target.value)} />
              </label>
            </div>
            <label>
              有效期
              <input value={qualificationValidUntil} onChange={(event) => setQualificationValidUntil(event.target.value)} placeholder="例如 2028-12-31" />
            </label>
            <button className="primary-button" disabled={!token || !qualificationName.trim() || Boolean(busyLabel)} type="submit">
              新增公司资质
            </button>
            <div className="mini-list">
              {qualifications.map((row) => (
                <div className="mini-item" key={row.id}>
                  <div>
                    <strong>{row.qualification_name}</strong>
                    <span>{row.qualification_level || "未分级"} · {row.certificate_no || "无证书号"}</span>
                  </div>
                  <button className="ghost-button" onClick={() => void handleDeleteQualification(row.id)} type="button">删除</button>
                </div>
              ))}
            </div>
          </form>

          <form className="surface-card stack" onSubmit={handleCreatePersonnelAsset}>
            <div className="panel-header compact">
              <div>
                <p className="eyebrow">企业事实表</p>
                <h3>人员资质</h3>
              </div>
              <span className="badge">{personnelAssets.length}</span>
            </div>
            <label>
              人员姓名
              <input value={personnelName} onChange={(event) => setPersonnelName(event.target.value)} />
            </label>
            <div className="two-column">
              <label>
                角色
                <input value={personnelRoleTitle} onChange={(event) => setPersonnelRoleTitle(event.target.value)} />
              </label>
              <label>
                证书编号
                <input value={personnelCertificateNo} onChange={(event) => setPersonnelCertificateNo(event.target.value)} />
              </label>
            </div>
            <button className="primary-button" disabled={!token || !personnelName.trim() || Boolean(busyLabel)} type="submit">
              新增人员资质
            </button>
            <div className="mini-list">
              {personnelAssets.map((row) => (
                <div className="mini-item" key={row.id}>
                  <div>
                    <strong>{row.full_name}</strong>
                    <span>{row.role_title || "未设角色"} · {row.certificate_no || "无证书号"}</span>
                  </div>
                  <button className="ghost-button" onClick={() => void handleDeletePersonnelAsset(row.id)} type="button">删除</button>
                </div>
              ))}
            </div>
          </form>

          <form className="surface-card stack" onSubmit={handleCreateEquipmentAsset}>
            <div className="panel-header compact">
              <div>
                <p className="eyebrow">企业事实表</p>
                <h3>设施设备</h3>
              </div>
              <span className="badge">{equipmentAssets.length}</span>
            </div>
            <label>
              设备名称
              <input value={equipmentName} onChange={(event) => setEquipmentName(event.target.value)} />
            </label>
            <div className="two-column">
              <label>
                型号
                <input value={equipmentModelNo} onChange={(event) => setEquipmentModelNo(event.target.value)} />
              </label>
              <label>
                数量
                <input value={equipmentQuantity} onChange={(event) => setEquipmentQuantity(event.target.value)} inputMode="numeric" />
              </label>
            </div>
            <button className="primary-button" disabled={!token || !equipmentName.trim() || Boolean(busyLabel)} type="submit">
              新增设施设备
            </button>
            <div className="mini-list">
              {equipmentAssets.map((row) => (
                <div className="mini-item" key={row.id}>
                  <div>
                    <strong>{row.equipment_name}</strong>
                    <span>{row.model_no || "未设型号"} · {row.quantity} 台</span>
                  </div>
                  <button className="ghost-button" onClick={() => void handleDeleteEquipmentAsset(row.id)} type="button">删除</button>
                </div>
              ))}
            </div>
          </form>

          <form className="surface-card stack" onSubmit={handleCreateProjectCredential}>
            <div className="panel-header compact">
              <div>
                <p className="eyebrow">企业事实表</p>
                <h3>项目业绩</h3>
              </div>
              <span className="badge">{projectCredentials.length}</span>
            </div>
            <label>
              项目名称
              <input value={credentialProjectName} onChange={(event) => setCredentialProjectName(event.target.value)} />
            </label>
            <div className="two-column">
              <label>
                业绩类型
                <input value={credentialType} onChange={(event) => setCredentialType(event.target.value)} />
              </label>
              <label>
                归口部门
                <input value={credentialOwnerName} onChange={(event) => setCredentialOwnerName(event.target.value)} />
              </label>
            </div>
            <button className="primary-button" disabled={!token || !credentialProjectName.trim() || Boolean(busyLabel)} type="submit">
              新增项目业绩
            </button>
            <div className="mini-list">
              {projectCredentials.map((row) => (
                <div className="mini-item" key={row.id}>
                  <div>
                    <strong>{row.project_name}</strong>
                    <span>{row.credential_type} · {row.owner_name || "未指定部门"}</span>
                  </div>
                  <button className="ghost-button" onClick={() => void handleDeleteProjectCredential(row.id)} type="button">删除</button>
                </div>
              ))}
            </div>
          </form>
        </div>
      </section>

      <section className="workspace-stack">
        <section className="surface-card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Evidence</p>
              <h3>真值证据检索</h3>
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
                  <option value="tender">tender</option>
                  <option value="norm">norm</option>
                </select>
              </label>
              <div className="align-end">
                <button
                  className="primary-button"
                  disabled={!token || !selectedProjectId || !evidenceQuery.trim() || Boolean(busyLabel)}
                  type="submit"
                >
                  检索 evidence
                </button>
              </div>
            </div>
          </form>
          <div className="workspace-grid workspace-grid-2">
            <div className="scroll-box">
              <strong>Search Results</strong>
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
              <strong>Selected Document Evidence Units</strong>
              {documentEvidenceUnits.map((row) => (
                <article className="result-card" key={row.id}>
                  <header>
                    <strong>{row.section_title}</strong>
                    <span>
                      {row.unit_type} · {row.anchor}
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
                <p className="eyebrow">Historical</p>
                <h3>历史标书导入</h3>
              </div>
              <span className="badge">{historicalBids.length} 份</span>
            </div>
            <form className="stack" onSubmit={handleImportHistoricalBid}>
              <label>
                选择已上传文档
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
                  source_type
                  <input value={historicalSourceType} onChange={(event) => setHistoricalSourceType(event.target.value)} />
                </label>
                <label>
                  project_type
                  <input value={historicalProjectType} onChange={(event) => setHistoricalProjectType(event.target.value)} />
                </label>
              </div>
              <div className="two-column">
                <label>
                  region
                  <input value={historicalRegion} onChange={(event) => setHistoricalRegion(event.target.value)} />
                </label>
                <label>
                  year
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
                    #{item.id} · doc {item.document_id} · {item.project_type}
                  </option>
                ))}
              </select>
            </label>
            <div className="button-row">
              <button className="ghost-button" onClick={() => void handleLoadHistoricalArtifacts()} type="button">
                刷新详情
              </button>
              <button className="ghost-button" onClick={() => void handleRebuildSections()} type="button">
                重建 sections
              </button>
              <button className="ghost-button" onClick={() => void handleRebuildReuseUnits()} type="button">
                重建 reuse units
              </button>
            </div>
          </section>

          <section className="surface-card workspace-span-2">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Reuse</p>
                <h3>历史复用与污染校验</h3>
              </div>
              <span className="badge">{selectedHistoricalBid ? `#${selectedHistoricalBid.id}` : "未选择"}</span>
            </div>
            <form className="stack" onSubmit={handleSearchReuse}>
              <div className="three-column">
                <label>
                  project_type
                  <input value={historicalProjectType} onChange={(event) => setHistoricalProjectType(event.target.value)} />
                </label>
                <label>
                  section_type
                  <input value={reuseSectionType} onChange={(event) => setReuseSectionType(event.target.value)} />
                </label>
                <div className="align-end">
                  <button className="primary-button" disabled={!token || Boolean(busyLabel)} type="submit">
                    检索 reuse pack
                  </button>
                </div>
              </div>
            </form>
            <div className="workspace-grid workspace-grid-3">
              <div className="scroll-box">
                <strong>safe_reuse</strong>
                {reusePack?.safe_reuse.map((item) => (
                  <article className="result-card" key={item.id}>
                    <header>
                      <strong>#{item.id}</strong>
                      <span>{item.risk_level}</span>
                    </header>
                    <p>{item.sanitized_text}</p>
                  </article>
                ))}
              </div>
              <div className="scroll-box">
                <strong>slot_reuse</strong>
                {reusePack?.slot_reuse.map((item) => (
                  <article className="result-card" key={item.id}>
                    <header>
                      <strong>#{item.id}</strong>
                      <span>{item.risk_level}</span>
                    </header>
                    <p>{item.sanitized_text}</p>
                  </article>
                ))}
              </div>
              <div className="scroll-box">
                <strong>style_only</strong>
                {reusePack?.style_only.map((item) => (
                  <article className="result-card" key={item.id}>
                    <header>
                      <strong>#{item.id}</strong>
                      <span>{item.risk_level}</span>
                    </header>
                    <p>{item.sanitized_text}</p>
                  </article>
                ))}
              </div>
            </div>

            <form className="stack" onSubmit={handleVerifyLeakage}>
              <div className="two-column">
                <label>
                  section_id
                  <input value={leakageSectionId} onChange={(event) => setLeakageSectionId(event.target.value)} />
                </label>
                <label>
                  reuse_unit_ids
                  <input
                    value={leakageReuseUnitIds}
                    onChange={(event) => setLeakageReuseUnitIds(event.target.value)}
                    placeholder="1,2,3"
                  />
                </label>
              </div>
              <label>
                forbidden_legacy_terms
                <input
                  value={leakageForbiddenTerms}
                  onChange={(event) => setLeakageForbiddenTerms(event.target.value)}
                  placeholder="旧项目名,旧业主名"
                />
              </label>
              <label>
                draft_text
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
                <strong>Sections</strong>
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
                <strong>Reuse Units</strong>
                {historicalReuseUnits.map((unit) => (
                  <article className="result-card" key={unit.id}>
                    <header>
                      <strong>#{unit.id}</strong>
                      <span>
                        {unit.reuse_mode} · {unit.risk_level}
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
    </>
  );
}
