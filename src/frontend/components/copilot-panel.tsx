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

function getModuleGuidance(moduleLabel: string) {
  switch (moduleLabel) {
    case "资料准备":
      return {
        currentFocus: "先补齐招标文件、资质、人员、设备和业绩资料。",
        nextStep: "资料齐全后，再进入招标分析和内容编写，后续返工会更少。",
      };
    case "招标分析":
      return {
        currentFocus: "先核对资格条件、评分点、工期要求和废标条款。",
        nextStep: "确认关键风险后，再进入内容编写，会更容易对准评分要求。",
      };
    case "内容编写":
      return {
        currentFocus: "先确认章节框架，再补重点章节的证据和亮点表述。",
        nextStep: "草稿完成后，建议尽快做一次校核定稿，提前发现风险问题。",
      };
    case "校核定稿":
      return {
        currentFocus: "先处理阻塞问题，再确认是否可以进入排版导出。",
        nextStep: "阻塞问题清零后，再安排排版导出和最终送审。",
      };
    case "排版导出":
      return {
        currentFocus: "先核对模板、页眉页脚、封签和输出版本。",
        nextStep: "导出文件确认无误后，再到项目归档登记结果和沉淀资料。",
      };
    case "项目归档":
      return {
        currentFocus: "先登记投标结果，再整理哪些资料可以继续复用。",
        nextStep: "优质成果回灌后，下个项目做资料准备会更快。",
      };
    default:
      return {
        currentFocus: "先确认今天要推进哪一步，我可以直接带你进入对应模块。",
        nextStep: "通常建议先从资料准备开始，或继续上次停下的步骤。",
      };
  }
}

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
  const guidance = getModuleGuidance(moduleLabel);

  return (
    <div className={`copilot-wrap ${open ? "is-open" : ""}`} aria-hidden={!open}>
      <button aria-label="关闭助手抽屉" className="drawer-backdrop" onClick={onClose} type="button" />
      <aside className="copilot-panel copilot-drawer" aria-label="投标助手">
        <div className="drawer-content">
          <div className="copilot-header drawer-header">
            <div className="drawer-title-group">
              <p className="eyebrow">助手</p>
              <h3>投标助手</h3>
              <p className="copilot-context">
                当前步骤：{moduleLabel}
                {projectName ? ` · ${projectName}` : " · 尚未选择项目"}
              </p>
            </div>
            <button className="ghost-button" onClick={onClose} type="button">
              收起
            </button>
          </div>

          <div className="drawer-body">
            <section className="surface-card compact copilot-summary">
              <div className="stack compact">
                <strong>当前这一步先做什么</strong>
                <p>{guidance.currentFocus}</p>
                <strong>建议下一步</strong>
                <p>{guidance.nextStep}</p>
              </div>
            </section>

            <section className="copilot-section">
              <div className="copilot-section-title">常用提问</div>
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
            </section>

            <section className="copilot-section chat-section">
              <div className="copilot-section-title">对话记录</div>
              <div className="copilot-messages chat-timeline">
                {messages.length ? (
                  messages.map((message) => (
                    <article
                      key={message.id}
                      className={`copilot-message ${message.role === "assistant" ? "copilot-message-assistant" : "copilot-message-user"}`}
                    >
                      <span className="copilot-message-point" />
                      <p>{message.text}</p>
                    </article>
                  ))
                ) : (
                  <div className="copilot-empty-chat">还没开始对话。你可以先点常用提问，或直接告诉我你现在卡在哪一步。</div>
                )}
              </div>
            </section>

            <form className="copilot-composer chat-compose" onSubmit={onSubmit}>
              <textarea
                className="chat-input"
                placeholder="例如：这一步我还缺哪些资料？下一步先做什么？"
                rows={4}
                value={draft}
                onChange={(event) => onDraftChange(event.target.value)}
              />
              <button className="primary-button" disabled={!draft.trim()} type="submit">
                发送问题
              </button>
            </form>
          </div>
        </div>
      </aside>
    </div>
  );
}
