import type { Dispatch, FormEventHandler, SetStateAction } from "react";

export type StateSetter<T> = Dispatch<SetStateAction<T>>;
export type AsyncActionResult = Promise<void> | void;
export type VoidAction = () => AsyncActionResult;
export type NumberAction = (value: number) => AsyncActionResult;
export type FormSubmitHandler = FormEventHandler<HTMLFormElement>;

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
