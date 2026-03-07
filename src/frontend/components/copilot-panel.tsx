import type { FormEvent } from "react";

type CopilotMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

type CopilotAction = {
  id: string;
  label: string;
};

type CopilotPanelProps = {
  open: boolean;
  moduleLabel: string;
  projectName: string | null;
  messages: CopilotMessage[];
  draft: string;
  quickActions: CopilotAction[];
  onClose: () => void;
  onDraftChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onQuickAction: (actionId: string) => void;
};

export function CopilotPanel({
  open,
  moduleLabel,
  projectName,
  messages,
  draft,
  quickActions,
  onClose,
  onDraftChange,
  onSubmit,
  onQuickAction,
}: CopilotPanelProps) {
  return (
    <div className={`copilot-wrap ${open ? "is-open" : ""}`} aria-hidden={!open}>
      <aside className="copilot-panel" aria-label="Copilot">
        <div className="copilot-header">
          <div>
            <p className="eyebrow">Copilot</p>
            <h3>上下文助手</h3>
            <p className="copilot-context">
              {moduleLabel}
              {projectName ? ` · ${projectName}` : ""}
            </p>
          </div>
          <button className="ghost-button" onClick={onClose} type="button">
            收起
          </button>
        </div>

        <div className="copilot-quick-actions">
          {quickActions.map((action) => (
            <button
              key={action.id}
              className="copilot-chip"
              onClick={() => onQuickAction(action.id)}
              type="button"
            >
              {action.label}
            </button>
          ))}
        </div>

        <div className="copilot-messages">
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

        <form className="copilot-composer" onSubmit={onSubmit}>
          <textarea
            placeholder="询问当前模块、让 Copilot 导航，或让它解释下一步。"
            rows={4}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
          />
          <button className="primary-button" disabled={!draft.trim()} type="submit">
            发送
          </button>
        </form>
      </aside>
    </div>
  );
}
