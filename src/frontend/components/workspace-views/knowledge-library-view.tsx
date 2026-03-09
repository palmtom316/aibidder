import { KnowledgeLibraryV2Panel } from "./knowledge-library-v2-panel";
import { ModuleIntro } from "./module-intro";
import type {
  DocumentRecord,
  HistoricalBid,
  HistoricalBidSection,
  HistoricalLeakageResult,
  HistoricalReusePack,
  HistoricalReuseUnit,
  Project,
} from "../../lib/api";
import type { FormSubmitHandler, NumberAction, StateSetter, VoidAction } from "./shared";
import { formatDocumentType, formatProjectType } from "./utils";

type KnowledgeLibraryViewProps = {
  projects: Project[];
  documents: DocumentRecord[];
  historicalBids: HistoricalBid[];
  selectedProject: Project | null;
  selectedProjectId: number | null;
  selectedDocument: DocumentRecord | null;
  selectedHistoricalBid: HistoricalBid | null;
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
  leakageResult: HistoricalLeakageResult | null;
  projectName: string;
  uploadType: string;
  token: string | null;
  busyLabel: string;
  message: string;
  setProjectName: StateSetter<string>;
  setUploadType: StateSetter<string>;
  setUploadFile: StateSetter<File | null>;
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
  selectedHistoricalBid,
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
  token,
  busyLabel,
  message,
  setProjectName,
  setUploadType,
  setUploadFile,
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
          description="统一资料库已接管历史标书、优秀标书、规范规程和企业事实表，适合投标工程师按项目类别持续沉淀复用。"
          metrics={[
            { label: "项目数", value: projects.length },
            { label: "文档数", value: documents.length },
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
        <KnowledgeLibraryV2Panel
          token={token}
          selectedProjectId={selectedProjectId}
          documents={documents}
          historicalBids={historicalBids}
          selectedHistoricalBid={selectedHistoricalBid}
          historicalSections={historicalSections}
          historicalReuseUnits={historicalReuseUnits}
          reusePack={reusePack}
          importDocumentId={importDocumentId}
          historicalSourceType={historicalSourceType}
          historicalProjectType={historicalProjectType}
          historicalRegion={historicalRegion}
          historicalYear={historicalYear}
          historicalRecommended={historicalRecommended}
          reuseSectionType={reuseSectionType}
          leakageSectionId={leakageSectionId}
          leakageDraftText={leakageDraftText}
          leakageForbiddenTerms={leakageForbiddenTerms}
          leakageReuseUnitIds={leakageReuseUnitIds}
          leakageResult={leakageResult}
          setImportDocumentId={setImportDocumentId}
          setSelectedHistoricalBidId={setSelectedHistoricalBidId}
          setHistoricalSourceType={setHistoricalSourceType}
          setHistoricalProjectType={setHistoricalProjectType}
          setHistoricalRegion={setHistoricalRegion}
          setHistoricalYear={setHistoricalYear}
          setHistoricalRecommended={setHistoricalRecommended}
          setReuseSectionType={setReuseSectionType}
          setLeakageSectionId={setLeakageSectionId}
          setLeakageDraftText={setLeakageDraftText}
          setLeakageForbiddenTerms={setLeakageForbiddenTerms}
          setLeakageReuseUnitIds={setLeakageReuseUnitIds}
          handleImportHistoricalBid={handleImportHistoricalBid}
          handleLoadHistoricalArtifacts={handleLoadHistoricalArtifacts}
          handleRebuildSections={handleRebuildSections}
          handleRebuildReuseUnits={handleRebuildReuseUnits}
          handleSearchReuse={handleSearchReuse}
          handleVerifyLeakage={handleVerifyLeakage}
        />
      </section>
    </>
  );
}
