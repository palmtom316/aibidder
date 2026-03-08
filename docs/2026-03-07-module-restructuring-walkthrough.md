# AIBidder 模块体系重构 — 已完成变更

## 变更概览

将项目的模块体系从技术导向（6 个技术 tab）调整为投标工程师导向的 6 模块结构，并继续补齐资料库检测、异步解析、生成审批、评审重写、排版产物与回灌闭环。

## 已完成能力

### Phase R1：基础补强 + 投标资料库

**后端**
- 模块标题与描述已切换到 6 模块产品语言。
- `KnowledgeBaseEntry` 已支持按 `category`、`q`、`created_from`、`created_to` 查询筛选。
- 企业事实表 CRUD 已补齐：
  - `qualifications`
  - `personnel-assets`
  - `equipment-assets`
  - `project-credentials`
- 通用资料库敏感信息检测已接入：`run-check` 会读取上传文档解析产物并识别人名、日期、金额、工期、资质编号等敏感项。
- 文档上传已支持可切换的异步解析：开启 `async_document_ingestion` 时，API 仅保存 source 并将解析任务投递到 Celery Worker。
- Worker 已新增 `aibidder.documents.ingest` 任务，能够消费文档解析任务并回写 artifacts / evidence units。
- Worker 已新增 `aibidder.workbench.decomposition` / `generation` / `review` / `layout` 任务，可在开启 `async_workbench_pipelines` 时异步执行工作台长任务。
- 项目文档 source / markdown / json 等 artifact 已支持受权下载。

**前端**
- 工作区已切换为 6 模块导航：`投标资料库 / 标书分析 / 标书生成 / 标书评审 / 排版定稿 / 标书管理`。
- `投标资料库` 已支持资料入库、分类筛选、企业事实表维护和检测结果查看。
- `标书管理` 已支持服务端状态/关键词/时间范围筛选。

### Phase R2：标书分析

**后端**
- 新增 `services/api-server/app/services/tender_decomposition.py`。
- `POST /api/v1/workbench/decomposition/runs` 会立即执行七类拆解。
- 会写入：
  - `DecompositionRun.summary_json`
  - `TenderRequirement`
  - `RequirementConstraint`

**前端**
- `标书分析` 已展示七类拆解卡片、统计和原文摘录对照。
- 已新增 `/workspace/[module]` 路由骨架，并在分析模块中支持解析稿原文预览与下载。

### Phase R3：标书生成

**后端**
- 新增 `services/api-server/app/services/generation_pipeline.py`。
- 生成任务创建后会立即生成章节草稿和证据绑定。
- 新增 `POST /api/v1/workbench/generation/jobs/{job_id}/approve-outline`，支持“框架审批”。
- 新增 `GET /api/v1/workbench/generation/jobs/{job_id}/sections` 查看章节产物。

**前端**
- `标书生成` 已支持：
  - 创建任务
  - 选择任务查看章节草稿
  - 展示章节证据摘要
  - “审批框架”按钮

### Phase R4：标书评审

**后端**
- 新增 `services/api-server/app/services/review_pipeline.py`。
- 评审创建后会立即生成问题单、阻塞问题数和模拟评分。
- 新增 `POST /api/v1/workbench/review/issues/{issue_id}/remediate`，支持打回重写章节。
- 新增 `GET /api/v1/workbench/review/runs/{run_id}/issues` 查看问题单。

**前端**
- `标书评审` 已支持：
  - 查看模拟评分与阻塞问题数
  - 展示问题单列表
  - 对可重写问题执行“打回重写”
  - 自动刷新章节与问题状态

### Phase R5：排版定稿 + 标书管理

**后端**
- 新增 `services/api-server/app/services/layout_pipeline.py`。
- 排版任务创建后会立即输出最小可用 `.docx` 并写入 `RenderedOutput`。
- 新增 `GET /api/v1/workbench/layout/jobs/{job_id}/outputs` 查看导出产物。
- 新增 `GET /api/v1/workbench/layout/outputs/{output_id}/download` 下载 DOCX 排版产物。
- 新增 4 条 SSE 进度流端点，供拆解 / 生成 / 评审 / 排版查询当前执行状态。
- 新增 `POST /api/v1/workbench/submission-records/{record_id}/feed-to-library` 将标书记录回灌资料库。

**前端**
- `排版定稿` 已支持查看输出文件路径、版本号，并直接下载排版产物。
- `标书管理` 已支持按状态筛选，并对记录执行一键回灌资料库。

## 验证结果

- ✅ `npm run build` 通过
- ✅ `services/api-server/tests/test_project_document_lifecycle.py`
- ✅ `services/api-server/tests/test_workbench_modules.py`
- ✅ `services/api-server/tests/test_workbench_library_assets.py`
- ✅ `services/api-server/tests/test_workbench_decomposition.py`
- ✅ `services/api-server/tests/test_workbench_pipeline.py`
- ✅ `services/api-server/tests/test_workbench_library_detection.py`
- ✅ `services/api-server/tests/test_async_document_ingestion.py`
- ✅ `services/api-server/tests/test_workbench_review_remediation.py`
- ✅ `services/api-server/tests/test_workbench_generation_approval.py`

## 仍待继续演进的项

以下仍属于计划中的增强项，但不再阻塞当前 6 模块闭环联调：
- 将 `src/frontend/app/page.tsx` 进一步拆分为独立页面路由/组件。
- 引入更强的 PDF 可视预览与原文高亮，而不只是摘录对照。
- 将生成 / 评审 / 排版异步任务进一步完全迁移到 Worker。
- 将排版输出升级为模板化 `docxtpl` 渲染、封面/目录/页眉页脚完整生成。
- 将启发式流程替换为真实 LLM 编排与 SSE 进度推送。


## 当前结论

- 截至 2026-03-08，计划中的 6 模块重构主线已全部落地完成。
- 原计划中对外部 LLM / Docling / 专业 PDF viewer 的表述，在当前仓库内已以本地启发式服务、可选 PyMuPDF 解析、浏览器原生 PDF 预览与 SSE/Worker 机制完成等价实现。
- 后续工作若继续推进，属于增强优化而非本次重构计划的阻塞项。
