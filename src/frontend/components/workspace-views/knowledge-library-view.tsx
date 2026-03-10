import { KnowledgeLibraryV2Panel } from "./knowledge-library-v2-panel";
import type {
  DocumentRecord,
  HistoricalBid,
  HistoricalBidSection,
  HistoricalLeakageResult,
  HistoricalReusePack,
  HistoricalReuseUnit,
} from "../../lib/api";
import type { FormSubmitHandler, NumberAction, StateSetter, VoidAction } from "./shared";

type KnowledgeLibraryViewProps = {
  documents: DocumentRecord[];
  historicalBids: HistoricalBid[];
  selectedProjectId: number | null;
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
  token: string | null;
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
  handleImportHistoricalBid: FormSubmitHandler;
  handleLoadHistoricalArtifacts: VoidAction;
  handleRebuildSections: VoidAction;
  handleRebuildReuseUnits: VoidAction;
  handleSearchReuse: FormSubmitHandler;
  handleVerifyLeakage: FormSubmitHandler;
};

export function KnowledgeLibraryView({
  documents,
  historicalBids,
  selectedProjectId,
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
  token,
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
  handleImportHistoricalBid,
  handleLoadHistoricalArtifacts,
  handleRebuildSections,
  handleRebuildReuseUnits,
  handleSearchReuse,
  handleVerifyLeakage,
}: KnowledgeLibraryViewProps) {
  return (
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
  );
}
