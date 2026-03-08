"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  const detail = error.message?.trim();

  return (
    <main className="loading-shell">
      <div className="loading-card error-card">
        <strong>页面暂时没有打开成功</strong>
        <p>你可以先点“重新打开”。如果仍然失败，建议刷新页面后回到刚才的步骤继续处理。</p>
        {detail ? <p className="workspace-subtitle">系统提示：{detail}</p> : null}
        <button className="primary-button" onClick={reset} type="button">
          重新打开
        </button>
      </div>
    </main>
  );
}
