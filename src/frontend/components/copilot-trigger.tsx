type CopilotTriggerProps = {
  onClick: () => void;
};

export function CopilotTrigger({ onClick }: CopilotTriggerProps) {
  return (
    <button className="copilot-fab copilot-trigger" onClick={onClick} type="button">
      <span className="brand-point brand-point-inline" />
      投标助手
    </button>
  );
}
