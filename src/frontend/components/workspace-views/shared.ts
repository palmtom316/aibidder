import type { Dispatch, FormEventHandler, SetStateAction } from "react";

export type StateSetter<T> = Dispatch<SetStateAction<T>>;
export type AsyncActionResult = Promise<void> | void;
export type VoidAction = () => AsyncActionResult;
export type NumberAction = (value: number) => AsyncActionResult;
export type FormSubmitHandler = FormEventHandler<HTMLFormElement>;

export type WorkspaceModule =
  | "home"
  | "knowledge-library"
  | "tender-analysis"
  | "bid-generation"
  | "bid-review"
  | "layout-finalize"
  | "bid-management";

export type WorkspaceModuleMeta = {
  id: WorkspaceModule;
  label: string;
  hint: string;
  shortLabel: string;
};

export const WORKSPACE_MODULES: WorkspaceModuleMeta[] = [
  { id: "home", label: "首页", hint: "从这里选择今天要推进的投标步骤", shortLabel: "首" },
  { id: "knowledge-library", label: "资料准备", hint: "整理招标文件、资质、人员、设备和业绩资料", shortLabel: "资" },
  { id: "tender-analysis", label: "招标分析", hint: "梳理资格条件、评分点和废标风险", shortLabel: "析" },
  { id: "bid-generation", label: "内容编写", hint: "按章节生成投标内容并继续完善", shortLabel: "写" },
  { id: "bid-review", label: "校核定稿", hint: "检查评分、废标风险和内容遗漏", shortLabel: "核" },
  { id: "layout-finalize", label: "排版导出", hint: "整理版式并导出最终提交材料", shortLabel: "排" },
  { id: "bid-management", label: "项目归档", hint: "归档投标成果并沉淀后续复用资料", shortLabel: "档" },
];

export const PROJECT_ID_QUERY_PARAM = "projectId";
export const LAST_VISITED_MODULE_STORAGE_PREFIX = "aibidder:last-visited-module";
export const DEFAULT_RESUME_MODULE: Exclude<WorkspaceModule, "home"> = "knowledge-library";
export const RESUMABLE_MODULES: Exclude<WorkspaceModule, "home">[] = [
  "knowledge-library",
  "tender-analysis",
  "bid-generation",
  "bid-review",
  "layout-finalize",
  "bid-management",
];
export const ALLOWED_WORKSPACE_MODULES: Exclude<WorkspaceModule, "home">[] = [
  "knowledge-library",
  "tender-analysis",
  "bid-generation",
  "bid-review",
  "layout-finalize",
  "bid-management",
];

export type EvidenceSummaryItem = {
  requirement_type: string;
  source_anchor: string;
  priority: string;
};

export type DecompositionSummary = {
  categories: Array<{
    category_key: string;
    label: string;
    count: number;
    items: Array<{
      title: string;
      detail: string;
      source_anchor: string;
      page: number;
      source_excerpt: string;
      priority: string;
    }>;
  }>;
  totals?: { sections?: number; items?: number };
};

export function modulePath(module: WorkspaceModule) {
  return module === "home" ? "/" : `/workspace/${module}`;
}

export function parseProjectIdParam(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function buildModuleHref(module: WorkspaceModule, projectId?: number | null) {
  const path = modulePath(module);
  return projectId ? `${path}?${PROJECT_ID_QUERY_PARAM}=${projectId}` : path;
}

export function isResumableModule(module: string | null): module is Exclude<WorkspaceModule, "home"> {
  return RESUMABLE_MODULES.includes(module as Exclude<WorkspaceModule, "home">);
}

export function lastVisitedModuleStorageKey(projectId: number) {
  return `${LAST_VISITED_MODULE_STORAGE_PREFIX}:${projectId}`;
}
