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
- `evidence_units` 仅承载 `tender/norm` 真值证据；`proposal` 不进入真值证据层，继续走历史复用或普通项目文档链路。
- 招标文件拆解应采用“工业化流水线”思路：解析、导航、并行提取、汇总、校验、证据联动展示分层清晰，不将整份长文直接交给单轮 prompt 处理。
- Docling 可作为 PDF 高保真解析优先选项之一，重点用于章节结构、跨页表格、评分表、资格表和格式模板恢复；不改变 `pdf/docx/doc` 统一入库总边界。
- LangGraph 仅作为 Milestone C 拆解编排候选，用于显式工作流和并行提取，不替代 Phase 1 的受控写作主链路，也不将系统改造成重型 agent 网络。
- 重型 agent 仅作为生成后的全局复核层使用，承担合规、一致性、漏项、合同风险和证据支撑审查；它是第二道防线，不替代事前约束、证据绑定和规则校验。
- 招标拆解前端应采用“工作台”形态：顶部展示任务总体进度与当前阶段，中部按成果维度展示拆解卡片，底部或侧栏展示流程/证据联动；信息架构可参考工业解析任务台，但不得弱化证据定位与风险提示。
- `docx/doc` 默认走确定性结构解析，不以 AI 作为主结构解析器；AI 只负责语义补强、章节分类、表格归类和招标要点抽取。

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
- `evidence_units` 真值证据层（仅 `tender/norm`）
- 文本知识库分类与企业事实查询接口分层
- PostgreSQL FTS 索引与词典归一
- 证据包聚合接口
- 历史标书入库与章节/复用单元/风险标记抽取
- 面向招标文件的高保真 PDF 解析增强（优先评估 Docling 在跨页表格、评分表、资格表上的收益）

### Milestone C（招标拆解）

- 结构化要求树
- 约束矩阵（constraint matrix）
- 星号项/废标项/强制响应项识别
- 硬约束快照（工期、有效期、资质等）
- 响应任务清单与证据需求清单
- `extract → grade → retry` 提取闭环
- 基础信息抽取（招标编号、招标人、截止时间、开标地点、保证金及缴纳方式）
- 资格要求与资格/符合性审查抽取
- 评分标准拆解与评分索引表
- 投标文件格式要求与模板页定位
- 无效标/废标项禁止清单
- 应提交材料清单（原件/复印件/盖章要求）
- 合同关键风险条款抽取（付款方式、违约责任、工期等）

### Milestone D（受控写作）

- 工具化编排：`plan/retrieve/draft/verify`
- 分节生成与改写
- 文本证据包与结构化企业事实双路取证
- 缺失证据/冲突参数/过期资质/必答项遗漏校验
- 跨章节一致性检查
- 生成后重型 agent 复核层（合规、事实一致性、评分覆盖、合同风险、证据支撑）
- reviewer agents 问题单与 adjudicator 汇总结论

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
8. 实现招标拆解引擎与结果持久化，输出要求树、约束矩阵、响应任务清单、证据需求清单，并覆盖基础信息、资格要求、评分标准、格式要求、废标项、提交材料清单、合同风险七类核心成果。
9. 为拆解引擎增加 `extract → grade → retry` 闭环，优先保障废标项、资质、工期、有效期等强约束提取准确率；工作流编排可采用轻量 LangGraph，将导航节点、并行提取节点和汇总节点显式化。
10. 实现生成编排器（工具调用 + 证据绑定 + 校验），默认使用检索证据包，长上下文仅用于整体解析与全局复核；历史标书内容必须经过泄漏校验后才能进入后续环节。
11. 增加生成后重型 agent 复核层，按合规、事实一致性、评分覆盖、合同风险、证据支撑等维度并行审稿，并输出结构化问题单与严重级别。
12. 实现 DOCX 模板渲染与导出。
13. 完成前端核心流（项目→上传→拆解→写作→导出），其中招标拆解页采用“工作台”模板：任务总览、七类拆解卡片、流程状态、原文证据联动、高风险项提示、复核问题单入口统一呈现。
14. 完成审计日志、脱敏 hook、重试机制、降级策略与验收测试。

## 3. API 与服务边界（首批）

- `api-gateway`: 鉴权、组织上下文、聚合路由。
- `document-service`: 上传、解析、artifact 管理。
- `knowledge-service`: 切分、分类、FTS 检索、证据包、章节锚点。
- `fact-service`（可先内嵌在 API 层）: 企业人员/资质/设备/项目业绩等结构化事实查询。
- `decomposition-service`（可先内嵌在 API 层）: 招标导航、并行提取、结果汇总、评分索引表、禁止清单与合同风险抽取。
- `generation-service`: 编排、证据绑定、约束校验、一致性复核。
- `review-service`（可先内嵌在 API 层）: 多 reviewer agents 审稿、问题单汇总、严重级别判定、回改任务生成；建议至少拆分 `compliance reviewer`、`fact consistency reviewer`、`scoring coverage reviewer`、`contract risk reviewer`、`evidence reviewer` 与 `adjudicator`。
- `formatting-service`: 模板渲染与导出。
- `project-service`: 项目状态、版本、成员与审计轨迹。

## 4. 验收清单（与需求文档对齐）

- 可创建项目并分配成员角色。
- 可上传 PDF/DOCX 并生成 Markdown/JSON。
- 可为解析结果保留页码/章节级证据锚点。
- 可生成可用表格结构（重点表格）。
- 可输出招标要求清单、约束矩阵与高风险项识别结果。
- 可输出基础信息、资格要求、评分标准、格式要求、废标项、提交材料清单、合同风险等结构化拆解结果。
- 可在“招标拆解工作台”中查看任务总进度、各拆解卡片状态、当前节点、关键高风险项和原文证据跳转。
- 可按证据包分节生成并显示来源页引用。
- 可从结构化企业事实库检索资质、人员、设备、业绩并绑定到章节。
- 可在导出前检测关键参数冲突与资质过期。
- 可在整份投标文件生成后执行多维 reviewer agents 复核，并输出结构化问题单、严重级别与修复建议。
- 可按 reviewer 维度查看复核结论，并由 adjudicator 输出整稿通过/阻断/需人工处理的汇总结论。
- 可导出模板化 DOCX 并保留历史版本。
- 可对人工批准成品执行回流入库。
- 可在前端以“结果 + 原文证据”联动方式审阅关键拆解结果，降低黑盒风险。

## 5. 实施策略建议

- 建议按 `A→B→C→D→E` 里程碑推进，每个里程碑结束进行一次演示验收。
- 先纵向打通一条“最小闭环”链路（上传→拆解→单节生成→DOCX 导出），再横向补齐能力。
- 模型调用统一走 provider abstraction，先完成主备切换、超时重试、审计与脱敏 hook，再做高级优化。
- Phase 1 优先使用“FTS + SQL/API facts + constraint matrix + controlled generation”路线，避免过早引入图数据库与复杂多智能体网络。
- 对需要全局理解的少数任务再启用长上下文，默认段落生成坚持“小证据包 + 强校验”的低风险路径。
- 在招标拆解阶段可借鉴“导航节点 + 并行提取节点 + 汇总节点”的工作流设计，但应保持每个节点输出结构化 schema 和证据锚点，避免 agent 自由发挥成为不可审计的黑盒。
- 前端展示应优先支持任务进度、拆解结果分组和证据联动查看；可采用“解析任务界面/工作台”模板，但比起花哨 agent 展示，更重要的是让用户快速定位原文依据、高风险项和回改入口。
- 重型 agent 复核建议采用“多 reviewer agents + adjudicator 汇总”模式，但 reviewer 只产出结构化问题单，不直接改正文；严重问题可阻断导出，轻微问题进入人工回改闭环。
- 招标拆解工作台建议固定包含：
  - 顶部任务总览：阶段、总进度、当前执行节点
  - 中部拆解卡片：基础信息、资格要求、评分标准、投标要求、废标条款、提交清单、合同风险
  - 侧栏或下方面板：流程状态、证据预览、风险汇总、问题单入口
  - 卡片详情页：结构化结果、来源锚点、原文片段、证据跳转、人工确认状态

### 5.1 招标拆解技术路线（适配本项目）

| 挑战类型 | 具体问题 | 本项目建议方案 |
| --- | --- | --- |
| 长文档处理 | 单个模型存在上下文和注意力衰减限制，不能稳定一次处理完整招标文件 | 按章节/主题切分的 `Map-Reduce` 拆解路径；先由导航节点定位相关章节，再将局部证据送入对应 extractor；长上下文只用于整体复核，不作为默认拆解路径 |
| 跨页表格 | 评分表、资格表、格式附表可能跨页断裂，导致语义丢失 | `Docling` 作为 PDF 高保真解析优先选项，重点恢复跨页表格；下游按章节聚合为统一 `Markdown + JSON + evidence_units` |
| 结果溯源 | 拆解结果必须能回到原文页码、章节和锚点，否则用户不敢使用 | 统一 `SourceMetadata/证据锚点` 设计；每条拆解结果和每条复核问题都必须绑定 `document_id + anchor + page refs + 原文片段` |
| 实时反馈 | 用户需要知道解析/拆解/复核任务处于哪个阶段，避免黑盒等待 | 采用 `SSE` 推送任务进度；前端以“招标拆解工作台”展示总进度、当前节点、卡片状态和高风险提示 |
| 并行处理 | 七类拆解结果需要协同提取，但系统又不能失控 | 使用 `轻 LangGraph 工作流` 或等价显式编排：`navigate -> extract_* 并行 -> finalize`；保持结构化 schema 输出，不采用重型 agent 自治网络作为主链路 |
| 成本控制 | 全文反复扫描会显著增加 token 成本和时延 | 优先做章节导航、命中筛选和局部提取；只把相关章节送给对应 extractor；重型 agent 仅放在生成后复核层，不参与默认拆解主链路 |
| 写作安全 | 历史标书和招标真值若混用，容易污染写作结果 | 继续坚持 `evidence_pack` 与 `reuse_pack` 分层；拆解结果只从真值证据层产生，历史内容只进入受控复用链路 |
| 整稿合规复核 | 分节生成后仍可能出现全局参数冲突、漏项和合同风险 | 生成后增加 `多 reviewer agents + adjudicator` 复核层；输出结构化问题单，不直接改正文；严重问题阻断导出 |

### 5.2 文档类型解析与 AI 补强分工

| 文档类型 | 主解析路径 | AI 参与位置 | 建议模型 |
| --- | --- | --- | --- |
| `pdf` | 高保真 PDF 解析/OCR，优先评估 `Docling` 与兼容 OCR adapter | OCR、表格恢复后的语义拆解、章节导航、结果抽取 | `ocr_role = deepseek-ai/DeepSeek-OCR`；`decomposition_navigator_role = deepseek-ai/DeepSeek-V3.2`；`decomposition_extractor_role = Qwen/Qwen3-30B-A3B-Instruct-2507` |
| `docx` | OOXML 原生结构解析，产出 `Markdown + JSON` | 章节语义分类、表格语义归类、招标要点抽取 | `decomposition_extractor_role = Qwen/Qwen3-30B-A3B-Instruct-2507`；复杂跨章节判断使用 `decomposition_navigator_role = deepseek-ai/DeepSeek-V3.2` |
| `doc` | 先归一化为 `docx`，再走同一条 OOXML 结构解析路径 | 与 `docx` 相同，仅在结构已恢复后做语义补强 | 同 `docx` |

补充约束：

- `docx/doc` 不使用 AI 作为默认主结构解析器，避免成本上升和结构不稳定。
- `DeepSeek-R1` 不参与日常结构补强，保留给整稿复核与 adjudicator 汇总层。
- 角色模型应通过 BYOK/runtime settings 可覆盖，默认先走 `SiliconFlow OpenAI-compatible` 路径。

### 5.3 本地联调默认角色模型矩阵（BYOK）

| 角色 | 默认模型 | 用途 |
| --- | --- | --- |
| `ocr_role` | `deepseek-ai/DeepSeek-OCR` | PDF OCR、图像文本读取 |
| `decomposition_navigator_role` | `deepseek-ai/DeepSeek-V3.2` | 章节导航、任务分派、复杂跨章节判断 |
| `decomposition_extractor_role` | `Qwen/Qwen3-30B-A3B-Instruct-2507` | 七类拆解结果抽取、`docx/doc` 语义补强 |
| `writer_role` | `deepseek-ai/DeepSeek-V3` | 受控写作、改写、组织表达 |
| `reviewer_role` | `deepseek-ai/DeepSeek-R1` | 合规、一致性、漏项复核 |
| `adjudicator_role` | `deepseek-ai/DeepSeek-R1` | 多 reviewer 结论汇总与裁决 |

## 6. 数据模型增补建议

- `evidence_units`: 存储文档切分后的证据单元、页码、章节、锚点、文档类型。
- `tender_requirements`: 存储要求树节点与层级关系。
- `requirement_constraints`: 存储约束矩阵（约束类型、严重级别、量化值、来源锚点、废标标记等）。
- `generated_sections`: 存储分节写作产物与状态。
- `section_evidence_bindings`: 存储章节与证据包/企业事实的绑定关系。
- `verification_issues`: 存储校验器发现的问题、严重级别、修复状态。
- `review_runs`: 存储整稿 reviewer agent 复核批次、输入版本、模型配置和总体结论。
- `review_issues`: 存储 reviewer agent 产出的结构化问题单、问题类型、严重级别、证据引用、建议修复和处理状态。
- `decomposition_runs`: 存储招标拆解批次、当前阶段、当前节点、总进度和最终状态，服务于“招标拆解工作台”任务总览。
- `decomposition_panels`（或同等视图模型）: 存储七类拆解卡片的摘要、状态、命中数量、高风险计数与入口信息，服务于工作台卡片展示。
- 企业事实表建议按域拆分：`qualifications`、`personnel_assets`、`equipment_assets`、`project_credentials`。

## 7. Phase 2/3 延后项边界

- Phase 2 可评估：选择性长上下文缓存、全局一致性增强校验、更完整的模型网关安全策略。
- Phase 2/3 再评估：知识图谱、Text-to-Cypher、复杂多智能体协作。
- 在验证 Phase 1 的 FTS + 结构化事实路线不足前，不引入向量检索作为默认主路径。
