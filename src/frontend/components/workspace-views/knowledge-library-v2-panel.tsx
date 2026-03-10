"use client";

import { type FormEvent, useEffect, useState } from "react";

import {
  ApiError,
  createCompanyAssetRecord,
  createCompanyPerformanceRecord,
  createCompanyQualificationRecord,
  createLibraryDocumentRecord,
  createPersonnelPerformanceRecord,
  createPersonnelQualificationRecord,
  getLibraryRecordDetail,
  type HistoricalBid,
  type HistoricalBidSection,
  type HistoricalLeakageResult,
  type HistoricalReusePack,
  type HistoricalReuseUnit,
  listLibraryProjectCategories,
  listLibraryRecords,
  listLibraryReviews,
  searchLibraryRecords,
  updateLibraryRecord,
  uploadLibraryRecordAttachment,
  uploadLibraryDocumentRecord,
  type DocumentRecord,
  type LibraryProjectCategoryOption,
  type LibraryRecord,
  type LibraryRecordDetail,
  type LibraryReview,
  type LibrarySearchResult,
} from "../../lib/api";
import { formatDate, formatJobStatus, formatProjectType, formatRiskLevel, formatStoragePath } from "./utils";

type KnowledgeLibraryV2PanelProps = {
  token: string | null;
  selectedProjectId: number | null;
  documents: DocumentRecord[];
  historicalBids: HistoricalBid[];
  selectedHistoricalBid: HistoricalBid | null;
  historicalSections: HistoricalBidSection[];
  historicalReuseUnits: HistoricalReuseUnit[];
  reusePack: HistoricalReusePack | null;
  importDocumentId: number | null;
  historicalSourceType: string;
  historicalProjectType: string;
  historicalRegion: string;
  historicalYear: string;
  historicalRecommended: boolean;
  reuseSectionType: string;
  leakageSectionId: string;
  leakageDraftText: string;
  leakageForbiddenTerms: string;
  leakageReuseUnitIds: string;
  leakageResult: HistoricalLeakageResult | null;
  setImportDocumentId: (value: number | null) => void;
  setSelectedHistoricalBidId: (value: number | null) => void;
  setHistoricalSourceType: (value: string) => void;
  setHistoricalProjectType: (value: string) => void;
  setHistoricalRegion: (value: string) => void;
  setHistoricalYear: (value: string) => void;
  setHistoricalRecommended: (value: boolean) => void;
  setReuseSectionType: (value: string) => void;
  setLeakageSectionId: (value: string) => void;
  setLeakageDraftText: (value: string) => void;
  setLeakageForbiddenTerms: (value: string) => void;
  setLeakageReuseUnitIds: (value: string) => void;
  handleImportHistoricalBid: (event: FormEvent<HTMLFormElement>) => void;
  handleLoadHistoricalArtifacts: () => void;
  handleRebuildSections: () => void;
  handleRebuildReuseUnits: () => void;
  handleSearchReuse: (event: FormEvent<HTMLFormElement>) => void;
  handleVerifyLeakage: (event: FormEvent<HTMLFormElement>) => void;
};

const RECORD_TABS = [
  { key: "historical_bid", label: "历史投标文件" },
  { key: "excellent_bid", label: "优秀标书" },
  { key: "norm_spec", label: "规范规程" },
  { key: "company_qualification", label: "公司资质" },
  { key: "company_performance", label: "公司业绩" },
  { key: "company_asset", label: "公司资产" },
  { key: "personnel_qualification", label: "人员资质" },
  { key: "personnel_performance", label: "人员业绩" },
] as const;

type RecordTabKey = (typeof RECORD_TABS)[number]["key"];

const ATTACHMENT_ROLE_OPTIONS: Record<RecordTabKey, { value: string; label: string }[]> = {
  historical_bid: [{ value: "source_document", label: "标书原文" }],
  excellent_bid: [{ value: "source_document", label: "标书原文" }],
  norm_spec: [{ value: "source_document", label: "规范原文" }],
  company_qualification: [{ value: "proof_certificate", label: "资质证明文件" }],
  company_performance: [
    { value: "proof_contract", label: "合同文件" },
    { value: "proof_commencement", label: "开工报告" },
    { value: "proof_completion", label: "竣工报告" },
    { value: "proof_owner_review", label: "业主评价" },
  ],
  company_asset: [
    { value: "asset_photo", label: "设备照片" },
    { value: "asset_contract", label: "采购合同" },
  ],
  personnel_qualification: [
    { value: "proof_certificate", label: "职称/资质证书" },
    { value: "proof_social_security", label: "社保证明" },
  ],
  personnel_performance: [{ value: "proof_contract", label: "人员业绩证明文件" }],
};

export function KnowledgeLibraryV2Panel({
  token,
  selectedProjectId,
  documents,
  historicalBids,
  selectedHistoricalBid,
  historicalSections,
  historicalReuseUnits,
  reusePack,
  importDocumentId,
  historicalSourceType,
  historicalProjectType,
  historicalRegion,
  historicalYear,
  historicalRecommended,
  reuseSectionType,
  leakageSectionId,
  leakageDraftText,
  leakageForbiddenTerms,
  leakageReuseUnitIds,
  leakageResult,
  setImportDocumentId,
  setSelectedHistoricalBidId,
  setHistoricalSourceType,
  setHistoricalProjectType,
  setHistoricalRegion,
  setHistoricalYear,
  setHistoricalRecommended,
  setReuseSectionType,
  setLeakageSectionId,
  setLeakageDraftText,
  setLeakageForbiddenTerms,
  setLeakageReuseUnitIds,
  handleImportHistoricalBid,
  handleLoadHistoricalArtifacts,
  handleRebuildSections,
  handleRebuildReuseUnits,
  handleSearchReuse,
  handleVerifyLeakage,
}: KnowledgeLibraryV2PanelProps) {
  const [activeTab, setActiveTab] = useState<RecordTabKey>("historical_bid");
  const [projectCategories, setProjectCategories] = useState<LibraryProjectCategoryOption[]>([]);
  const [records, setRecords] = useState<LibraryRecord[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);
  const [selectedRecordDetail, setSelectedRecordDetail] = useState<LibraryRecordDetail | null>(null);
  const [searchResults, setSearchResults] = useState<LibrarySearchResult[]>([]);
  const [pendingReviews, setPendingReviews] = useState<LibraryReview[]>([]);
  const [recordReviews, setRecordReviews] = useState<LibraryReview[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "awaiting_review" | "published">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [busyLabel, setBusyLabel] = useState("");
  const [message, setMessage] = useState("新版资料库支持统一入库、附件挂载和检索。");

  const [documentSourceId, setDocumentSourceId] = useState<number | null>(null);
  const [documentUploadFile, setDocumentUploadFile] = useState<File | null>(null);
  const [projectCategory, setProjectCategory] = useState("配网工程");
  const [title, setTitle] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [attachmentRole, setAttachmentRole] = useState("proof_contract");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [editableSummary, setEditableSummary] = useState("");
  const [editableTags, setEditableTags] = useState("");
  const [editableWeight, setEditableWeight] = useState("1.0");

  const [qualificationLevel, setQualificationLevel] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [certificateNo, setCertificateNo] = useState("");
  const [projectFeatures, setProjectFeatures] = useState("");
  const [contractAmount, setContractAmount] = useState("");
  const [startDate, setStartDate] = useState("");
  const [completionDate, setCompletionDate] = useState("");
  const [equipmentBrand, setEquipmentBrand] = useState("");
  const [equipmentModel, setEquipmentModel] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [personName, setPersonName] = useState("");
  const [education, setEducation] = useState("");
  const [titleName, setTitleName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectRole, setProjectRole] = useState("");

  async function loadProjectCategories(currentToken: string) {
    try {
      const payload = await listLibraryProjectCategories(currentToken);
      setProjectCategories(payload);
      if (payload.length > 0) {
        setProjectCategory(payload[0].key);
      }
    } catch (error) {
      setProjectCategories([]);
      setMessage(readClientError(error));
    }
  }

  async function loadRecords(currentToken: string, tab: RecordTabKey) {
    try {
      const payload = await listLibraryRecords(currentToken, {
        record_type: tab,
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
      setRecords(payload);
      const reviews = await listLibraryReviews(currentToken, { review_status: "awaiting_review" });
      setPendingReviews(reviews);
      if (payload.length > 0) {
        setSelectedRecordId(payload[0].id);
        const detail = await getLibraryRecordDetail(currentToken, payload[0].id);
        setSelectedRecordDetail(detail);
        setRecordReviews(await listLibraryReviews(currentToken, { record_id: payload[0].id }));
      } else {
        setSelectedRecordId(null);
        setSelectedRecordDetail(null);
        setRecordReviews([]);
      }
    } catch (error) {
      setRecords([]);
      setPendingReviews([]);
      setSelectedRecordId(null);
      setSelectedRecordDetail(null);
      setRecordReviews([]);
      setMessage(readClientError(error));
    }
  }

  useEffect(() => {
    if (!token) {
      return;
    }
    void loadProjectCategories(token);
  }, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }
    void loadRecords(token, activeTab);
  }, [token, activeTab, statusFilter]);

  useEffect(() => {
    if (documents.length > 0 && documentSourceId === null) {
      setDocumentSourceId(documents[0].id);
    }
  }, [documentSourceId, documents]);

  useEffect(() => {
    const options = ATTACHMENT_ROLE_OPTIONS[activeTab];
    if (options.length > 0) {
      setAttachmentRole(options[0].value);
    }
  }, [activeTab]);

  async function handleSelectRecord(recordId: number) {
    if (!token) {
      return;
    }
    setSelectedRecordId(recordId);
    const detail = await getLibraryRecordDetail(token, recordId);
    setSelectedRecordDetail(detail);
    setEditableSummary(detail.summary_text || "");
    setEditableTags(detail.tags_json || "[]");
    setEditableWeight(String(detail.confidence_weight ?? 1));
    setRecordReviews(await listLibraryReviews(token, { record_id: recordId }));
  }

  async function handleCreateRecord() {
    if (!token) {
      return;
    }
    setBusyLabel("正在创建资料记录");
    try {
      let record: LibraryRecord;
      if (activeTab === "historical_bid" || activeTab === "excellent_bid" || activeTab === "norm_spec") {
        if (documentUploadFile && selectedProjectId) {
          record = await uploadLibraryDocumentRecord(token, {
            project_id: selectedProjectId,
            record_type: activeTab,
            title: title || documentUploadFile.name,
            project_category: projectCategory,
            owner_name: ownerName,
            file: documentUploadFile,
          });
        } else if (!documentSourceId) {
          setMessage("请先上传文档，或选择一份已上传文档。");
          return;
        } else {
          record = await createLibraryDocumentRecord(token, {
            project_id: selectedProjectId,
            source_document_id: documentSourceId,
            record_type: activeTab,
            title: title || documents.find((item) => item.id === documentSourceId)?.filename || "未命名资料",
            project_category: projectCategory,
            owner_name: ownerName,
          });
        }
      } else if (activeTab === "company_qualification") {
        record = await createCompanyQualificationRecord(token, {
          project_id: selectedProjectId,
          title,
          project_category: projectCategory,
          owner_name: ownerName,
          qualification_name: title,
          qualification_level: qualificationLevel,
          valid_until: validUntil,
          certificate_no: certificateNo,
        });
      } else if (activeTab === "company_performance") {
        record = await createCompanyPerformanceRecord(token, {
          project_id: selectedProjectId,
          title,
          project_category: projectCategory,
          owner_name: ownerName,
          contract_name: title,
          project_features: projectFeatures,
          contract_amount: contractAmount,
          start_date: startDate,
          completion_date: completionDate,
        });
      } else if (activeTab === "company_asset") {
        record = await createCompanyAssetRecord(token, {
          project_id: selectedProjectId,
          title,
          project_category: projectCategory,
          owner_name: ownerName,
          equipment_name: title,
          equipment_brand: equipmentBrand,
          equipment_model: equipmentModel,
          purchase_date: purchaseDate,
        });
      } else if (activeTab === "personnel_qualification") {
        record = await createPersonnelQualificationRecord(token, {
          project_id: selectedProjectId,
          title,
          project_category: projectCategory,
          owner_name: ownerName,
          person_name: personName || title,
          education,
          title_name: titleName,
          qualification_name: title,
          qualification_valid_until: validUntil,
        });
      } else {
        record = await createPersonnelPerformanceRecord(token, {
          project_id: selectedProjectId,
          title,
          project_category: projectCategory,
          owner_name: ownerName,
          person_name: personName || title,
          project_name,
          project_role: projectRole,
        });
      }

      await loadRecords(token, activeTab);
      await handleSelectRecord(record.id);
      setDocumentUploadFile(null);
      setMessage(`已新增 ${RECORD_TABS.find((item) => item.key === activeTab)?.label} 记录。`);
    } finally {
      setBusyLabel("");
    }
  }

  async function handleUploadAttachment() {
    if (!token || !selectedRecordId || !attachmentFile) {
      return;
    }
    setBusyLabel("正在上传附件");
    try {
      await uploadLibraryRecordAttachment(token, selectedRecordId, {
        attachment_role: attachmentRole,
        file: attachmentFile,
      });
      await handleSelectRecord(selectedRecordId);
      setAttachmentFile(null);
      setMessage("附件已上传并加入资料检索。");
    } finally {
      setBusyLabel("");
    }
  }

  async function handleSearch() {
    if (!token || !searchQuery.trim()) {
      return;
    }
    setBusyLabel("正在搜索资料");
    try {
      const payload = await searchLibraryRecords(token, {
        q: searchQuery.trim(),
        record_type: activeTab,
        project_category: projectCategory || undefined,
      });
      setSearchResults(payload);
      setMessage(`检索完成，共命中 ${payload.length} 条资料。`);
    } finally {
      setBusyLabel("");
    }
  }

  async function handleStatusChange(nextStatus: string) {
    if (!token || !selectedRecordId) {
      return;
    }
    setBusyLabel("正在更新状态");
    try {
      await updateLibraryRecord(token, selectedRecordId, {
        status: nextStatus,
        review_notes: reviewNotes,
      });
      await loadRecords(token, activeTab);
      await handleSelectRecord(selectedRecordId);
      setMessage(`资料状态已更新为 ${nextStatus}。`);
    } finally {
      setBusyLabel("");
    }
  }

  async function handleSaveReviewEdits() {
    if (!token || !selectedRecordId) {
      return;
    }
    setBusyLabel("正在保存复核内容");
    try {
      await updateLibraryRecord(token, selectedRecordId, {
        summary_text: editableSummary,
        tags_json: editableTags,
        confidence_weight: Number(editableWeight) || 1,
        review_notes: reviewNotes,
      });
      await loadRecords(token, activeTab);
      await handleSelectRecord(selectedRecordId);
      setMessage("复核内容已保存。");
    } finally {
      setBusyLabel("");
    }
  }

  function renderStructuredFields() {
    switch (activeTab) {
      case "company_qualification":
        return (
          <div className="three-column three-column-equal">
            <label>
              资质等级
              <input value={qualificationLevel} onChange={(event) => setQualificationLevel(event.target.value)} />
            </label>
            <label>
              有效期
              <input value={validUntil} onChange={(event) => setValidUntil(event.target.value)} />
            </label>
            <label>
              证书编号
              <input value={certificateNo} onChange={(event) => setCertificateNo(event.target.value)} />
            </label>
          </div>
        );
      case "company_performance":
        return (
          <div className="three-column three-column-equal">
            <label>
              项目特征
              <input value={projectFeatures} onChange={(event) => setProjectFeatures(event.target.value)} />
            </label>
            <label>
              合同金额
              <input value={contractAmount} onChange={(event) => setContractAmount(event.target.value)} />
            </label>
            <label>
              开工/竣工
              <input
                value={`${startDate}${completionDate ? ` - ${completionDate}` : ""}`}
                onChange={(event) => {
                  const [start, end] = event.target.value.split(" - ");
                  setStartDate(start ?? "");
                  setCompletionDate(end ?? "");
                }}
              />
            </label>
          </div>
        );
      case "company_asset":
        return (
          <div className="three-column three-column-equal">
            <label>
              设备品牌
              <input value={equipmentBrand} onChange={(event) => setEquipmentBrand(event.target.value)} />
            </label>
            <label>
              规格型号
              <input value={equipmentModel} onChange={(event) => setEquipmentModel(event.target.value)} />
            </label>
            <label>
              采购时间
              <input value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} />
            </label>
          </div>
        );
      case "personnel_qualification":
        return (
          <div className="three-column three-column-equal">
            <label>
              人员名称
              <input value={personName} onChange={(event) => setPersonName(event.target.value)} />
            </label>
            <label>
              学历
              <input value={education} onChange={(event) => setEducation(event.target.value)} />
            </label>
            <label>
              职称/有效期
              <input
                value={`${titleName}${validUntil ? ` · ${validUntil}` : ""}`}
                onChange={(event) => {
                  const [nextTitle, nextDate] = event.target.value.split(" · ");
                  setTitleName(nextTitle ?? "");
                  setValidUntil(nextDate ?? "");
                }}
              />
            </label>
          </div>
        );
      case "personnel_performance":
        return (
          <div className="three-column three-column-equal">
            <label>
              人员名称
              <input value={personName} onChange={(event) => setPersonName(event.target.value)} />
            </label>
            <label>
              项目名称
              <input value={projectName} onChange={(event) => setProjectName(event.target.value)} />
            </label>
            <label>
              项目角色
              <input value={projectRole} onChange={(event) => setProjectRole(event.target.value)} />
            </label>
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <section className="workspace-stack library-v2-shell">
      <section className="surface-card library-v2-card">
        <div className="panel-header">
          <div>
            <h3>投标资料库</h3>
          </div>
          <span className="badge">{busyLabel || "就绪"}</span>
        </div>

        <div className="library-record-tabs" role="tablist" aria-label="资料类型">
          {RECORD_TABS.map((tab) => (
            <button
              aria-selected={activeTab === tab.key}
              key={tab.key}
              className={`library-record-tab ${activeTab === tab.key ? "library-record-tab-active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
              role="tab"
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="library-filter-tabs" role="tablist" aria-label="资料状态">
          <button
            aria-selected={statusFilter === "all"}
            className={`library-filter-tab ${statusFilter === "all" ? "library-filter-tab-active" : ""}`}
            onClick={() => setStatusFilter("all")}
            role="tab"
            type="button"
          >
            全部
          </button>
          <button
            aria-selected={statusFilter === "awaiting_review"}
            className={`library-filter-tab ${statusFilter === "awaiting_review" ? "library-filter-tab-active" : ""}`}
            onClick={() => setStatusFilter("awaiting_review")}
            role="tab"
            type="button"
          >
            待复核
          </button>
          <button
            aria-selected={statusFilter === "published"}
            className={`library-filter-tab ${statusFilter === "published" ? "library-filter-tab-active" : ""}`}
            onClick={() => setStatusFilter("published")}
            role="tab"
            type="button"
          >
            已发布
          </button>
        </div>

        {pendingReviews.length > 0 ? (
          <section className="surface-card library-v2-subcard">
            <div className="panel-header compact">
              <div>
                <h3>优先处理这些资料</h3>
              </div>
              <span className="badge">{pendingReviews.length}</span>
            </div>
            <div className="mini-list">
              {pendingReviews.slice(0, 6).map((review) => (
                <div className="mini-item" key={review.id}>
                  <div>
                    <strong>记录 #{review.library_record_id}</strong>
                    <span>{review.review_notes || "待人工复核后发布"}</span>
                  </div>
                  <button className="ghost-button" onClick={() => void handleSelectRecord(review.library_record_id)} type="button">
                    打开
                  </button>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <div className="workspace-grid workspace-grid-2">
          <div className="stack">
            <div className="panel-header compact">
              <div>
                <p className="eyebrow">录入向导</p>
                <h3>{RECORD_TABS.find((item) => item.key === activeTab)?.label}</h3>
              </div>
            </div>
            <div className="three-column three-column-equal">
              <label>
                项目类别
                <select value={projectCategory} onChange={(event) => setProjectCategory(event.target.value)}>
                  {projectCategories.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                资料标题
                <input value={title} onChange={(event) => setTitle(event.target.value)} />
              </label>
              <label>
                归口部门
                <input value={ownerName} onChange={(event) => setOwnerName(event.target.value)} />
              </label>
            </div>

            {activeTab === "historical_bid" || activeTab === "excellent_bid" || activeTab === "norm_spec" ? (
              <div className="three-column three-column-equal" key="document-upload">
                <label>
                  直接上传
                  <input key="document-upload-file" type="file" onChange={(event) => setDocumentUploadFile(event.target.files?.[0] ?? null)} />
                </label>
                <label>
                  或选择已上传文档
                  <select
                    value={documentSourceId ?? ""}
                    onChange={(event) => setDocumentSourceId(Number(event.target.value) || null)}
                  >
                    <option value="">请选择</option>
                    {documents.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.filename} · {item.document_type}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : (
              <div key={activeTab}>{renderStructuredFields()}</div>
            )}

            <div className="list-actions">
              <button className="primary-button" disabled={!token || !title.trim() || Boolean(busyLabel)} onClick={() => void handleCreateRecord()} type="button">
                新增记录
              </button>
              <span>{message}</span>
            </div>
          </div>

          <div className="stack">
            <div className="panel-header compact">
              <div>
                <p className="eyebrow">统一检索</p>
                <h3>按分类和关键词查询</h3>
              </div>
            </div>
            <div className="three-column three-column-equal">
              <label>
                关键词
                <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
              </label>
              <div className="align-end">
                <button className="primary-button" disabled={!token || !searchQuery.trim() || Boolean(busyLabel)} onClick={() => void handleSearch()} type="button">
                  开始检索
                </button>
              </div>
            </div>
            <div className="list">
              {(searchResults.length > 0 ? searchResults.map((item) => item.record) : records).map((record) => (
                <button
                  key={record.id}
                  className={`list-item ${selectedRecordId === record.id ? "list-item-active" : ""}`}
                  onClick={() => void handleSelectRecord(record.id)}
                  type="button"
                >
                  <div>
                    <strong>{record.title}</strong>
                    <p>
                      {record.project_category} · {formatJobStatus(record.status)} · 权重 {record.confidence_weight.toFixed(1)}
                    </p>
                  </div>
                  <span>{formatDate(record.updated_at)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="workspace-grid workspace-grid-2">
          <section className="surface-card library-v2-subcard">
            <div className="panel-header compact">
              <div>
                <h3>{selectedRecordDetail?.title || "未选择记录"}</h3>
              </div>
              <span className="badge">{selectedRecordDetail ? selectedRecordDetail.record_type : "空"}</span>
            </div>
            {selectedRecordDetail ? (
              <div className="stack">
                <label>
                  摘要
                  <textarea value={editableSummary} onChange={(event) => setEditableSummary(event.target.value)} rows={4} />
                </label>
                <label>
                  标签 JSON
                  <input value={editableTags} onChange={(event) => setEditableTags(event.target.value)} />
                </label>
                <label>
                  召回权重
                  <input value={editableWeight} onChange={(event) => setEditableWeight(event.target.value)} />
                </label>
                <div className="summary-list">
                  <div className="summary-item">
                    <span>项目类别</span>
                    <strong>{selectedRecordDetail.project_category}</strong>
                  </div>
                  <div className="summary-item">
                    <span>优先级</span>
                    <strong>{selectedRecordDetail.source_priority}</strong>
                  </div>
                  <div className="summary-item">
                    <span>切块数</span>
                    <strong>{selectedRecordDetail.chunks.length}</strong>
                  </div>
                </div>
                <div className="stack">
                  <strong>附件上传</strong>
                  <label>
                    复核备注
                    <input value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} />
                  </label>
                  <div className="list-actions">
                    <button className="primary-button" disabled={Boolean(busyLabel)} onClick={() => void handleSaveReviewEdits()} type="button">
                      保存复核内容
                    </button>
                    <button className="ghost-button" disabled={Boolean(busyLabel)} onClick={() => void handleStatusChange("published")} type="button">
                      发布入库
                    </button>
                    <button className="ghost-button" disabled={Boolean(busyLabel)} onClick={() => void handleStatusChange("disabled")} type="button">
                      停用
                    </button>
                  </div>
                  <div className="three-column three-column-equal">
                    <label>
                      附件角色
                      <select value={attachmentRole} onChange={(event) => setAttachmentRole(event.target.value)}>
                        {ATTACHMENT_ROLE_OPTIONS[activeTab].map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      选择文件
                      <input type="file" onChange={(event) => setAttachmentFile(event.target.files?.[0] ?? null)} />
                    </label>
                    <div className="align-end">
                      <button className="primary-button" disabled={!attachmentFile || Boolean(busyLabel)} onClick={() => void handleUploadAttachment()} type="button">
                        上传附件
                      </button>
                    </div>
                  </div>
                </div>
                <div className="mini-list">
                  {selectedRecordDetail.attachments.map((attachment) => (
                    <div className="mini-item" key={attachment.id}>
                      <div>
                        <strong>{attachment.filename}</strong>
                        <span>{attachment.attachment_role} · {attachment.ocr_status}</span>
                      </div>
                      <span>{formatStoragePath(attachment.storage_path)}</span>
                    </div>
                  ))}
                </div>
                <div className="mini-list">
                  {recordReviews.map((review) => (
                    <div className="mini-item" key={review.id}>
                      <div>
                        <strong>{review.review_status}</strong>
                        <span>{review.review_notes || "无复核备注"}</span>
                      </div>
                      <span>{formatDate(review.created_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p>先从左侧创建或选择一条资料记录。</p>
            )}
          </section>

          <section className="surface-card library-v2-subcard">
            <div className="panel-header compact">
              <div>
                <h3>供 AI 编写与查询使用</h3>
              </div>
            </div>
            <div className="scroll-box">
              {selectedRecordDetail?.chunks.map((chunk) => (
                <article className="result-card" key={chunk.id}>
                  <header>
                    <strong>{chunk.title || chunk.chunk_type}</strong>
                    <span>
                      {chunk.chunk_type} · p.{chunk.page_start}
                    </span>
                  </header>
                  <p>{chunk.content}</p>
                </article>
              )) || <p>暂无切块。</p>}
            </div>
          </section>
        </div>

        <section className="surface-card library-v2-subcard">
          <div className="panel-header">
            <div>
              <h3>历史样本入库与复用校验</h3>
            </div>
            <span className="badge">{historicalBids.length} 份</span>
          </div>
          <form className="stack" onSubmit={handleImportHistoricalBid}>
            <div className="three-column three-column-equal">
              <label>
                选择已上传资料
                <select
                  value={importDocumentId ?? ""}
                  onChange={(event) => setImportDocumentId(Number(event.target.value) || null)}
                >
                  <option value="">请选择文档</option>
                  {documents.map((document) => (
                    <option key={document.id} value={document.id}>
                      {document.filename} · {document.document_type}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                样本来源
                <select value={historicalSourceType} onChange={(event) => setHistoricalSourceType(event.target.value)}>
                  <option value="won_bid">历史标书</option>
                  <option value="excellent_sample">优秀标书</option>
                </select>
              </label>
              <label>
                项目类别
                <input value={historicalProjectType} onChange={(event) => setHistoricalProjectType(event.target.value)} />
              </label>
            </div>
            <div className="three-column three-column-equal">
              <label>
                区域
                <input value={historicalRegion} onChange={(event) => setHistoricalRegion(event.target.value)} />
              </label>
              <label>
                年份
                <input value={historicalYear} onChange={(event) => setHistoricalYear(event.target.value)} />
              </label>
              <label className="inline-hint">
                <input
                  checked={historicalRecommended}
                  onChange={(event) => setHistoricalRecommended(event.target.checked)}
                  type="checkbox"
                />
                推荐样本
              </label>
            </div>
            <div className="list-actions">
              <button className="primary-button" disabled={!token || !importDocumentId || Boolean(busyLabel)} type="submit">
                导入历史样本
              </button>
              <button className="ghost-button" disabled={!selectedHistoricalBid || Boolean(busyLabel)} onClick={() => void handleLoadHistoricalArtifacts()} type="button">
                刷新历史样本
              </button>
            </div>
            <div className="list">
              {historicalBids.map((item) => (
                <button
                  className={`list-item ${selectedHistoricalBid?.id === item.id ? "list-item-active" : ""}`}
                  key={item.id}
                  onClick={() => setSelectedHistoricalBidId(item.id)}
                  type="button"
                >
                  <div>
                    <strong>#{item.id}</strong>
                    <p>
                      {formatProjectType(item.project_type)} · {item.source_type} · {item.year}
                    </p>
                  </div>
                  <span>{formatJobStatus(item.ingestion_status)}</span>
                </button>
              ))}
            </div>
          </form>

          <div className="workspace-grid workspace-grid-2">
            <form className="stack" onSubmit={handleSearchReuse}>
              <div className="panel-header compact">
                <div>
                  <p className="eyebrow">复用检索</p>
                  <h3>搜索可复用片段</h3>
                </div>
              </div>
              <div className="three-column three-column-equal">
                <label>
                  样本类型
                  <input value={historicalProjectType} onChange={(event) => setHistoricalProjectType(event.target.value)} />
                </label>
                <label>
                  章节类型
                  <input value={reuseSectionType} onChange={(event) => setReuseSectionType(event.target.value)} />
                </label>
                <div className="align-end">
                  <button className="primary-button" disabled={!token || Boolean(busyLabel)} type="submit">
                    检索复用片段
                  </button>
                </div>
              </div>
              <div className="list-actions">
                <button className="ghost-button" disabled={!selectedHistoricalBid || Boolean(busyLabel)} onClick={() => void handleRebuildSections()} type="button">
                  重建章节
                </button>
                <button className="ghost-button" disabled={!selectedHistoricalBid || Boolean(busyLabel)} onClick={() => void handleRebuildReuseUnits()} type="button">
                  重建复用片段
                </button>
              </div>
              <div className="workspace-grid workspace-grid-3">
                <div className="scroll-box">
                  <strong>可直接复用</strong>
                  {reusePack?.safe_reuse?.map((item) => (
                    <article className="result-card" key={item.id}>
                      <header>
                        <strong>#{item.id}</strong>
                        <span>{formatRiskLevel(item.risk_level)}</span>
                      </header>
                      <p>{item.sanitized_text}</p>
                    </article>
                  ))}
                </div>
                <div className="scroll-box">
                  <strong>需替换信息</strong>
                  {reusePack?.slot_reuse?.map((item) => (
                    <article className="result-card" key={item.id}>
                      <header>
                        <strong>#{item.id}</strong>
                        <span>{formatRiskLevel(item.risk_level)}</span>
                      </header>
                      <p>{item.sanitized_text}</p>
                    </article>
                  ))}
                </div>
                <div className="scroll-box">
                  <strong>仅保留写法</strong>
                  {reusePack?.style_only?.map((item) => (
                    <article className="result-card" key={item.id}>
                      <header>
                        <strong>#{item.id}</strong>
                        <span>{formatRiskLevel(item.risk_level)}</span>
                      </header>
                      <p>{item.sanitized_text}</p>
                    </article>
                  ))}
                </div>
              </div>
            </form>

            <form className="stack" onSubmit={handleVerifyLeakage}>
              <div className="panel-header compact">
                <div>
                  <p className="eyebrow">历史污染校验</p>
                  <h3>检查草稿是否带出旧项目信息</h3>
                </div>
              </div>
              <div className="two-column">
                <label>
                  章节编号
                  <input value={leakageSectionId} onChange={(event) => setLeakageSectionId(event.target.value)} />
                </label>
                <label>
                  复用片段编号
                  <input value={leakageReuseUnitIds} onChange={(event) => setLeakageReuseUnitIds(event.target.value)} placeholder="1,2,3" />
                </label>
              </div>
              <label>
                禁止沿用词
                <input value={leakageForbiddenTerms} onChange={(event) => setLeakageForbiddenTerms(event.target.value)} placeholder="旧项目名,旧业主名" />
              </label>
              <label>
                待检查草稿
                <textarea rows={5} value={leakageDraftText} onChange={(event) => setLeakageDraftText(event.target.value)} />
              </label>
              <button className="primary-button" disabled={!token || !selectedProjectId || Boolean(busyLabel)} type="submit">
                校验历史污染
              </button>
              {leakageResult ? (
                <div className={`message-box ${leakageResult.ok ? "message-success" : "message-warning"}`}>
                  <strong>{leakageResult.ok ? "未命中旧项目痕迹" : "命中历史污染"}</strong>
                  <p>{leakageResult.matched_terms.join("、") || "无"}</p>
                </div>
              ) : null}
            </form>
          </div>

          <div className="workspace-grid workspace-grid-2">
            <div className="scroll-box">
              <strong>历史章节</strong>
              {historicalSections.map((section) => (
                <article className="result-card" key={section.id}>
                  <header>
                    <strong>{section.title}</strong>
                    <span>{section.section_type}</span>
                  </header>
                  <p>{section.raw_text.slice(0, 180)}</p>
                </article>
              ))}
            </div>
            <div className="scroll-box">
              <strong>复用片段</strong>
              {historicalReuseUnits.map((unit) => (
                <article className="result-card" key={unit.id}>
                  <header>
                    <strong>#{unit.id}</strong>
                    <span>复用方式 · {formatRiskLevel(unit.risk_level)}</span>
                  </header>
                  <p>{unit.sanitized_text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </section>
    </section>
  );
}

function readClientError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "登录态已失效，请刷新页面后重新登录。";
    }
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "资料库加载失败，请稍后重试。";
}
