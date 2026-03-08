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
import { ModuleStrip } from "../components/module-strip";
import { SettingsDrawer } from "../components/settings-drawer";
import { WorkspaceSidebar } from "../components/workspace-sidebar";
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
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

  function parseDecompositionSummary(summaryJson: string): {
    categories: Array<{
      category_key: string;
      label: string;
      count: number;
      items: Array<{
        title: string;
        detail: string;
        source_anchor: string;
        page: number;
        source_excerpt: string;
        priority: string;
      }>;
    }>;
    totals?: { sections?: number; items?: number };
  } | null {
    if (!summaryJson || summaryJson === "{}") {
      return null;
    }
    try {
      return JSON.parse(summaryJson);
    } catch {
      return null;
    }
  }

  function activateModule(module: WorkspaceModule) {
    setActiveModule(module);
    router.push(modulePath(module));
  }

  function parseEvidenceSummary(summaryJson: string): Array<{
    requirement_type: string;
    source_anchor: string;
    priority: string;
  }> {
    if (!summaryJson) {
      return [];
    }
    try {
      const payload = JSON.parse(summaryJson);
      return Array.isArray(payload) ? payload : [];
    } catch {
      return [];
    }
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

  function renderOverviewModule() {
    return (
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
              <button className="ghost-button" onClick={() => setActiveModule("tender-analysis")} type="button">
                标书分析
              </button>
              <button className="ghost-button" onClick={() => setActiveModule("bid-generation")} type="button">
                标书生成
              </button>
              <button className="ghost-button" onClick={() => setCopilotOpen(true)} type="button">
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
    );
  }

  function renderDocumentsModule() {
    return (
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
                disabled={!token || !selectedProjectId || !uploadFile || Boolean(busyLabel)}
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
    );
  }

  function renderEvidenceModule() {
    return (
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
    );
  }

  function renderHistoricalModule() {
    return (
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
                value={selectedHistoricalBidId ?? ""}
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
    );
  }

  function renderDecompositionModule() {
    const summary = selectedDecompositionRun ? parseDecompositionSummary(selectedDecompositionRun.summary_json) : null;

    return (
      <section className="workspace-stack">
        <div className="workspace-grid workspace-grid-2">
          <section className="surface-card">
            <div className="panel-header compact">
              <div>
                <p className="eyebrow">标书分析</p>
                <h3>Tender Analysis</h3>
              </div>
              <span className="badge">{decompositionRuns.length}</span>
            </div>
            <form className="stack" onSubmit={handleCreateDecompositionRun}>
              <label>
                任务名
                <input value={decompositionRunName} onChange={(event) => setDecompositionRunName(event.target.value)} />
              </label>
              <button className="primary-button" disabled={!token || !selectedProjectId || Boolean(busyLabel)} type="submit">
                创建解析任务
              </button>
            </form>
            <div className="mini-list">
              {decompositionRuns.map((row) => (
                <button
                  className={`list-item ${selectedDecompositionRun?.id === row.id ? "list-item-active" : ""}`}
                  key={row.id}
                  onClick={() => setSelectedDecompositionRunId(row.id)}
                  type="button"
                >
                  <div>
                    <strong>{row.run_name}</strong>
                    <p>{row.status} · {row.progress_pct}%</p>
                  </div>
                  <span>{formatDate(row.created_at)}</span>
                </button>
              ))}
            </div>
            <div className="info-block">
              <strong>原文预览</strong>
              <p>优先展示解析后的 markdown，便于与七类拆解结果左右对照。</p>
              {selectedDecompositionRun?.source_document_id ? (
                <div className="inline-actions">
                  <button
                    className="ghost-button"
                    disabled={!token || !selectedProjectId || Boolean(busyLabel)}
                    onClick={() =>
                      void handleDownloadDocumentArtifact(
                        selectedDecompositionRun.source_document_id!,
                        "source",
                        selectedDocument?.filename || `document-${selectedDecompositionRun.source_document_id}`
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
                        `document-${selectedDecompositionRun.source_document_id}.md`
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
              <strong>{decompositionPreviewBusy ? "正在加载原文…" : "原文 / 解析预览"}</strong>
              {decompositionSourcePreviewUrl ? (
                <iframe className="document-preview-frame" src={decompositionSourcePreviewUrl} title="招标文件 PDF 预览" />
              ) : null}
              <pre className="code-box">{decompositionSourceMarkdown || "当前任务暂无可预览的解析稿。"}</pre>
            </div>
          </section>

          <section className="surface-card">
            <div className="panel-header">
              <div>
                <p className="eyebrow">拆解结果</p>
                <h3>{selectedDecompositionRun ? selectedDecompositionRun.run_name : "等待创建任务"}</h3>
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
                  <strong>当前文档</strong>
                  <p>建议先在投标资料库模块上传招标文件并创建拆解任务。</p>
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

  function renderActiveModule() {
    switch (activeModule) {
      case "knowledge-library":
        return (
          <>
            {renderOverviewModule()}
            {renderDocumentsModule()}
            {renderEvidenceModule()}
            {renderHistoricalModule()}
          </>
        );
      case "tender-analysis":
        return renderDecompositionModule();
      case "bid-generation":
        return renderGenerationModule();
      case "bid-review":
        return renderReviewModule();
      case "layout-finalize":
        return renderLayoutModule();
      case "bid-management":
        return renderBidManagementModule();
      default:
        return renderOverviewModule();
    }
  }

  function renderGenerationModule() {
    const sectionCount = generatedSections.length;

    return (
      <section className="workspace-stack">
        <div className="workspace-grid workspace-grid-2">
          <form className="surface-card stack" onSubmit={handleCreateGenerationJob}>
            <div className="panel-header compact">
              <div>
                <p className="eyebrow">标书生成</p>
                <h3>Generation</h3>
              </div>
              <span className="badge">{generationJobs.length}</span>
            </div>
            <label>
              任务名
              <input value={generationJobName} onChange={(event) => setGenerationJobName(event.target.value)} />
            </label>
            <label>
              目标章节数
              <input
                min="0"
                type="number"
                value={generationTargetSections}
                onChange={(event) => setGenerationTargetSections(event.target.value)}
              />
            </label>
            <button className="primary-button" disabled={!token || !selectedProjectId || Boolean(busyLabel)} type="submit">
              创建生成任务
            </button>
            <label>
              查看任务
              <select
                value={selectedGenerationJobId ?? ""}
                onChange={(event) => setSelectedGenerationJobId(Number(event.target.value) || null)}
              >
                <option value="">请选择任务</option>
                {generationJobs.map((row) => (
                  <option key={row.id} value={row.id}>
                    #{row.id} · {row.job_name}
                  </option>
                ))}
              </select>
            </label>
            <div className="mini-list">
              {generationJobs.map((row) => (
                <div className="mini-item" key={row.id}>
                  <strong>{row.job_name}</strong>
                  <span>{row.status}</span>
                </div>
              ))}
            </div>
          </form>

          <section className="surface-card">
            <div className="panel-header">
              <div>
                <p className="eyebrow">生成结果</p>
                <h3>{selectedGenerationJob ? selectedGenerationJob.job_name : "等待选择任务"}</h3>
              </div>
              <span className="badge">{sectionCount} 章</span>
            </div>
            <div className="stack">
              <div className="info-block">
                <strong>框架与章节</strong>
                <p>
                  {selectedGenerationJob
                    ? `状态：${selectedGenerationJob.status}，目标章节：${selectedGenerationJob.target_sections}`
                    : "先创建或选择一个生成任务。"}
                </p>
                <div className="inline-actions">
                  <button
                    className="ghost-button"
                    disabled={!token || !selectedGenerationJob || Boolean(busyLabel) || selectedGenerationJob.status === "approved"}
                    onClick={() => void handleApproveGenerationOutline()}
                    type="button"
                  >
                    {selectedGenerationJob?.status === "approved" ? "已审批" : "审批框架"}
                  </button>
                </div>
              </div>
              {generatedSections.length ? (
                <div className="scroll-box">
                  {generatedSections.map((section) => {
                    const evidence = parseEvidenceSummary(section.evidence_summary_json);
                    return (
                      <article className="result-card" key={section.id}>
                        <header>
                          <strong>{section.title}</strong>
                          <span>
                            {section.status} · {evidence.length} 条证据
                          </span>
                        </header>
                        <p>{section.draft_text}</p>
                        <div className="mini-list">
                          {evidence.map((item, index) => (
                            <div className="mini-item" key={`${section.id}-${index}`}>
                              <strong>{item.requirement_type}</strong>
                              <span>
                                {item.source_anchor} · {item.priority}
                              </span>
                            </div>
                          ))}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="info-block">
                  <strong>暂无章节草稿</strong>
                  <p>创建生成任务后，这里会显示已生成的章节草稿和证据来源。</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
    );
  }

  function renderReviewModule() {
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
                onChange={(event) => setSelectedReviewRunId(Number(event.target.value) || null)}
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

  function renderLayoutModule() {
    return (
      <section className="workspace-stack">
        <div className="workspace-grid workspace-grid-2">
          <form className="surface-card stack" onSubmit={handleCreateLayoutJob}>
            <div className="panel-header compact">
              <div>
                <p className="eyebrow">排版定稿</p>
                <h3>Layout</h3>
              </div>
              <span className="badge">{layoutJobs.length}</span>
            </div>
            <label>
              任务名
              <input value={layoutJobName} onChange={(event) => setLayoutJobName(event.target.value)} />
            </label>
            <label>
              模板
              <input value={layoutTemplateName} onChange={(event) => setLayoutTemplateName(event.target.value)} />
            </label>
            <button className="primary-button" disabled={!token || !selectedProjectId || Boolean(busyLabel)} type="submit">
              创建排版任务
            </button>
            <label>
              查看排版
              <select
                value={selectedLayoutJobId ?? ""}
                onChange={(event) => setSelectedLayoutJobId(Number(event.target.value) || null)}
              >
                <option value="">请选择排版任务</option>
                {layoutJobs.map((row) => (
                  <option key={row.id} value={row.id}>
                    #{row.id} · {row.job_name}
                  </option>
                ))}
              </select>
            </label>
            <div className="mini-list">
              {layoutJobs.map((row) => (
                <div className="mini-item" key={row.id}>
                  <strong>{row.job_name}</strong>
                  <span>{row.template_name}</span>
                </div>
              ))}
            </div>
          </form>

          <section className="surface-card">
            <div className="panel-header">
              <div>
                <p className="eyebrow">排版输出</p>
                <h3>{selectedLayoutJob ? selectedLayoutJob.job_name : "等待选择排版任务"}</h3>
              </div>
              <span className="badge">{renderedOutputs.length} 个输出</span>
            </div>
            <div className="stack">
              <div className="info-block">
                <strong>排版状态</strong>
                <p>
                  {selectedLayoutJob
                    ? `模板：${selectedLayoutJob.template_name}，状态：${selectedLayoutJob.status}`
                    : "先创建或选择一个排版任务。"}
                </p>
              </div>
              {renderedOutputs.length ? (
                <div className="scroll-box">
                  {renderedOutputs.map((output) => (
                    <article className="result-card" key={output.id}>
                      <header>
                        <strong>{output.output_type.toUpperCase()}</strong>
                        <span>{output.version_tag}</span>
                      </header>
                      <p>{output.storage_path}</p>
                      <div className="inline-actions">
                        <button
                          className="ghost-button"
                          disabled={!token || Boolean(busyLabel)}
                          onClick={() => void handleDownloadRenderedOutput(output.id, output.version_tag, output.output_type)}
                          type="button"
                        >
                          下载产物
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="info-block">
                  <strong>暂无导出文件</strong>
                  <p>排版完成后，这里会显示输出文件路径和版本号。</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
    );
  }

  function renderBidManagementModule() {
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
