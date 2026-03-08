type StatusBadgeTone = "neutral" | "success" | "warning" | "danger";

type StatusBadgeProps = {
  tone?: StatusBadgeTone;
  label: string;
  withDot?: boolean;
  className?: string;
};

const toneClassMap: Record<StatusBadgeTone, string> = {
  neutral: "badge",
  success: "badge badge-success",
  warning: "badge badge-warning",
  danger: "badge badge-danger",
};

export function StatusBadge({ tone = "neutral", label, withDot = false, className = "" }: StatusBadgeProps) {
  const classes = `${toneClassMap[tone]} ${className}`.trim();

  return (
    <span className={classes}>
      {withDot ? <span aria-hidden="true" className="status-pill-dot" /> : null}
      <span>{label}</span>
    </span>
  );
}
