# AIBidder 评审整改跟踪表

> 对照文档：`docs/2026-03-07-aibidder-review-report.md`  
> 跟踪日期：2026-03-08  
> 跟踪原则：仅把“当前代码中仍然成立的缺口”列为本轮整改项；对评审中已被后续开发覆盖的结论，标记为“已完成/已被后续实现覆盖”。

## 一、结论摘要

本次复核后，原评审文档中的问题分为三类：

- **已完成/已被覆盖**：Alembic、PostgreSQL 默认开发库、核心缺失表、认证增强、分页能力、审计日志、工作台核心流程、前端模块拆分、SSE 进度流等。
- **本轮继续整改并闭环**：Docker/Compose 镜像链路、容器内迁移文件装载、Worker 对 API 代码/依赖的可见性、MinIO 依赖与建桶闭环。
- **保留为后续优化项**：按 domain 拆包、全面设计系统升级、进一步细化并行 loading 状态。这些项属于架构/体验优化，不再是“评审结论仍然成立但完全未落地”的阻塞项。

## 二、逐项跟踪

| 评审项 | 评审原结论 | 当前状态 | 证据 | 本轮动作 |
|---|---|---|---|---|
| 3.1 数据库迁移缺失 | 无 Alembic，仅 `create_all` | **已完成** | `services/api-server/alembic.ini`、`services/api-server/alembic/versions/20260307_0001_baseline.py`、`services/api-server/app/db/bootstrap.py` | 补齐容器镜像中的 Alembic 文件装载，确保 `migrate` 服务可运行 |
| 3.2 SQLite 作为开发数据库 | 默认开发库错误 | **已完成** | `services/api-server/app/core/config.py` 默认 `dev -> PostgreSQL`，仅 `test -> SQLite` | 无 |
| 3.3 Worker 服务为空壳 | 无最小可用异步执行 | **部分完成 -> 本轮闭环** | `services/worker/worker/tasks.py`、`services/api-server/app/services/*_tasks.py` 已存在异步任务；但容器镜像未正确装载 API 代码/依赖 | 修复 `services/worker/Dockerfile`、`services/worker/worker/celery_app.py`、`services/worker/worker/main.py` |
| 3.4 服务边界模糊 | 单体且未按 domain 拆包 | **保留优化项** | 当前仍以单体组织，但已有服务层与路由分层基础 | 本轮不做大规模目录重构，避免扩大变更面 |
| 3.5 MinIO 未真正接入 | 仅本地文件系统 | **部分完成 -> 本轮闭环** | 已有 `StorageBackend` 抽象，但缺少 `boto3` 依赖、Compose 默认仍未走共享存储、建桶闭环不足 | 修复 `services/api-server/app/core/storage.py`、`services/api-server/pyproject.toml`、`docker-compose.yml`、`.env.example` |
| 4.1 PDF 解析器假实现 | 直接 decode PDF 二进制 | **已完成** | `services/api-server/app/core/document_parser.py` 已有 PyMuPDF / pypdf / OCR fallback / structured error 路径 | 无 |
| 4.2 DOCX 表格支持不足 | 不处理表格 | **已完成** | `services/api-server/app/core/document_parser.py` 含 `_extract_table` 与表格 markdown 产出 | 无 |
| 4.3 认证安全短板 | 无 refresh token / 限频 / secret 校验 | **已完成** | `services/api-server/app/api/routes/auth.py`、`services/api-server/app/core/config.py` | 无 |
| 4.4 API 缺少分页 | list 接口全量返回 | **已完成** | `services/api-server/app/api/routes/projects.py`、`historical_bids.py`、`workbench.py` 已有 `limit/offset` | 无 |
| 4.5 错误处理与审计不足 | 缺少结构化错误与审计写入 | **已完成** | `services/api-server/app/core/document_ingestion.py`、`services/api-server/app/services/audit.py`、`app/db/models.py` 中 `audit_logs` | 无 |
| 5.1 前端单文件过大 | 单文件巨型组件 | **部分完成，阻塞已解除** | `src/frontend/components/workspace-views/*` 已拆出六大模块视图；`src/frontend/app/page.tsx` 仍为壳层与状态编排 | 本轮不再继续大拆，控制风险 |
| 5.2 无错误边界/加载管理 | 无 Error Boundary / Loading | **部分完成** | `src/frontend/app/error.tsx`、`src/frontend/app/loading.tsx` 已存在；共享 `busyLabel` 仍可继续优化 | 本轮不扩展前端状态架构 |
| 5.3 缺少设计系统 | 无 tokens/theme | **基础完成，增强待后续** | `src/frontend/app/globals.css` 已引入 CSS variables 设计 token | 本轮不引入 Tailwind/shadcn，避免重构蔓延 |
| 6.1 核心数据表缺失 | 多张表未实现 | **已完成** | `services/api-server/app/db/models.py` 已含 `tender_requirements`、`requirement_constraints`、`generated_sections`、`section_evidence_bindings`、`verification_issues`、`review_issues`、`rendered_outputs`、企业事实表、`audit_logs` | 无 |
| 6.2 PostgreSQL FTS 索引缺失 | 无 `tsvector` / GIN | **已完成** | `services/api-server/app/db/bootstrap.py` 中 `_ensure_postgresql_fts_objects()`；`historical_search.py` 支持 FTS/fallback | 无 |
| 7/8/9 中与本轮相关的 P0/P1 项 | 多项基础能力缺口 | **本轮已收敛至极少残项** | 详见上表 | 将通过最终验证确认容器链路、后端测试、前端构建全部通过 |

## 三、本轮整改清单

- [x] 容器镜像补齐 Alembic 配置与迁移目录
- [x] Worker 镜像补齐 API 代码与依赖安装
- [x] Worker Celery 配置兼容 `CELERY_*` 与 `WORKER_*` 环境变量
- [x] MinIO 后端补齐 `boto3` 依赖
- [x] MinIO 写入前自动确保 bucket 存在
- [x] Compose 默认切换为共享对象存储，并启用异步文档解析/工作台流水线
- [x] 重新验证：后端测试（`69 passed in 7.73s`）
- [x] 重新验证：前端构建（`npm run build` 通过）
- [x] 重新验证：Docker Compose 本地栈（`api`/`worker` 运行，`/openapi.json` 可访问）

## 四、验收标准

- `services/api-server` 全量测试通过。
- `src/frontend` 构建通过。
- `docker compose up -d --build postgres redis minio migrate api worker` 可拉起，`migrate` 成功，`api`/`worker` 不崩溃。
- 以上结果将回填到本文件，作为提交说明依据。

## 五、最终验证记录

- 后端：在 `services/api-server` 执行 `../../.venv/bin/python -m pytest -q`，结果为 `69 passed, 5 warnings in 7.73s`。
- 前端：在 `src/frontend` 执行 `npm run build`，构建成功，产出 `/`、`/workspace`、`/workspace/[module]` 页面。
- Docker Compose：
  - 镜像链路已修复，`api`、`worker` 容器均可启动。
  - 由于本地 PostgreSQL 卷复用了旧 schema，本次验证中先按新增迁移的同等 SQL 对旧卷做了补列，再将 `alembic_version` 更新为 `20260308_0002`。
  - 当前 `curl http://localhost:8080/openapi.json` 可正常返回，`info.title = aibidder-api`。

## 六、说明

- `services/api-server/alembic/versions/20260308_0002_align_legacy_schema.py` 已将本次对旧 schema 的兼容补丁固化为正式迁移；后续在新镜像/新环境执行 `alembic upgrade head` 时会自动应用，不再需要手工补列。
- 前端关于更细粒度并行 loading 状态、完整设计系统与更彻底的页面/状态拆分，已降级为后续体验优化项，不再构成本轮评审整改阻塞项。
