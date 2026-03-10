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
  const quickPrompts = [
    "帮我整理当前投标资料库里优先要补齐的资料。",
    "根据当前页面，给我一份资料复核清单。",
    "告诉我模型设置里哪些角色还需要补全。",
  ];

  return (
    <div className={`copilot-wrap ${open ? "is-open" : ""}`} aria-hidden={!open}>
      <button aria-label="关闭助手抽屉" className="drawer-backdrop" onClick={onClose} type="button" />
      <aside className="copilot-panel copilot-drawer" aria-label="投标助手">
        <div className="drawer-content">
          <div className="copilot-header drawer-header diagnostic-header">
            <div className="drawer-title-group">
              <span className="badge">Copilot</span>
              <div className="stack compact">
                <h3>投标助手</h3>
                <p className="drawer-subtitle">围绕资料库、设置与当前页面状态进行提问。</p>
              </div>
            </div>
            <button className="ghost-button" onClick={onClose} type="button">
              收起
            </button>
          </div>

          <div className="drawer-body">
            <section className="copilot-intro-card" aria-label="快捷提问">
              <div className="copilot-intro-copy">
                <span className="eyebrow">Quick prompts</span>
                <strong>从当前工作区直接发起问题</strong>
              </div>
              <div className="copilot-suggestion-grid">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    className="copilot-chip"
                    onClick={() => onDraftChange(prompt)}
                    type="button"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </section>

            <div className="copilot-messages chat-timeline">
              {messages.length === 0 ? (
                <article className="copilot-empty-chat">
                  <span className="eyebrow">Ready</span>
                  <strong>还没有对话</strong>
                  <p>可以直接输入问题，或先点上面的快捷提问把草稿带入输入框。</p>
                </article>
              ) : (
                messages.map((message) => (
                  <article
                    key={message.id}
                    className={`copilot-message ${message.role === "assistant" ? "copilot-message-assistant" : "copilot-message-user"}`}
                  >
                    <span className="copilot-message-point" />
                    <p>{message.text}</p>
                  </article>
                ))
              )}
            </div>

            <form className="copilot-composer chat-compose" onSubmit={onSubmit}>
              <textarea
                className="chat-input"
                placeholder="输入关于投标资料库、模型设置或当前页面的问题"
                rows={4}
                value={draft}
                onChange={(event) => onDraftChange(event.target.value)}
              />
              <div className="copilot-compose-footer">
                <p>Copilot 会基于当前页面上下文组织回答。</p>
                <button className="primary-button" type="submit">
                  发送
                </button>
              </div>
            </form>
          </div>
        </div>
      </aside>
    </div>
  );
}
