# AI Bid Writing Platform Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 交付一个可私有化部署的 AI 标书写作 Phase 1 MVP（PDF/DOCX 输入、受控分段生成、证据可追溯、DOCX 导出）。

**Architecture:** 采用服务化边界（API 网关、文档处理、知识检索、生成编排、格式化、项目管理），以 PostgreSQL FTS 作为唯一检索主干，严格执行 `plan → retrieve → draft → verify`，并保持 OpenAI-compatible 模型网关抽象。

**Tech Stack:** Python 3.12+, FastAPI, SQLAlchemy, Alembic, PostgreSQL, Redis, MinIO, Celery/RQ/Arq, Next.js + React + TypeScript。

---

## 0. 实施原则（硬约束）

- Phase 1 禁止引入 embedding / vector DB / rerank。
- 事实来源仅限规范与企业事实库；历史/优秀标书仅作风格参考。
- 每段生成内容必须可追溯来源，无法支撑则显式标记。
- 输出仅支持模板化 DOCX，保留人工 Word 最终调整。

## 1. 里程碑与交付物

### Milestone A（基础平台）

- 单仓或多服务项目脚手架
- 组织/用户/项目/RBAC 基础能力
- 文档上传与对象存储落库
- 基础可观测性（健康检查、结构化日志）

### Milestone B（文档与知识层）

- PDF/DOCX 解析产物（Markdown + JSON）
- 知识单元切分与库分类
- PostgreSQL FTS 索引与词典归一
- 证据包聚合接口

### Milestone C（招标拆解）

- 结构化要求树
- 星号项/废标项/强制响应项识别
- 硬约束快照（工期、有效期、资质等）
- 响应任务清单与证据需求清单

### Milestone D（受控写作）

- 工具化编排：`plan/retrieve/draft/verify`
- 分节生成与改写
- 缺失证据/冲突参数/过期资质校验
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
5. 接入 OCR/解析器并产出 Markdown/JSON artifacts。
6. 实现知识单元抽取、库分类、FTS 索引刷新任务。
7. 构建检索工具 API（`search_norms`、`read_norm_clause` 等）。
8. 实现招标拆解引擎与结果持久化。
9. 实现生成编排器（工具调用 + 证据绑定 + 校验）。
10. 实现 DOCX 模板渲染与导出。
11. 完成前端核心流（项目→上传→拆解→写作→导出）。
12. 完成审计日志、重试机制、降级策略与验收测试。

## 3. API 与服务边界（首批）

- `api-gateway`: 鉴权、组织上下文、聚合路由。
- `document-service`: 上传、解析、artifact 管理。
- `knowledge-service`: 切分、分类、FTS 检索、证据包。
- `generation-service`: 编排与校验。
- `formatting-service`: 模板渲染与导出。
- `project-service`: 项目状态、版本、成员与审计轨迹。

## 4. 验收清单（与需求文档对齐）

- 可创建项目并分配成员角色。
- 可上传 PDF/DOCX 并生成 Markdown/JSON。
- 可生成可用表格结构（重点表格）。
- 可输出招标要求清单与高风险项识别结果。
- 可按证据包分节生成并显示来源页引用。
- 可在导出前检测关键参数冲突与资质过期。
- 可导出模板化 DOCX 并保留历史版本。
- 可对人工批准成品执行回流入库。

## 5. 实施策略建议

- 建议按 `A→B→C→D→E` 里程碑推进，每个里程碑结束进行一次演示验收。
- 先纵向打通一条“最小闭环”链路（上传→拆解→单节生成→DOCX 导出），再横向补齐能力。
- 模型调用统一走 provider abstraction，先完成主备切换与超时重试，再做高级优化。
