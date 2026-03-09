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
  platform_config: {
    provider: string;
    api_base_url: string | null;
    api_key_configured: boolean;
  };
  default_models: {
    ocr_role: string;
    decomposition_navigator_role: string;
    decomposition_extractor_role: string;
    writer_role: string;
    reviewer_role: string;
    adjudicator_role: string;
  };
  role_configs: {
    ocr_role: RuntimeRoleSettings;
    decomposition_navigator_role: RuntimeRoleSettings;
    decomposition_extractor_role: RuntimeRoleSettings;
    writer_role: RuntimeRoleSettings;
    reviewer_role: RuntimeRoleSettings;
    adjudicator_role: RuntimeRoleSettings;
  };
};

type RuntimeRoleSettings = {
  api_base_url: string | null;
  api_key_configured: boolean;
  model: string;
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

export type LibraryProjectCategoryOption = {
  key: string;
  label: string;
};

export type LibraryRecord = {
  id: number;
  organization_id: number;
  project_id: number | null;
  source_document_id: number | null;
  record_type: string;
  title: string;
  project_category: string;
  owner_name: string;
  source_priority: string;
  confidence_weight: number;
  status: string;
  ingestion_mode: string;
  summary_text: string;
  tags_json: string;
  profile_json: string;
  metadata_json: string;
  current_version_no: number;
  created_by_user_id: number;
  created_at: string;
  updated_at: string;
};

export type LibraryAttachment = {
  id: number;
  library_record_id: number;
  document_id: number | null;
  attachment_role: string;
  filename: string;
  mime_type: string;
  storage_path: string;
  page_count: number;
  ocr_status: string;
  extracted_text: string;
  metadata_json: string;
  created_by_user_id: number;
  created_at: string;
};

export type LibraryChunk = {
  id: number;
  organization_id: number;
  project_id: number | null;
  library_record_id: number;
  library_record_version_id: number | null;
  attachment_id: number | null;
  chunk_type: string;
  title: string;
  section_path: string;
  anchor: string;
  page_start: number;
  page_end: number;
  content: string;
  summary_text: string;
  tags_json: string;
  source_priority: string;
  retrieval_weight: number;
  fts_text: string;
  metadata_json: string;
  created_at: string;
};

export type LibraryRecordDetail = LibraryRecord & {
  attachments: LibraryAttachment[];
  chunks: LibraryChunk[];
};

export type LibrarySearchResult = {
  record: LibraryRecord;
  chunks: LibraryChunk[];
};

export type LibraryReview = {
  id: number;
  library_record_id: number;
  library_record_version_id: number | null;
  review_status: string;
  reviewer_user_id: number | null;
  review_notes: string;
  diff_json: string;
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

export type GeneratedSection = {
  id: number;
  organization_id: number;
  project_id: number;
  source_document_id: number | null;
  section_key: string;
  title: string;
  status: string;
  draft_text: string;
  evidence_summary_json: string;
  created_by_user_id: number;
  created_at: string;
  updated_at: string;
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

export type ReviewIssue = {
  id: number;
  organization_id: number;
  project_id: number;
  review_run_id: number;
  generated_section_id: number | null;
  severity: string;
  category: string;
  title: string;
  detail: string;
  is_blocking: boolean;
  status: string;
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

export type RenderedOutput = {
  id: number;
  organization_id: number;
  project_id: number;
  source_document_id: number | null;
  layout_job_id: number | null;
  output_type: string;
  storage_path: string;
  version_tag: string;
  created_by_user_id: number;
  created_at: string;
};

export type SubmissionRecordFilters = {
  status?: string;
  q?: string;
  created_from?: string;
  created_to?: string;
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

async function apiBinaryRequest(
  path: string,
  init: RequestInit = {},
  token?: string | null,
): Promise<Blob> {
  const headers = new Headers(init.headers ?? {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });
  if (!response.ok) {
    let message = response.statusText || "Request failed";
    try {
      const data = await response.json();
      if (data && typeof data === "object" && "detail" in data && typeof data.detail === "string") {
        message = data.detail;
      }
    } catch {}
    throw new ApiError(message, response.status);
  }

  return response.blob();
}

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

export function listLibraryProjectCategories(token: string) {
  return apiRequest<LibraryProjectCategoryOption[]>("/api/v1/workbench/library/project-categories", {}, token);
}

export function listLibraryRecords(
  token: string,
  filters: {
    record_type?: string;
    project_category?: string;
    status?: string;
    q?: string;
  } = {},
) {
  const params = new URLSearchParams();
  if (filters.record_type) {
    params.set("record_type", filters.record_type);
  }
  if (filters.project_category) {
    params.set("project_category", filters.project_category);
  }
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.q) {
    params.set("q", filters.q);
  }
  const query = params.toString();
  return apiRequest<LibraryRecord[]>(`/api/v1/workbench/library/records${query ? `?${query}` : ""}`, {}, token);
}

export function getLibraryRecordDetail(token: string, recordId: number) {
  return apiRequest<LibraryRecordDetail>(`/api/v1/workbench/library/records/${recordId}`, {}, token);
}

export function searchLibraryRecords(
  token: string,
  payload: { q: string; record_type?: string; project_category?: string },
) {
  const params = new URLSearchParams();
  params.set("q", payload.q);
  if (payload.record_type) {
    params.set("record_type", payload.record_type);
  }
  if (payload.project_category) {
    params.set("project_category", payload.project_category);
  }
  return apiRequest<LibrarySearchResult[]>(`/api/v1/workbench/library/search?${params.toString()}`, {}, token);
}

export function createLibraryDocumentRecord(
  token: string,
  payload: {
    project_id?: number | null;
    source_document_id: number;
    record_type: string;
    title: string;
    project_category: string;
    owner_name?: string;
  },
) {
  return apiRequest<LibraryRecord>(
    "/api/v1/workbench/library/document-records",
    { method: "POST", body: JSON.stringify(payload) },
    token,
  );
}

export function uploadLibraryDocumentRecord(
  token: string,
  payload: {
    project_id: number;
    record_type: string;
    title: string;
    project_category: string;
    owner_name?: string;
    file: File;
  },
) {
  const formData = new FormData();
  formData.set("project_id", String(payload.project_id));
  formData.set("record_type", payload.record_type);
  formData.set("title", payload.title);
  formData.set("project_category", payload.project_category);
  formData.set("owner_name", payload.owner_name ?? "");
  formData.set("file", payload.file);
  return apiRequest<LibraryRecord>(
    "/api/v1/workbench/library/document-records/upload",
    { method: "POST", body: formData },
    token,
  );
}

export function createCompanyQualificationRecord(
  token: string,
  payload: {
    project_id?: number | null;
    title: string;
    project_category: string;
    owner_name?: string;
    qualification_name: string;
    qualification_level?: string;
    valid_until?: string;
    certificate_no?: string;
  },
) {
  return apiRequest<LibraryRecord>(
    "/api/v1/workbench/library/company-qualifications-v2",
    { method: "POST", body: JSON.stringify(payload) },
    token,
  );
}

export function createCompanyPerformanceRecord(
  token: string,
  payload: {
    project_id?: number | null;
    title: string;
    project_category: string;
    owner_name?: string;
    contract_name: string;
    project_features?: string;
    contract_amount?: string;
    start_date?: string;
    completion_date?: string;
  },
) {
  return apiRequest<LibraryRecord>(
    "/api/v1/workbench/library/company-performances",
    { method: "POST", body: JSON.stringify(payload) },
    token,
  );
}

export function createCompanyAssetRecord(
  token: string,
  payload: {
    project_id?: number | null;
    title: string;
    project_category: string;
    owner_name?: string;
    equipment_name: string;
    equipment_brand?: string;
    equipment_model?: string;
    purchase_date?: string;
  },
) {
  return apiRequest<LibraryRecord>(
    "/api/v1/workbench/library/company-assets-v2",
    { method: "POST", body: JSON.stringify(payload) },
    token,
  );
}

export function createPersonnelQualificationRecord(
  token: string,
  payload: {
    project_id?: number | null;
    title: string;
    project_category: string;
    owner_name?: string;
    person_name: string;
    education?: string;
    title_name?: string;
    qualification_name?: string;
    qualification_valid_until?: string;
  },
) {
  return apiRequest<LibraryRecord>(
    "/api/v1/workbench/library/personnel-qualifications-v2",
    { method: "POST", body: JSON.stringify(payload) },
    token,
  );
}

export function createPersonnelPerformanceRecord(
  token: string,
  payload: {
    project_id?: number | null;
    title: string;
    project_category: string;
    owner_name?: string;
    person_name: string;
    project_name: string;
    project_role?: string;
  },
) {
  return apiRequest<LibraryRecord>(
    "/api/v1/workbench/library/personnel-performances-v2",
    { method: "POST", body: JSON.stringify(payload) },
    token,
  );
}

export function uploadLibraryRecordAttachment(
  token: string,
  recordId: number,
  payload: { attachment_role: string; file: File },
) {
  const formData = new FormData();
  formData.set("attachment_role", payload.attachment_role);
  formData.set("file", payload.file);
  return apiRequest<LibraryAttachment>(
    `/api/v1/workbench/library/records/${recordId}/attachments/upload`,
    { method: "POST", body: formData },
    token,
  );
}

export function updateLibraryRecord(
  token: string,
  recordId: number,
  payload: {
    status?: string;
    summary_text?: string;
    tags_json?: string;
    confidence_weight?: number;
    review_notes?: string;
  },
) {
  return apiRequest<LibraryRecord>(
    `/api/v1/workbench/library/records/${recordId}`,
    { method: "PATCH", body: JSON.stringify(payload) },
    token,
  );
}

export function listLibraryReviews(
  token: string,
  filters: { review_status?: string; record_id?: number } = {},
) {
  const params = new URLSearchParams();
  if (filters.review_status) {
    params.set("review_status", filters.review_status);
  }
  if (typeof filters.record_id === "number") {
    params.set("record_id", String(filters.record_id));
  }
  const query = params.toString();
  return apiRequest<LibraryReview[]>(`/api/v1/workbench/library/reviews${query ? `?${query}` : ""}`, {}, token);
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


export function listGeneratedSections(token: string, generationJobId: number) {
  return apiRequest<GeneratedSection[]>(`/api/v1/workbench/generation/jobs/${generationJobId}/sections`, {}, token);
}

export function approveGenerationOutline(token: string, generationJobId: number) {
  return apiRequest<GenerationJob>(`/api/v1/workbench/generation/jobs/${generationJobId}/approve-outline`, {
    method: "POST",
  }, token);
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


export function listReviewIssues(token: string, reviewRunId: number) {
  return apiRequest<ReviewIssue[]>(`/api/v1/workbench/review/runs/${reviewRunId}/issues`, {}, token);
}

export function remediateReviewIssue(token: string, issueId: number) {
  return apiRequest<GeneratedSection>(`/api/v1/workbench/review/issues/${issueId}/remediate`, {
    method: "POST",
  }, token);
}

export function confirmReviewRunPass(token: string, runId: number) {
  return apiRequest<ReviewRun>(`/api/v1/workbench/review/runs/${runId}/confirm-pass`, {
    method: "POST",
  }, token);
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


export function listRenderedOutputs(token: string, layoutJobId: number) {
  return apiRequest<RenderedOutput[]>(`/api/v1/workbench/layout/jobs/${layoutJobId}/outputs`, {}, token);
}

export function downloadRenderedOutput(token: string, outputId: number) {
  return apiBinaryRequest(`/api/v1/workbench/layout/outputs/${outputId}/download`, {}, token);
}

export function downloadDocumentArtifact(token: string, projectId: number, documentId: number, artifactType: string) {
  return apiBinaryRequest(`/api/v1/projects/${projectId}/documents/${documentId}/artifacts/${artifactType}`, {}, token);
}

export function listSubmissionRecords(token: string, projectId?: number, filters: SubmissionRecordFilters = {}) {
  const params = new URLSearchParams();
  if (typeof projectId === "number") {
    params.set("project_id", String(projectId));
  }
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.q) {
    params.set("q", filters.q);
  }
  if (filters.created_from) {
    params.set("created_from", filters.created_from);
  }
  if (filters.created_to) {
    params.set("created_to", filters.created_to);
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


export function feedSubmissionRecordToLibrary(token: string, submissionRecordId: number) {
  return apiRequest<LibraryRecord>(
    `/api/v1/workbench/submission-records/${submissionRecordId}/feed-to-library`,
    {
      method: "POST",
    },
    token,
  );
}
