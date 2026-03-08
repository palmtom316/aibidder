import type { DecompositionSummary, EvidenceSummaryItem } from "./shared";

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function parseEvidenceSummary(summaryJson: string): EvidenceSummaryItem[] {
  if (!summaryJson) {
    return [];
  }

  try {
    const payload = JSON.parse(summaryJson);
    return Array.isArray(payload) ? payload : [];
  } catch {
    return [];
  }
}

export function parseDecompositionSummary(summaryJson: string): DecompositionSummary | null {
  if (!summaryJson || summaryJson === "{}") {
    return null;
  }

  try {
    return JSON.parse(summaryJson) as DecompositionSummary;
  } catch {
    return null;
  }
}
