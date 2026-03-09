"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  ApiError,
  approveGenerationOutline,
  createDecompositionRun,
  createGenerationJob,
  createLayoutJob,
  createProject,
  createReviewRun,
  confirmReviewRunPass,
  createSubmissionRecord,
  downloadDocumentArtifact,
  DecompositionRun,
  DocumentRecord,
  GenerationJob,
  getRuntimeSettings,
  HistoricalBid,
  HistoricalBidSection,
  HistoricalReusePack,
  HistoricalReuseUnit,
  LayoutJob,
  listDecompositionRuns,
  listDocuments,
  listEvidenceUnits,
  listGenerationJobs,
  listHistoricalBids,
  listHistoricalReuseUnits,
  listHistoricalSections,
  listLayoutJobs,
  listProjects,
  listReviewRuns,
  listSubmissionRecords,
  login,
  Project,
  ReviewRun,
  runConnectivityCheck,
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
  feedSubmissionRecordToLibrary,
  GeneratedSection,
  listGeneratedSections,
  downloadRenderedOutput,
  listRenderedOutputs,
  listReviewIssues,
  remediateReviewIssue,
  RenderedOutput,
  ReviewIssue,
} from "../lib/api";
import { AppShell } from "../components/app-shell";
import { CopilotPanel } from "../components/copilot-panel";
import { CopilotTrigger } from "../components/copilot-trigger";
import { HomeContinueCard } from "../components/home-continue-card";
import { HeroPanel } from "../components/hero-panel";
import { TaskEntryCard } from "../components/task-entry-card";
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
import {
  DEFAULT_RESUME_MODULE,
  PROJECT_ID_QUERY_PARAM,
  WORKSPACE_MODULES,
  buildModuleHref,
  isResumableModule,
  lastVisitedModuleStorageKey,
  parseProjectIdParam,
  type WorkspaceModule,
} from "../components/workspace-views/shared";
import { formatLibraryCategory, getResumeCardState } from "../components/workspace-views/utils";
import { shouldCollapseCopilotOnInteraction, isNarrowViewport } from "../lib/copilot-visibility";
import { clearStoredToken, getStorageItem, getStoredToken, setStorageItem, setStoredToken } from "../lib/session";

type RuntimeRole = keyof RuntimeSettings["default_models"];

type RuntimeRoleConfig = {
  apiBaseUrl: string;
  apiKey: string;
  model: string;
};

type RuntimePlatformConfig = {
  provider: string;
  apiBaseUrl: string;
  apiKey: string;
};

type RuntimeFormState = {
  platformConfig: RuntimePlatformConfig;
  roleConfigs: Record<RuntimeRole, RuntimeRoleConfig>;
};

const DEFAULT_RUNTIME_API_BASE_URL = "https://api.siliconflow.cn/v1";

const EMPTY_MODELS: RuntimeSettings["default_models"] = {
  ocr_role: "deepseek-ai/DeepSeek-OCR",
  decomposition_navigator_role: "deepseek-ai/DeepSeek-V3.2",
  decomposition_extractor_role: "Qwen/Qwen3-30B-A3B-Instruct-2507",
  writer_role: "deepseek-ai/DeepSeek-V3",
  reviewer_role: "deepseek-ai/DeepSeek-R1",
  adjudicator_role: "deepseek-ai/DeepSeek-R1",
};


function buildRuntimeRoleConfigs(
  models: RuntimeSettings["default_models"],
  apiBaseUrl: string,
  previous?: Record<RuntimeRole, RuntimeRoleConfig>,
): Record<RuntimeRole, RuntimeRoleConfig> {
  return {
    ocr_role: {
      apiBaseUrl: previous?.ocr_role.apiBaseUrl ?? apiBaseUrl,
      apiKey: previous?.ocr_role.apiKey ?? "",
      model: models.ocr_role,
    },
    decomposition_navigator_role: {
      apiBaseUrl: previous?.decomposition_navigator_role.apiBaseUrl ?? apiBaseUrl,
      apiKey: previous?.decomposition_navigator_role.apiKey ?? "",
      model: models.decomposition_navigator_role,
    },
    decomposition_extractor_role: {
      apiBaseUrl: previous?.decomposition_extractor_role.apiBaseUrl ?? apiBaseUrl,
      apiKey: previous?.decomposition_extractor_role.apiKey ?? "",
      model: models.decomposition_extractor_role,
    },
    writer_role: {
      apiBaseUrl: previous?.writer_role.apiBaseUrl ?? apiBaseUrl,
      apiKey: previous?.writer_role.apiKey ?? "",
      model: models.writer_role,
    },
    reviewer_role: {
      apiBaseUrl: previous?.reviewer_role.apiBaseUrl ?? apiBaseUrl,
      apiKey: previous?.reviewer_role.apiKey ?? "",
      model: models.reviewer_role,
    },
    adjudicator_role: {
      apiBaseUrl: previous?.adjudicator_role.apiBaseUrl ?? apiBaseUrl,
      apiKey: previous?.adjudicator_role.apiKey ?? "",
      model: models.adjudicator_role,
    },
  };
}

type CopilotMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

export function WorkspaceHome({ forcedModule }: { forcedModule?: WorkspaceModule } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdFromUrl = parseProjectIdParam(searchParams.get(PROJECT_ID_QUERY_PARAM));
  const [token, setToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("请先登录，再查看项目和投标资料。");
  const [busyLabel, setBusyLabel] = useState<string>("");
  const [loginEmail, setLoginEmail] = useState("admin@example.com");
  const [loginPassword, setLoginPassword] = useState("admin123456");

  const [runtimeSettings, setRuntimeSettings] = useState<RuntimeSettings | null>(null);
  const [runtimeForm, setRuntimeForm] = useState<RuntimeFormState>({
    platformConfig: {
      provider: "硅基流动",
      apiBaseUrl: DEFAULT_RUNTIME_API_BASE_URL,
      apiKey: "",
    },
    roleConfigs: buildRuntimeRoleConfigs(EMPTY_MODELS, DEFAULT_RUNTIME_API_BASE_URL),
  });
  const [connectivityResult, setConnectivityResult] = useState<RuntimeConnectivityResult | null>(null);
  const [connectivityRole, setConnectivityRole] = useState<RuntimeRole | "platform" | null>(null);
  const [checkingRole, setCheckingRole] = useState<RuntimeRole | "platform" | null>(null);

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
  const [activeModule, setActiveModule] = useState<WorkspaceModule>(forcedModule ?? "home");
  const [resumeModule, setResumeModule] = useState<Exclude<WorkspaceModule, "home"> | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotDraft, setCopilotDraft] = useState("");
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([]);

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

  const sidebarUserName = useMemo(() => {
    const identity = loginEmail.trim();
    if (!identity) {
      return token ? "AIBidder User" : "访客";
    }

    const localPart = identity.split("@")[0] ?? identity;
    return localPart
      .split(/[._-]+/)
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" ");
  }, [loginEmail, token]);

  const sidebarUserAccountLabel = token ? loginEmail.trim() : "请先登录";

  function buildSubmissionFilters(): SubmissionRecordFilters {
    return {
      status: submissionFilterStatus !== "all" ? submissionFilterStatus : undefined,
      q: submissionFilterQuery.trim() || undefined,
      created_from: submissionCreatedFrom ? `${submissionCreatedFrom}T00:00:00Z` : undefined,
      created_to: submissionCreatedTo ? `${submissionCreatedTo}T23:59:59.999Z` : undefined,
    };
  }

  function selectProject(projectId: number | null) {
    setSelectedProjectId(projectId);
    router.replace(buildModuleHref(activeModule, projectId));
  }

  function activateModule(module: WorkspaceModule, projectId = selectedProjectId) {
    setActiveModule(module);
    router.push(buildModuleHref(module, projectId));
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
    if (projectIdFromUrl === null || projects.length === 0) {
      return;
    }

    if (!projects.some((project) => project.id === projectIdFromUrl)) {
      return;
    }

    setSelectedProjectId((current) => (current === projectIdFromUrl ? current : projectIdFromUrl));
  }, [projectIdFromUrl, projects]);

  useEffect(() => {
    if (!token) {
      return;
    }
    void hydrateConsole(token);
  }, [token]);

  useEffect(() => {
    if (!selectedProjectId) {
      setResumeModule(null);
      return;
    }

    const storedModule = getStorageItem(lastVisitedModuleStorageKey(selectedProjectId));
    setResumeModule(isResumableModule(storedModule) ? storedModule : null);
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId || activeModule === "home") {
      return;
    }

    setStorageItem(lastVisitedModuleStorageKey(selectedProjectId), activeModule);
    setResumeModule(activeModule);
  }, [activeModule, selectedProjectId]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (shouldCollapseCopilotOnInteraction({ open: copilotOpen, narrowViewport: isNarrowViewport(window), event })) {
        setCopilotOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const isEditableTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);

      if (event.key === "Escape") {
        setCopilotOpen(false);
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j") {
        event.preventDefault();
        if (!isEditableTarget || copilotOpen) {
          setCopilotOpen((current) => !current);
        }
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [copilotOpen]);

  useEffect(() => {
    if (!token || selectedProjectId === null) {
      setDocuments([]);
      return;
    }
    void refreshDocuments(token, selectedProjectId);
  }, [token, selectedProjectId]);

  useEffect(() => {
    if (!token) {
      setKnowledgeBaseEntries([]);
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
      setBusyLabel("正在整理项目和资料");
      const [settingsPayload, projectRows, historicalRows] = await Promise.all([
        getRuntimeSettings(activeToken),
        listProjects(activeToken),
        listHistoricalBids(activeToken),
      ]);
      setRuntimeSettings(settingsPayload);
      setRuntimeForm((current) => ({
        platformConfig: {
          provider: settingsPayload.provider,
          apiBaseUrl: settingsPayload.api_base_url ?? DEFAULT_RUNTIME_API_BASE_URL,
          apiKey: current.platformConfig.apiKey,
        },
        roleConfigs: buildRuntimeRoleConfigs(
          settingsPayload.default_models,
          settingsPayload.api_base_url ?? DEFAULT_RUNTIME_API_BASE_URL,
          current.roleConfigs,
        ),
      }));
      setProjects(projectRows);
      setHistoricalBids(historicalRows);
      setSelectedProjectId((current) => {
        if (current !== null && projectRows.some((project) => project.id === current)) {
          return current;
        }
        if (projectIdFromUrl !== null && projectRows.some((project) => project.id === projectIdFromUrl)) {
          return projectIdFromUrl;
        }
        return projectRows[0]?.id ?? null;
      });
      setSelectedHistoricalBidId((current) => current ?? historicalRows[0]?.id ?? null);
      setMessage("项目和资料已同步完成。");
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
    submissionFilters: SubmissionRecordFilters = buildSubmissionFilters(),
  ) {
    try {
      const [
        decompositionRows,
        generationRows,
        reviewRows,
        layoutRows,
        submissionRows,
      ] = await Promise.all([
        listDecompositionRuns(activeToken, projectId),
        listGenerationJobs(activeToken, projectId),
        listReviewRuns(activeToken, projectId),
        listLayoutJobs(activeToken, projectId),
        listSubmissionRecords(activeToken, projectId, submissionFilters),
      ]);
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
      setMessage("登录成功，可以开始处理项目了。");
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
      selectProject(project.id);
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

  async function handleApplySubmissionFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }
    try {
      setBusyLabel("正在筛选项目归档记录");
      await refreshWorkbench(token, selectedProjectId ?? undefined, buildLibraryFilters(), buildSubmissionFilters());
      setMessage("项目归档筛选结果已刷新。");
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
      setBusyLabel("正在重置项目归档筛选");
      setSubmissionFilterStatus("all");
      setSubmissionFilterQuery("");
      setSubmissionCreatedFrom("");
      setSubmissionCreatedTo("");
      await refreshWorkbench(token, selectedProjectId ?? undefined, buildLibraryFilters(), {});
      setMessage("已重置项目归档筛选条件。");
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
      setBusyLabel("正在创建招标分析任务");
      await createDecompositionRun(token, {
        project_id: selectedProjectId,
        source_document_id: selectedDocumentId ?? undefined,
        run_name: decompositionRunName.trim(),
      });
      await refreshWorkbench(token, selectedProjectId);
      setMessage("招标分析任务已加入工作台。");
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
      setBusyLabel("正在创建内容编写任务");
      const created = await createGenerationJob(token, {
        project_id: selectedProjectId,
        source_document_id: selectedDocumentId ?? undefined,
        job_name: generationJobName.trim(),
        target_sections: Number(generationTargetSections) || 0,
      });
      await refreshWorkbench(token, selectedProjectId);
      setSelectedGenerationJobId(created.id);
      setMessage("内容编写任务已加入工作台。");
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
      setBusyLabel("正在创建校核定稿任务");
      const created = await createReviewRun(token, {
        project_id: selectedProjectId,
        source_document_id: selectedDocumentId ?? undefined,
        run_name: reviewRunName.trim(),
        review_mode: reviewMode.trim(),
      });
      await refreshWorkbench(token, selectedProjectId);
      setSelectedReviewRunId(created.id);
      setMessage("校核定稿任务已加入工作台。");
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
      setBusyLabel("正在创建排版导出任务");
      const created = await createLayoutJob(token, {
        project_id: selectedProjectId,
        source_document_id: selectedDocumentId ?? undefined,
        job_name: layoutJobName.trim(),
        template_name: layoutTemplateName.trim(),
      });
      await refreshWorkbench(token, selectedProjectId);
      setSelectedLayoutJobId(created.id);
      setMessage("排版导出任务已加入工作台。");
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
      setBusyLabel("正在创建项目归档记录");
      await createSubmissionRecord(token, {
        project_id: selectedProjectId,
        source_document_id: selectedDocumentId ?? undefined,
        title: submissionTitle.trim(),
        status: submissionStatus.trim(),
      });
      await refreshWorkbench(token, selectedProjectId);
      setMessage("项目归档记录已加入工作台。");
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
      setMessage("校核已确认通过，可进入排版导出。");
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
      setMessage(`标书记录 ${recordId} 已回灌到资料台账（${formatLibraryCategory(entry.category)}）。`);
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

  async function handleConnectivityCheck(role: RuntimeRole | "platform") {
    if (!token) {
      return;
    }

    const provider = runtimeForm.platformConfig.provider.trim();
    const platformApiBaseUrl = runtimeForm.platformConfig.apiBaseUrl.trim();
    const platformApiKey = runtimeForm.platformConfig.apiKey.trim();
    const roleConfig = role === "platform" ? null : runtimeForm.roleConfigs[role];
    const apiBaseUrl = role === "platform" ? platformApiBaseUrl : roleConfig?.apiBaseUrl.trim() || platformApiBaseUrl;
    const apiKey = role === "platform" ? platformApiKey : roleConfig?.apiKey.trim() || platformApiKey;
    const model = role === "platform" ? runtimeForm.roleConfigs.writer_role.model.trim() : roleConfig?.model.trim() ?? "";

    if (!provider || !apiBaseUrl || !apiKey || !model) {
      setMessage("请填写 AI 平台或角色自己的 API / URL，并填写模型名称。");
      return;
    }
    try {
      setBusyLabel("正在验证模型连通性");
      setCheckingRole(role);
      const result = await runConnectivityCheck(token, {
        provider,
        api_base_url: apiBaseUrl,
        api_key: apiKey,
        model,
      });
      setConnectivityRole(role);
      setConnectivityResult(result);
      setMessage(result.message);
    } catch (error) {
      setConnectivityRole(role);
      setConnectivityResult(null);
      setMessage(readError(error));
    } finally {
      setCheckingRole(null);
      setBusyLabel("");
    }
  }

  function handleLogout() {
    clearStoredToken();
    setToken(null);
    setProjects([]);
    setDocuments([]);
    setHistoricalBids([]);
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
      return `${projectLabel}我已经切到「资料准备」。你可以先上传招标文件，再补充资质、人员、设备和业绩资料。`;
    }
    if (normalized.includes("分析") || normalized.includes("拆解") || normalized.includes("招标")) {
      activateModule("tender-analysis");
      return `${projectLabel}我已经切到「招标分析」。这里会拆解资格条件、评分点和风险条款，并支持与原文对照。`;
    }
    if (normalized.includes("生成") || normalized.includes("编写")) {
      activateModule("bid-generation");
      return `${projectLabel}我已经切到「内容编写」。系统会先生成章节框架，再逐章补齐投标内容。`;
    }
    if (normalized.includes("评审") || normalized.includes("检测") || normalized.includes("打分")) {
      activateModule("bid-review");
      return `${projectLabel}我已经切到「校核定稿」。这里可以继续检查评分风险、合规问题和废标隐患。`;
    }
    if (normalized.includes("排版") || normalized.includes("定稿")) {
      activateModule("layout-finalize");
      return `${projectLabel}我已经切到「排版导出」。可以继续整理版式，并导出送审文件。`;
    }
    if (normalized.includes("管理") || normalized.includes("中标") || normalized.includes("归档")) {
      activateModule("bid-management");
      return `${projectLabel}我已经切到「项目归档」。可以登记结果、归档成果，并沉淀后续复用资料。`;
    }
    if (normalized.includes("设置") || normalized.includes("api") || normalized.includes("模型")) {
      setSettingsOpen(true);
      return "我已打开设置。这里可以调整模型服务地址、密钥和各环节默认模型。";
    }

    return `你当前位于「${moduleLabel}」。${projectLabel}如果你愿意，我可以继续帮你解释这个模块的下一步操作，或者帮你跳到资料准备、招标分析、内容编写、校核定稿、排版导出、项目归档。`;
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

  function renderHomeWorkspace() {
    const nextResumeModule = resumeModule ?? DEFAULT_RESUME_MODULE;
    const nextResumeModuleMeta =
      WORKSPACE_MODULES.find((module) => module.id === nextResumeModule) ?? WORKSPACE_MODULES[1];
    const continueTitle = selectedProject ? selectedProject.name : "请先选择本次要处理的项目";
    const continueStep = selectedProject ? `上次停在：${nextResumeModuleMeta.label}` : "先在左侧选择项目";

    const { detail: continueDetail, cue: continueCue } = getResumeCardState({
      selectedProject: Boolean(selectedProject),
      nextResumeModule,
      nextResumeModuleMeta,
      documentsCount: documents.length,
      decompositionProgress: selectedDecompositionRun?.progress_pct ?? null,
      generationTargetSections: selectedGenerationJob?.target_sections ?? null,
      reviewBlockingIssues: selectedReviewRun?.blocking_issue_count ?? null,
      reviewScore: selectedReviewRun?.simulated_score ?? null,
      hasLayoutJob: Boolean(selectedLayoutJob),
      renderedOutputCount: renderedOutputs.length,
      submissionRecordCount: submissionRecords.length,
    });

    return (
      <section className="workspace-stack">
        <HeroPanel
          projectCount={projects.length}
          documentCount={documents.length}
          historicalBidCount={historicalBids.length}
        />

        <section className="workspace-grid workspace-grid-3">
          <TaskEntryCard
            actionLabel="进入资料准备"
            description="先上传招标文件，再补充资质、人员、设备和业绩资料。"
            onAction={() => activateModule("knowledge-library")}
            title="整理投标资料"
          />
          <TaskEntryCard
            actionLabel="进入招标分析"
            description="快速梳理资格要求、评分点、合同风险和废标条款。"
            onAction={() => activateModule("tender-analysis")}
            title="分析招标文件"
          />
          <TaskEntryCard
            actionLabel="进入内容编写"
            description="按章节生成投标内容，并结合证据与历史经验继续完善。"
            onAction={() => activateModule("bid-generation")}
            title="生成投标内容"
          />
          <TaskEntryCard
            actionLabel="进入校核定稿"
            description="检查评分项、废标风险和关键遗漏，减少提交风险。"
            onAction={() => activateModule("bid-review")}
            title="检查评分与废标风险"
          />
          <TaskEntryCard
            actionLabel="进入排版导出"
            description="整理版式、核对导出成果，准备最终提交材料。"
            onAction={() => activateModule("layout-finalize")}
            title="排版并导出"
          />
          <TaskEntryCard
            actionLabel="进入项目归档"
            description="归档成果、记录状态，并将可复用内容沉淀到后续项目。"
            onAction={() => activateModule("bid-management")}
            title="归档与复用"
          />
        </section>

        <HomeContinueCard
          actionLabel={selectedProject ? `继续${nextResumeModuleMeta.label}` : "先选择项目"}
          cueLabel={continueCue}
          detail={continueDetail}
          disabled={!selectedProject}
          onAction={() => {
            if (selectedProject) {
              activateModule(nextResumeModule);
            }
          }}
          stepLabel={continueStep}
          title={continueTitle}
        />
      </section>
    );
  }

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
              <p className="eyebrow">开始使用</p>
              <h3>登录后进入投标工作台</h3>
            </div>
            <span className="badge">需先登录</span>
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
                登录并开始处理
              </button>
            </form>

            <div className="stack">
              <div className="info-block">
                <strong>界面原则</strong>
                <p>左侧切换步骤，中间专注处理当前工作，右侧助手按需打开，设置统一收在抽屉里。</p>
              </div>
              <div className="info-block">
                <strong>默认账号</strong>
                <p>`admin@example.com` / `admin123456`</p>
                <p>`project_manager@example.com` / `manager123456`</p>
              </div>
              <div className="info-block">
                <strong>助手能帮什么</strong>
                <p>解释当前步骤、提醒下一步，并帮你快速切到资料上传、证据检索、历史复用、招标拆解、生成和校核。</p>
              </div>
            </div>
          </div>
        </section>
      </section>
    );
  }

  function renderActiveModule() {
    switch (activeModule) {
      case "home":
        return renderHomeWorkspace();
      case "knowledge-library":
        return (
          <KnowledgeLibraryView
            busyLabel={busyLabel}
            documentEvidenceUnits={documentEvidenceUnits}
            documents={documents}
            evidenceDocumentType={evidenceDocumentType}
            evidenceQuery={evidenceQuery}
            evidenceResults={evidenceResults}
            handleCreateProject={handleCreateProject}
            handleImportHistoricalBid={handleImportHistoricalBid}
            handleLoadEvidenceUnits={handleLoadEvidenceUnits}
            handleLoadHistoricalArtifacts={handleLoadHistoricalArtifacts}
            handleRebuildReuseUnits={handleRebuildReuseUnits}
            handleRebuildSections={handleRebuildSections}
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
            leakageDraftText={leakageDraftText}
            leakageForbiddenTerms={leakageForbiddenTerms}
            leakageResult={leakageResult}
            leakageReuseUnitIds={leakageReuseUnitIds}
            leakageSectionId={leakageSectionId}
            message={message}
            onActivateModule={(module) => setActiveModule(module)}
            onOpenCopilot={() => setCopilotOpen(true)}
            projectName={projectName}
            projects={projects}
            reusePack={reusePack}
            reuseSectionType={reuseSectionType}
            selectedDocument={selectedDocument}
            selectedDocumentId={selectedDocumentId}
            selectedHistoricalBid={selectedHistoricalBid}
            selectedProject={selectedProject}
            selectedProjectId={selectedProjectId}
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
            setProjectName={setProjectName}
            setReuseSectionType={setReuseSectionType}
            setSelectedHistoricalBidId={setSelectedHistoricalBidId}
            setUploadFile={setUploadFile}
            setUploadType={setUploadType}
            token={token}
            uploadType={uploadType}
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
            documentEvidenceUnits={documentEvidenceUnits}
            documents={documents}
            evidenceDocumentType={evidenceDocumentType}
            evidenceQuery={evidenceQuery}
            evidenceResults={evidenceResults}
            handleCreateProject={handleCreateProject}
            handleImportHistoricalBid={handleImportHistoricalBid}
            handleLoadEvidenceUnits={handleLoadEvidenceUnits}
            handleLoadHistoricalArtifacts={handleLoadHistoricalArtifacts}
            handleRebuildReuseUnits={handleRebuildReuseUnits}
            handleRebuildSections={handleRebuildSections}
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
            leakageDraftText={leakageDraftText}
            leakageForbiddenTerms={leakageForbiddenTerms}
            leakageResult={leakageResult}
            leakageReuseUnitIds={leakageReuseUnitIds}
            leakageSectionId={leakageSectionId}
            message={message}
            onActivateModule={(module) => setActiveModule(module)}
            onOpenCopilot={() => setCopilotOpen(true)}
            projectName={projectName}
            projects={projects}
            reusePack={reusePack}
            reuseSectionType={reuseSectionType}
            selectedDocument={selectedDocument}
            selectedDocumentId={selectedDocumentId}
            selectedHistoricalBid={selectedHistoricalBid}
            selectedProject={selectedProject}
            selectedProjectId={selectedProjectId}
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
            setProjectName={setProjectName}
            setReuseSectionType={setReuseSectionType}
            setSelectedHistoricalBidId={setSelectedHistoricalBidId}
            setUploadFile={setUploadFile}
            setUploadType={setUploadType}
            token={token}
            uploadType={uploadType}
          />
        );
    }
  }

  return (
    <>
      <AppShell
        currentView={activeModule}
        projectContext={{
          projectName: selectedProject?.name ?? null,
          deadlineLabel: "待确认",
          stageLabel: activeModule === "home" ? "等待选择下一步" : activeModuleMeta.label,
          reminderLabel: selectedProject
            ? `当前建议先完成“${activeModule === "home" ? "资料准备" : activeModuleMeta.label}”。`
            : "请先选择项目，再进入具体投标步骤。",
        }}
        showProjectContext={Boolean(token)}
        sidebar={
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
            onSelectProject={(projectId) => selectProject(projectId)}
            onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
            projects={projects}
            selectedProjectId={selectedProjectId}
            sessionReady={Boolean(token)}
            userAccountLabel={sidebarUserAccountLabel}
            userName={sidebarUserName}
          />
        }
        subtitle={activeModuleMeta.hint}
        title={activeModuleMeta.label}
      >
        {token ? renderActiveModule() : renderLoginWorkspace()}
      </AppShell>

      <SettingsDrawer
        checkingRole={checkingRole}
        connectivityResult={connectivityResult}
        connectivityRole={connectivityRole}
        disabled={!token || Boolean(busyLabel)}
        onCheckRole={handleConnectivityCheck}
        onClose={() => setSettingsOpen(false)}
        onPlatformFieldChange={(field, value) =>
          setRuntimeForm((current) => ({
            ...current,
            platformConfig: {
              ...current.platformConfig,
              [field]: value,
            },
          }))
        }
        onRoleFieldChange={(role, field, value) =>
          setRuntimeForm((current) => ({
            ...current,
            roleConfigs: {
              ...current.roleConfigs,
              [role]: {
                ...current.roleConfigs[role],
                [field]: value,
              },
            },
          }))
        }
        open={settingsOpen}
        runtimeForm={runtimeForm}
        runtimeSettings={runtimeSettings}
      />

      <CopilotPanel
        draft={copilotDraft}
        messages={copilotMessages}
        onClose={() => setCopilotOpen(false)}
        onDraftChange={setCopilotDraft}
        onSubmit={handleCopilotSubmit}
        open={copilotOpen}
      />

      {!copilotOpen ? <CopilotTrigger onClick={() => setCopilotOpen(true)} /> : null}
    </>
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
