import type {
  DecompositionSummary,
  EvidenceSummaryItem,
  WorkspaceModule,
  WorkspaceModuleMeta,
} from "./shared";

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  tender: "招标文件",
  norm: "规范文件",
  proposal: "投标文件",
};

const LIBRARY_CATEGORY_LABELS: Record<string, string> = {
  historical_bid: "历史标书",
  excellent_bid: "优秀标书",
  company_qualification: "企业资质",
  company_performance_asset: "企业业绩与设备",
  personnel_qualification: "人员资质",
  personnel_performance: "人员业绩",
};

const CREDENTIAL_TYPE_LABELS: Record<string, string> = {
  project_performance: "项目业绩",
};

const STATUS_LABELS: Record<string, string> = {
  queued: "待处理",
  drafting: "编写中",
  draft: "草稿",
  open: "待处理",
  approved: "已确认",
  resolved: "已处理",
  rewritten: "已重写",
  submitted: "已提交",
  ready_for_submission: "待提交",
  won: "已中标",
  lost: "未中标",
  archived: "已归档",
  succeeded: "已完成",
  failed: "处理失败",
  parsed: "已解析",
  imported: "已导入",
  pending: "待检查",
  checked: "已检查",
  attention_needed: "需关注",
  sectioned: "已切分章节",
  reuse_built: "已生成复用片段",
};

const REVIEW_MODE_LABELS: Record<string, string> = {
  simulated_scoring: "模拟评分",
  compliance_review: "合规核对",
  disqualification_check: "废标风险检查",
};

const REVIEW_SEVERITY_LABELS: Record<string, string> = {
  info: "提示",
  warning: "提醒",
  error: "严重",
  critical: "严重",
  high: "高",
  medium: "中",
  low: "低",
};

const REVIEW_CATEGORY_LABELS: Record<string, string> = {
  generation: "内容生成",
  content: "内容完整性",
  evidence: "依据支撑",
  contract_risk: "合同风险",
  missing_evidence_binding: "缺少依据",
  thin_section_content: "章节内容偏少",
};

const OUTPUT_TYPE_LABELS: Record<string, string> = {
  docx: "Word 文件",
  pdf: "PDF 文件",
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  won_bid: "中标样本",
  excellent_sample: "优秀样本",
};

const RISK_LEVEL_LABELS: Record<string, string> = {
  high: "高风险",
  medium: "中风险",
  low: "低风险",
};

function containsChinese(value: string) {
  return /[\u4e00-\u9fff]/.test(value);
}

function fallbackLabel(value: string, fallback: string) {
  if (!value) {
    return fallback;
  }
  if (containsChinese(value)) {
    return value;
  }
  return fallback;
}

function lookup(value: string, labels: Record<string, string>, fallback: string) {
  return labels[value] ?? fallbackLabel(value, fallback);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatDocumentType(value: string) {
  return lookup(value, DOCUMENT_TYPE_LABELS, "其他资料");
}

export function formatLibraryCategory(value: string) {
  return lookup(value, LIBRARY_CATEGORY_LABELS, "其他资料");
}

export function formatCredentialType(value: string) {
  return lookup(value, CREDENTIAL_TYPE_LABELS, "其他业绩");
}

export function formatJobStatus(value: string) {
  return lookup(value, STATUS_LABELS, "处理中");
}

export function formatSubmissionStatus(value: string) {
  return lookup(value, STATUS_LABELS, "处理中");
}

export function formatReviewMode(value: string) {
  return lookup(value, REVIEW_MODE_LABELS, "其他核对方式");
}

export function formatReviewSeverity(value: string) {
  return lookup(value, REVIEW_SEVERITY_LABELS, "提醒");
}

export function formatReviewCategory(value: string) {
  return lookup(value, REVIEW_CATEGORY_LABELS, "其他问题");
}

export function formatOutputType(value: string) {
  return lookup(value, OUTPUT_TYPE_LABELS, "导出文件");
}

export function formatHistoricalSourceType(value: string) {
  return lookup(value, SOURCE_TYPE_LABELS, "其他来源");
}

export function formatProjectType(value: string) {
  if (!value) {
    return "未填写工程类型";
  }
  return containsChinese(value) ? value : value.replace(/[_-]+/g, " ");
}

export function formatRiskLevel(value: string) {
  return lookup(value, RISK_LEVEL_LABELS, "待判断");
}

export function formatStoragePath(value: string) {
  if (!value) {
    return "已生成导出文件";
  }
  const segments = value.split("/");
  return segments[segments.length - 1] || "已生成导出文件";
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


type ResumeCardStateInput = {
  selectedProject: boolean;
  nextResumeModule: Exclude<WorkspaceModule, "home">;
  nextResumeModuleMeta: WorkspaceModuleMeta;
  documentsCount: number;
  decompositionProgress?: number | null;
  generationTargetSections?: number | null;
  reviewBlockingIssues?: number | null;
  reviewScore?: number | null;
  hasLayoutJob: boolean;
  renderedOutputCount: number;
  submissionRecordCount: number;
};

export function getResumeCardState({
  selectedProject,
  nextResumeModule,
  nextResumeModuleMeta,
  documentsCount,
  decompositionProgress,
  generationTargetSections,
  reviewBlockingIssues,
  reviewScore,
  hasLayoutJob,
  renderedOutputCount,
  submissionRecordCount,
}: ResumeCardStateInput) {
  if (!selectedProject) {
    return {
      detail: "选好项目后，首页会直接告诉你上次做到哪一步。",
      cue: "建议先确定本次要推进的项目，再继续后续工作。",
    };
  }

  switch (nextResumeModule) {
    case "knowledge-library":
      return {
        detail: `可直接回到“${nextResumeModuleMeta.label}”继续整理本项目资料。`,
        cue:
          documentsCount > 0
            ? `当前已收 ${documentsCount} 份资料，建议继续补齐资质、人员或业绩证明。`
            : "当前还没有招标资料，建议先上传招标文件或补一份企业资质材料。",
      };
    case "tender-analysis":
      return {
        detail: `可回到“${nextResumeModuleMeta.label}”继续梳理资格条件、评分点和废标风险。`,
        cue:
          decompositionProgress !== null && decompositionProgress !== undefined
            ? `最近一次分析进度 ${decompositionProgress}%，可继续核对原文条款。`
            : "招标分析还未开始，建议先发起一次招标文件拆解。",
      };
    case "bid-generation":
      return {
        detail: `可回到“${nextResumeModuleMeta.label}”继续完善各章节投标内容。`,
        cue:
          generationTargetSections !== null && generationTargetSections !== undefined
            ? `最近一次编写任务面向 ${generationTargetSections} 个章节，可继续补全内容。`
            : "内容编写还未开始，建议先生成章节草稿。",
      };
    case "bid-review":
      return {
        detail: `可回到“${nextResumeModuleMeta.label}”继续检查评分风险和内容遗漏。`,
        cue:
          reviewBlockingIssues !== null && reviewBlockingIssues !== undefined
            ? reviewBlockingIssues > 0
              ? `最近一次校核发现 ${reviewBlockingIssues} 项重点问题，建议先处理。`
              : `最近一次校核${reviewScore !== null && reviewScore !== undefined ? `模拟得分 ${reviewScore} 分，` : ""}可继续复核关键章节。`
            : "校核定稿还未开始，建议先做一次模拟打分。",
      };
    case "layout-finalize":
      return {
        detail: `可回到“${nextResumeModuleMeta.label}”继续整理版式和导出成果。`,
        cue: hasLayoutJob
          ? `当前已有 ${renderedOutputCount} 份导出成果，可继续核对版式和封签。`
          : "排版导出还未开始，建议先套用企业模板生成一版。",
      };
    case "bid-management":
      return {
        detail: `可回到“${nextResumeModuleMeta.label}”继续登记成果并沉淀复用资料。`,
        cue:
          submissionRecordCount > 0
            ? `当前已登记 ${submissionRecordCount} 条归档记录，可继续补充中标结果或回灌资料。`
            : "项目归档还未登记，建议先补一条投标成果记录。",
      };
  }
}
