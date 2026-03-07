export default function Loading() {
  return (
    <main className="loading-shell">
      <div className="loading-card">
        <div className="loading-spinner" />
        <strong>正在加载 AIBidder 控制台...</strong>
        <p>正在准备本地联调视图与运行时状态。</p>
      </div>
    </main>
  );
}
