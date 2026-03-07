export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export type DocumentType = "tender" | "norm" | "proposal";

export type RuntimeSettings = {
  provider: string;
  api_base_url: string | null;
  api_key_configured: boolean;
  cors_allowed_origins: string[];
  default_models: {
    ocr_role: string;
    decomposition_navigator_role: string;
    decomposition_extractor_role: string;
    writer_role: string;
    reviewer_role: string;
    adjudicator_role: string;
  };
};

export type RuntimeConnectivityRequest = {
  provider: string;
  api_base_url: string;
  api_key: string;
  model: string;
};

export type RuntimeConnectivityResult = {
  ok: boolean;
  provider: string;
  api_base_url: string;
  model: string;
  status_code: number | null;
  message: string;
};

export type Project = {
  id: number;
  name: string;
  organization_id: number;
  created_by_user_id: number;
  created_at: string;
};

export type DocumentRecord = {
  id: number;
  project_id: number;
  filename: string;
  document_type: string;
  created_by_user_id: number;
  created_at: string;
};

export type EvidenceUnit = {
  id: number;
  organization_id: number;
  project_id: number;
  document_id: number;
  document_version_id: number;
  document_type: string;
  unit_type: string;
  section_title: string;
  section_path: string;
  anchor: string;
  page_start: number;
  page_end: number;
  content: string;
  fts_text: string;
  metadata_json: string;
  created_at: string;
};

export type EvidenceSearchResult = {
  id: number;
  document_id: number;
  filename: string;
  document_type: string;
  unit_type: string;
  section_title: string;
  anchor: string;
  page_start: number;
  page_end: number;
  content: string;
};

export type HistoricalBid = {
  id: number;
  organization_id: number;
  document_id: number;
  source_type: string;
  project_type: string;
  region: string;
  year: number;
  is_recommended: boolean;
  default_usage_mode: string;
  ingestion_status: string;
  created_at: string;
};

export type HistoricalBidSection = {
  id: number;
  historical_bid_document_id: number;
  title: string;
  section_path: string;
  section_type: string;
  anchor: string;
  page_start: number;
  page_end: number;
  raw_text: string;
  fts_text: string;
  created_at: string;
};

export type HistoricalReuseUnit = {
  id: number;
  historical_bid_section_id: number;
  unit_type: string;
  raw_text: string;
  sanitized_text: string;
  reuse_mode: string;
  fact_density_score: number;
  risk_level: string;
  created_at: string;
};

export type ReusePackItem = {
  id: number;
  historical_bid_section_id: number;
  unit_type: string;
  sanitized_text: string;
  reuse_mode: string;
  fact_density_score: number;
  risk_level: string;
};

export type HistoricalReusePack = {
  query: { project_type: string; section_type: string };
  safe_reuse: ReusePackItem[];
  slot_reuse: ReusePackItem[];
  style_only: ReusePackItem[];
};

export type HistoricalLeakageResult = {
  ok: boolean;
  matched_terms: string[];
};

export type WorkbenchModuleSummary = {
  module_key: string;
  title: string;
  count: number;
  status: string;
  description: string;
};

export type WorkbenchOverview = {
  project_id: number | null;
  modules: WorkbenchModuleSummary[];
};

export type KnowledgeBaseEntry = {
  id: number;
  organization_id: number;
  project_id: number | null;
  source_document_id: number | null;
  category: string;
  title: string;
  owner_name: string;
  ingestion_status: string;
  detection_status: string;
  detected_summary: string;
  created_by_user_id: number;
  created_at: string;
};

export type DecompositionRun = {
  id: number;
  organization_id: number;
  project_id: number;
  source_document_id: number | null;
  run_name: string;
  status: string;
  progress_pct: number;
  summary_json: string;
  created_by_user_id: number;
  created_at: string;
};

export type GenerationJob = {
  id: number;
  organization_id: number;
  project_id: number;
  source_document_id: number | null;
  job_name: string;
  target_sections: number;
  status: string;
  created_by_user_id: number;
  created_at: string;
};

export type ReviewRun = {
  id: number;
  organization_id: number;
  project_id: number;
  source_document_id: number | null;
  run_name: string;
  review_mode: string;
  status: string;
  simulated_score: number | null;
  blocking_issue_count: number;
  created_by_user_id: number;
  created_at: string;
};

export type LayoutJob = {
  id: number;
  organization_id: number;
  project_id: number;
  source_document_id: number | null;
  job_name: string;
  template_name: string;
  status: string;
  created_by_user_id: number;
  created_at: string;
};

export type SubmissionRecord = {
  id: number;
  organization_id: number;
  project_id: number;
  source_document_id: number | null;
  title: string;
  status: string;
  created_by_user_id: number;
  created_at: string;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:8080";

async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (
    init.body &&
    !(init.body instanceof FormData) &&
    !(init.body instanceof URLSearchParams) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message =
      (data && typeof data === "object" && "detail" in data && typeof data.detail === "string"
        ? data.detail
        : response.statusText) || "Request failed";
    throw new ApiError(message, response.status);
  }

  return data as T;
}

export function login(username: string, password: string) {
  const payload = new URLSearchParams({ username, password });
  return apiRequest<{ access_token: string; token_type: string }>(
    "/api/v1/auth/login",
    {
      method: "POST",
      body: payload,
    },
  );
}

export function getRuntimeSettings(token: string) {
  return apiRequest<RuntimeSettings>("/api/v1/runtime-settings", {}, token);
}

export function runConnectivityCheck(
  token: string,
  payload: RuntimeConnectivityRequest,
) {
  return apiRequest<RuntimeConnectivityResult>(
    "/api/v1/runtime-settings/connectivity-check",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token,
  );
}

export function listProjects(token: string) {
  return apiRequest<Project[]>("/api/v1/projects", {}, token);
}

export function createProject(token: string, name: string) {
  return apiRequest<Project>(
    "/api/v1/projects",
    {
      method: "POST",
      body: JSON.stringify({ name }),
    },
    token,
  );
}

export function listDocuments(token: string, projectId: number) {
  return apiRequest<DocumentRecord[]>(`/api/v1/projects/${projectId}/documents`, {}, token);
}

export function uploadDocument(
  token: string,
  projectId: number,
  documentType: string,
  file: File,
) {
  const formData = new FormData();
  formData.append("document_type", documentType);
  formData.append("file", file);
  return apiRequest<DocumentRecord>(
    `/api/v1/projects/${projectId}/documents/upload`,
    {
      method: "POST",
      body: formData,
    },
    token,
  );
}

export function listEvidenceUnits(token: string, projectId: number, documentId: number) {
  return apiRequest<EvidenceUnit[]>(
    `/api/v1/projects/${projectId}/documents/${documentId}/evidence-units`,
    {},
    token,
  );
}

export function searchEvidence(
  token: string,
  projectId: number,
  q: string,
  documentType?: string,
) {
  const params = new URLSearchParams({ q });
  if (documentType) {
    params.set("document_type", documentType);
  }
  return apiRequest<EvidenceSearchResult[]>(
    `/api/v1/projects/${projectId}/evidence/search?${params.toString()}`,
    {},
    token,
  );
}

export function listHistoricalBids(token: string) {
  return apiRequest<HistoricalBid[]>("/api/v1/historical-bids", {}, token);
}

export function importHistoricalBid(
  token: string,
  payload: {
    document_id: number;
    source_type: string;
    project_type: string;
    region: string;
    year: number;
    is_recommended: boolean;
  },
) {
  return apiRequest<HistoricalBid>(
    "/api/v1/historical-bids/import",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token,
  );
}

export function rebuildHistoricalSections(token: string, historicalBidId: number) {
  return apiRequest<HistoricalBidSection[]>(
    `/api/v1/historical-bids/${historicalBidId}/rebuild-sections`,
    { method: "POST" },
    token,
  );
}

export function listHistoricalSections(token: string, historicalBidId: number) {
  return apiRequest<HistoricalBidSection[]>(
    `/api/v1/historical-bids/${historicalBidId}/sections`,
    {},
    token,
  );
}

export function rebuildHistoricalReuseUnits(token: string, historicalBidId: number) {
  return apiRequest<HistoricalReuseUnit[]>(
    `/api/v1/historical-bids/${historicalBidId}/rebuild-reuse-units`,
    { method: "POST" },
    token,
  );
}

export function listHistoricalReuseUnits(token: string, historicalBidId: number) {
  return apiRequest<HistoricalReuseUnit[]>(
    `/api/v1/historical-bids/${historicalBidId}/reuse-units`,
    {},
    token,
  );
}

export function searchHistoricalReuse(
  token: string,
  projectType: string,
  sectionType: string,
) {
  const params = new URLSearchParams({
    project_type: projectType,
    section_type: sectionType,
  });
  return apiRequest<HistoricalReusePack>(
    `/api/v1/historical-bids/reuse-units/search?${params.toString()}`,
    {},
    token,
  );
}

export function verifyHistoricalLeakage(
  token: string,
  projectId: number,
  sectionId: string,
  payload: {
    draft_text: string;
    forbidden_legacy_terms: string[];
    history_candidate_pack: { reuse_unit_ids: number[] };
  },
) {
  return apiRequest<HistoricalLeakageResult>(
    `/api/v1/projects/${projectId}/sections/${sectionId}/verify-historical-leakage`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token,
  );
}

export function getWorkbenchOverview(token: string, projectId?: number) {
  const params = new URLSearchParams();
  if (typeof projectId === "number") {
    params.set("project_id", String(projectId));
  }
  const query = params.toString();
  return apiRequest<WorkbenchOverview>(`/api/v1/workbench/overview${query ? `?${query}` : ""}`, {}, token);
}

export function listKnowledgeBaseEntries(token: string, projectId?: number) {
  const params = new URLSearchParams();
  if (typeof projectId === "number") {
    params.set("project_id", String(projectId));
  }
  const query = params.toString();
  return apiRequest<KnowledgeBaseEntry[]>(
    `/api/v1/workbench/library/entries${query ? `?${query}` : ""}`,
    {},
    token,
  );
}

export function createKnowledgeBaseEntry(
  token: string,
  payload: {
    project_id?: number;
    source_document_id?: number;
    category: string;
    title: string;
    owner_name?: string;
  },
) {
  return apiRequest<KnowledgeBaseEntry>(
    "/api/v1/workbench/library/entries",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token,
  );
}

export function runKnowledgeBaseCheck(token: string, entryId: number) {
  return apiRequest<KnowledgeBaseEntry>(
    `/api/v1/workbench/library/entries/${entryId}/run-check`,
    {
      method: "POST",
    },
    token,
  );
}

export function listDecompositionRuns(token: string, projectId?: number) {
  const params = new URLSearchParams();
  if (typeof projectId === "number") {
    params.set("project_id", String(projectId));
  }
  const query = params.toString();
  return apiRequest<DecompositionRun[]>(
    `/api/v1/workbench/decomposition/runs${query ? `?${query}` : ""}`,
    {},
    token,
  );
}

export function createDecompositionRun(
  token: string,
  payload: {
    project_id: number;
    source_document_id?: number;
    run_name: string;
  },
) {
  return apiRequest<DecompositionRun>(
    "/api/v1/workbench/decomposition/runs",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token,
  );
}

export function listGenerationJobs(token: string, projectId?: number) {
  const params = new URLSearchParams();
  if (typeof projectId === "number") {
    params.set("project_id", String(projectId));
  }
  const query = params.toString();
  return apiRequest<GenerationJob[]>(
    `/api/v1/workbench/generation/jobs${query ? `?${query}` : ""}`,
    {},
    token,
  );
}

export function createGenerationJob(
  token: string,
  payload: {
    project_id: number;
    source_document_id?: number;
    job_name: string;
    target_sections: number;
  },
) {
  return apiRequest<GenerationJob>(
    "/api/v1/workbench/generation/jobs",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token,
  );
}

export function listReviewRuns(token: string, projectId?: number) {
  const params = new URLSearchParams();
  if (typeof projectId === "number") {
    params.set("project_id", String(projectId));
  }
  const query = params.toString();
  return apiRequest<ReviewRun[]>(
    `/api/v1/workbench/review/runs${query ? `?${query}` : ""}`,
    {},
    token,
  );
}

export function createReviewRun(
  token: string,
  payload: {
    project_id: number;
    source_document_id?: number;
    run_name: string;
    review_mode: string;
  },
) {
  return apiRequest<ReviewRun>(
    "/api/v1/workbench/review/runs",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token,
  );
}

export function listLayoutJobs(token: string, projectId?: number) {
  const params = new URLSearchParams();
  if (typeof projectId === "number") {
    params.set("project_id", String(projectId));
  }
  const query = params.toString();
  return apiRequest<LayoutJob[]>(
    `/api/v1/workbench/layout/jobs${query ? `?${query}` : ""}`,
    {},
    token,
  );
}

export function createLayoutJob(
  token: string,
  payload: {
    project_id: number;
    source_document_id?: number;
    job_name: string;
    template_name: string;
  },
) {
  return apiRequest<LayoutJob>(
    "/api/v1/workbench/layout/jobs",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token,
  );
}

export function listSubmissionRecords(token: string, projectId?: number) {
  const params = new URLSearchParams();
  if (typeof projectId === "number") {
    params.set("project_id", String(projectId));
  }
  const query = params.toString();
  return apiRequest<SubmissionRecord[]>(
    `/api/v1/workbench/submission-records${query ? `?${query}` : ""}`,
    {},
    token,
  );
}

export function createSubmissionRecord(
  token: string,
  payload: {
    project_id: number;
    source_document_id?: number;
    title: string;
    status: string;
  },
) {
  return apiRequest<SubmissionRecord>(
    "/api/v1/workbench/submission-records",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token,
  );
}
