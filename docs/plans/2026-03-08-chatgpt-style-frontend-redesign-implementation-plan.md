# ChatGPT Style Frontend Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 AIBidder 前端重构为面向建筑施工单位招投标工程师的 ChatGPT 风格工作台，统一首页、模块页、设置、错误/加载页与 Copilot 呈现方式。

**Architecture:** 在现有 Next.js App Router 基础上，新增统一页面壳层、设计 token、按钮/卡片/状态等基础组件，并把首页与模块页纳入同一布局体系。Copilot 改为默认隐藏的右侧抽屉，页面文案改写为业务导向语言，避免技术后台风格。

**Tech Stack:** Next.js App Router, React, TypeScript, CSS Modules / global CSS, existing frontend API client

---

### Task 1: 建立统一设计 token 与全局样式基线

**Files:**
- Modify: `src/frontend/app/globals.css`
- Modify: `src/frontend/app/layout.tsx`
- Verify: `src/frontend/package.json`

**Step 1: 写出目标样式清单**

记录并实现以下全局 token：
- 页面背景、面板背景、主文字、次级文字、边框、主操作色、警示色
- 统一圆角、按钮高度、阴影、聚焦态
- 统一内容宽度、留白和主区栅格

**Step 2: 运行构建确认当前基线可用**

Run: `npm run build`
Expected: PASS

**Step 3: 在 `globals.css` 中重建全局样式基线**

至少包含：
- `:root` 设计 token
- 按钮三套语义类
- 卡片、输入框、状态标签、空状态、页面壳层样式
- 色盲/色弱友好状态表达（颜色 + 文本 + 图标留位）

**Step 4: 让 `layout.tsx` 套用新的全局页面语义**

保证：
- 页面标题与描述更新为“投标工作台”语境
- 全局 body 背景、字体和滚动行为符合新壳层要求

**Step 5: 重新构建验证**

Run: `npm run build`
Expected: PASS

### Task 2: 抽取统一页面壳层与基础业务组件

**Files:**
- Create: `src/frontend/components/app-shell.tsx`
- Create: `src/frontend/components/project-context-bar.tsx`
- Create: `src/frontend/components/task-entry-card.tsx`
- Create: `src/frontend/components/ui/status-badge.tsx`
- Modify: `src/frontend/components/workspace-sidebar.tsx`
- Modify: `src/frontend/components/hero-panel.tsx`
- Verify: `src/frontend/app/page.tsx`

**Step 1: 先梳理当前首页与模块页共性区域**

明确以下壳层职责：
- 左侧导航
- 顶部轻量栏
- 当前项目条
- 主内容容器
- Copilot 触发器插槽

**Step 2: 创建 `AppShell`**

提供统一 props：
- 当前模块
- 当前项目摘要
- 是否显示项目条
- Copilot 入口
- 主区内容

**Step 3: 创建 `ProjectContextBar`**

展示：
- 当前项目
- 截止时间
- 当前阶段
- 系统提醒

**Step 4: 创建 `TaskEntryCard`**

统一用于首页入口卡片，确保按钮、标题、说明、hover 全部一致。

**Step 5: 统一侧边导航文案和样式**

把当前模块文案改成：
- 首页
- 资料准备
- 招标分析
- 内容编写
- 校核定稿
- 项目归档

**Step 6: 构建验证**

Run: `npm run build`
Expected: PASS

### Task 3: 重做首页为“工作台入口型”首页

**Files:**
- Modify: `src/frontend/app/page.tsx`
- Create: `src/frontend/components/home-continue-card.tsx`
- Modify: `src/frontend/components/hero-panel.tsx`
- Verify: `src/frontend/app/workspace/page.tsx`

**Step 1: 先保留现有业务数据加载逻辑**

不要重写 API 调用；只调整首页渲染结构与文案。

**Step 2: 将首页改为入口型结构**

首页必须包含：
- 主引导语：“今天先处理哪一步？”
- 一句说明：说明可以从资料准备开始或继续上次工作
- 6 张任务入口卡片
- 一张继续处理卡片

**Step 3: 用业务语言重写首页文案**

要求：
- 面向非 IT 招投标工程师
- 不使用“控制台、工作流引擎、runtime”之类术语

**Step 4: 让首页与 `/workspace` 入口一致**

保证从首页进入模块时，路由和当前数据上下文不丢失。

**Step 5: 构建验证**

Run: `npm run build`
Expected: PASS

### Task 4: 统一模块页结构与模块标题文案

**Files:**
- Modify: `src/frontend/app/page.tsx`
- Modify: `src/frontend/components/workspace-views/knowledge-library-view.tsx`
- Modify: `src/frontend/components/workspace-views/tender-analysis-view.tsx`
- Modify: `src/frontend/components/workspace-views/bid-generation-view.tsx`
- Modify: `src/frontend/components/workspace-views/bid-review-view.tsx`
- Modify: `src/frontend/components/workspace-views/layout-finalize-view.tsx`
- Modify: `src/frontend/components/workspace-views/bid-management-view.tsx`

**Step 1: 为每个模块定义统一页头结构**

每个模块页头至少包含：
- 模块标题
- 一句本页说明
- 当前项目条
- 主操作按钮区

**Step 2: 重写模块文案**

替换技术式或内部式文案为业务表达，例如：
- “资料准备” 而不是 “Knowledge Library”
- “招标分析” 而不是 “Tender Analysis Console”

**Step 3: 统一模块内按钮风格**

清理不同模块中零散按钮写法，统一使用主/次/文字按钮体系。

**Step 4: 统一模块内卡片与表单布局**

消除各模块不同尺寸、不同留白、不同边框的样式漂移。

**Step 5: 构建验证**

Run: `npm run build`
Expected: PASS

### Task 5: 将 Copilot 重构为默认隐藏的右侧抽屉

**Files:**
- Modify: `src/frontend/components/copilot-panel.tsx`
- Create: `src/frontend/components/copilot-trigger.tsx`
- Create: `src/frontend/lib/copilot-visibility.ts`
- Modify: `src/frontend/app/page.tsx`
- Modify: `src/frontend/app/globals.css`

**Step 1: 参考 `ExpertDatebase` 设计抽屉行为**

复用其交互原则：
- 默认收起
- 右侧抽屉
- 窄屏点击外部区域自动收起
- 触发器与抽屉区域识别分离

**Step 2: 重写 Copilot 面板结构**

改成：
- 抽屉头部
- 当前页面/当前项目上下文
- 建议下一步
- 常用提问
- 对话消息区
- 输入区

**Step 3: 重写 Copilot 默认文案**

确保文案为投标业务导向，例如：
- 当前这一步要做什么
- 哪些资料还缺
- 下一步建议先做什么

**Step 4: 增加统一触发器**

支持：
- 左侧导航入口
- 右下角浮动入口

**Step 5: 构建验证**

Run: `npm run build`
Expected: PASS

### Task 6: 重做设置抽屉、错误页和加载页

**Files:**
- Modify: `src/frontend/components/settings-drawer.tsx`
- Modify: `src/frontend/app/error.tsx`
- Modify: `src/frontend/app/loading.tsx`
- Modify: `src/frontend/app/page.tsx`

**Step 1: 统一设置抽屉视觉与文案**

把设置抽屉改造成与 Copilot/主界面一致的轻量面板，文案改为：
- 模型与服务设置
- 检查服务是否可用
- 默认写作模型

**Step 2: 重写错误页文案**

要求告诉用户：
- 页面没有打开成功
- 可以点“重试”
- 若仍失败应如何处理

**Step 3: 重写加载页文案**

使用投标工作语境，例如：
- 正在准备当前工作页面
- 正在读取项目与资料信息

**Step 4: 构建验证**

Run: `npm run build`
Expected: PASS

### Task 7: 清理 `page.tsx` 并收口样式分散点

**Files:**
- Modify: `src/frontend/app/page.tsx`
- Modify: `src/frontend/components/workspace-views/shared.ts`
- Modify: `src/frontend/components/workspace-views/utils.ts`

**Step 1: 把壳层相关状态与模块渲染职责分离**

`page.tsx` 只保留：
- 全局数据加载
- 路由切换
- 当前项目/模块上下文
- Copilot / Settings 显隐控制

**Step 2: 删除或收口旧的样式耦合逻辑**

尤其是：
- 各模块零散类名
- 与旧控制台布局强耦合的样式分支
- 纯展示层逻辑混在页面壳层中的代码

**Step 3: 保持业务逻辑不变**

不要顺手改 API 交互契约；确保这是一次 UI/UX 导向重构。

**Step 4: 构建验证**

Run: `npm run build`
Expected: PASS

### Task 8: 最终验证与文案走查

**Files:**
- Verify: `src/frontend/**/*`
- Update: `docs/plans/2026-03-08-chatgpt-style-frontend-redesign-design.md`

**Step 1: 全量构建验证**

Run: `npm run build`
Expected: PASS

**Step 2: 手工走查页面文案**

检查：
- 首页
- 各模块标题与说明
- Copilot 默认提示
- 设置抽屉
- 错误页 / 加载页

确认全部符合非 IT 招投标工程师认知习惯。

**Step 3: 手工走查交互一致性**

确认：
- 按钮尺寸、颜色、圆角、状态一致
- Copilot 默认隐藏，能正常展开/收起
- 首页入口卡片样式统一
- 色彩不依赖红绿区分

**Step 4: 如设计有细微偏差，回写设计文档**

把实际落地后的局部调整同步到设计文档，避免文档与实现偏离。
