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
            <h1>Bid Workspace</h1>
          </div>
        ) : null}
      </div>

      {!collapsed ? (
        <div className="sidebar-status-card" aria-live="polite">
          <div className={`status-pill ${sessionReady ? "status-pill-ready" : ""}`}>
            <span className="status-pill-dot" />
            {sessionReady ? "已连接" : "未登录"}
          </div>
          <strong>{busyLabel || "就绪"}</strong>
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
        {modules.map((module) => (
          <button
            key={module.id}
            aria-current={activeModule === module.id ? "page" : undefined}
            className={`sidebar-nav-item ${activeModule === module.id ? "sidebar-nav-item-active" : ""}`}
            onClick={() => onSelectModule(module.id)}
            title={collapsed ? module.label : undefined}
            type="button"
          >
            <span className="sidebar-nav-icon">{collapsed ? module.shortLabel : module.shortLabel}</span>
            {!collapsed ? (
              <span className="sidebar-nav-copy">
                <strong>{module.label}</strong>
                <small>{module.hint}</small>
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      <div className="sidebar-actions">
        <button className="sidebar-action" onClick={onOpenCopilot} type="button">
          <span className="sidebar-action-point" />
          {!collapsed ? <span>打开 Copilot</span> : null}
        </button>
        <button className="sidebar-action" onClick={onOpenSettings} type="button">
          <span className="sidebar-action-point" />
          {!collapsed ? <span>设置</span> : null}
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

