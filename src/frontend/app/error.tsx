"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="loading-shell">
      <div className="loading-card error-card">
        <strong>控制台渲染失败</strong>
        <p>{error.message || "请重试，或刷新页面后重新进入。"}</p>
        <button className="primary-button" onClick={reset} type="button">
          重试
        </button>
      </div>
    </main>
  );
}
