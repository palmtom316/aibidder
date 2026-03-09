"use client";

import { useEffect, useState } from "react";

import {
  createCompanyAssetRecord,
  createCompanyPerformanceRecord,
  createCompanyQualificationRecord,
  createLibraryDocumentRecord,
  createPersonnelPerformanceRecord,
  createPersonnelQualificationRecord,
  getLibraryRecordDetail,
  listLibraryProjectCategories,
  listLibraryRecords,
  searchLibraryRecords,
  updateLibraryRecord,
  uploadLibraryRecordAttachment,
  uploadLibraryDocumentRecord,
  type DocumentRecord,
  type LibraryProjectCategoryOption,
  type LibraryRecord,
  type LibraryRecordDetail,
  type LibrarySearchResult,
} from "../../lib/api";
import { formatDate, formatJobStatus, formatStoragePath } from "./utils";

type KnowledgeLibraryV2PanelProps = {
  token: string | null;
  selectedProjectId: number | null;
  documents: DocumentRecord[];
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

export function KnowledgeLibraryV2Panel({ token, selectedProjectId, documents }: KnowledgeLibraryV2PanelProps) {
  const [activeTab, setActiveTab] = useState<RecordTabKey>("historical_bid");
  const [projectCategories, setProjectCategories] = useState<LibraryProjectCategoryOption[]>([]);
  const [records, setRecords] = useState<LibraryRecord[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);
  const [selectedRecordDetail, setSelectedRecordDetail] = useState<LibraryRecordDetail | null>(null);
  const [searchResults, setSearchResults] = useState<LibrarySearchResult[]>([]);
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
    const payload = await listLibraryProjectCategories(currentToken);
    setProjectCategories(payload);
    if (payload.length > 0) {
      setProjectCategory(payload[0].key);
    }
  }

  async function loadRecords(currentToken: string, tab: RecordTabKey) {
    const payload = await listLibraryRecords(currentToken, { record_type: tab });
    setRecords(payload);
    if (payload.length > 0) {
      setSelectedRecordId(payload[0].id);
      const detail = await getLibraryRecordDetail(currentToken, payload[0].id);
      setSelectedRecordDetail(detail);
    } else {
      setSelectedRecordId(null);
      setSelectedRecordDetail(null);
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
  }, [token, activeTab]);

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
    <section className="workspace-stack">
      <section className="surface-card">
        <div className="panel-header">
          <div>
            <p className="eyebrow">新版资料库</p>
            <h3>8 类资料统一入库</h3>
          </div>
          <span className="badge">{busyLabel || "可录入"}</span>
        </div>

        <div className="list-actions">
          {RECORD_TABS.map((tab) => (
            <button
              key={tab.key}
              className={activeTab === tab.key ? "primary-button" : "ghost-button"}
              onClick={() => setActiveTab(tab.key)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

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
              <div className="three-column three-column-equal">
                <label>
                  直接上传
                  <input type="file" onChange={(event) => setDocumentUploadFile(event.target.files?.[0] ?? null)} />
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
              renderStructuredFields()
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
          <section className="surface-card">
            <div className="panel-header compact">
              <div>
                <p className="eyebrow">详情</p>
                <h3>{selectedRecordDetail?.title || "未选择记录"}</h3>
              </div>
              <span className="badge">{selectedRecordDetail ? selectedRecordDetail.record_type : "空"}</span>
            </div>
            {selectedRecordDetail ? (
              <div className="stack">
                <p>{selectedRecordDetail.summary_text || "待补充总结。"}</p>
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
              </div>
            ) : (
              <p>先从左侧创建或选择一条资料记录。</p>
            )}
          </section>

          <section className="surface-card">
            <div className="panel-header compact">
              <div>
                <p className="eyebrow">切块预览</p>
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
      </section>
    </section>
  );
}
