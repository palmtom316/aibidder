type CopilotTriggerProps = {
  onClick: () => void;
};

function SparklesGlyph() {
  return (
    <svg aria-hidden="true" className="copilot-hotkey-icon" viewBox="0 0 24 24" fill="none">
      <path d="M12 3.8 13.55 8.45 18.2 10 13.55 11.55 12 16.2 10.45 11.55 5.8 10l4.65-1.55L12 3.8Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.55" />
      <path d="M18.1 4.9 18.55 6.25 19.9 6.7 18.55 7.15 18.1 8.5 17.65 7.15 16.3 6.7 17.65 6.25 18.1 4.9Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" />
      <path d="M18.1 15.5 18.5 16.7 19.7 17.1 18.5 17.5 18.1 18.7 17.7 17.5 16.5 17.1 17.7 16.7 18.1 15.5Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" />
    </svg>
  );
}

export function CopilotTrigger({ onClick }: CopilotTriggerProps) {
  return (
    <button
      aria-label="打开投标助手（快捷键 Command + J 或 Ctrl + J）"
      className="copilot-fab copilot-hotkey-badge"
      onClick={onClick}
      type="button"
    >
      <span className="copilot-hotkey-icon-wrap" aria-hidden="true">
        <SparklesGlyph />
      </span>
      <span className="copilot-hotkey-keycaps" aria-hidden="true">
        <span className="copilot-hotkey-keycap">⌘J</span>
        <span className="copilot-hotkey-divider">/</span>
        <span className="copilot-hotkey-keycap">CtrlJ</span>
      </span>
      <span className="copilot-hotkey-badge-label">投标助手</span>
    </button>
  );
}
