import type { Dispatch, FormEventHandler, SetStateAction } from "react";

export type StateSetter<T> = Dispatch<SetStateAction<T>>;
export type AsyncActionResult = Promise<void> | void;
export type VoidAction = () => AsyncActionResult;
export type NumberAction = (value: number) => AsyncActionResult;
export type FormSubmitHandler = FormEventHandler<HTMLFormElement>;

export type WorkspaceModule =
  | "home"
  | "knowledge-library";

export type WorkspaceModuleMeta = {
  id: WorkspaceModule;
  label: string;
  hint: string;
  shortLabel: string;
};

export const WORKSPACE_MODULES: WorkspaceModuleMeta[] = [
  { id: "home", label: "首页", hint: "从这里进入投标资料库", shortLabel: "首" },
  { id: "knowledge-library", label: "投标资料库", hint: "管理历史标书、规范规程和企业事实资料", shortLabel: "库" },
];

export const PROJECT_ID_QUERY_PARAM = "projectId";
export const LAST_VISITED_MODULE_STORAGE_PREFIX = "aibidder:last-visited-module";
export const DEFAULT_RESUME_MODULE: Exclude<WorkspaceModule, "home"> = "knowledge-library";
export const RESUMABLE_MODULES: Exclude<WorkspaceModule, "home">[] = [
  "knowledge-library",
];
export const ALLOWED_WORKSPACE_MODULES: Exclude<WorkspaceModule, "home">[] = [
  "knowledge-library",
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
