"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  ApiError,
  createDecompositionRun,
  createGenerationJob,
  createKnowledgeBaseEntry,
  createLayoutJob,
  createProject,
  createReviewRun,
  createSubmissionRecord,
  DecompositionRun,
  DocumentRecord,
  GenerationJob,
  getRuntimeSettings,
  HistoricalBid,
  HistoricalBidSection,
  HistoricalReusePack,
  HistoricalReuseUnit,
  KnowledgeBaseEntry,
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
  uploadDocument,
  verifyHistoricalLeakage,
  importHistoricalBid,
  rebuildHistoricalSections,
  rebuildHistoricalReuseUnits,
  EvidenceSearchResult,
  EvidenceUnit,
  getWorkbenchOverview,
  WorkbenchOverview,
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

type WorkspaceModule =
  | "overview"
  | "documents"
  | "evidence"
  | "historical"
  | "decomposition"
  | "generation-review";

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
  { id: "overview", label: "项目总览", hint: "当前项目与任务概况", shortLabel: "总" },
  { id: "documents", label: "文档上传", hint: "项目、文档、资料库", shortLabel: "文" },
  { id: "evidence", label: "证据检索", hint: "真值证据与命中定位", shortLabel: "证" },
  { id: "historical", label: "历史复用", hint: "历史标书与污染校验", shortLabel: "史" },
  { id: "decomposition", label: "招标拆解", hint: "解析任务与拆解流程", shortLabel: "拆" },
  { id: "generation-review", label: "生成与复核", hint: "生成、检测、排版、管理", shortLabel: "生" },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function Home() {
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
  const [generationJobs, setGenerationJobs] = useState<GenerationJob[]>([]);
  const [reviewRuns, setReviewRuns] = useState<ReviewRun[]>([]);
  const [layoutJobs, setLayoutJobs] = useState<LayoutJob[]>([]);
  const [submissionRecords, setSubmissionRecords] = useState<SubmissionRecord[]>([]);
  const [libraryCategory, setLibraryCategory] = useState("excellent_bid");
  const [libraryTitle, setLibraryTitle] = useState("2026 输变电优秀标书");
  const [libraryOwnerName, setLibraryOwnerName] = useState("市场经营中心");
  const [decompositionRunName, setDecompositionRunName] = useState("招标文件七类拆解");
  const [generationJobName, setGenerationJobName] = useState("技术标初稿生成");
  const [generationTargetSections, setGenerationTargetSections] = useState("7");
  const [reviewRunName, setReviewRunName] = useState("模拟打分与合规复核");
  const [reviewMode, setReviewMode] = useState("simulated_scoring");
  const [layoutJobName, setLayoutJobName] = useState("企业模板排版");
  const [layoutTemplateName, setLayoutTemplateName] = useState("corporate-default");
  const [submissionTitle, setSubmissionTitle] = useState("投标文件回灌记录");
  const [submissionStatus, setSubmissionStatus] = useState("draft");

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
  const [activeModule, setActiveModule] = useState<WorkspaceModule>("overview");
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

  const activeModuleMeta = useMemo(
    () => WORKSPACE_MODULES.find((module) => module.id === activeModule) ?? WORKSPACE_MODULES[0],
    [activeModule],
  );

  useEffect(() => {
    const storedToken = getStoredToken();
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

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
      setDecompositionRuns([]);
      setGenerationJobs([]);
      setReviewRuns([]);
      setLayoutJobs([]);
      setSubmissionRecords([]);
      return;
    }
    void refreshWorkbench(token, selectedProjectId ?? undefined);
  }, [token, selectedProjectId]);

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

  async function refreshWorkbench(activeToken: string, projectId?: number) {
    try {
      const [
        overview,
        libraryRows,
        decompositionRows,
        generationRows,
        reviewRows,
        layoutRows,
        submissionRows,
      ] = await Promise.all([
        getWorkbenchOverview(activeToken, projectId),
        listKnowledgeBaseEntries(activeToken, projectId),
        listDecompositionRuns(activeToken, projectId),
        listGenerationJobs(activeToken, projectId),
        listReviewRuns(activeToken, projectId),
        listLayoutJobs(activeToken, projectId),
        listSubmissionRecords(activeToken, projectId),
      ]);
      setWorkbenchOverview(overview);
      setKnowledgeBaseEntries(libraryRows);
      setDecompositionRuns(decompositionRows);
      setGenerationJobs(generationRows);
      setReviewRuns(reviewRows);
      setLayoutJobs(layoutRows);
      setSubmissionRecords(submissionRows);
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

  async function handleCreateDecompositionRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedProjectId || !decompositionRunName.trim()) {
      return;
    }
    try {
      setBusyLabel("正在创建招标解析任务");
      await createDecompositionRun(token, {
        project_id: selectedProjectId,
        source_document_id: selectedDocumentId ?? undefined,
        run_name: decompositionRunName.trim(),
      });
      await refreshWorkbench(token, selectedProjectId);
      setMessage("招标解析任务已加入工作台。");
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
      await createGenerationJob(token, {
        project_id: selectedProjectId,
        source_document_id: selectedDocumentId ?? undefined,
        job_name: generationJobName.trim(),
        target_sections: Number(generationTargetSections) || 0,
      });
      await refreshWorkbench(token, selectedProjectId);
      setMessage("标书生成任务已加入工作台。");
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
      setBusyLabel("正在创建标书检测任务");
      await createReviewRun(token, {
        project_id: selectedProjectId,
        source_document_id: selectedDocumentId ?? undefined,
        run_name: reviewRunName.trim(),
        review_mode: reviewMode.trim(),
      });
      await refreshWorkbench(token, selectedProjectId);
      setMessage("标书检测任务已加入工作台。");
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
      await createLayoutJob(token, {
        project_id: selectedProjectId,
        source_document_id: selectedDocumentId ?? undefined,
        job_name: layoutJobName.trim(),
        template_name: layoutTemplateName.trim(),
      });
      await refreshWorkbench(token, selectedProjectId);
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

    if (normalized.includes("上传")) {
      setActiveModule("documents");
      return `${projectLabel}我已经把你带到「文档上传」模块，建议先完成项目选择，再上传招标文件或规范文件。`;
    }
    if (normalized.includes("证据")) {
      setActiveModule("evidence");
      return `${projectLabel}我已经切到「证据检索」模块。你可以先选择文档，再检索工期、资格要求、质量目标等真值信息。`;
    }
    if (normalized.includes("历史")) {
      setActiveModule("historical");
      return `${projectLabel}我已经切到「历史复用」模块。这里适合做历史标书导入、reuse pack 检索和污染校验。`;
    }
    if (normalized.includes("设置") || normalized.includes("api") || normalized.includes("模型")) {
      setSettingsOpen(true);
      return "我已打开设置抽屉。运行时 Provider、Base URL、API Key 和角色模型都收纳在这里。";
    }

    return `你当前位于「${moduleLabel}」。${projectLabel}如果你愿意，我可以继续帮你解释这个模块的下一步操作，或者直接帮你跳到上传、证据检索、历史复用、招标拆解、生成与复核。`;
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
      case "go-documents":
        setActiveModule("documents");
        appendCopilotMessage("assistant", "已切换到「文档上传」模块。你可以先创建/选择项目，再上传文档。");
        break;
      case "go-evidence":
        setActiveModule("evidence");
        appendCopilotMessage("assistant", "已切换到「证据检索」模块。建议先点击一份文档查看已抽取的 evidence units。");
        break;
      case "go-historical":
        setActiveModule("historical");
        appendCopilotMessage("assistant", "已切换到「历史复用」模块。这里可以完成历史标书导入、重建与污染校验。");
        break;
      case "go-decomposition":
        setActiveModule("decomposition");
        appendCopilotMessage("assistant", "已切换到「招标拆解」模块。这里聚焦解析任务与拆解流程。");
        break;
      case "go-generation":
        setActiveModule("generation-review");
        appendCopilotMessage("assistant", "已切换到「生成与复核」模块。这里包含生成、检测、排版与提交管理。");
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
    { id: "go-documents", label: "去上传文档" },
    { id: "go-evidence", label: "去查证据" },
    { id: "go-historical", label: "去看历史复用" },
    { id: "go-decomposition", label: "去看招标拆解" },
    { id: "go-generation", label: "去看生成与复核" },
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
              <button className="ghost-button" onClick={() => setActiveModule("documents")} type="button">
                去上传文档
              </button>
              <button className="ghost-button" onClick={() => setActiveModule("evidence")} type="button">
                去查证据
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
    return (
      <section className="workspace-stack">
        <div className="workspace-grid workspace-grid-2">
          <section className="surface-card">
            <div className="panel-header compact">
              <div>
                <p className="eyebrow">招标解析</p>
                <h3>Decomposition</h3>
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
                <div className="mini-item" key={row.id}>
                  <strong>{row.run_name}</strong>
                  <span>{row.status}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="surface-card">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Risk & Context</p>
                <h3>拆解工作台提示</h3>
              </div>
            </div>
            <div className="stack">
              <div className="info-block">
                <strong>当前项目</strong>
                <p>{selectedProject ? selectedProject.name : "未选择项目"}</p>
              </div>
              <div className="info-block">
                <strong>当前文档</strong>
                <p>{selectedDocument ? selectedDocument.filename : "建议先在文档上传模块选定招标文件"}</p>
              </div>
              <div className="info-block">
                <strong>Copilot 可帮助</strong>
                <p>解释拆解状态、跳转证据检索、提示下一步补齐动作。</p>
              </div>
            </div>
          </section>
        </div>
      </section>
    );
  }

  function renderGenerationReviewModule() {
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
            <div className="mini-list">
              {generationJobs.map((row) => (
                <div className="mini-item" key={row.id}>
                  <strong>{row.job_name}</strong>
                  <span>{row.status}</span>
                </div>
              ))}
            </div>
          </form>

          <form className="surface-card stack" onSubmit={handleCreateReviewRun}>
            <div className="panel-header compact">
              <div>
                <p className="eyebrow">标书检测</p>
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
                <option value="simulated_scoring">simulated_scoring</option>
                <option value="compliance_review">compliance_review</option>
              </select>
            </label>
            <button className="primary-button" disabled={!token || !selectedProjectId || Boolean(busyLabel)} type="submit">
              创建检测任务
            </button>
            <div className="mini-list">
              {reviewRuns.map((row) => (
                <div className="mini-item" key={row.id}>
                  <strong>{row.run_name}</strong>
                  <span>{row.review_mode}</span>
                </div>
              ))}
            </div>
          </form>

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
            <div className="mini-list">
              {layoutJobs.map((row) => (
                <div className="mini-item" key={row.id}>
                  <strong>{row.job_name}</strong>
                  <span>{row.template_name}</span>
                </div>
              ))}
            </div>
          </form>

          <form className="surface-card stack" onSubmit={handleCreateSubmissionRecord}>
            <div className="panel-header compact">
              <div>
                <p className="eyebrow">标书管理</p>
                <h3>Submission</h3>
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
                <option value="draft">draft</option>
                <option value="ready_for_submission">ready_for_submission</option>
                <option value="submitted">submitted</option>
                <option value="archived">archived</option>
              </select>
            </label>
            <button className="primary-button" disabled={!token || !selectedProjectId || Boolean(busyLabel)} type="submit">
              创建管理记录
            </button>
            <div className="mini-list">
              {submissionRecords.map((row) => (
                <div className="mini-item" key={row.id}>
                  <strong>{row.title}</strong>
                  <span>{row.status}</span>
                </div>
              ))}
            </div>
          </form>
        </div>
      </section>
    );
  }

  function renderActiveModule() {
    switch (activeModule) {
      case "documents":
        return renderDocumentsModule();
      case "evidence":
        return renderEvidenceModule();
      case "historical":
        return renderHistoricalModule();
      case "decomposition":
        return renderDecompositionModule();
      case "generation-review":
        return renderGenerationReviewModule();
      case "overview":
      default:
        return renderOverviewModule();
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
        onSelectModule={(moduleId) => setActiveModule(moduleId as WorkspaceModule)}
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
