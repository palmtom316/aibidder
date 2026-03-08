type ModuleItem = {
  id: string;
  label: string;
  hint: string;
  shortLabel: string;
};

type ProjectItem = {
  id: number;
  name: string;
};

type WorkspaceSidebarProps = {
  collapsed: boolean;
  modules: ModuleItem[];
  activeModule: string;
  projects: ProjectItem[];
  selectedProjectId: number | null;
  sessionReady: boolean;
  busyLabel: string;
  message: string;
  onSelectModule: (moduleId: string) => void;
  onSelectProject: (projectId: number | null) => void;
  onToggleCollapsed: () => void;
  onOpenSettings: () => void;
  onOpenCopilot: () => void;
  onLogout: () => void;
};

type SidebarNavItem = {
  id: string;
  label: string;
  hint: string;
  shortLabel: string;
};

const NAV_ITEMS: SidebarNavItem[] = [
  { id: "home", label: "首页", hint: "查看今天先做什么", shortLabel: "首" },
  { id: "knowledge-library", label: "资料准备", hint: "整理招标文件和企业资料", shortLabel: "资" },
  { id: "tender-analysis", label: "招标分析", hint: "梳理要求、评分点和风险", shortLabel: "析" },
  { id: "bid-generation", label: "内容编写", hint: "按章节编写和完善投标内容", shortLabel: "写" },
  { id: "bid-review", label: "校核定稿", hint: "检查问题并准备最终定稿", shortLabel: "核" },
  { id: "bid-management", label: "项目归档", hint: "沉淀成果和后续复用资料", shortLabel: "档" },
];

function isModuleAvailable(modules: ModuleItem[], moduleId: string) {
  return modules.some((module) => module.id === moduleId);
}

function isModuleActive(activeModule: string, moduleId: string) {
  if (moduleId === "bid-review") {
    return activeModule === "bid-review" || activeModule === "layout-finalize";
  }

  return activeModule === moduleId;
}

export function WorkspaceSidebar({
  collapsed,
  modules,
  activeModule,
  projects,
  selectedProjectId,
  sessionReady,
  busyLabel,
  message,
  onSelectModule,
  onSelectProject,
  onToggleCollapsed,
  onOpenSettings,
  onOpenCopilot,
  onLogout,
}: WorkspaceSidebarProps) {
  const visibleModules = NAV_ITEMS.filter((item) => isModuleAvailable(modules, item.id));

  return (
    <aside className={`workspace-sidebar ${collapsed ? "workspace-sidebar-collapsed" : ""}`}>
      <div className="workspace-brand">
        <button
          aria-label={collapsed ? "展开侧边栏" : "折叠侧边栏"}
          className="sidebar-toggle"
          onClick={onToggleCollapsed}
          type="button"
        >
          <span className="brand-point" />
        </button>
        {!collapsed ? (
          <div>
            <p className="eyebrow">AIBidder</p>
            <h1>投标工作台</h1>
          </div>
        ) : null}
      </div>

      {!collapsed ? (
        <div className="sidebar-status-card" aria-live="polite">
          <div className={`status-pill ${sessionReady ? "status-pill-ready" : "status-pill-warning"}`}>
            <span className="status-pill-dot" />
            {sessionReady ? "已连接" : "请先登录"}
          </div>
          <strong>{busyLabel || "可以开始处理"}</strong>
          <p>{message}</p>
        </div>
      ) : null}

      {!collapsed ? (
        <label className="sidebar-project-select">
          当前项目
          <select
            value={selectedProjectId ?? ""}
            onChange={(event) => onSelectProject(Number(event.target.value) || null)}
          >
            <option value="">请选择项目</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                #{project.id} · {project.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <nav className="sidebar-nav" aria-label="工作模块">
        {visibleModules.map((module) => {
          const active = isModuleActive(activeModule, module.id);

          return (
            <button
              key={module.id}
              aria-current={active ? "page" : undefined}
              className={`sidebar-nav-item ${active ? "sidebar-nav-item-active" : ""}`}
              onClick={() => onSelectModule(module.id)}
              title={collapsed ? module.label : undefined}
              type="button"
            >
              <span className="sidebar-nav-icon">{module.shortLabel}</span>
              {!collapsed ? (
                <span className="sidebar-nav-copy">
                  <strong>{module.label}</strong>
                  <small>{module.hint}</small>
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-actions">
        <button className="sidebar-action" onClick={onOpenCopilot} type="button">
          <span className="sidebar-action-point" />
          {!collapsed ? <span>打开助手</span> : null}
        </button>
        <button className="sidebar-action" onClick={onOpenSettings} type="button">
          <span className="sidebar-action-point" />
          {!collapsed ? <span>模型与服务设置</span> : null}
        </button>
        {sessionReady ? (
          <button className="sidebar-action" onClick={onLogout} type="button">
            <span className="sidebar-action-point" />
            {!collapsed ? <span>退出登录</span> : null}
          </button>
        ) : null}
      </div>
    </aside>
  );
}
