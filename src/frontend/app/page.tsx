"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  ApiError,
  createProject,
  DocumentRecord,
  getRuntimeSettings,
  HistoricalBid,
  HistoricalBidSection,
  HistoricalLeakageResult,
  HistoricalReusePack,
  HistoricalReuseUnit,
  importHistoricalBid,
  listDocuments,
  listHistoricalBids,
  listHistoricalReuseUnits,
  listHistoricalSections,
  listProjects,
  login,
  Project,
  rebuildHistoricalReuseUnits,
  rebuildHistoricalSections,
  runConnectivityCheck,
  RuntimeConnectivityResult,
  RuntimeSettings,
  searchHistoricalReuse,
  uploadDocument,
  verifyHistoricalLeakage,
} from "../lib/api";
import { AppShell } from "../components/app-shell";
import { CopilotPanel } from "../components/copilot-panel";
import { CopilotTrigger } from "../components/copilot-trigger";
import { SettingsDrawer } from "../components/settings-drawer";
import { WorkspaceSidebar } from "../components/workspace-sidebar";
import { KnowledgeLibraryView } from "../components/workspace-views";
import {
  PROJECT_ID_QUERY_PARAM,
  WORKSPACE_MODULES,
  buildModuleHref,
  parseProjectIdParam,
  type WorkspaceModule,
} from "../components/workspace-views/shared";
import { clearStoredToken, getStoredToken, setStoredToken } from "../lib/session";

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

type CopilotMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
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

export function WorkspaceHome({ forcedModule }: { forcedModule?: WorkspaceModule } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdFromUrl = parseProjectIdParam(searchParams.get(PROJECT_ID_QUERY_PARAM));

  const [token, setToken] = useState<string | null>(null);
  const [message, setMessage] = useState("请先登录，再进入投标资料库。");
  const [busyLabel, setBusyLabel] = useState("");
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
  const [uploadType, setUploadType] = useState("proposal");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [historicalBids, setHistoricalBids] = useState<HistoricalBid[]>([]);
  const [selectedHistoricalBidId, setSelectedHistoricalBidId] = useState<number | null>(null);
  const [historicalSections, setHistoricalSections] = useState<HistoricalBidSection[]>([]);
  const [historicalReuseUnits, setHistoricalReuseUnits] = useState<HistoricalReuseUnit[]>([]);
  const [importDocumentId, setImportDocumentId] = useState<number | null>(null);
  const [historicalSourceType, setHistoricalSourceType] = useState("won_bid");
  const [historicalProjectType, setHistoricalProjectType] = useState("配网工程");
  const [historicalRegion, setHistoricalRegion] = useState("华东");
  const [historicalYear, setHistoricalYear] = useState(String(new Date().getFullYear()));
  const [historicalRecommended, setHistoricalRecommended] = useState(true);
  const [reuseSectionType, setReuseSectionType] = useState("quality_assurance");
  const [reusePack, setReusePack] = useState<HistoricalReusePack | null>(null);
  const [leakageSectionId, setLeakageSectionId] = useState("draft-1");
  const [leakageDraftText, setLeakageDraftText] = useState("");
  const [leakageForbiddenTerms, setLeakageForbiddenTerms] = useState("");
  const [leakageReuseUnitIds, setLeakageReuseUnitIds] = useState("");
  const [leakageResult, setLeakageResult] = useState<HistoricalLeakageResult | null>(null);

  const [activeModule, setActiveModule] = useState<WorkspaceModule>(forcedModule ?? "home");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotDraft, setCopilotDraft] = useState("");
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );
  const selectedHistoricalBid = useMemo(
    () => historicalBids.find((item) => item.id === selectedHistoricalBidId) ?? null,
    [historicalBids, selectedHistoricalBidId],
  );
  const activeModuleMeta = useMemo(
    () => WORKSPACE_MODULES.find((module) => module.id === activeModule) ?? WORKSPACE_MODULES[0],
    [activeModule],
  );

  function activateModule(module: WorkspaceModule, projectId = selectedProjectId) {
    setActiveModule(module);
    router.push(buildModuleHref(module, projectId));
  }

  function selectProject(projectId: number | null) {
    setSelectedProjectId(projectId);
    router.replace(buildModuleHref(activeModule, projectId));
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
      setProjects([]);
      setDocuments([]);
      setHistoricalBids([]);
      setSelectedHistoricalBidId(null);
      setHistoricalSections([]);
      setHistoricalReuseUnits([]);
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

  async function hydrateConsole(activeToken: string) {
    try {
      const [runtime, projectRows, historicalRows] = await Promise.all([
        getRuntimeSettings(activeToken),
        listProjects(activeToken),
        listHistoricalBids(activeToken),
      ]);
      setRuntimeSettings(runtime);
      setRuntimeForm((current) => ({
        platformConfig: {
          provider: current.platformConfig.provider || runtime.platform_config.provider || "openai_compatible",
          apiBaseUrl: runtime.platform_config.api_base_url ?? DEFAULT_RUNTIME_API_BASE_URL,
          apiKey: current.platformConfig.apiKey,
        },
        roleConfigs: buildRuntimeRoleConfigs(
          runtime.default_models,
          runtime.platform_config.api_base_url ?? DEFAULT_RUNTIME_API_BASE_URL,
          current.roleConfigs,
        ),
      }));
      setProjects(projectRows);
      setHistoricalBids(historicalRows);
      setSelectedProjectId((current) => current ?? projectRows[0]?.id ?? null);
      setSelectedHistoricalBidId((current) => current ?? historicalRows[0]?.id ?? null);
      setMessage("投标资料库已同步。");
    } catch (error) {
      setMessage(readError(error));
    }
  }

  async function refreshDocuments(activeToken: string, projectId: number) {
    try {
      const rows = await listDocuments(activeToken, projectId);
      setDocuments(rows);
      setImportDocumentId((current) => current ?? rows[0]?.id ?? null);
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
      setMessage("已登录，正在加载投标资料库。");
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusyLabel("");
    }
  }

  function handleLogout() {
    clearStoredToken();
    setToken(null);
    setMessage("已退出登录。");
  }

  async function handleConnectivityCheck(role: RuntimeRole | "platform") {
    if (!token) {
      return;
    }
    setCheckingRole(role);
    setConnectivityRole(role);
    try {
      if (role === "platform") {
        const payload = await runConnectivityCheck(token, {
          provider: runtimeForm.platformConfig.provider,
          api_base_url: runtimeForm.platformConfig.apiBaseUrl,
          api_key: runtimeForm.platformConfig.apiKey,
          model: runtimeForm.roleConfigs.ocr_role.model,
        });
        setConnectivityResult(payload);
        return;
      }
      const roleConfig = runtimeForm.roleConfigs[role];
      const payload = await runConnectivityCheck(token, {
        provider: runtimeForm.platformConfig.provider,
        api_base_url: roleConfig.apiBaseUrl || runtimeForm.platformConfig.apiBaseUrl,
        api_key: roleConfig.apiKey || runtimeForm.platformConfig.apiKey,
        model: roleConfig.model,
      });
      setConnectivityResult(payload);
    } catch (error) {
      setConnectivityResult({
        ok: false,
        provider: runtimeForm.platformConfig.provider,
        api_base_url: runtimeForm.platformConfig.apiBaseUrl,
        api_key_configured: false as never,
        model: role === "platform" ? runtimeForm.roleConfigs.ocr_role.model : runtimeForm.roleConfigs[role].model,
        status_code: error instanceof ApiError ? error.status : null,
        message: readError(error),
      } as RuntimeConnectivityResult);
    } finally {
      setCheckingRole(null);
    }
  }

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !projectName.trim()) {
      return;
    }
    try {
      setBusyLabel("正在创建项目");
      const created = await createProject(token, projectName.trim());
      await hydrateConsole(token);
      selectProject(created.id);
      setProjectName("");
      setMessage(`项目「${created.name}」已创建。`);
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
      setMessage("文档已上传。");
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
      setBusyLabel("正在导入历史样本");
      await importHistoricalBid(token, {
        document_id: importDocumentId,
        source_type: historicalSourceType,
        project_type: historicalProjectType,
        region: historicalRegion,
        year: Number(historicalYear) || new Date().getFullYear(),
        is_recommended: historicalRecommended,
      });
      const rows = await listHistoricalBids(token);
      setHistoricalBids(rows);
      setSelectedHistoricalBidId(rows[0]?.id ?? null);
      setMessage("历史样本已导入。");
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
      setBusyLabel("正在刷新历史样本");
      const [sections, reuseUnits] = await Promise.all([
        listHistoricalSections(token, selectedHistoricalBidId),
        listHistoricalReuseUnits(token, selectedHistoricalBidId),
      ]);
      setHistoricalSections(sections);
      setHistoricalReuseUnits(reuseUnits);
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
      setMessage("历史章节已重建。");
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
      setBusyLabel("正在重建复用片段");
      const rows = await rebuildHistoricalReuseUnits(token, selectedHistoricalBidId);
      setHistoricalReuseUnits(rows);
      setMessage("复用片段已重建。");
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function handleSearchReuse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }
    try {
      setBusyLabel("正在检索复用片段");
      const pack = await searchHistoricalReuse(token, historicalProjectType.trim(), reuseSectionType.trim());
      setReusePack(pack);
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusyLabel("");
    }
  }

  async function handleVerifyLeakage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedProjectId) {
      return;
    }
    try {
      setBusyLabel("正在校验历史污染");
      const result = await verifyHistoricalLeakage(token, selectedProjectId, leakageSectionId, {
        draft_text: leakageDraftText,
        forbidden_legacy_terms: leakageForbiddenTerms
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        history_candidate_pack: {
          reuse_unit_ids: leakageReuseUnitIds
            .split(",")
            .map((item) => Number(item.trim()))
            .filter((value) => Number.isInteger(value) && value > 0),
        },
      });
      setLeakageResult(result);
    } catch (error) {
      setMessage(readError(error));
    } finally {
      setBusyLabel("");
    }
  }

  function buildCopilotReply(prompt: string) {
    const normalized = prompt.trim().toLowerCase();
    if (normalized.includes("设置") || normalized.includes("api") || normalized.includes("模型")) {
      setSettingsOpen(true);
      return "我已打开设置。这里可以检查模型服务和接口配置。";
    }
    activateModule("knowledge-library");
    return "我已切到投标资料库。你可以继续整理历史标书、规范规程和企业事实资料。";
  }

  function appendCopilotMessage(role: CopilotMessage["role"], text: string) {
    setCopilotMessages((current) => [
      ...current,
      {
        id: `${role}-${Date.now()}-${current.length}`,
        role,
        text,
      },
    ]);
  }

  function handleCopilotSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = copilotDraft.trim();
    if (!prompt) {
      return;
    }
    appendCopilotMessage("user", prompt);
    setCopilotDraft("");
    appendCopilotMessage("assistant", buildCopilotReply(prompt));
  }

  function renderHomeWorkspace() {
    return (
      <section className="workspace-stack">
        <section className="surface-card surface-card-login">
          <div className="panel-header">
            <div>
              <h3>投标资料库</h3>
            </div>
            <span className="badge">{selectedProject ? "已选择项目" : "未选择项目"}</span>
          </div>
          <div className="stack">
            <p>{selectedProject ? `当前项目：${selectedProject.name}` : "请先创建或选择项目，再进入投标资料库。"}</p>
            <form className="inline-form" onSubmit={handleCreateProject}>
              <input
                placeholder="新项目名称"
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
              />
              <button className="primary-button" disabled={!token || !projectName.trim() || Boolean(busyLabel)} type="submit">
                新建项目
              </button>
            </form>
            <form className="inline-form" onSubmit={handleUploadDocument}>
              <select value={uploadType} onChange={(event) => setUploadType(event.target.value)}>
                <option value="proposal">投标文件</option>
                <option value="norm">规范文件</option>
              </select>
              <input key={selectedProjectId ?? "no-project"} type="file" onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} />
              <button className="ghost-button" disabled={!token || !selectedProjectId || !uploadFile || Boolean(busyLabel)} type="submit">
                上传文档
              </button>
            </form>
            <button className="primary-button" onClick={() => activateModule("knowledge-library")} type="button">
              进入投标资料库
            </button>
          </div>
        </section>
      </section>
    );
  }

  function renderLoginWorkspace() {
    return (
      <section className="workspace-stack">
        <section className="surface-card surface-card-login">
          <div className="panel-header">
            <div>
              <h3>登录后进入投标资料库</h3>
            </div>
            <span className="badge">需先登录</span>
          </div>
          <div className="workspace-grid workspace-grid-2">
            <form className="stack" onSubmit={handleLogin}>
              <label>
                邮箱
                <input autoComplete="username" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} />
              </label>
              <label>
                密码
                <input autoComplete="current-password" type="password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} />
              </label>
              <button className="primary-button" disabled={Boolean(busyLabel)} type="submit">
                登录
              </button>
            </form>
            <div className="stack">
              <div className="info-block">
                <strong>默认账号</strong>
                <p>`admin@example.com` / `admin123456`</p>
                <p>`project_manager@example.com` / `manager123456`</p>
              </div>
            </div>
          </div>
        </section>
      </section>
    );
  }

  function renderActiveModule() {
    if (activeModule === "knowledge-library") {
      return (
        <KnowledgeLibraryView
          documents={documents}
          historicalBids={historicalBids}
          selectedProjectId={selectedProjectId}
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
          token={token}
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
    return renderHomeWorkspace();
  }

  const sidebarUserName = loginEmail.trim() || (token ? "AIBidder User" : "访客");
  const sidebarUserAccountLabel = token ? loginEmail.trim() : "请先登录";

  return (
    <>
      <AppShell
        currentView={activeModule}
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
        showProjectContext={false}
        subtitle={undefined}
        title={activeModule === "knowledge-library" ? "投标资料库" : "首页"}
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
