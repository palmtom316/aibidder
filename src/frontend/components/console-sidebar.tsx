type ConsoleSidebarProps = {
  busyLabel: string;
  message: string;
  token: string | null;
  onLogout: () => void;
};

export function ConsoleSidebar({ busyLabel, message, token, onLogout }: ConsoleSidebarProps) {
  return (
    <aside className="console-sidebar">
      <div>
        <p className="eyebrow">Local Integration</p>
        <h1>AIBidder Console</h1>
        <p className="sidebar-copy">本地联调用于验证登录、项目、文档、证据、历史标书复用和 BYOK 运行时设置。</p>
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
        <button className="ghost-button" onClick={onLogout} type="button">
          退出登录
        </button>
      ) : null}
    </aside>
  );
}
