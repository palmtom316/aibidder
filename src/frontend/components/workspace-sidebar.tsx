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
  userName?: string;
  userAccountLabel?: string;
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
  kind: "module" | "action";
  moduleId?: string;
  icon: "library" | "copilot" | "settings";
};

const NAV_ITEMS: SidebarNavItem[] = [
  { id: "knowledge-library", label: "投标资料库", kind: "module", moduleId: "knowledge-library", icon: "library" },
  { id: "copilot", label: "Copilot", kind: "action", icon: "copilot" },
  { id: "settings", label: "设置", kind: "action", icon: "settings" },
];

function isModuleAvailable(modules: ModuleItem[], moduleId: string) {
  return modules.some((module) => module.id === moduleId);
}

function isModuleActive(activeModule: string, moduleId: string) {
  return activeModule === moduleId;
}

function buildUserInitials(userName: string) {
  const parts = userName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }

  return userName.slice(0, 2).toUpperCase();
}

function formatFallbackName(sessionReady: boolean, userName?: string) {
  if (userName?.trim()) {
    return userName.trim();
  }

  return sessionReady ? "AIBidder User" : "访客";
}

function SidebarGlyph() {
  return (
    <svg aria-hidden="true" className="sidebar-brand-glyph" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3.8 13.55 8.45 18.2 10 13.55 11.55 12 16.2 10.45 11.55 5.8 10l4.65-1.55L12 3.8Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.55"
      />
      <path
        d="M18.1 4.9 18.55 6.25 19.9 6.7 18.55 7.15 18.1 8.5 17.65 7.15 16.3 6.7 17.65 6.25 18.1 4.9Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
      <path
        d="M18.1 15.5 18.5 16.7 19.7 17.1 18.5 17.5 18.1 18.7 17.7 17.5 16.5 17.1 17.7 16.7 18.1 15.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function ToggleGlyph({ collapsed }: { collapsed: boolean }) {
  return collapsed ? (
    <svg aria-hidden="true" className="sidebar-toggle-glyph" viewBox="0 0 24 24" fill="none">
      <path d="M5 7.25h14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M5 16.75h14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  ) : (
    <svg aria-hidden="true" className="sidebar-toggle-glyph" viewBox="0 0 24 24" fill="none">
      <rect x="4.5" y="5" width="15" height="14" rx="3.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M14 6v12" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function NavIcon({ icon }: { icon: SidebarNavItem["icon"] }) {
  switch (icon) {
    case "library":
      return (
        <svg aria-hidden="true" className="sidebar-nav-svg" viewBox="0 0 24 24" fill="none">
          <path
            d="M4.9 8.2a2.3 2.3 0 0 1 2.3-2.3h3.6c.45 0 .88.18 1.2.5l1.15 1.14c.32.32.75.5 1.2.5h2.45a2.3 2.3 0 0 1 2.3 2.3v5.5a2.3 2.3 0 0 1-2.3 2.3H7.2a2.3 2.3 0 0 1-2.3-2.3V8.2Z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.55"
          />
          <path d="M16.9 5.2 17.25 6.2 18.25 6.55 17.25 6.9 16.9 7.9 16.55 6.9 15.55 6.55 16.55 6.2 16.9 5.2Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.35" />
        </svg>
      );
    case "copilot":
      return (
        <svg aria-hidden="true" className="sidebar-nav-svg" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 4.25 13.48 8.52 17.75 10 13.48 11.48 12 15.75 10.52 11.48 6.25 10l4.27-1.48L12 4.25Z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.45"
          />
          <path
            d="M17.65 5.6 18.05 6.7 19.15 7.1 18.05 7.5 17.65 8.6 17.25 7.5 16.15 7.1 17.25 6.7 17.65 5.6Z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.25"
          />
          <path
            d="M17.65 14.9 18.05 16 19.15 16.4 18.05 16.8 17.65 17.9 17.25 16.8 16.15 16.4 17.25 16 17.65 14.9Z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.25"
          />
        </svg>
      );
    case "settings":
      return (
        <svg aria-hidden="true" className="sidebar-nav-svg" viewBox="0 0 24 24" fill="none">
          <path d="M7 7.2h10" stroke="currentColor" strokeLinecap="round" strokeWidth="1.55" />
          <path d="M7 12h10" stroke="currentColor" strokeLinecap="round" strokeWidth="1.55" />
          <path d="M7 16.8h10" stroke="currentColor" strokeLinecap="round" strokeWidth="1.55" />
          <circle cx="10" cy="7.2" r="1.45" fill="white" stroke="currentColor" strokeWidth="1.45" />
          <circle cx="14.5" cy="12" r="1.45" fill="white" stroke="currentColor" strokeWidth="1.45" />
          <circle cx="11.4" cy="16.8" r="1.45" fill="white" stroke="currentColor" strokeWidth="1.45" />
          <path d="M18.1 4.95 18.45 5.95 19.45 6.3 18.45 6.65 18.1 7.65 17.75 6.65 16.75 6.3 17.75 5.95 18.1 4.95Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
        </svg>
      );
  }
}

export function WorkspaceSidebar({
  collapsed,
  modules,
  activeModule,
  sessionReady,
  busyLabel,
  message,
  userName,
  userAccountLabel,
  onSelectModule,
  onToggleCollapsed,
  onOpenCopilot,
  onOpenSettings,
}: WorkspaceSidebarProps) {
  const visibleItems = NAV_ITEMS.filter((item) => item.kind === "action" || isModuleAvailable(modules, item.moduleId ?? ""));
  const resolvedUserName = formatFallbackName(sessionReady, userName);
  const resolvedUserAccountLabel = userAccountLabel?.trim() || (sessionReady ? "已登录" : "未登录");
  const initials = buildUserInitials(resolvedUserName);
  return (
    <aside className={`workspace-sidebar ${collapsed ? "workspace-sidebar-collapsed" : ""}`}>
      <div className="workspace-sidebar-inner">
        <div className="workspace-brand workspace-brand-chatgpt">
          <button
            aria-label="返回首页"
            className="sidebar-brand-button"
            onClick={() => onSelectModule("home")}
            title="返回首页"
            type="button"
          >
            <SidebarGlyph />
          </button>
          <button
            aria-label={collapsed ? "展开侧边栏" : "折叠侧边栏"}
            className="sidebar-toggle"
            onClick={onToggleCollapsed}
            type="button"
          >
            <ToggleGlyph collapsed={collapsed} />
          </button>
        </div>

        <nav className="sidebar-nav sidebar-nav-chatgpt" aria-label="工作模块">
          {visibleItems.map((item) => {
            const active = item.kind === "module" ? isModuleActive(activeModule, item.moduleId ?? "") : false;
            const handleClick = () => {
              if (item.kind === "module" && item.moduleId) {
                onSelectModule(item.moduleId);
                return;
              }

              if (item.id === "copilot") {
                onOpenCopilot();
                return;
              }

              onOpenSettings();
            };

            return (
              <button
                key={item.id}
                aria-current={active ? "page" : undefined}
                className={`sidebar-nav-item sidebar-nav-item-chatgpt ${active ? "sidebar-nav-item-active" : ""}`}
                onClick={handleClick}
                title={collapsed ? item.label : undefined}
                type="button"
              >
                <span className="sidebar-nav-icon">
                  <NavIcon icon={item.icon} />
                </span>
                {!collapsed ? <span className="sidebar-nav-label">{item.label}</span> : null}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="sidebar-user-wrap">
        <button
          className={`sidebar-user-card ${sessionReady ? "sidebar-user-card-ready" : "sidebar-user-card-guest"}`}
          onClick={onOpenSettings}
          title={sessionReady ? "打开设置" : "请先登录"}
          type="button"
        >
          <span className="sidebar-user-avatar" aria-hidden="true">
            <span>{initials}</span>
          </span>
          {!collapsed ? (
            <span className="sidebar-user-copy">
              <strong>{resolvedUserName}</strong>
              <small>{resolvedUserAccountLabel}</small>
            </span>
          ) : null}
        </button>
      </div>
    </aside>
  );
}
