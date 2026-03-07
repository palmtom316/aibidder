# AI Bid Writing Platform Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 交付一个可私有化部署的 AI 标书写作 Phase 1 MVP（PDF/DOCX 输入、受控分段生成、证据可追溯、DOCX 导出）。

**Architecture:** 采用服务化边界（API 网关、文档处理、知识检索、生成编排、格式化、项目管理），以 PostgreSQL FTS 作为文本知识主干、以结构化事实查询作为企业资产主干，严格执行 `plan → retrieve → draft → verify`，并保持 OpenAI-compatible 模型网关抽象。长上下文仅用于招标文件整体解析与全局复核，不作为默认段落生成路径。

**Tech Stack:** Python 3.12+, FastAPI, SQLAlchemy, Alembic, PostgreSQL, Redis, MinIO, Celery/RQ/Arq, Next.js + React + TypeScript。

---

## 0. 实施原则（硬约束）

- Phase 1 禁止引入 embedding / vector DB / rerank。
- 事实来源仅限规范与企业事实库；历史/优秀标书可作为受控复用候选，但不作为事实真值来源。
- 每段生成内容必须可追溯来源，无法支撑则显式标记。
- 文本知识与结构化企业事实必须走两条检索通道：文档走 FTS/BM25 风格检索，企业事实走 SQL/API 查询。
- 长上下文能力仅用于 RFP 全文解析与跨章节全局一致性复核，不作为默认检索或默认生成方案。
- 所有写作输出必须经过约束矩阵与证据绑定校验后才能进入导出链路。
- 输出仅支持模板化 DOCX，保留人工 Word 最终调整。
- 历史标书运行时只能以 `reuse_pack` 形式进入写作链路；进入运行时的内容必须先脱敏，不得直接暴露原始历史文本。
- 写作运行时必须执行历史污染校验；显式禁词和已选历史复用单元的风险标记都应参与拦截。

## 1. 里程碑与交付物

### Milestone A（基础平台）

- 单仓或多服务项目脚手架
- 组织/用户/项目/RBAC 基础能力
- 文档上传与对象存储落库
- 基础可观测性（健康检查、结构化日志）
- 模型网关抽象（provider abstraction、审计、脱敏 hook、租户级凭证注入预留）

### Milestone B（文档与知识层）

- PDF/DOCX/DOC 解析产物（Markdown + JSON）
- 文档章节映射与知识单元切分（含页码/章节/段落锚点）
- 文本知识库分类与企业事实查询接口分层
- PostgreSQL FTS 索引与词典归一
- 证据包聚合接口
- 历史标书入库与章节/复用单元/风险标记抽取

### Milestone C（招标拆解）

- 结构化要求树
- 约束矩阵（constraint matrix）
- 星号项/废标项/强制响应项识别
- 硬约束快照（工期、有效期、资质等）
- 响应任务清单与证据需求清单
- `extract → grade → retry` 提取闭环

### Milestone D（受控写作）

- 工具化编排：`plan/retrieve/draft/verify`
- 分节生成与改写
- 文本证据包与结构化企业事实双路取证
- 缺失证据/冲突参数/过期资质/必答项遗漏校验
- 跨章节一致性检查

### Milestone E（格式化与交付）

- DOCX 模板渲染（封面、目录、页眉页脚、编号、附录）
- 导出版本留痕
- 已批准成品回流再入库

## 2. 工作分解（执行顺序）

1. 搭建仓库结构与 `docker-compose`（api/web/postgres/redis/minio/worker）。
2. 建立数据库基线与迁移（organizations/users/projects/documents/...）。
3. 完成认证、RBAC 与项目成员管理 API。
4. 打通上传链路：文件校验、对象存储、版本记录。
5. 接入 OCR/解析器并产出 Markdown/JSON artifacts，同时生成章节映射与证据锚点；支持 `pdf/docx/doc` 三类输入，其中 `doc` 先归一化为 `docx`。
6. 实现知识单元抽取、库分类、FTS 索引刷新任务，并定义 `evidence_unit` 抽象；为历史标书补充 section、reuse unit、risk mark 语义层。
7. 构建检索工具 API（`search_norms`、`read_norm_clause`、`search_bid_examples`）与企业事实查询 API（`get_company_fact`、`list_project_credentials`）；历史标书检索仅返回脱敏后的 `reuse_pack`。
8. 实现招标拆解引擎与结果持久化，输出要求树、约束矩阵、响应任务清单、证据需求清单。
9. 为拆解引擎增加 `extract → grade → retry` 闭环，优先保障废标项、资质、工期、有效期等强约束提取准确率。
10. 实现生成编排器（工具调用 + 证据绑定 + 校验），默认使用检索证据包，长上下文仅用于整体解析与全局复核；历史标书内容必须经过泄漏校验后才能进入后续环节。
11. 实现 DOCX 模板渲染与导出。
12. 完成前端核心流（项目→上传→拆解→写作→导出）。
13. 完成审计日志、脱敏 hook、重试机制、降级策略与验收测试。

## 3. API 与服务边界（首批）

- `api-gateway`: 鉴权、组织上下文、聚合路由。
- `document-service`: 上传、解析、artifact 管理。
- `knowledge-service`: 切分、分类、FTS 检索、证据包、章节锚点。
- `fact-service`（可先内嵌在 API 层）: 企业人员/资质/设备/项目业绩等结构化事实查询。
- `generation-service`: 编排、证据绑定、约束校验、一致性复核。
- `formatting-service`: 模板渲染与导出。
- `project-service`: 项目状态、版本、成员与审计轨迹。

## 4. 验收清单（与需求文档对齐）

- 可创建项目并分配成员角色。
- 可上传 PDF/DOCX 并生成 Markdown/JSON。
- 可为解析结果保留页码/章节级证据锚点。
- 可生成可用表格结构（重点表格）。
- 可输出招标要求清单、约束矩阵与高风险项识别结果。
- 可按证据包分节生成并显示来源页引用。
- 可从结构化企业事实库检索资质、人员、设备、业绩并绑定到章节。
- 可在导出前检测关键参数冲突与资质过期。
- 可导出模板化 DOCX 并保留历史版本。
- 可对人工批准成品执行回流入库。

## 5. 实施策略建议

- 建议按 `A→B→C→D→E` 里程碑推进，每个里程碑结束进行一次演示验收。
- 先纵向打通一条“最小闭环”链路（上传→拆解→单节生成→DOCX 导出），再横向补齐能力。
- 模型调用统一走 provider abstraction，先完成主备切换、超时重试、审计与脱敏 hook，再做高级优化。
- Phase 1 优先使用“FTS + SQL/API facts + constraint matrix + controlled generation”路线，避免过早引入图数据库与复杂多智能体网络。
- 对需要全局理解的少数任务再启用长上下文，默认段落生成坚持“小证据包 + 强校验”的低风险路径。

## 6. 数据模型增补建议

- `evidence_units`: 存储文档切分后的证据单元、页码、章节、锚点、文档类型。
- `tender_requirements`: 存储要求树节点与层级关系。
- `requirement_constraints`: 存储约束矩阵（约束类型、严重级别、量化值、来源锚点、废标标记等）。
- `generated_sections`: 存储分节写作产物与状态。
- `section_evidence_bindings`: 存储章节与证据包/企业事实的绑定关系。
- `verification_issues`: 存储校验器发现的问题、严重级别、修复状态。
- 企业事实表建议按域拆分：`qualifications`、`personnel_assets`、`equipment_assets`、`project_credentials`。

## 7. Phase 2/3 延后项边界

- Phase 2 可评估：选择性长上下文缓存、全局一致性增强校验、更完整的模型网关安全策略。
- Phase 2/3 再评估：知识图谱、Text-to-Cypher、复杂多智能体协作。
- 在验证 Phase 1 的 FTS + 结构化事实路线不足前，不引入向量检索作为默认主路径。
