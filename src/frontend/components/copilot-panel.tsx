import type { FormEvent } from "react";

type CopilotMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

type CopilotPanelProps = {
  open: boolean;
  messages: CopilotMessage[];
  draft: string;
  onClose: () => void;
  onDraftChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function CopilotPanel({
  open,
  messages,
  draft,
  onClose,
  onDraftChange,
  onSubmit,
}: CopilotPanelProps) {
  return (
    <div className={`copilot-wrap ${open ? "is-open" : ""}`} aria-hidden={!open}>
      <button aria-label="关闭助手抽屉" className="drawer-backdrop" onClick={onClose} type="button" />
      <aside className="copilot-panel copilot-drawer" aria-label="投标助手">
        <div className="drawer-content">
          <div className="copilot-header drawer-header diagnostic-header">
            <div className="drawer-title-group">
              <span className="badge">Copilot</span>
              <h3>投标助手</h3>
            </div>
            <button className="ghost-button" onClick={onClose} type="button">
              收起
            </button>
          </div>

          <div className="drawer-body">
            <div className="copilot-messages chat-timeline">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`copilot-message ${message.role === "assistant" ? "copilot-message-assistant" : "copilot-message-user"}`}
                >
                  <span className="copilot-message-point" />
                  <p>{message.text}</p>
                </article>
              ))}
            </div>

            <form className="copilot-composer chat-compose" onSubmit={onSubmit}>
              <textarea
                className="chat-input"
                placeholder="输入关于投标资料库、模型设置或当前页面的问题"
                rows={4}
                value={draft}
                onChange={(event) => onDraftChange(event.target.value)}
              />
              <button className="primary-button" type="submit">
                发送
              </button>
            </form>
          </div>
        </div>
      </aside>
    </div>
  );
}
