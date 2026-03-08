"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  ApiError,
  approveGenerationOutline,
  createDecompositionRun,
  createEquipmentAsset,
  createGenerationJob,
  createKnowledgeBaseEntry,
  createLayoutJob,
  createPersonnelAsset,
  createProject,
  createProjectCredential,
  createQualification,
  createReviewRun,
  confirmReviewRunPass,
  createSubmissionRecord,
  downloadDocumentArtifact,
  DecompositionRun,
  DocumentRecord,
  EquipmentAsset,
  GenerationJob,
  getRuntimeSettings,
  HistoricalBid,
  HistoricalBidSection,
  HistoricalReusePack,
  HistoricalReuseUnit,
  KnowledgeBaseEntry,
  KnowledgeBaseEntryFilters,
  LayoutJob,
  listDecompositionRuns,
  listDocuments,
  listEvidenceUnits,
  listGenerationJobs,
  listHistoricalBids,
  listHistoricalReuseUnits,
  listHistoricalSections,
  listKnowledgeBaseEntries,
  listLayoutJobs,
  listProjects,
  listReviewRuns,
  listSubmissionRecords,
  login,
  Project,
  ReviewRun,
  runConnectivityCheck,
  runKnowledgeBaseCheck,
  RuntimeConnectivityResult,
  RuntimeSettings,
  searchEvidence,
  searchHistoricalReuse,
  SubmissionRecord,
  SubmissionRecordFilters,
  uploadDocument,
  verifyHistoricalLeakage,
  importHistoricalBid,
  rebuildHistoricalSections,
  rebuildHistoricalReuseUnits,
  EvidenceSearchResult,
  EvidenceUnit,
  getWorkbenchOverview,
  listEquipmentAssets,
  listPersonnelAssets,
  listProjectCredentials,
  listQualifications,
  ProjectCredential,
  Qualification,
  deleteEquipmentAsset,
  deletePersonnelAsset,
  deleteProjectCredential,
  deleteQualification,
  feedSubmissionRecordToLibrary,
  PersonnelAsset,
  GeneratedSection,
  listGeneratedSections,
  downloadRenderedOutput,
  listRenderedOutputs,
  listReviewIssues,
  remediateReviewIssue,
  WorkbenchOverview,
  RenderedOutput,
  ReviewIssue,
} from "../lib/api";
import { CopilotPanel } from "../components/copilot-panel";
import { HeroPanel } from "../components/hero-panel";
import { SettingsDrawer } from "../components/settings-drawer";
import { WorkspaceSidebar } from "../components/workspace-sidebar";
import {
  BidGenerationView,
  BidManagementView,
  BidReviewView,
  KnowledgeLibraryView,
  LayoutFinalizeView,
  TenderAnalysisView,
} from "../components/workspace-views";
import { clearStoredToken, getStoredToken, setStoredToken } from "../lib/session";

type RuntimeFormState = {
  provider: string;
  apiBaseUrl: string;
  apiKey: string;
  selectedRole: keyof RuntimeSettings["default_models"];
  defaultModels: RuntimeSettings["default_models"];
};

const EMPTY_MODELS: RuntimeSettings["default_models"] = {
  ocr_role: "deepseek-ai/DeepSeek-OCR",
  decomposition_navigator_role: "deepseek-ai/DeepSeek-V3.2",
  decomposition_extractor_role: "Qwen/Qwen3-30B-A3B-Instruct-2507",
  writer_role: "deepseek-ai/DeepSeek-V3",
  reviewer_role: "deepseek-ai/DeepSeek-R1",
  adjudicator_role: "deepseek-ai/DeepSeek-R1",
};

export type WorkspaceModule =
  | "knowledge-library"
  | "tender-analysis"
  | "bid-generation"
  | "bid-review"
  | "layout-finalize"
  | "bid-management";

type CopilotMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

const WORKSPACE_MODULES: Array<{
  id: WorkspaceModule;
  label: string;
  hint: string;
  shortLabel: string;
}> = [
    { id: "knowledge-library", label: "投标资料库", hint: "历史标书、资质业绩、敏感信息清洗", shortLabel: "库" },
    { id: "tender-analysis", label: "标书分析", hint: "招标文件拆解与原文对照", shortLabel: "析" },
    { id: "bid-generation", label: "标书生成", hint: "框架审批与分章节编写", shortLabel: "生" },
    { id: "bid-review", label: "标书评审", hint: "评审、模拟评分与废标分析", shortLabel: "审" },
    { id: "layout-finalize", label: "排版定稿", hint: "排版、导出最终打印版", shortLabel: "版" },
    { id: "bid-management", label: "标书管理", hint: "标书存档、中标记录与回灌", shortLabel: "管" },
  ];

function modulePath(module: WorkspaceModule) {
  return `/workspace/${module}`;
}

export function WorkspaceHome({ forcedModule }: { forcedModule?: WorkspaceModule } = {}) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("请先登录以开始本地联调。");
  const [busyLabel, setBusyLabel] = useState<string>("");
  const [loginEmail, setLoginEmail] = useState("admin@example.com");
  const [loginPassword, setLoginPassword] = useState("admin123456");

  const [runtimeSettings, setRuntimeSettings] = useState<RuntimeSettings | null>(null);
  const [runtimeForm, setRuntimeForm] = useState<RuntimeFormState>({
    provider: "openai_compatible",
    apiBaseUrl: "https://api.siliconflow.cn/v1",
    apiKey: "",
    selectedRole: "writer_role",
    defaultModels: EMPTY_MODELS,
  });
  const [connectivityResult, setConnectivityResult] = useState<RuntimeConnectivityResult | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [projectName, setProjectName] = useState("");
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [uploadType, setUploadType] = useState("tender");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [evidenceQuery, setEvidenceQuery] = useState("");
  const [evidenceDocumentType, setEvidenceDocumentType] = useState("");
  const [evidenceResults, setEvidenceResults] = useState<EvidenceSearchResult[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [documentEvidenceUnits, setDocumentEvidenceUnits] = useState<EvidenceUnit[]>([]);
  const [workbenchOverview, setWorkbenchOverview] = useState<WorkbenchOverview | null>(null);
  const [knowledgeBaseEntries, setKnowledgeBaseEntries] = useState<KnowledgeBaseEntry[]>([]);
  const [decompositionRuns, setDecompositionRuns] = useState<DecompositionRun[]>([]);
  const [selectedDecompositionRunId, setSelectedDecompositionRunId] = useState<number | null>(null);
  const [generationJobs, setGenerationJobs] = useState<GenerationJob[]>([]);
  const [selectedGenerationJobId, setSelectedGenerationJobId] = useState<number | null>(null);
  const [generatedSections, setGeneratedSections] = useState<GeneratedSection[]>([]);
  const [reviewRuns, setReviewRuns] = useState<ReviewRun[]>([]);
  const [selectedReviewRunId, setSelectedReviewRunId] = useState<number | null>(null);
  const [reviewIssues, setReviewIssues] = useState<ReviewIssue[]>([]);
  const [layoutJobs, setLayoutJobs] = useState<LayoutJob[]>([]);
  const [selectedLayoutJobId, setSelectedLayoutJobId] = useState<number | null>(null);
  const [renderedOutputs, setRenderedOutputs] = useState<RenderedOutput[]>([]);
  const [submissionRecords, setSubmissionRecords] = useState<SubmissionRecord[]>([]);
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [personnelAssets, setPersonnelAssets] = useState<PersonnelAsset[]>([]);
  const [equipmentAssets, setEquipmentAssets] = useState<EquipmentAsset[]>([]);
  const [projectCredentials, setProjectCredentials] = useState<ProjectCredential[]>([]);
  const [libraryCategory, setLibraryCategory] = useState("excellent_bid");
  const [libraryTitle, setLibraryTitle] = useState("2026 输变电优秀标书");
  const [libraryOwnerName, setLibraryOwnerName] = useState("市场经营中心");
  const [libraryFilterCategory, setLibraryFilterCategory] = useState("all");
  const [libraryFilterQuery, setLibraryFilterQuery] = useState("");
  const [libraryCreatedFrom, setLibraryCreatedFrom] = useState("");
  const [libraryCreatedTo, setLibraryCreatedTo] = useState("");
  const [qualificationName, setQualificationName] = useState("电力工程施工总承包");
  const [qualificationLevel, setQualificationLevel] = useState("一级");
  const [qualificationCertificateNo, setQualificationCertificateNo] = useState("");
  const [qualificationValidUntil, setQualificationValidUntil] = useState("");
  const [personnelName, setPersonnelName] = useState("张三");
  const [personnelRoleTitle, setPersonnelRoleTitle] = useState("项目经理");
  const [personnelCertificateNo, setPersonnelCertificateNo] = useState("");
  const [equipmentName, setEquipmentName] = useState("发电车");
  const [equipmentModelNo, setEquipmentModelNo] = useState("");
  const [equipmentQuantity, setEquipmentQuantity] = useState("1");
  const [credentialProjectName, setCredentialProjectName] = useState("浙江示范工程");
  const [credentialType, setCredentialType] = useState("project_performance");
  const [credentialOwnerName, setCredentialOwnerName] = useState("市场经营中心");
  const [decompositionRunName, setDecompositionRunName] = useState("招标文件七类拆解");
  const [generationJobName, setGenerationJobName] = useState("技术标初稿生成");
  const [generationTargetSections, setGenerationTargetSections] = useState("7");
  const [reviewRunName, setReviewRunName] = useState("模拟打分与合规复核");
  const [reviewMode, setReviewMode] = useState("simulated_scoring");
  const [layoutJobName, setLayoutJobName] = useState("企业模板排版");
  const [layoutTemplateName, setLayoutTemplateName] = useState("corporate-default");
  const [submissionTitle, setSubmissionTitle] = useState("投标文件回灌记录");
  const [submissionStatus, setSubmissionStatus] = useState("draft");
  const [submissionFilterStatus, setSubmissionFilterStatus] = useState("all");
  const [submissionFilterQuery, setSubmissionFilterQuery] = useState("");
  const [submissionCreatedFrom, setSubmissionCreatedFrom] = useState("");
  const [submissionCreatedTo, setSubmissionCreatedTo] = useState("");
  const [decompositionSourceMarkdown, setDecompositionSourceMarkdown] = useState("");
  const [decompositionSourcePreviewUrl, setDecompositionSourcePreviewUrl] = useState<string | null>(null);
  const [decompositionPreviewBusy, setDecompositionPreviewBusy] = useState(false);

  const [historicalBids, setHistoricalBids] = useState<HistoricalBid[]>([]);
  const [selectedHistoricalBidId, setSelectedHistoricalBidId] = useState<number | null>(null);
  const [historicalSections, setHistoricalSections] = useState<HistoricalBidSection[]>([]);
  const [historicalReuseUnits, setHistoricalReuseUnits] = useState<HistoricalReuseUnit[]>([]);
  const [importDocumentId, setImportDocumentId] = useState<number | null>(null);
  const [historicalSourceType, setHistoricalSourceType] = useState("won_bid");
  const [historicalProjectType, setHistoricalProjectType] = useState("power-construction");
  const [historicalRegion, setHistoricalRegion] = useState("华东");
  const [historicalYear, setHistoricalYear] = useState(String(new Date().getFullYear()));
  const [historicalRecommended, setHistoricalRecommended] = useState(true);
  const [reuseSectionType, setReuseSectionType] = useState("quality");
  const [reusePack, setReusePack] = useState<HistoricalReusePack | null>(null);
  const [leakageSectionId, setLeakageSectionId] = useState("draft-1");
  const [leakageDraftText, setLeakageDraftText] = useState("");
  const [leakageForbiddenTerms, setLeakageForbiddenTerms] = useState("");
  const [leakageReuseUnitIds, setLeakageReuseUnitIds] = useState("");
  const [leakageResult, setLeakageResult] = useState<{ ok: boolean; matched_terms: string[] } | null>(null);
  const [activeModule, setActiveModule] = useState<WorkspaceModule>(forcedModule ?? "knowledge-library");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotDraft, setCopilotDraft] = useState("");
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "我是 Copilot。默认保持隐藏，需要时我可以解释当前模块、帮你导航，或提示下一步操作。",
    },
  ]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const selectedDocument = useMemo(
    () => documents.find((document) => document.id === selectedDocumentId) ?? null,
    [documents, selectedDocumentId],
  );

  const selectedHistoricalBid = useMemo(
    () => historicalBids.find((item) => item.id === selectedHistoricalBidId) ?? null,
    [historicalBids, selectedHistoricalBidId],
  );

  const selectedDecompositionRun = useMemo(
    () => decompositionRuns.find((item) => item.id === selectedDecompositionRunId) ?? decompositionRuns[0] ?? null,
    [decompositionRuns, selectedDecompositionRunId],
  );

  const selectedDecompositionSourceDocument = useMemo(
    () =>
      documents.find((document) => document.id === selectedDecompositionRun?.source_document_id) ?? null,
    [documents, selectedDecompositionRun],
  );

  const selectedGenerationJob = useMemo(
    () => generationJobs.find((item) => item.id === selectedGenerationJobId) ?? generationJobs[0] ?? null,
    [generationJobs, selectedGenerationJobId],
  );

  const selectedReviewRun = useMemo(
    () => reviewRuns.find((item) => item.id === selectedReviewRunId) ?? reviewRuns[0] ?? null,
    [reviewRuns, selectedReviewRunId],
  );

  const selectedLayoutJob = useMemo(
    () => layoutJobs.find((item) => item.id === selectedLayoutJobId) ?? layoutJobs[0] ?? null,
    [layoutJobs, selectedLayoutJobId],
  );

  const activeModuleMeta = useMemo(
    () => WORKSPACE_MODULES.find((module) => module.id === activeModule) ?? WORKSPACE_MODULES[0],
    [activeModule],
  );

  function buildLibraryFilters(): KnowledgeBaseEntryFilters {
    return {
      category: libraryFilterCategory !== "all" ? libraryFilterCategory : undefined,
      q: libraryFilterQuery.trim() || undefined,
      created_from: libraryCreatedFrom ? `${libraryCreatedFrom}T00:00:00Z` : undefined,
      created_to: libraryCreatedTo ? `${libraryCreatedTo}T23:59:59.999Z` : undefined,
    };
  }

  function buildSubmissionFilters(): SubmissionRecordFilters {
    return {
      status: submissionFilterStatus !== "all" ? submissionFilterStatus : undefined,
      q: submissionFilterQuery.trim() || undefined,
      created_from: submissionCreatedFrom ? `${submissionCreatedFrom}T00:00:00Z` : undefined,
      created_to: submissionCreatedTo ? `${submissionCreatedTo}T23:59:59.999Z` : undefined,
    };
  }

  function activateModule(module: WorkspaceModule) {
    setActiveModule(module);
    router.push(modulePath(module));
  }

  useEffect(() => {
    const storedToken = getStoredToken();
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  useEffect(() => {
    if (forcedModule) {
      setActiveModule(forcedModule);
    }
  }, [forcedModule]);

  useEffect(() => {
    if (!token) {
      return;
    }
    void hydrateConsole(token);
  }, [token]);

  useEffect(() => {
    if (!token || selectedProjectId === null) {
      setDocuments([]);
      return;
    }
    void refreshDocuments(token, selectedProjectId);
  }, [token, selectedProjectId]);

  useEffect(() => {
    if (!token) {
      setWorkbenchOverview(null);
      setKnowledgeBaseEntries([]);
      setQualifications([]);
      setPersonnelAssets([]);
      setEquipmentAssets([]);
      setProjectCredentials([]);
      setDecompositionRuns([]);
      setGenerationJobs([]);
      setSelectedGenerationJobId(null);
      setGeneratedSections([]);
      setReviewRuns([]);
      setSelectedReviewRunId(null);
      setReviewIssues([]);
      setLayoutJobs([]);
      setSelectedLayoutJobId(null);
      setRenderedOutputs([]);
      setSubmissionRecords([]);
      return;
    }
    void refreshWorkbench(token, selectedProjectId ?? undefined);
  }, [token, selectedProjectId]);

  useEffect(() => {
    setSelectedDecompositionRunId((current) =>
      current !== null && decompositionRuns.some((item) => item.id === current) ? current : decompositionRuns[0]?.id ?? null,
    );
  }, [decompositionRuns]);

  useEffect(() => {
    setSelectedGenerationJobId((current) =>
      current !== null && generationJobs.some((item) => item.id === current) ? current : generationJobs[0]?.id ?? null,
    );
  }, [generationJobs]);

  useEffect(() => {
    setSelectedReviewRunId((current) =>
      current !== null && reviewRuns.some((item) => item.id === current) ? current : reviewRuns[0]?.id ?? null,
    );
  }, [reviewRuns]);

  useEffect(() => {
    setSelectedLayoutJobId((current) =>
      current !== null && layoutJobs.some((item) => item.id === current) ? current : layoutJobs[0]?.id ?? null,
    );
  }, [layoutJobs]);

  useEffect(() => {
    if (!token || selectedGenerationJobId === null) {
      setGeneratedSections([]);
      return;
    }
    void loadGeneratedSections(token, selectedGenerationJobId);
  }, [token, selectedGenerationJobId]);

  useEffect(() => {
    if (!token || selectedReviewRunId === null) {
      setReviewIssues([]);
      return;
    }
    void loadReviewIssues(token, selectedReviewRunId);
  }, [token, selectedReviewRunId]);

  useEffect(() => {
    if (!token || selectedLayoutJobId === null) {
      setRenderedOutputs([]);
      return;
    }
    void loadRenderedOutputs(token, selectedLayoutJobId);
  }, [token, selectedLayoutJobId]);

  useEffect(() => {
    const sourceDocumentId = selectedDecompositionRun?.source_document_id;
    const sourceFilename = selectedDecompositionSourceDocument?.filename.toLowerCase() ?? "";
    if (!token || !selectedProjectId || sourceDocumentId === null || sourceDocumentId === undefined) {
      setDecompositionSourceMarkdown("");
      setDecompositionSourcePreviewUrl(null);
      setDecompositionPreviewBusy(false);
      return;
    }

    let active = true;
    let previewUrl: string | null = null;
    void (async () => {
      try {
        setDecompositionPreviewBusy(true);
        const markdownBlob = await downloadDocumentArtifact(token, selectedProjectId, sourceDocumentId, "markdown");
        const markdown = await markdownBlob.text();
        if (active) {
          setDecompositionSourceMarkdown(markdown);
        }

        if (sourceFilename.endsWith(".pdf")) {
          const sourceBlob = await downloadDocumentArtifact(token, selectedProjectId, sourceDocumentId, "source");
          previewUrl = URL.createObjectURL(sourceBlob);
          if (active) {
            setDecompositionSourcePreviewUrl(previewUrl);
          }
        } else if (active) {
          setDecompositionSourcePreviewUrl(null);
        }
      } catch {
        if (active) {
          setDecompositionSourceMarkdown("");
          setDecompositionSourcePreviewUrl(null);
        }
      } finally {
        if (active) {
          setDecompositionPreviewBusy(false);
        }
      }
    })();

    return () => {
      active = false;
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [token, selectedProjectId, selectedDecompositionRun, selectedDecompositionSourceDocument]);

  async function hydrateConsole(activeToken: string) {
    try {
      setBusyLabel("正在加载控制台数据");
      const [settingsPayload, projectRows, historicalRows] = await Promise.all([
        getRuntimeSettings(activeToken),
        listProjects(activeToken),
        listHistoricalBids(activeToken),
      ]);
      setRuntimeSettings(settingsPayload);
      setRuntimeForm((current) => ({
        ...current,
        provider: settingsPayload.provider,
        apiBaseUrl: settingsPayload.api_base_url ?? "https://api.siliconflow.cn/v1",
        defaultModels: settingsPayload.default_models,
      }));
      setProjects(projectRows);
      setHistoricalBids(historicalRows);
      setSelectedProjectId((current) => current ?? projectRows[0]?.id ?? null);
      setSelectedHistoricalBidId((current) => current ?? historicalRows[0]?.id ?? null);
      setMessage("控制台已同步到本地后端。");
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function refreshDocuments(activeToken: string, projectId: number) {
    try {
      const rows = await listDocuments(activeToken, projectId);
      setDocuments(rows);
      setImportDocumentId((current) => current ?? rows[0]?.id ?? null);
      setSelectedDocumentId((current) => current ?? rows[0]?.id ?? null);
    } catch (error) {
      setMessage(readError(error));
    }
  }

  async function refreshWorkbench(
    activeToken: string,
    projectId?: number,
    libraryFilters: KnowledgeBaseEntryFilters = buildLibraryFilters(),
    submissionFilters: SubmissionRecordFilters = buildSubmissionFilters(),
  ) {
    try {
      const [
        overview,
        libraryRows,
        qualificationRows,
        personnelRows,
        equipmentRows,
        credentialRows,
        decompositionRows,
        generationRows,
        reviewRows,
        layoutRows,
        submissionRows,
      ] = await Promise.all([
        getWorkbenchOverview(activeToken, projectId),
        listKnowledgeBaseEntries(activeToken, projectId, libraryFilters),
        listQualifications(activeToken),
        listPersonnelAssets(activeToken),
        listEquipmentAssets(activeToken),
        listProjectCredentials(activeToken),
        listDecompositionRuns(activeToken, projectId),
        listGenerationJobs(activeToken, projectId),
        listReviewRuns(activeToken, projectId),
        listLayoutJobs(activeToken, projectId),
        listSubmissionRecords(activeToken, projectId, submissionFilters),
      ]);
      setWorkbenchOverview(overview);
      setKnowledgeBaseEntries(libraryRows);
      setQualifications(qualificationRows);
      setPersonnelAssets(personnelRows);
      setEquipmentAssets(equipmentRows);
      setProjectCredentials(credentialRows);
      setDecompositionRuns(decompositionRows);
      setGenerationJobs(generationRows);
      setReviewRuns(reviewRows);
      setLayoutJobs(layoutRows);
      setSubmissionRecords(submissionRows);
    } catch (error) {
      setMessage(readError(error));
    }
  }

  async function loadGeneratedSections(activeToken: string, jobId: number) {
    try {
      const rows = await listGeneratedSections(activeToken, jobId);
      setGeneratedSections(rows);
    } catch (error) {
      setMessage(readError(error));
    }
  }

  async function loadReviewIssues(activeToken: string, runId: number) {
    try {
      const rows = await listReviewIssues(activeToken, runId);
      setReviewIssues(rows);
    } catch (error) {
      setMessage(readError(error));
    }
  }

  async function loadRenderedOutputs(activeToken: string, jobId: number) {
    try {
      const rows = await listRenderedOutputs(activeToken, jobId);
      setRenderedOutputs(rows);
    } catch (error) {
      setMessage(readError(error));
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setBusyLabel("正在登录");
      const response = await login(loginEmail, loginPassword);
      setStoredToken(response.access_token);
      setToken(response.access_token);
      setMessage("登录成功，本地联调环境已解锁。");
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !projectName.trim()) {
      return;
    }
    try {
      setBusyLabel("正在创建项目");
      const project = await createProject(token, projectName.trim());
      const nextProjects = [...projects, project].sort((left, right) => left.id - right.id);
      setProjects(nextProjects);
      setSelectedProjectId(project.id);
      setProjectName("");
      setMessage(`项目 ${project.name} 已创建。`);
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function handleUploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedProjectId || !uploadFile) {
      return;
    }
    try {
      setBusyLabel("正在上传文档");
      await uploadDocument(token, selectedProjectId, uploadType, uploadFile);
      await refreshDocuments(token, selectedProjectId);
      setUploadFile(null);
      setEvidenceResults([]);
      setDocumentEvidenceUnits([]);
      setMessage(`文档已上传到项目 ${selectedProject?.name ?? selectedProjectId}。`);
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function handleCreateLibraryEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedProjectId || !libraryTitle.trim()) {
      return;
    }
    try {
      setBusyLabel("正在登记投标资料");
      await createKnowledgeBaseEntry(token, {
        project_id: selectedProjectId,
        source_document_id: selectedDocumentId ?? undefined,
        category: libraryCategory,
        title: libraryTitle.trim(),
        owner_name: libraryOwnerName.trim(),
      });
      await refreshWorkbench(token, selectedProjectId);
      setMessage("投标资料库已新增一条入库记录。");
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function handleRunLibraryCheck(entryId: number) {
    if (!token || !selectedProjectId) {
      return;
    }
    try {
      setBusyLabel("正在执行资料检测");
      await runKnowledgeBaseCheck(token, entryId);
      await refreshWorkbench(token, selectedProjectId);
      setMessage(`投标资料 ${entryId} 已完成检测。`);
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function handleApplyLibraryFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }
    try {
      setBusyLabel("正在筛选投标资料");
      await refreshWorkbench(token, selectedProjectId ?? undefined);
      setMessage("投标资料库筛选结果已刷新。");
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function handleApplySubmissionFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }
    try {
      setBusyLabel("正在筛选标书管理记录");
      await refreshWorkbench(token, selectedProjectId ?? undefined, buildLibraryFilters(), buildSubmissionFilters());
      setMessage("标书管理筛选结果已刷新。");
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function handleResetSubmissionFilters() {
    if (!token) {
      setSubmissionFilterStatus("all");
      setSubmissionFilterQuery("");
      setSubmissionCreatedFrom("");
      setSubmissionCreatedTo("");
      return;
    }
    try {
      setBusyLabel("正在重置标书管理筛选");
      setSubmissionFilterStatus("all");
      setSubmissionFilterQuery("");
      setSubmissionCreatedFrom("");
      setSubmissionCreatedTo("");
      await refreshWorkbench(token, selectedProjectId ?? undefined, buildLibraryFilters(), {});
      setMessage("已重置标书管理筛选条件。");
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function handleResetLibraryFilters() {
    if (!token) {
      setLibraryFilterCategory("all");
      setLibraryFilterQuery("");
      setLibraryCreatedFrom("");
      setLibraryCreatedTo("");
      return;
    }
    try {
      setBusyLabel("正在重置资料筛选");
      setLibraryFilterCategory("all");
      setLibraryFilterQuery("");
      setLibraryCreatedFrom("");
      setLibraryCreatedTo("");
      await refreshWorkbench(token, selectedProjectId ?? undefined, {});
      setMessage("已重置投标资料库筛选条件。");
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function handleCreateQualification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !qualificationName.trim()) {
      return;
    }
    try {
      setBusyLabel("正在登记公司资质");
      await createQualification(token, {
        qualification_name: qualificationName.trim(),
        qualification_level: qualificationLevel.trim(),
        certificate_no: qualificationCertificateNo.trim(),
        valid_until: qualificationValidUntil.trim(),
      });
      await refreshWorkbench(token, selectedProjectId ?? undefined);
      setQualificationCertificateNo("");
      setQualificationValidUntil("");
      setMessage("公司资质已加入资料库。");
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function handleDeleteQualification(qualificationId: number) {
    if (!token) {
      return;
    }
    try {
      setBusyLabel("正在删除公司资质");
      await deleteQualification(token, qualificationId);
      await refreshWorkbench(token, selectedProjectId ?? undefined);
      setMessage(`公司资质 ${qualificationId} 已删除。`);
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function handleCreatePersonnelAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !personnelName.trim()) {
      return;
    }
    try {
      setBusyLabel("正在登记人员资质");
      await createPersonnelAsset(token, {
        full_name: personnelName.trim(),
        role_title: personnelRoleTitle.trim(),
        certificate_no: personnelCertificateNo.trim(),
      });
      await refreshWorkbench(token, selectedProjectId ?? undefined);
      setPersonnelCertificateNo("");
      setMessage("人员资质已加入资料库。");
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function handleDeletePersonnelAsset(personnelAssetId: number) {
    if (!token) {
      return;
    }
    try {
      setBusyLabel("正在删除人员资质");
      await deletePersonnelAsset(token, personnelAssetId);
      await refreshWorkbench(token, selectedProjectId ?? undefined);
      setMessage(`人员资质 ${personnelAssetId} 已删除。`);
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function handleCreateEquipmentAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !equipmentName.trim()) {
      return;
    }
    try {
      setBusyLabel("正在登记设施设备");
      await createEquipmentAsset(token, {
        equipment_name: equipmentName.trim(),
        model_no: equipmentModelNo.trim(),
        quantity: Number(equipmentQuantity) || 0,
      });
      await refreshWorkbench(token, selectedProjectId ?? undefined);
      setEquipmentModelNo("");
      setEquipmentQuantity("1");
      setMessage("设施设备已加入资料库。");
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function handleDeleteEquipmentAsset(equipmentAssetId: number) {
    if (!token) {
      return;
    }
    try {
      setBusyLabel("正在删除设施设备");
      await deleteEquipmentAsset(token, equipmentAssetId);
      await refreshWorkbench(token, selectedProjectId ?? undefined);
      setMessage(`设施设备 ${equipmentAssetId} 已删除。`);
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function handleCreateProjectCredential(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !credentialProjectName.trim()) {
      return;
    }
    try {
      setBusyLabel("正在登记项目业绩");
      await createProjectCredential(token, {
        project_name: credentialProjectName.trim(),
        credential_type: credentialType.trim(),
        owner_name: credentialOwnerName.trim(),
      });
      await refreshWorkbench(token, selectedProjectId ?? undefined);
      setMessage("项目业绩已加入资料库。");
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function handleDeleteProjectCredential(projectCredentialId: number) {
    if (!token) {
      return;
    }
    try {
      setBusyLabel("正在删除项目业绩");
      await deleteProjectCredential(token, projectCredentialId);
      await refreshWorkbench(token, selectedProjectId ?? undefined);
      setMessage(`项目业绩 ${projectCredentialId} 已删除。`);
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function handleCreateDecompositionRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedProjectId || !decompositionRunName.trim()) {
      return;
    }
    try {
      setBusyLabel("正在创建标书分析任务");
      await createDecompositionRun(token, {
        project_id: selectedProjectId,
        source_document_id: selectedDocumentId ?? undefined,
        run_name: decompositionRunName.trim(),
      });
      await refreshWorkbench(token, selectedProjectId);
      setMessage("标书分析任务已加入工作台。");
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function handleCreateGenerationJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedProjectId || !generationJobName.trim()) {
      return;
    }
    try {
      setBusyLabel("正在创建标书生成任务");
      const created = await createGenerationJob(token, {
        project_id: selectedProjectId,
        source_document_id: selectedDocumentId ?? undefined,
        job_name: generationJobName.trim(),
        target_sections: Number(generationTargetSections) || 0,
      });
      await refreshWorkbench(token, selectedProjectId);
      setSelectedGenerationJobId(created.id);
      setMessage("标书生成任务已加入工作台。");
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function handleApproveGenerationOutline() {
    if (!token || selectedGenerationJobId === null || !selectedProjectId) {
      return;
    }
    try {
      setBusyLabel("正在审批生成框架");
      await approveGenerationOutline(token, selectedGenerationJobId);
      await refreshWorkbench(token, selectedProjectId);
      setMessage("标书框架已审批通过，可继续章节编写与评审。");
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function handleCreateReviewRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedProjectId || !reviewRunName.trim()) {
      return;
    }
    try {
      setBusyLabel("正在创建标书评审任务");
      const created = await createReviewRun(token, {
        project_id: selectedProjectId,
        source_document_id: selectedDocumentId ?? undefined,
        run_name: reviewRunName.trim(),
        review_mode: reviewMode.trim(),
      });
      await refreshWorkbench(token, selectedProjectId);
      setSelectedReviewRunId(created.id);
      setMessage("标书评审任务已加入工作台。");
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function handleCreateLayoutJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedProjectId || !layoutJobName.trim() || !layoutTemplateName.trim()) {
      return;
    }
    try {
      setBusyLabel("正在创建排版定稿任务");
      const created = await createLayoutJob(token, {
        project_id: selectedProjectId,
        source_document_id: selectedDocumentId ?? undefined,
        job_name: layoutJobName.trim(),
        template_name: layoutTemplateName.trim(),
      });
      await refreshWorkbench(token, selectedProjectId);
      setSelectedLayoutJobId(created.id);
      setMessage("排版定稿任务已加入工作台。");
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function handleCreateSubmissionRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedProjectId || !submissionTitle.trim() || !submissionStatus.trim()) {
      return;
    }
    try {
      setBusyLabel("正在创建标书管理记录");
      await createSubmissionRecord(token, {
        project_id: selectedProjectId,
        source_document_id: selectedDocumentId ?? undefined,
        title: submissionTitle.trim(),
        status: submissionStatus.trim(),
      });
      await refreshWorkbench(token, selectedProjectId);
      setMessage("标书管理记录已加入工作台。");
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function handleConfirmReviewRunPass() {
    if (!token || selectedReviewRunId === null || !selectedProjectId) {
      return;
    }
    try {
      setBusyLabel("正在确认评审通过");
      await confirmReviewRunPass(token, selectedReviewRunId);
      await refreshWorkbench(token, selectedProjectId);
      setMessage("评审已确认通过，可进入排版定稿。");
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function handleRemediateReviewIssue(issueId: number) {
    if (!token || selectedReviewRunId === null) {
      return;
    }
    try {
      setBusyLabel("正在打回重写章节");
      const section = await remediateReviewIssue(token, issueId);
      await Promise.all([
        loadReviewIssues(token, selectedReviewRunId),
        selectedGenerationJobId !== null ? loadGeneratedSections(token, selectedGenerationJobId) : Promise.resolve(),
      ]);
      setMessage(`章节 ${section.title} 已根据评审意见重写。`);
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function handleDownloadDocumentArtifact(documentId: number, artifactType: string, filename: string) {
    if (!token || !selectedProjectId) {
      return;
    }
    try {
      setBusyLabel(artifactType === "source" ? "正在下载原始文档" : "正在下载解析产物");
      const blob = await downloadDocumentArtifact(token, selectedProjectId, documentId, artifactType);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      setMessage("文档下载已开始。");
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function handleDownloadRenderedOutput(outputId: number, versionTag: string, outputType: string) {
    if (!token) {
      return;
    }
    try {
      setBusyLabel("正在下载排版产物");
      const blob = await downloadRenderedOutput(token, outputId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `bid-output-${versionTag}.${outputType}`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage("排版产物下载已开始。");
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function handleFeedSubmissionRecordToLibrary(recordId: number) {
    if (!token) {
      return;
    }
    try {
      setBusyLabel("正在回灌标书到资料库");
      const entry = await feedSubmissionRecordToLibrary(token, recordId);
      await refreshWorkbench(token, selectedProjectId ?? undefined);
      activateModule("knowledge-library");
      setMessage(`标书记录 ${recordId} 已回灌到投标资料库（${entry.category}）。`);
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function handleLoadEvidenceUnits(documentId: number) {
    if (!token || !selectedProjectId) {
      return;
    }
    try {
      setBusyLabel("正在读取证据单元");
      const rows = await listEvidenceUnits(token, selectedProjectId, documentId);
      setSelectedDocumentId(documentId);
      setDocumentEvidenceUnits(rows);
      setMessage(`已加载文档 ${documentId} 的证据单元。`);
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function handleSearchEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedProjectId || !evidenceQuery.trim()) {
      return;
    }
    try {
      setBusyLabel("正在检索证据");
      const rows = await searchEvidence(
        token,
        selectedProjectId,
        evidenceQuery.trim(),
        evidenceDocumentType || undefined,
      );
      setEvidenceResults(rows);
      setMessage(`证据检索返回 ${rows.length} 条结果。`);
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function handleImportHistoricalBid(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !importDocumentId) {
      return;
    }
    try {
      setBusyLabel("正在导入历史标书");
      const created = await importHistoricalBid(token, {
        document_id: importDocumentId,
        source_type: historicalSourceType,
        project_type: historicalProjectType,
        region: historicalRegion,
        year: Number(historicalYear),
        is_recommended: historicalRecommended,
      });
      const rows = await listHistoricalBids(token);
      setHistoricalBids(rows);
      setSelectedHistoricalBidId(created.id);
      setMessage(`历史标书 ${created.id} 已导入。`);
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function handleRebuildSections() {
    if (!token || !selectedHistoricalBidId) {
      return;
    }
    try {
      setBusyLabel("正在重建章节");
      const rows = await rebuildHistoricalSections(token, selectedHistoricalBidId);
      setHistoricalSections(rows);
      setMessage(`已生成 ${rows.length} 个历史章节。`);
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function handleRebuildReuseUnits() {
    if (!token || !selectedHistoricalBidId) {
      return;
    }
    try {
      setBusyLabel("正在重建复用单元");
      const rows = await rebuildHistoricalReuseUnits(token, selectedHistoricalBidId);
      setHistoricalReuseUnits(rows);
      setMessage(`已生成 ${rows.length} 个复用单元。`);
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function handleLoadHistoricalArtifacts() {
    if (!token || !selectedHistoricalBidId) {
      return;
    }
    try {
      setBusyLabel("正在刷新历史标书详情");
      const [sections, reuseUnits] = await Promise.all([
        listHistoricalSections(token, selectedHistoricalBidId),
        listHistoricalReuseUnits(token, selectedHistoricalBidId),
      ]);
      setHistoricalSections(sections);
      setHistoricalReuseUnits(reuseUnits);
      setMessage("历史标书详情已刷新。");
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function handleSearchReuse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !historicalProjectType.trim() || !reuseSectionType.trim()) {
      return;
    }
    try {
      setBusyLabel("正在构建 reuse pack");
      const pack = await searchHistoricalReuse(token, historicalProjectType.trim(), reuseSectionType.trim());
      setReusePack(pack);
      setMessage("历史复用候选已更新。");
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function handleVerifyLeakage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedProjectId || !leakageDraftText.trim()) {
      return;
    }
    try {
      setBusyLabel("正在执行历史污染校验");
      const result = await verifyHistoricalLeakage(token, selectedProjectId, leakageSectionId, {
        draft_text: leakageDraftText.trim(),
        forbidden_legacy_terms: leakageForbiddenTerms
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        history_candidate_pack: {
          reuse_unit_ids: leakageReuseUnitIds
            .split(",")
            .map((value) => Number(value.trim()))
            .filter((value) => Number.isInteger(value) && value > 0),
        },
      });
      setLeakageResult(result);
      setMessage(result.ok ? "未发现历史污染。" : "检测到历史污染项。");
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function handleConnectivityCheck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !runtimeForm.apiKey.trim()) {
      return;
    }
    try {
      setBusyLabel("正在验证模型连通性");
      const result = await runConnectivityCheck(token, {
        provider: runtimeForm.provider,
        api_base_url: runtimeForm.apiBaseUrl,
        api_key: runtimeForm.apiKey.trim(),
        model: runtimeForm.defaultModels[runtimeForm.selectedRole],
      });
      setConnectivityResult(result);
      setMessage(result.message);
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusyLabel("");
    }
  }

  function handleLogout() {
    clearStoredToken();
    setToken(null);
    setProjects([]);
    setDocuments([]);
    setHistoricalBids([]);
    setWorkbenchOverview(null);
    setKnowledgeBaseEntries([]);
    setDecompositionRuns([]);
    setGenerationJobs([]);
    setReviewRuns([]);
    setLayoutJobs([]);
    setSubmissionRecords([]);
    setEvidenceResults([]);
    setDocumentEvidenceUnits([]);
    setMessage("已退出登录。");
  }

  function appendCopilotMessage(role: CopilotMessage["role"], text: string) {
    setCopilotMessages((current) => [
      ...current,
      { id: `${role}-${Date.now()}-${current.length}`, role, text },
    ]);
  }

  function buildCopilotReply(prompt: string) {
    const normalized = prompt.trim().toLowerCase();
    const moduleLabel = activeModuleMeta.label;
    const projectLabel = selectedProject?.name ? `当前项目是「${selectedProject.name}」。` : "当前还没有选中项目。";

    if (normalized.includes("资料") || normalized.includes("入库") || normalized.includes("上传")) {
      activateModule("knowledge-library");
      return `${projectLabel}我已经切到「投标资料库」模块。你可以上传历史标书、资质文件等，并进行敏感信息清洗。`;
    }
    if (normalized.includes("分析") || normalized.includes("拆解") || normalized.includes("招标")) {
      activateModule("tender-analysis");
      return `${projectLabel}我已经切到「标书分析」模块。上传招标文件 PDF 后，可进行七类要点拆解并与原文对照。`;
    }
    if (normalized.includes("生成") || normalized.includes("编写")) {
      activateModule("bid-generation");
      return `${projectLabel}我已经切到「标书生成」模块。AI 会先生成标书框架，审批通过后分章节编写初稿。`;
    }
    if (normalized.includes("评审") || normalized.includes("检测") || normalized.includes("打分")) {
      activateModule("bid-review");
      return `${projectLabel}我已经切到「标书评审」模块。这里可以进行多维评审、模拟评分和废标分析。`;
    }
    if (normalized.includes("排版") || normalized.includes("定稿")) {
      activateModule("layout-finalize");
      return `${projectLabel}我已经切到「排版定稿」模块。将合格标书按模板排版并导出打印版。`;
    }
    if (normalized.includes("管理") || normalized.includes("中标") || normalized.includes("归档")) {
      activateModule("bid-management");
      return `${projectLabel}我已经切到「标书管理」模块。查看标书文件、记录中标情况，或将优秀标书回灌资料库。`;
    }
    if (normalized.includes("设置") || normalized.includes("api") || normalized.includes("模型")) {
      setSettingsOpen(true);
      return "我已打开设置抽屉。运行时 Provider、Base URL、API Key 和角色模型都收纳在这里。";
    }

    return `你当前位于「${moduleLabel}」。${projectLabel}如果你愿意，我可以继续帮你解释这个模块的下一步操作，或者帮你跳到投标资料库、标书分析、标书生成、标书评审、排版定稿、标书管理。`;
  }

  function handleCopilotSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = copilotDraft.trim();
    if (!prompt) {
      return;
    }
    appendCopilotMessage("user", prompt);
    setCopilotDraft("");
    setCopilotOpen(true);
    appendCopilotMessage("assistant", buildCopilotReply(prompt));
  }

  function handleCopilotQuickAction(actionId: string) {
    setCopilotOpen(true);
    switch (actionId) {
      case "go-knowledge-library":
        activateModule("knowledge-library");
        appendCopilotMessage("assistant", "已切换到「投标资料库」模块。你可以上传文件入库、查看资料、执行敏感信息清洗。");
        break;
      case "go-tender-analysis":
        activateModule("tender-analysis");
        appendCopilotMessage("assistant", "已切换到「标书分析」模块。上传招标 PDF 文件进行七类拆解与原文对照。");
        break;
      case "go-bid-generation":
        activateModule("bid-generation");
        appendCopilotMessage("assistant", "已切换到「标书生成」模块。AI 先生成框架，审批后分章节编写初稿。");
        break;
      case "go-bid-review":
        activateModule("bid-review");
        appendCopilotMessage("assistant", "已切换到「标书评审」模块。这里可以进行多维评审、模拟评分与废标分析。");
        break;
      case "go-layout-finalize":
        activateModule("layout-finalize");
        appendCopilotMessage("assistant", "已切换到「排版定稿」模块。将合格标书按模板排版，导出最终打印版。");
        break;
      case "go-bid-management":
        activateModule("bid-management");
        appendCopilotMessage("assistant", "已切换到「标书管理」模块。查看标书文件、记录中标情况，或回灌优秀标书。");
        break;
      case "open-settings":
        setSettingsOpen(true);
        appendCopilotMessage("assistant", "已打开设置抽屉。所有技术性配置都收纳在设置中。");
        break;
      default:
        appendCopilotMessage("assistant", "我已记录你的意图。你可以继续问我要做什么，或者直接点模块切换。");
        break;
    }
  }

  const copilotQuickActions = [
    { id: "go-knowledge-library", label: "投标资料库" },
    { id: "go-tender-analysis", label: "标书分析" },
    { id: "go-bid-generation", label: "标书生成" },
    { id: "go-bid-review", label: "标书评审" },
    { id: "go-layout-finalize", label: "排版定稿" },
    { id: "go-bid-management", label: "标书管理" },
    { id: "open-settings", label: "打开设置" },
  ];

  function renderLoginWorkspace() {
    return (
      <section className="workspace-stack">
        <HeroPanel
          projectCount={projects.length}
          documentCount={documents.length}
          historicalBidCount={historicalBids.length}
        />
        <section className="surface-card surface-card-login">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Access</p>
              <h3>登录后进入 Copilot 工作区</h3>
            </div>
            <span className="badge">登录必需</span>
          </div>
          <div className="workspace-grid workspace-grid-2">
            <form className="stack" onSubmit={handleLogin}>
              <label>
                邮箱
                <input
                  autoComplete="username"
                  value={loginEmail}
                  onChange={(event) => setLoginEmail(event.target.value)}
                />
              </label>
              <label>
                密码
                <input
                  autoComplete="current-password"
                  type="password"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                />
              </label>
              <button className="primary-button" disabled={Boolean(busyLabel)} type="submit">
                登录并进入工作区
              </button>
            </form>

            <div className="stack">
              <div className="info-block">
                <strong>界面原则</strong>
                <p>左侧切模块，中间只做一件事，右侧 Copilot 默认隐藏，设置全部收纳到抽屉里。</p>
              </div>
              <div className="info-block">
                <strong>默认账号</strong>
                <p>`admin@example.com` / `admin123456`</p>
                <p>`project_manager@example.com` / `manager123456`</p>
              </div>
              <div className="info-block">
                <strong>Copilot 作用</strong>
                <p>解释当前模块、提示下一步、代你导航到上传、证据检索、历史复用、招标拆解和生成复核。</p>
              </div>
            </div>
          </div>
        </section>
      </section>
    );
  }

  function renderActiveModule() {
    switch (activeModule) {
      case "knowledge-library":
        return (
          <KnowledgeLibraryView
            busyLabel={busyLabel}
            credentialOwnerName={credentialOwnerName}
            credentialProjectName={credentialProjectName}
            credentialType={credentialType}
            documentEvidenceUnits={documentEvidenceUnits}
            documents={documents}
            equipmentAssets={equipmentAssets}
            equipmentModelNo={equipmentModelNo}
            equipmentName={equipmentName}
            equipmentQuantity={equipmentQuantity}
            evidenceDocumentType={evidenceDocumentType}
            evidenceQuery={evidenceQuery}
            evidenceResults={evidenceResults}
            handleApplyLibraryFilters={handleApplyLibraryFilters}
            handleCreateEquipmentAsset={handleCreateEquipmentAsset}
            handleCreateLibraryEntry={handleCreateLibraryEntry}
            handleCreatePersonnelAsset={handleCreatePersonnelAsset}
            handleCreateProject={handleCreateProject}
            handleCreateProjectCredential={handleCreateProjectCredential}
            handleCreateQualification={handleCreateQualification}
            handleDeleteEquipmentAsset={handleDeleteEquipmentAsset}
            handleDeletePersonnelAsset={handleDeletePersonnelAsset}
            handleDeleteProjectCredential={handleDeleteProjectCredential}
            handleDeleteQualification={handleDeleteQualification}
            handleImportHistoricalBid={handleImportHistoricalBid}
            handleLoadEvidenceUnits={handleLoadEvidenceUnits}
            handleLoadHistoricalArtifacts={handleLoadHistoricalArtifacts}
            handleRebuildReuseUnits={handleRebuildReuseUnits}
            handleRebuildSections={handleRebuildSections}
            handleResetLibraryFilters={handleResetLibraryFilters}
            handleRunLibraryCheck={handleRunLibraryCheck}
            handleSearchEvidence={handleSearchEvidence}
            handleSearchReuse={handleSearchReuse}
            handleUploadDocument={handleUploadDocument}
            handleVerifyLeakage={handleVerifyLeakage}
            historicalBids={historicalBids}
            historicalProjectType={historicalProjectType}
            historicalRecommended={historicalRecommended}
            historicalRegion={historicalRegion}
            historicalReuseUnits={historicalReuseUnits}
            historicalSections={historicalSections}
            historicalSourceType={historicalSourceType}
            historicalYear={historicalYear}
            importDocumentId={importDocumentId}
            knowledgeBaseEntries={knowledgeBaseEntries}
            leakageDraftText={leakageDraftText}
            leakageForbiddenTerms={leakageForbiddenTerms}
            leakageResult={leakageResult}
            leakageReuseUnitIds={leakageReuseUnitIds}
            leakageSectionId={leakageSectionId}
            libraryCategory={libraryCategory}
            libraryCreatedFrom={libraryCreatedFrom}
            libraryCreatedTo={libraryCreatedTo}
            libraryFilterCategory={libraryFilterCategory}
            libraryFilterQuery={libraryFilterQuery}
            libraryOwnerName={libraryOwnerName}
            libraryTitle={libraryTitle}
            message={message}
            onActivateModule={(module) => setActiveModule(module)}
            onOpenCopilot={() => setCopilotOpen(true)}
            personnelAssets={personnelAssets}
            personnelCertificateNo={personnelCertificateNo}
            personnelName={personnelName}
            personnelRoleTitle={personnelRoleTitle}
            projectCredentials={projectCredentials}
            projectName={projectName}
            projects={projects}
            qualifications={qualifications}
            qualificationCertificateNo={qualificationCertificateNo}
            qualificationLevel={qualificationLevel}
            qualificationName={qualificationName}
            qualificationValidUntil={qualificationValidUntil}
            reusePack={reusePack}
            reuseSectionType={reuseSectionType}
            selectedDocument={selectedDocument}
            selectedDocumentId={selectedDocumentId}
            selectedHistoricalBid={selectedHistoricalBid}
            selectedProject={selectedProject}
            selectedProjectId={selectedProjectId}
            setCredentialOwnerName={setCredentialOwnerName}
            setCredentialProjectName={setCredentialProjectName}
            setCredentialType={setCredentialType}
            setEquipmentModelNo={setEquipmentModelNo}
            setEquipmentName={setEquipmentName}
            setEquipmentQuantity={setEquipmentQuantity}
            setEvidenceDocumentType={setEvidenceDocumentType}
            setEvidenceQuery={setEvidenceQuery}
            setHistoricalProjectType={setHistoricalProjectType}
            setHistoricalRecommended={setHistoricalRecommended}
            setHistoricalRegion={setHistoricalRegion}
            setHistoricalSourceType={setHistoricalSourceType}
            setHistoricalYear={setHistoricalYear}
            setImportDocumentId={setImportDocumentId}
            setLeakageDraftText={setLeakageDraftText}
            setLeakageForbiddenTerms={setLeakageForbiddenTerms}
            setLeakageReuseUnitIds={setLeakageReuseUnitIds}
            setLeakageSectionId={setLeakageSectionId}
            setLibraryCategory={setLibraryCategory}
            setLibraryCreatedFrom={setLibraryCreatedFrom}
            setLibraryCreatedTo={setLibraryCreatedTo}
            setLibraryFilterCategory={setLibraryFilterCategory}
            setLibraryFilterQuery={setLibraryFilterQuery}
            setLibraryOwnerName={setLibraryOwnerName}
            setLibraryTitle={setLibraryTitle}
            setPersonnelCertificateNo={setPersonnelCertificateNo}
            setPersonnelName={setPersonnelName}
            setPersonnelRoleTitle={setPersonnelRoleTitle}
            setProjectName={setProjectName}
            setQualificationCertificateNo={setQualificationCertificateNo}
            setQualificationLevel={setQualificationLevel}
            setQualificationName={setQualificationName}
            setQualificationValidUntil={setQualificationValidUntil}
            setReuseSectionType={setReuseSectionType}
            setSelectedHistoricalBidId={setSelectedHistoricalBidId}
            setUploadFile={setUploadFile}
            setUploadType={setUploadType}
            token={token}
            uploadType={uploadType}
            workbenchOverview={workbenchOverview}
          />
        );
      case "tender-analysis":
        return (
          <TenderAnalysisView
            busyLabel={busyLabel}
            decompositionPreviewBusy={decompositionPreviewBusy}
            decompositionRunName={decompositionRunName}
            decompositionRuns={decompositionRuns}
            decompositionSourceMarkdown={decompositionSourceMarkdown}
            decompositionSourcePreviewUrl={decompositionSourcePreviewUrl}
            handleCreateDecompositionRun={handleCreateDecompositionRun}
            handleDownloadDocumentArtifact={handleDownloadDocumentArtifact}
            selectedDecompositionRun={selectedDecompositionRun}
            selectedDocument={selectedDocument}
            selectedProject={selectedProject}
            selectedProjectId={selectedProjectId}
            setDecompositionRunName={setDecompositionRunName}
            setSelectedDecompositionRunId={setSelectedDecompositionRunId}
            token={token}
          />
        );
      case "bid-generation":
        return (
          <BidGenerationView
            busyLabel={busyLabel}
            generatedSections={generatedSections}
            generationJobName={generationJobName}
            generationJobs={generationJobs}
            generationTargetSections={generationTargetSections}
            handleApproveGenerationOutline={handleApproveGenerationOutline}
            handleCreateGenerationJob={handleCreateGenerationJob}
            selectedGenerationJob={selectedGenerationJob}
            selectedGenerationJobId={selectedGenerationJobId}
            selectedProjectId={selectedProjectId}
            setGenerationJobName={setGenerationJobName}
            setGenerationTargetSections={setGenerationTargetSections}
            setSelectedGenerationJobId={setSelectedGenerationJobId}
            token={token}
          />
        );
      case "bid-review":
        return (
          <BidReviewView
            busyLabel={busyLabel}
            handleConfirmReviewRunPass={handleConfirmReviewRunPass}
            handleCreateReviewRun={handleCreateReviewRun}
            handleRemediateReviewIssue={handleRemediateReviewIssue}
            reviewIssues={reviewIssues}
            reviewMode={reviewMode}
            reviewRunName={reviewRunName}
            reviewRuns={reviewRuns}
            selectedProjectId={selectedProjectId}
            selectedReviewRun={selectedReviewRun}
            selectedReviewRunId={selectedReviewRunId}
            setReviewMode={setReviewMode}
            setReviewRunName={setReviewRunName}
            setSelectedReviewRunId={setSelectedReviewRunId}
            token={token}
          />
        );
      case "layout-finalize":
        return (
          <LayoutFinalizeView
            busyLabel={busyLabel}
            handleCreateLayoutJob={handleCreateLayoutJob}
            handleDownloadRenderedOutput={handleDownloadRenderedOutput}
            layoutJobName={layoutJobName}
            layoutJobs={layoutJobs}
            layoutTemplateName={layoutTemplateName}
            renderedOutputs={renderedOutputs}
            selectedLayoutJob={selectedLayoutJob}
            selectedLayoutJobId={selectedLayoutJobId}
            selectedProjectId={selectedProjectId}
            setLayoutJobName={setLayoutJobName}
            setLayoutTemplateName={setLayoutTemplateName}
            setSelectedLayoutJobId={setSelectedLayoutJobId}
            token={token}
          />
        );
      case "bid-management":
        return (
          <BidManagementView
            busyLabel={busyLabel}
            handleApplySubmissionFilters={handleApplySubmissionFilters}
            handleCreateSubmissionRecord={handleCreateSubmissionRecord}
            handleFeedSubmissionRecordToLibrary={handleFeedSubmissionRecordToLibrary}
            handleResetSubmissionFilters={handleResetSubmissionFilters}
            selectedProjectId={selectedProjectId}
            setSubmissionCreatedFrom={setSubmissionCreatedFrom}
            setSubmissionCreatedTo={setSubmissionCreatedTo}
            setSubmissionFilterQuery={setSubmissionFilterQuery}
            setSubmissionFilterStatus={setSubmissionFilterStatus}
            setSubmissionStatus={setSubmissionStatus}
            setSubmissionTitle={setSubmissionTitle}
            submissionCreatedFrom={submissionCreatedFrom}
            submissionCreatedTo={submissionCreatedTo}
            submissionFilterQuery={submissionFilterQuery}
            submissionFilterStatus={submissionFilterStatus}
            submissionRecords={submissionRecords}
            submissionStatus={submissionStatus}
            submissionTitle={submissionTitle}
            token={token}
          />
        );
      default:
        return (
          <KnowledgeLibraryView
            busyLabel={busyLabel}
            credentialOwnerName={credentialOwnerName}
            credentialProjectName={credentialProjectName}
            credentialType={credentialType}
            documentEvidenceUnits={documentEvidenceUnits}
            documents={documents}
            equipmentAssets={equipmentAssets}
            equipmentModelNo={equipmentModelNo}
            equipmentName={equipmentName}
            equipmentQuantity={equipmentQuantity}
            evidenceDocumentType={evidenceDocumentType}
            evidenceQuery={evidenceQuery}
            evidenceResults={evidenceResults}
            handleApplyLibraryFilters={handleApplyLibraryFilters}
            handleCreateEquipmentAsset={handleCreateEquipmentAsset}
            handleCreateLibraryEntry={handleCreateLibraryEntry}
            handleCreatePersonnelAsset={handleCreatePersonnelAsset}
            handleCreateProject={handleCreateProject}
            handleCreateProjectCredential={handleCreateProjectCredential}
            handleCreateQualification={handleCreateQualification}
            handleDeleteEquipmentAsset={handleDeleteEquipmentAsset}
            handleDeletePersonnelAsset={handleDeletePersonnelAsset}
            handleDeleteProjectCredential={handleDeleteProjectCredential}
            handleDeleteQualification={handleDeleteQualification}
            handleImportHistoricalBid={handleImportHistoricalBid}
            handleLoadEvidenceUnits={handleLoadEvidenceUnits}
            handleLoadHistoricalArtifacts={handleLoadHistoricalArtifacts}
            handleRebuildReuseUnits={handleRebuildReuseUnits}
            handleRebuildSections={handleRebuildSections}
            handleResetLibraryFilters={handleResetLibraryFilters}
            handleRunLibraryCheck={handleRunLibraryCheck}
            handleSearchEvidence={handleSearchEvidence}
            handleSearchReuse={handleSearchReuse}
            handleUploadDocument={handleUploadDocument}
            handleVerifyLeakage={handleVerifyLeakage}
            historicalBids={historicalBids}
            historicalProjectType={historicalProjectType}
            historicalRecommended={historicalRecommended}
            historicalRegion={historicalRegion}
            historicalReuseUnits={historicalReuseUnits}
            historicalSections={historicalSections}
            historicalSourceType={historicalSourceType}
            historicalYear={historicalYear}
            importDocumentId={importDocumentId}
            knowledgeBaseEntries={knowledgeBaseEntries}
            leakageDraftText={leakageDraftText}
            leakageForbiddenTerms={leakageForbiddenTerms}
            leakageResult={leakageResult}
            leakageReuseUnitIds={leakageReuseUnitIds}
            leakageSectionId={leakageSectionId}
            libraryCategory={libraryCategory}
            libraryCreatedFrom={libraryCreatedFrom}
            libraryCreatedTo={libraryCreatedTo}
            libraryFilterCategory={libraryFilterCategory}
            libraryFilterQuery={libraryFilterQuery}
            libraryOwnerName={libraryOwnerName}
            libraryTitle={libraryTitle}
            message={message}
            onActivateModule={(module) => setActiveModule(module)}
            onOpenCopilot={() => setCopilotOpen(true)}
            personnelAssets={personnelAssets}
            personnelCertificateNo={personnelCertificateNo}
            personnelName={personnelName}
            personnelRoleTitle={personnelRoleTitle}
            projectCredentials={projectCredentials}
            projectName={projectName}
            projects={projects}
            qualifications={qualifications}
            qualificationCertificateNo={qualificationCertificateNo}
            qualificationLevel={qualificationLevel}
            qualificationName={qualificationName}
            qualificationValidUntil={qualificationValidUntil}
            reusePack={reusePack}
            reuseSectionType={reuseSectionType}
            selectedDocument={selectedDocument}
            selectedDocumentId={selectedDocumentId}
            selectedHistoricalBid={selectedHistoricalBid}
            selectedProject={selectedProject}
            selectedProjectId={selectedProjectId}
            setCredentialOwnerName={setCredentialOwnerName}
            setCredentialProjectName={setCredentialProjectName}
            setCredentialType={setCredentialType}
            setEquipmentModelNo={setEquipmentModelNo}
            setEquipmentName={setEquipmentName}
            setEquipmentQuantity={setEquipmentQuantity}
            setEvidenceDocumentType={setEvidenceDocumentType}
            setEvidenceQuery={setEvidenceQuery}
            setHistoricalProjectType={setHistoricalProjectType}
            setHistoricalRecommended={setHistoricalRecommended}
            setHistoricalRegion={setHistoricalRegion}
            setHistoricalSourceType={setHistoricalSourceType}
            setHistoricalYear={setHistoricalYear}
            setImportDocumentId={setImportDocumentId}
            setLeakageDraftText={setLeakageDraftText}
            setLeakageForbiddenTerms={setLeakageForbiddenTerms}
            setLeakageReuseUnitIds={setLeakageReuseUnitIds}
            setLeakageSectionId={setLeakageSectionId}
            setLibraryCategory={setLibraryCategory}
            setLibraryCreatedFrom={setLibraryCreatedFrom}
            setLibraryCreatedTo={setLibraryCreatedTo}
            setLibraryFilterCategory={setLibraryFilterCategory}
            setLibraryFilterQuery={setLibraryFilterQuery}
            setLibraryOwnerName={setLibraryOwnerName}
            setLibraryTitle={setLibraryTitle}
            setPersonnelCertificateNo={setPersonnelCertificateNo}
            setPersonnelName={setPersonnelName}
            setPersonnelRoleTitle={setPersonnelRoleTitle}
            setProjectName={setProjectName}
            setQualificationCertificateNo={setQualificationCertificateNo}
            setQualificationLevel={setQualificationLevel}
            setQualificationName={setQualificationName}
            setQualificationValidUntil={setQualificationValidUntil}
            setReuseSectionType={setReuseSectionType}
            setSelectedHistoricalBidId={setSelectedHistoricalBidId}
            setUploadFile={setUploadFile}
            setUploadType={setUploadType}
            token={token}
            uploadType={uploadType}
            workbenchOverview={workbenchOverview}
          />
        );
    }
  }

  return (
    <main className="chat-shell">
      <WorkspaceSidebar
        activeModule={activeModule}
        busyLabel={busyLabel}
        collapsed={sidebarCollapsed}
        message={message}
        modules={WORKSPACE_MODULES}
        onLogout={handleLogout}
        onOpenCopilot={() => setCopilotOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onSelectModule={(moduleId) => activateModule(moduleId as WorkspaceModule)}
        onSelectProject={(projectId) => setSelectedProjectId(projectId)}
        onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
        projects={projects}
        selectedProjectId={selectedProjectId}
        sessionReady={Boolean(token)}
      />

      <section className="chat-main">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">Workspace</p>
            <h2>{activeModuleMeta.label}</h2>
            <p className="workspace-subtitle">{activeModuleMeta.hint}</p>
          </div>
          <div className="workspace-toolbar">
            <div className="context-pill">
              <span className="brand-point brand-point-inline" />
              <span>{selectedProject ? selectedProject.name : "未选择项目"}</span>
            </div>
            <button className="ghost-button" onClick={() => setSettingsOpen(true)} type="button">
              设置
            </button>
            <button className="primary-button" onClick={() => setCopilotOpen(true)} type="button">
              打开 Copilot
            </button>
          </div>
        </header>

        {token ? renderActiveModule() : renderLoginWorkspace()}
      </section>

      <SettingsDrawer
        connectivityResult={connectivityResult}
        disabled={!token || Boolean(busyLabel)}
        onClose={() => setSettingsOpen(false)}
        onFieldChange={(field, value) =>
          setRuntimeForm((current) => ({
            ...current,
            [field]: value,
          }))
        }
        onModelChange={(role, value) =>
          setRuntimeForm((current) => ({
            ...current,
            defaultModels: {
              ...current.defaultModels,
              [role]: value,
            },
          }))
        }
        onSelectedRoleChange={(value) =>
          setRuntimeForm((current) => ({
            ...current,
            selectedRole: value,
          }))
        }
        onSubmit={handleConnectivityCheck}
        open={settingsOpen}
        runtimeForm={runtimeForm}
        runtimeSettings={runtimeSettings}
      />

      <CopilotPanel
        draft={copilotDraft}
        messages={copilotMessages}
        moduleLabel={activeModuleMeta.label}
        onClose={() => setCopilotOpen(false)}
        onDraftChange={setCopilotDraft}
        onQuickAction={handleCopilotQuickAction}
        onSubmit={handleCopilotSubmit}
        open={copilotOpen}
        projectName={selectedProject?.name ?? null}
        quickActions={copilotQuickActions}
      />

      {!copilotOpen ? (
        <button className="copilot-fab" onClick={() => setCopilotOpen(true)} type="button">
          <span className="brand-point brand-point-inline" />
          Copilot
        </button>
      ) : null}
    </main>
  );
}

function readError(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "发生未知错误";
}


export default function HomePage() {
  return <WorkspaceHome />;
}
