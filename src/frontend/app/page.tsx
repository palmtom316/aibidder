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

  return (
    <main className="console-shell">
      <aside className="console-sidebar">
        <div>
          <p className="eyebrow">Local Integration</p>
          <h1>AIBidder Console</h1>
          <p className="sidebar-copy">
            本地联调用于验证登录、项目、文档、证据、历史标书复用和 BYOK 运行时设置。
          </p>
        </div>
        <div className="status-card">
          <span className="status-dot" />
          <div>
            <strong>{busyLabel || "就绪"}</strong>
            <p>{message}</p>
          </div>
        </div>
        <div className="seed-box">
          <strong>默认账号</strong>
          <p>admin@example.com / admin123456</p>
          <p>project_manager@example.com / manager123456</p>
        </div>
        {token ? (
          <button className="ghost-button" onClick={handleLogout} type="button">
            退出登录
          </button>
        ) : null}
      </aside>

      <section className="console-main">
        <div className="hero-panel">
          <div>
            <p className="eyebrow">Workbench</p>
            <h2>前后端与数据库联调工作台</h2>
            <p>
              当前重点是把投标资料库、招标解析、标书生成、标书检测、排版定稿和标书管理六个模块挂到同一套前后端和数据库上，并保留证据检索与历史标书复用闭环。
            </p>
          </div>
          <div className="hero-stats">
            <div>
              <span>项目</span>
              <strong>{projects.length}</strong>
            </div>
            <div>
              <span>文档</span>
              <strong>{documents.length}</strong>
            </div>
            <div>
              <span>历史标书</span>
              <strong>{historicalBids.length}</strong>
            </div>
          </div>
        </div>

        <section className="module-strip">
          {(workbenchOverview?.modules ?? []).map((module) => (
            <article className="module-card" key={module.module_key}>
              <div className="module-card-header">
                <strong>{module.title}</strong>
                <span className={`badge ${module.status === "ready" ? "badge-success" : ""}`}>
                  {module.status}
                </span>
              </div>
              <p>{module.description}</p>
              <div className="module-card-footer">
                <span>{module.module_key}</span>
                <strong>{module.count}</strong>
              </div>
            </article>
          ))}
        </section>

        <div className="panel-grid">
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Auth</p>
                <h3>登录</h3>
              </div>
              <span className={`badge ${token ? "badge-success" : ""}`}>{token ? "已登录" : "未登录"}</span>
            </div>
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
              <button className="primary-button" type="submit" disabled={Boolean(busyLabel)}>
                登录并载入控制台
              </button>
            </form>
          </section>

          <section className="panel panel-span-2">
            <div className="panel-header">
              <div>
                <p className="eyebrow">BYOK</p>
                <h3>运行时模型设置</h3>
              </div>
              <span className="badge">{runtimeForm.provider}</span>
            </div>
            <form className="stack" onSubmit={handleConnectivityCheck}>
              <div className="two-column">
                <label>
                  Provider
                  <input
                    value={runtimeForm.provider}
                    onChange={(event) =>
                      setRuntimeForm((current) => ({ ...current, provider: event.target.value }))
                    }
                  />
                </label>
                <label>
                  API Base URL
                  <input
                    value={runtimeForm.apiBaseUrl}
                    onChange={(event) =>
                      setRuntimeForm((current) => ({ ...current, apiBaseUrl: event.target.value }))
                    }
                  />
                </label>
              </div>
              <div className="two-column">
                <label>
                  API Key
                  <input
                    autoComplete="new-password"
                    type="password"
                    value={runtimeForm.apiKey}
                    placeholder={runtimeSettings?.api_key_configured ? "后端已配置，可覆盖" : "输入调试用 BYOK"}
                    onChange={(event) =>
                      setRuntimeForm((current) => ({ ...current, apiKey: event.target.value }))
                    }
                  />
                </label>
                <label>
                  连通性校验角色
                  <select
                    value={runtimeForm.selectedRole}
                    onChange={(event) =>
                      setRuntimeForm((current) => ({
                        ...current,
                        selectedRole: event.target.value as RuntimeFormState["selectedRole"],
                      }))
                    }
                  >
                    {Object.keys(runtimeForm.defaultModels).map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="role-grid">
                {Object.entries(runtimeForm.defaultModels).map(([role, model]) => (
                  <label key={role}>
                    {role}
                    <input
                      value={model}
                      onChange={(event) =>
                        setRuntimeForm((current) => ({
                          ...current,
                          defaultModels: {
                            ...current.defaultModels,
                            [role]: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
              <button className="primary-button" type="submit" disabled={!token || Boolean(busyLabel)}>
                运行模型连通性检查
              </button>
              {connectivityResult ? (
                <div className={`message-box ${connectivityResult.ok ? "message-success" : "message-warning"}`}>
                  <strong>{connectivityResult.ok ? "连通成功" : "连通失败"}</strong>
                  <p>
                    {connectivityResult.model} · {connectivityResult.message}
                  </p>
                </div>
              ) : null}
            </form>
          </section>

          <section className="panel">
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
              <button className="primary-button" type="submit" disabled={!token || Boolean(busyLabel)}>
                创建
              </button>
            </form>
            <label>
              当前项目
              <select
                value={selectedProjectId ?? ""}
                onChange={(event) => setSelectedProjectId(Number(event.target.value) || null)}
              >
                <option value="">请选择项目</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.id} · {project.name}
                  </option>
                ))}
              </select>
            </label>
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
                  <input
                    type="file"
                    onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
              <button
                className="primary-button"
                type="submit"
                disabled={!token || !selectedProjectId || !uploadFile || Boolean(busyLabel)}
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

          <section className="panel panel-span-2">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Knowledge Library</p>
                <h3>投标资料库</h3>
              </div>
              <span className="badge">{knowledgeBaseEntries.length} 条资料</span>
            </div>
            <form className="stack" onSubmit={handleCreateLibraryEntry}>
              <div className="three-column">
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
                type="submit"
                disabled={!token || !selectedProjectId || !libraryTitle.trim() || Boolean(busyLabel)}
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
                    <button
                      className="ghost-button"
                      onClick={() => void handleRunLibraryCheck(entry.id)}
                      type="button"
                    >
                      运行检测
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel panel-span-3">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Pipelines</p>
                <h3>招标解析、标书生成、标书检测、排版定稿、标书管理</h3>
              </div>
              <span className="badge">{selectedProject ? selectedProject.name : "未选择项目"}</span>
            </div>
            <div className="workbench-grid">
              <form className="stack workbench-card" onSubmit={handleCreateDecompositionRun}>
                <div className="panel-header compact">
                  <div>
                    <p className="eyebrow">招标解析</p>
                    <h4>Decomposition</h4>
                  </div>
                  <span className="badge">{decompositionRuns.length}</span>
                </div>
                <label>
                  任务名
                  <input value={decompositionRunName} onChange={(event) => setDecompositionRunName(event.target.value)} />
                </label>
                <button className="primary-button" type="submit" disabled={!token || !selectedProjectId || Boolean(busyLabel)}>
                  创建解析任务
                </button>
                <div className="mini-list">
                  {decompositionRuns.map((row) => (
                    <div className="mini-item" key={row.id}>
                      <strong>{row.run_name}</strong>
                      <span>{row.status}</span>
                    </div>
                  ))}
                </div>
              </form>

              <form className="stack workbench-card" onSubmit={handleCreateGenerationJob}>
                <div className="panel-header compact">
                  <div>
                    <p className="eyebrow">标书生成</p>
                    <h4>Generation</h4>
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
                    type="number"
                    min="0"
                    value={generationTargetSections}
                    onChange={(event) => setGenerationTargetSections(event.target.value)}
                  />
                </label>
                <button className="primary-button" type="submit" disabled={!token || !selectedProjectId || Boolean(busyLabel)}>
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

              <form className="stack workbench-card" onSubmit={handleCreateReviewRun}>
                <div className="panel-header compact">
                  <div>
                    <p className="eyebrow">标书检测</p>
                    <h4>Review</h4>
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
                <button className="primary-button" type="submit" disabled={!token || !selectedProjectId || Boolean(busyLabel)}>
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

              <form className="stack workbench-card" onSubmit={handleCreateLayoutJob}>
                <div className="panel-header compact">
                  <div>
                    <p className="eyebrow">排版定稿</p>
                    <h4>Layout</h4>
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
                <button className="primary-button" type="submit" disabled={!token || !selectedProjectId || Boolean(busyLabel)}>
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

              <form className="stack workbench-card" onSubmit={handleCreateSubmissionRecord}>
                <div className="panel-header compact">
                  <div>
                    <p className="eyebrow">标书管理</p>
                    <h4>Submission</h4>
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
                <button className="primary-button" type="submit" disabled={!token || !selectedProjectId || Boolean(busyLabel)}>
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

          <section className="panel panel-span-2">
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
                  <select
                    value={evidenceDocumentType}
                    onChange={(event) => setEvidenceDocumentType(event.target.value)}
                  >
                    <option value="">全部真值文档</option>
                    <option value="tender">tender</option>
                    <option value="norm">norm</option>
                  </select>
                </label>
                <div className="align-end">
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={!token || !selectedProjectId || !evidenceQuery.trim() || Boolean(busyLabel)}
                  >
                    检索 evidence
                  </button>
                </div>
              </div>
            </form>
            <div className="two-column-layout">
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

          <section className="panel">
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
                  <input
                    value={historicalSourceType}
                    onChange={(event) => setHistoricalSourceType(event.target.value)}
                  />
                </label>
                <label>
                  project_type
                  <input
                    value={historicalProjectType}
                    onChange={(event) => setHistoricalProjectType(event.target.value)}
                  />
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
              <button className="primary-button" type="submit" disabled={!token || !importDocumentId || Boolean(busyLabel)}>
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

          <section className="panel panel-span-2">
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
                  <input
                    value={historicalProjectType}
                    onChange={(event) => setHistoricalProjectType(event.target.value)}
                  />
                </label>
                <label>
                  section_type
                  <input value={reuseSectionType} onChange={(event) => setReuseSectionType(event.target.value)} />
                </label>
                <div className="align-end">
                  <button className="primary-button" type="submit" disabled={!token || Boolean(busyLabel)}>
                    检索 reuse pack
                  </button>
                </div>
              </div>
            </form>
            <div className="three-column-layout">
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
                <textarea
                  rows={5}
                  value={leakageDraftText}
                  onChange={(event) => setLeakageDraftText(event.target.value)}
                />
              </label>
              <button className="primary-button" type="submit" disabled={!token || !selectedProjectId || Boolean(busyLabel)}>
                校验历史污染
              </button>
              {leakageResult ? (
                <div className={`message-box ${leakageResult.ok ? "message-success" : "message-warning"}`}>
                  <strong>{leakageResult.ok ? "未命中旧项目痕迹" : "命中历史污染"}</strong>
                  <p>{leakageResult.matched_terms.join("、") || "无"}</p>
                </div>
              ) : null}
            </form>
            <div className="two-column-layout">
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

      <style jsx>{`
        .console-shell {
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 24px;
          min-height: 100vh;
          padding: 24px;
        }

        .console-sidebar {
          display: flex;
          flex-direction: column;
          gap: 20px;
          padding: 28px;
          border: 1px solid var(--line);
          border-radius: 28px;
          background: rgba(20, 29, 46, 0.94);
          color: white;
          box-shadow: var(--shadow);
        }

        .sidebar-copy,
        .seed-box p,
        .status-card p {
          color: rgba(255, 255, 255, 0.72);
        }

        .status-card,
        .seed-box {
          display: flex;
          gap: 12px;
          padding: 16px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.06);
        }

        .status-dot {
          width: 12px;
          height: 12px;
          margin-top: 5px;
          border-radius: 50%;
          background: #53d58d;
          box-shadow: 0 0 0 6px rgba(83, 213, 141, 0.18);
        }

        .console-main {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .hero-panel,
        .panel {
          border: 1px solid var(--line);
          border-radius: 28px;
          padding: 24px;
          background: var(--panel);
          backdrop-filter: blur(14px);
          box-shadow: var(--shadow);
        }

        .hero-panel {
          display: flex;
          justify-content: space-between;
          gap: 24px;
          background: linear-gradient(135deg, rgba(255, 252, 246, 0.95), rgba(236, 242, 255, 0.9));
        }

        .hero-panel p {
          max-width: 680px;
        }

        .hero-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(96px, 1fr));
          gap: 12px;
          min-width: 300px;
        }

        .hero-stats div {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 16px;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.72);
          border: 1px solid rgba(33, 96, 255, 0.08);
        }

        .hero-stats span,
        .badge,
        .eyebrow {
          color: var(--muted);
          font-size: 0.78rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .hero-stats strong {
          font-size: 2rem;
        }

        .panel-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 20px;
        }

        .panel-span-2 {
          grid-column: span 2;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: start;
          margin-bottom: 18px;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 12px;
          border-radius: 999px;
          background: var(--accent-soft);
          color: var(--accent);
        }

        .badge-success {
          background: rgba(27, 156, 103, 0.14);
          color: var(--success);
        }

        .stack {
          display: grid;
          gap: 14px;
        }

        .inline-form,
        .button-row,
        .two-column,
        .three-column,
        .role-grid,
        .two-column-layout,
        .three-column-layout {
          display: grid;
          gap: 12px;
        }

        .inline-form {
          grid-template-columns: 1fr auto;
          margin-bottom: 12px;
        }

        .button-row {
          grid-template-columns: repeat(3, 1fr);
          margin: 12px 0;
        }

        .two-column {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .three-column {
          grid-template-columns: 1.6fr 1fr auto;
          align-items: end;
        }

        .two-column-layout {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          margin-top: 16px;
        }

        .three-column-layout {
          grid-template-columns: repeat(3, minmax(0, 1fr));
          margin: 16px 0;
        }

        .role-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        label {
          display: grid;
          gap: 8px;
          color: var(--muted);
          font-size: 0.92rem;
        }

        input,
        select,
        textarea {
          width: 100%;
          border: 1px solid var(--line);
          border-radius: 16px;
          padding: 12px 14px;
          background: var(--panel-strong);
          color: var(--ink);
        }

        textarea {
          resize: vertical;
        }

        .primary-button,
        .ghost-button {
          border-radius: 16px;
          padding: 12px 16px;
          border: 1px solid transparent;
          transition: 160ms ease;
        }

        .primary-button {
          background: linear-gradient(135deg, #2160ff, #55a4ff);
          color: white;
          box-shadow: 0 12px 24px rgba(33, 96, 255, 0.24);
        }

        .ghost-button {
          background: transparent;
          border-color: var(--line);
          color: inherit;
        }

        .primary-button:disabled,
        .ghost-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .list {
          display: grid;
          gap: 10px;
          margin-top: 12px;
          max-height: 340px;
          overflow: auto;
        }

        .list-item {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: center;
          padding: 14px 16px;
          border-radius: 18px;
          border: 1px solid var(--line);
          background: rgba(255, 255, 255, 0.72);
          text-align: left;
        }

        .list-item p,
        .result-card p,
        .message-box p {
          margin: 4px 0 0;
          color: var(--muted);
        }

        .list-item-active {
          border-color: rgba(33, 96, 255, 0.3);
          background: rgba(33, 96, 255, 0.08);
        }

        .scroll-box {
          max-height: 360px;
          overflow: auto;
          display: grid;
          gap: 10px;
          align-content: start;
        }

        .result-card {
          border: 1px solid var(--line);
          border-radius: 18px;
          padding: 14px;
          background: rgba(255, 255, 255, 0.72);
        }

        .result-card header {
          display: flex;
          justify-content: space-between;
          gap: 10px;
        }

        .message-box {
          padding: 14px 16px;
          border-radius: 18px;
          border: 1px solid transparent;
        }

        .message-success {
          background: rgba(27, 156, 103, 0.1);
          border-color: rgba(27, 156, 103, 0.2);
        }

        .message-warning {
          background: rgba(190, 106, 0, 0.1);
          border-color: rgba(190, 106, 0, 0.18);
        }

        .checkbox-row {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .checkbox-row input {
          width: auto;
        }

        .align-end {
          display: flex;
          align-items: end;
        }

        @media (max-width: 1280px) {
          .console-shell {
            grid-template-columns: 1fr;
          }

          .panel-grid,
          .two-column-layout,
          .three-column-layout,
          .three-column,
          .role-grid,
          .hero-panel {
            grid-template-columns: 1fr;
          }

          .panel-span-2 {
            grid-column: span 1;
          }
        }
      `}</style>
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
