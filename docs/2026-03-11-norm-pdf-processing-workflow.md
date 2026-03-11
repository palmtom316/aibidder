# 规范 PDF 文档处理开发说明（基于 GB 50148-2010 实测）

## 1. 目标与背景

本文整理本次围绕“规范 PDF 文档处理”的讨论与实操结果，沉淀为后续开发可直接参考的说明文档。

本次目标不是泛泛讨论 PDF 解析，而是围绕一份真实规范文档，完成以下几件事：

1. 对比不同 OCR 平台产物质量。
2. 选择更适合本系统的 OCR 基座。
3. 基于 OCR 产物，生成可用于检索/召回的章节树与条款索引。
4. 将“条文说明”与正文条款分离，构造条款到说明的映射关系。
5. 明确后续标书写作时，系统如何召回规范条款约束 AI 写作。
6. 明确 OCR 后处理所需的 AI 模型选型思路。

---

## 2. 本次输入文件

### 2.1 GLM-ocr 产物

- `C:\Users\palmtom\Downloads\ocr_1773133467435.md`
- `C:\Users\palmtom\Downloads\ocr_1773133473756.json`

### 2.2 MinerU 产物

- `C:\Users\palmtom\Desktop\电力工程投标规范\GB20148-2010电气装置安装工程电力变压器、油浸电抗器、互感器施工及验收规范.pdf-e967373f-88c3-4c3b-802e-b28e7c282b2f\full.md`
- `C:\Users\palmtom\Desktop\电力工程投标规范\GB20148-2010电气装置安装工程电力变压器、油浸电抗器、互感器施工及验收规范.pdf-e967373f-88c3-4c3b-802e-b28e7c282b2f\layout.json`

---

## 3. OCR 对比结论

### 3.1 结论摘要

本次实测结论明确：

- **MinerU 更适合作为系统 OCR 基座。**
- GLM-ocr 可作为补充通道或兜底复核，不建议作为唯一主基座。

### 3.2 判断依据

#### 3.2.1 文本识别质量

两者都能把正文基本识别出来，整体可读性接近，但都在复杂表格与注释区域存在局部字符错误。

#### 3.2.2 结构化质量

MinerU 明显更强：

- `layout.json` 是文档解析结果，不只是接口回包。
- 能区分 `title`、`list`、`table`、`text`、`discarded_blocks`。
- 能显式识别并剔除 `page_number`、`header`、`footer`。
- 更适合后续做章节树、条款切片、页码定位、证据回链。

GLM-ocr 的主要问题：

- JSON 更像服务回包，语义层次较粗，主要只有 `text/table/image/formula`。
- Markdown 混入图片 URL 与 HTML 包装，离线可复现性差。
- 复杂表格区域更容易扁平化。
- 存在明显误识别和错误切块噪音。

#### 3.2.3 工程适配性

如果系统后面要做：

- 章节树构建
- 条款编号提取
- 表格解析
- RAG 检索
- 证据定位
- 标书写作约束召回

则需要的是“稳定可消费的结构结果”，不是仅仅“文本能读出来”。在这一点上 MinerU 明显优于 GLM-ocr。

### 3.3 选型建议

- **主 OCR 引擎**：MinerU
- **补充/兜底 OCR**：GLM-ocr

推荐架构：

`MinerU -> Markdown/布局清洗 -> 条款树构建 -> 证据切片 -> 检索/召回`

---

## 4. OCR 后处理的总体思路

本系统不应把 OCR 当成终点，而应把 OCR 视为“结构化解析的输入层”。

后处理目标不是单纯产出一份 Markdown，而是生成两类核心中间件：

1. **正文条款索引**
   - 用于约束写作、检索规范、构建章节树、建立页码锚点。
2. **条文说明映射**
   - 用于为正文条款补充解释性说明，但不与正文硬约束混淆。

换句话说，规范类 PDF 的处理链路应是：

`PDF -> OCR -> full.md/layout.json -> 条款树 -> 条文说明映射 -> 检索约束层 -> AI 写作/审核`

---

## 5. 为什么正文条款与条文说明必须分开

这是本次讨论中非常重要的设计决策。

### 5.1 正文条款的定位

正文条款是“硬约束”，写作时必须优先满足。

例如：

- `4.9.1` 注油前油必须试验合格。
- `4.9.2` 混油前必须做混油试验。
- `4.9.6` 抽真空时必须采取附件隔离与防倒灌措施。

这些内容属于规范要求本身，直接约束施工方案写法。

### 5.2 条文说明的定位

条文说明是“解释增强”，帮助模型理解规范意图，但不应与正文具有同等约束权重。

例如：

- `4.1.3` 的条文说明里解释了三维冲击加速度控制在 `3g` 左右的依据。
- `4.8.4` 的条文说明补充了冷却装置密封试验的工程经验。

它们很适合用于：

- 提升写作准确性
- 给出施工方案中的理由说明
- 做合规审查时提供解释依据

但不应替代正文强制要求。

### 5.3 推荐策略

因此推荐采用“双通道召回”：

- **主召回**：正文条款索引
- **辅召回**：条文说明映射

写作时优先拿正文条款做约束；需要补充解释时，再拼接对应条文说明。

---

## 6. 本次实现的两个核心产物

### 6.1 正文条款索引 JSON

文件：

- `docs/generated/gb50148-2010-mineru-clause-index.json`

作用：

- 生成章节树
- 建立 `4/4.1/4.1.3` 这样的路径标签
- 提供 `section_path`、页码、summary、anchor
- 用于检索和写作约束

核心字段包括：

- `tree`
- `entries`
- `clause_id`
- `label`
- `path_label`
- `section_path`
- `page_start/page_end`
- `summary_text`
- `anchor`
- `tags`

#### 6.1.1 当前统计

- 63 页 OCR 输入
- 130 个索引节点
- 根节点为：
  - `1 总则`
  - `2 术语`
  - `3 基本规定`
  - `4 电力变压器、油浸电抗器`
  - `5 互感器`
  - `附录A`
  - `本规范用词说明`
  - `引用标准名录`

### 6.2 条文说明映射 JSON

文件：

- `docs/generated/gb50148-2010-mineru-clause-commentary-map.json`

作用：

- 将条文说明正文映射回具体条款编号
- 为正文条款提供解释增强
- 用于 RAG 和审查解释层

核心字段包括：

- `tree`
- `entries`
- `commentary_map`
- `commentary_text`
- `summary_text`
- `commentary_page_start/commentary_page_end`
- `section_path`

#### 6.2.1 当前统计

- 61 个条文说明节点
- 43 个条款级说明映射
- 根节点仅保留：
  - `2 术语`
  - `4 电力变压器、油浸电抗器`
  - `5 互感器`

这说明当前版本已经把第二个目次中的目录噪音剔除了，没有把“修订说明引言”混入条文说明正文映射。

---

## 7. 正文条款索引的解析方法

### 7.1 使用输入

- 主文本来源：`full.md`
- 页码/版面定位来源：`layout.json`

### 7.2 核心方法

#### 7.2.1 章节树构建

从 `full.md` 中识别两类结构信号：

1. 标题行，例如：
   - `# 4 电力变压器、油浸电抗器`
   - `# 4.1 装卸、运输与就位`
2. 行内条款，例如：
   - `4.1.3 ...`
   - `4.8.4 ...`

规则：

- `4` 视为章级节点。
- `4.1` 视为节级节点。
- `4.1.3` 视为条款节点。
- `1.0.1` 这种条款自动挂到 `1` 章下，而不是误挂为根节点。

#### 7.2.2 目录与正文分离

为避免把目录页中的条款标题误识别为正文，正文索引做了两个过滤：

- 在 Markdown 解析时跳过 `目次/Contents` 段落。
- 在页码匹配时，仅在正文窗口内匹配。

正文窗口定义方法：

- 起点：页面文本中第一次出现 `1总则`
- 终点：页面文本中第一次出现 `修订说明` 之前

这样可以避免：

- 把目录页误当成正文页
- 把修订说明后的说明页误当成正文页

#### 7.2.3 页码定位

条款页码不是直接从 Markdown 行号推，而是利用 `layout.json` 每页文字块做文本匹配。

匹配候选包括：

- 原始行
- `clause_id + title`
- `title`
- 局部标题片段

再在正文页窗口中按顺序匹配，从而得到：

- `page_start`
- `page_end`

#### 7.2.4 摘要生成

当前 `summary_text` 使用抽取式方法：

- 如果节点有正文内容，取本节点首段压缩作为摘要
- 如果节点没有正文内容，则从其子节点标题生成概述

这种做法的优点是：

- 成本低
- 无需额外 LLM
- 可直接用于索引与召回

缺点是：

- 个别摘要较长
- 不适合直接作为最终前端展示文案

---

## 8. 条文说明映射的解析方法

### 8.1 处理范围

这里必须区分两个概念：

1. **修订说明引言**
2. **后面的条文说明正文**

本次产物处理的是第 2 类，不是第 1 类。

也就是说，目标是：

- 第二个 `目次` 之后
- `# 2 术语 / # 4 ... / # 5 ...` 开始的说明正文

而不是前面“本规范按什么背景修订”的那部分说明文字。

### 8.2 核心方法

#### 8.2.1 先切出修订说明后的文本片段

脚本先从 `# 修订说明` 之后开始处理，但不会把前面的引言直接入树。

#### 8.2.2 再跳过第二个目录

条文说明区域里还包含第二个 `目次`。如果不跳过，会出现目录节点污染结果。

本次脚本已经修正这一点：

- `4 电力变压器、油浸电抗器 (40)` 这样的目录项已剔除
- 只保留真正的条文说明正文节点

#### 8.2.3 按条款号建立映射

与正文索引类似，条文说明里会出现：

- 章/节标题
- 具体条款说明，如 `4.1.3 ...`

这些说明项会被挂在对应章/节下，并在 `commentary_map` 中形成：

`clause_id -> commentary_text`

例如：

- `4.1.3`
- `4.2.1`
- `4.5.3`
- `4.8.4`
- `5.1.1`

#### 8.2.4 页码定位

条文说明页码匹配使用的是“说明窗口”，不是正文窗口。

说明窗口定义方式：

- 起点：`修订说明` 后的第二个目录后正文页
- 终点：文件结束

这样正文索引和说明映射不会互相串页。

---

## 9. 本次实现的脚本

### 9.1 正文条款索引脚本

- `services/api-server/scripts/generate_mineru_norm_index.py`

功能：

- 读取 MinerU `full.md/layout.json`
- 生成正文条款树
- 生成条款索引 JSON

### 9.2 条文说明映射脚本

- `services/api-server/scripts/generate_mineru_clause_commentary_map.py`

功能：

- 读取 MinerU `full.md/layout.json`
- 跳过修订说明引言与第二个目录
- 提取条文说明正文
- 生成 `clause_id -> commentary_text` 映射

---

## 10. 写“变压器安装施工方案”时系统应召回哪些条款

如果用户在系统中写“变压器安装施工方案”，系统不应只召回单一条款，而应按层次召回。

### 10.1 通用硬约束

应至少召回：

- `3.0.1` 按已批准设计文件施工
- `3.0.2` 设备资料齐全
- `3.0.5` 装卸、运输、就位及安装必须先有施工及安全技术措施
- `3.0.6` 相关建筑工程条件满足安装要求

### 10.2 变压器安装全流程主干条款

应优先召回 `第4章` 的主流程：

- `4.1` 装卸、运输与就位
- `4.2` 交接与保管
- `4.3` 绝缘油处理
- `4.4` 排氮
- `4.5` 器身检查
- `4.6` 内部安装、连接
- `4.7` 干燥
- `4.8` 本体及附件安装
- `4.9` 注油
- `4.10` 热油循环
- `4.11` 补油、整体密封检查和静放
- `4.12` 工程交接验收

### 10.3 强制性和高风险条款

施工方案生成时，应把以下条款作为高优先级约束：

- `4.1.3`
- `4.1.7`
- `4.4.3`
- `4.5.3` 中强制项
- `4.5.5`
- `4.9.1`
- `4.9.2`
- `4.9.6`
- `4.12.1` 中关键检查项
- `4.12.2` 中关键试运行检查项

### 10.4 组件触发型召回

如果用户写到具体安装组件，还应追加召回细项：

- 冷却装置：`4.8.4`
- 储油柜：`4.8.5`
- 升高座：`4.8.7`
- 套管：`4.8.8`
- 气体继电器：`4.8.9`
- 压力释放装置：`4.8.10`
- 吸湿器：`4.8.11`
- 测温装置：`4.8.12`

### 10.5 正文与条文说明的协同召回

推荐写作约束方式：

- 正文条款：作为硬约束写入 prompt/evidence pack
- 条文说明：作为解释性补充写入 secondary evidence

例如：

- 主约束：`4.1.3` 不应有严重冲击和振动
- 解释增强：`4.1.3` 的条文说明中关于 `3g` 经验边界和国际参照说明

---

## 11. 后处理 AI 模型推荐（不是 OCR 模型）

这里要特别区分：

- OCR 模型：负责“看 PDF/看图片”
- 后处理模型：负责“读 OCR 产出、构造树、总结、归纳、生成结构化 JSON”

对于本次这种“规范 OCR 产物分析”任务，推荐的不是视觉模型，而是文本推理/结构化输出模型。

### 11.1 单模型推荐

如果在硅基流动平台只选一个模型做这类后处理，推荐：

- `deepseek-ai/DeepSeek-V3.2`

原因：

- 更适合长文本理解
- 适合对 `Markdown + JSON` 做联合分析
- 适合输出结构化 JSON
- 适合做条款层级梳理、摘要和归纳

### 11.2 分层调度建议

如果做多模型分工，建议：

- 导航/树构建/总结：`deepseek-ai/DeepSeek-V3.2`
- 低成本批量局部抽取：`Qwen/Qwen3.5-9B`
- 最终冲突校核/强推理复核：`deepseek-ai/DeepSeek-R1`

### 11.3 重要原则

规范文档后处理不建议继续使用 OCR/VL 模型来做结构分析，因为：

- 输入已经是文本和布局结果
- 视觉模型成本更高
- 文本结构化推理模型更稳定

---

## 12. 对后续开发的建议

### 12.1 数据层建议

建议把规范处理产物拆成 3 层：

1. `raw_ocr_artifacts`
   - 保存 `full.md/layout.json`
2. `norm_index_entries`
   - 保存正文条款索引项
3. `norm_commentary_entries`
   - 保存条文说明映射项

### 12.2 检索层建议

建议检索时使用两路召回：

- `primary_norm_recall`
  - 从正文索引中召回硬约束条款
- `secondary_commentary_recall`
  - 从条文说明映射中召回解释增强材料

### 12.3 写作层建议

标书写作时不要直接把整个规范塞给模型，而应：

1. 根据写作主题判定规范范围
2. 召回相关章节主干
3. 召回强制性条文
4. 召回对应条文说明
5. 组装成证据包，送入写作模型

### 12.4 审查层建议

在评审阶段，应再基于同一规范条款树做反向校验：

- 是否漏写关键安装环节
- 是否遗漏强制性要求
- 是否与条款要求冲突

---

## 13. 当前结果的局限性

### 13.1 摘要仍是抽取式

`summary_text` 当前主要用于索引，不适合直接拿来做最终前端展示文案。

### 13.2 页码是 OCR 匹配页码

当前页码来自 OCR 文本匹配，不是原生 PDF 书签级定位。

### 13.3 条文说明并非覆盖所有条款

规范的条文说明不会给每一条正文都写解释，因此 `commentary_map` 允许存在缺项。

### 13.4 当前列表项尚未独立成更细粒度节点

例如 `4.12.1` 下的 `(1)(2)(3)` 这类项，目前没有全部细拆成子节点；如果后续要做更细粒度约束，可继续拆解。

---

## 14. 推荐的下一步开发动作

1. 将 `gb50148-2010-mineru-clause-index.json` 接入统一 `library_chunks/evidence_units` 格式。
2. 将 `gb50148-2010-mineru-clause-commentary-map.json` 挂接到正文条款上，形成 `clause + commentary` 组合结构。
3. 实现“写作主题 -> 规范召回规则表”，例如“变压器安装施工方案”自动召回第 3 章与第 4 章相关约束。
4. 对强制性条文做专门标签，写作时强制置顶。
5. 后续支持更细粒度的款、项、目拆分。
6. 再扩展到其他规范 PDF，验证方法在多文档上的稳定性。

---

## 15. 本次沉淀的关键结论

- **OCR 基座选 MinerU。**
- **正文条款与条文说明必须分开建模。**
- **正文条款是硬约束，条文说明是解释增强。**
- **规范 PDF 的目标不是“转 Markdown”，而是“生成可检索、可约束、可回链的结构化中间层”。**
- **后处理 AI 模型优先用文本推理模型，不用视觉模型。**

---

## 16. DeepSeek 直投 Prompt 与本地验收脚本

这一节用于沉淀后续可直接复用的 DeepSeek 投喂模板和结果校验脚本，避免再次出现“schema 外形正确，但内容覆盖不足或 `tree/entries` 不一致”的问题。

### 16.1 适用场景

输入文件固定为两份：

- `full.md`
- `layout.json`

适用目标：

- 生成正文条款索引 `clause_index`
- 生成条文说明映射 `commentary_map_result`
- 确保 `entries`、`tree`、页码、层级挂接可以直接进入后续检索与约束写作流程

### 16.2 DeepSeek 强约束直投 Prompt

将 `full.md` 和 `layout.json` 一起作为附件传给 DeepSeek，用户消息中直接投喂以下 prompt：

```text
你现在处理的不是普通文档摘要任务，而是“规范类 PDF OCR 后处理”任务。

输入文件有两个：
1. `full.md`：GB 50148-2010 的 OCR 全文 Markdown
2. `layout.json`：同一文档按页组织的版面解析结果，包含页面文本块、标题、表格、页眉页脚、页码等信息

文档名称：
《电气装置安装工程 电力变压器、油浸电抗器、互感器施工及验收规范》
文档编号：
GB 50148-2010

你的目标不是总结文档，而是输出一个“可检索、可约束写作、可证据回链”的结构化 JSON。
必须同时产出两部分：
1. `clause_index`：正文条款索引
2. `commentary_map_result`：条文说明映射

最重要的原则：
1. 正文条款和条文说明必须严格分开，不能混在一起。
2. 正文条款是硬约束，用于写作约束和审查。
3. 条文说明是解释增强，用于辅助理解，不具有和正文同等约束权重。
4. 不要把目录页、页眉、页脚、页码、目录项误识别为正文或条文说明正文。
5. 不要把“修订说明”前面的引言性文字混入条文说明映射。
6. 不要编造不存在的条款、说明、页码、标题。
7. 输出必须是单个纯 JSON 对象，不要输出 Markdown，不要解释，不要代码块。

一、正文条款索引的构建要求

1. 识别正文窗口
- 正文起点：文档第一次进入正文，例如 “1 总则”
- 正文终点：第一次进入 “修订说明” 之前
- 只在正文窗口内构建 `clause_index`

2. 识别层级结构
- `1`、`2`、`3`、`4`、`5` 是 chapter
- `4.1`、`4.2`、`5.3` 是 section
- `4.1.3`、`4.9.6`、`5.3.6` 是 clause
- `附录A` 是 appendix
- `本规范用词说明`、`引用标准名录` 保留为根级节点
- 不能把 `1.0.1`、`4.1.3` 之类错误挂到根节点

3. 正文索引必须服务于后续检索和约束写作
因此每个节点尽量包含：
- 层级路径
- section_path
- 可定位页码
- 摘要
- 预览文本
- mandatory 标签

4. 页码定位
- `page_start` 和 `page_end` 必须根据 `layout.json` 的实际页面文本匹配得到
- 不能凭感觉猜测页码
- 如果无法可靠确定，填 `null`
- 如果页码无法确定，在 `tags` 中增加 `"page_unresolved"`

5. 摘要规则
- `summary_text` 采用抽取式摘要
- 优先从该节点正文首句或首段压缩生成
- 不要写成泛泛总结
- 中文长度尽量控制在 40 到 120 字

6. mandatory 规则
- 若条文本身明确是强制性条文，或条文说明明确说明“列为强制性条文”，则可在对应正文条款 `tags` 中加入 `"mandatory"`
- 不要滥标

二、条文说明映射的构建要求

1. 识别条文说明窗口
- 从 “修订说明” 之后开始
- 该区域里如果有第二个“目次/目录”，必须跳过
- 只保留真正的条文说明正文
- 不要把修订背景引言混入 `commentary_map_result`

2. 说明映射规则
- 条文说明按章、节、条重新挂接
- 对于出现说明正文的条款，建立：
  `clause_id -> commentary_text`
- 如果某条没有条文说明，可以缺省，不要编造

3. 条文说明输出要求
- `commentary_map_result.entries` 中保留章、节、条节点
- `commentary_map_result.commentary_map` 中只保留真正存在说明正文的条款映射
- `commentary_text` 只放条文说明内容，不要放正文条文本身

三、根节点顺序要求

根节点顺序尽量保持原文顺序，优先为：
1. `1 总则`
2. `2 术语`
3. `3 基本规定`
4. `4 电力变压器、油浸电抗器`
5. `5 互感器`
6. `附录A`
7. `本规范用词说明`
8. `引用标准名录`

`commentary_map_result` 的根节点只保留真正进入条文说明正文的那些章/节树，不要保留无正文说明内容的目录噪音节点。

四、输出 JSON schema

输出必须严格遵守下面的结构，只输出一个 JSON 对象：

{
  "document": {
    "name": "电气装置安装工程 电力变压器、油浸电抗器、互感器施工及验收规范",
    "code": "GB 50148-2010"
  },
  "clause_index": {
    "summary_text": "对正文条款索引的整体概述",
    "tree": [],
    "entries": [
      {
        "node_id": "clause-4.9.1",
        "clause_id": "4.9.1",
        "title": "条款标题或首句压缩标题",
        "label": "4.9.1 条款标题",
        "node_type": "chapter",
        "depth": 1,
        "parent_id": null,
        "path_ids": ["4", "4.9", "4.9.1"],
        "path_label": "4 / 4.9 / 4.9.1",
        "section_path": "4 电力变压器、油浸电抗器 > 4.9 注油 > 4.9.1",
        "anchor": "clause-4.9.1",
        "page_start": 31,
        "page_end": 31,
        "summary_text": "抽取式摘要",
        "content_preview": "条文原文前 120 到 220 字",
        "child_count": 0,
        "tags": ["mandatory"],
        "children": []
      }
    ]
  },
  "commentary_map_result": {
    "summary_text": "对条文说明映射的整体概述",
    "tree": [],
    "entries": [
      {
        "node_id": "commentary-4.1.3",
        "clause_id": "4.1.3",
        "title": "条文说明标题或首句压缩标题",
        "label": "4.1.3 条文说明",
        "node_type": "clause",
        "depth": 3,
        "parent_id": "commentary-4.1",
        "path_ids": ["4", "4.1", "4.1.3"],
        "path_label": "4 / 4.1 / 4.1.3",
        "section_path": "4 电力变压器、油浸电抗器 > 4.1 装卸、运输与就位 > 4.1.3",
        "anchor": "commentary-4.1.3",
        "page_start": 46,
        "page_end": 46,
        "commentary_text": "该条对应的条文说明正文",
        "summary_text": "条文说明摘要",
        "child_count": 0,
        "tags": [],
        "children": []
      }
    ],
    "commentary_map": {
      "4.1.3": {
        "commentary_text": "该条对应的条文说明正文",
        "summary_text": "条文说明摘要",
        "page_start": 46,
        "page_end": 46,
        "section_path": "4 电力变压器、油浸电抗器 > 4.1 装卸、运输与就位 > 4.1.3"
      }
    }
  }
}

五、硬性验收要求

1. `clause_index.entries` 必须覆盖 chapter、section、clause 三层，不能只保留条款。
2. `chapter 4` 必须完整包含：
   `4.1`、`4.2`、`4.3`、`4.4`、`4.5`、`4.6`、`4.7`、`4.8`、`4.9`、`4.10`、`4.11`、`4.12`
3. `chapter 5` 必须完整包含：
   `5.1`、`5.2`、`5.3`、`5.4`
4. `clause_index` 中不要出现 `explanation` 字段。
5. `commentary_map_result.entries` 必须包含对应的 chapter/section/clause 节点，不能只保留两个 clause。
6. `commentary_map_result.commentary_map` 只保留存在真实条文说明正文的条款。
7. `tree` 和 `entries` 必须一致：
   - `tree` 中出现的节点，必须全部出现在对应的 `entries`
   - `entries` 不能少于 `tree` 的节点总数
8. `children` 必须反映真实子节点，不能全部留空占位。
9. `node_type` 只能取：`chapter`、`section`、`clause`、`appendix`、`other`
10. `anchor` 要稳定、可程序消费
11. 不要省略 `tree`、`entries`、`commentary_map`

六、输出前必须内部自检

在最终输出前，你必须内部完成以下检查，但不要把检查过程写出来：
1. 是否把正文和条文说明完全分开了
2. 是否剔除了目录噪音
3. 是否剔除了修订说明引言
4. 是否正确挂接了章、节、条层级
5. 是否尽可能给出了 `page_start/page_end`
6. 是否没有编造不存在的说明映射
7. 是否 chapter 4、5 的 section 展开完整
8. 是否 `tree` 与 `entries` 一致
9. 是否 `children` 不是空占位
10. 是否输出的是单个合法 JSON 对象

现在开始读取 `full.md` 和 `layout.json`，并直接输出最终 JSON。
```

### 16.3 推荐使用方式

建议不要直接把 DeepSeek 首轮输出接入系统，而是先做本地结构验收。

推荐流程：

1. 将 `full.md` 和 `layout.json` 作为附件发送给 DeepSeek。
2. 使用上面的强约束 prompt。
3. 将模型输出保存为本地 JSON 文件。
4. 用下面的校验脚本先检查结果是否合格。
5. 只有在校验通过后，才进入接入或进一步人工抽查。

### 16.4 本地校验脚本

下面的脚本用于校验 DeepSeek 输出是否满足当前工作流的最基本要求。它重点检查：

- 顶层 schema 是否正确
- `chapter 4/5` 的 section 是否完整
- `tree` 和 `entries` 是否一致
- `commentary_map_result` 是否不止保留极少数条款
- 页码字段和关键字段是否存在

使用方式：

```bash
python3 validate_norm_structure.py /path/to/deepseek-output.json
```

脚本如下：

```python
#!/usr/bin/env python3
import json
import sys
from pathlib import Path


REQUIRED_TOP_KEYS = {"document", "clause_index", "commentary_map_result"}
REQUIRED_CLAUSE_KEYS = {
    "node_id",
    "clause_id",
    "title",
    "label",
    "node_type",
    "depth",
    "parent_id",
    "path_ids",
    "path_label",
    "section_path",
    "anchor",
    "page_start",
    "page_end",
    "summary_text",
    "content_preview",
    "child_count",
    "tags",
    "children",
}
REQUIRED_COMMENTARY_KEYS = {
    "node_id",
    "clause_id",
    "title",
    "label",
    "node_type",
    "depth",
    "parent_id",
    "path_ids",
    "path_label",
    "section_path",
    "anchor",
    "page_start",
    "page_end",
    "commentary_text",
    "summary_text",
    "child_count",
    "tags",
    "children",
}
REQUIRED_CH4_SECTIONS = {
    "4.1",
    "4.2",
    "4.3",
    "4.4",
    "4.5",
    "4.6",
    "4.7",
    "4.8",
    "4.9",
    "4.10",
    "4.11",
    "4.12",
}
REQUIRED_CH5_SECTIONS = {"5.1", "5.2", "5.3", "5.4"}
VALID_NODE_TYPES = {"chapter", "section", "clause", "appendix", "other"}


def walk_tree(nodes):
    result = []
    for node in nodes:
        result.append(node)
        result.extend(walk_tree(node.get("children", [])))
    return result


def add_error(errors, message):
    errors.append(f"ERROR: {message}")


def add_warning(warnings, message):
    warnings.append(f"WARNING: {message}")


def main():
    if len(sys.argv) != 2:
        print("Usage: python3 validate_norm_structure.py /path/to/output.json")
        raise SystemExit(2)

    path = Path(sys.argv[1])
    obj = json.loads(path.read_text(encoding="utf-8"))
    errors = []
    warnings = []

    if not isinstance(obj, dict):
        add_error(errors, "Top-level JSON must be an object.")
        return finish(errors, warnings)

    missing_top = REQUIRED_TOP_KEYS - set(obj.keys())
    if missing_top:
        add_error(errors, f"Missing top-level keys: {sorted(missing_top)}")

    clause_index = obj.get("clause_index", {})
    commentary = obj.get("commentary_map_result", {})

    clause_entries = clause_index.get("entries", [])
    commentary_entries = commentary.get("entries", [])
    clause_tree_nodes = walk_tree(clause_index.get("tree", []))
    commentary_tree_nodes = walk_tree(commentary.get("tree", []))

    if not clause_entries:
        add_error(errors, "clause_index.entries is empty.")
    if not commentary_entries:
        add_error(errors, "commentary_map_result.entries is empty.")
    if not commentary.get("commentary_map"):
        add_warning(warnings, "commentary_map_result.commentary_map is empty.")

    for entry in clause_entries:
        missing = REQUIRED_CLAUSE_KEYS - set(entry.keys())
        if missing:
            add_error(errors, f"Clause entry {entry.get('clause_id')} missing keys: {sorted(missing)}")
        if entry.get("node_type") not in VALID_NODE_TYPES:
            add_error(errors, f"Clause entry {entry.get('clause_id')} has invalid node_type.")
        if "explanation" in entry:
            add_error(errors, f"Clause entry {entry.get('clause_id')} illegally contains explanation.")

    for entry in commentary_entries:
        missing = REQUIRED_COMMENTARY_KEYS - set(entry.keys())
        if missing:
            add_error(errors, f"Commentary entry {entry.get('clause_id')} missing keys: {sorted(missing)}")
        if entry.get("node_type") not in VALID_NODE_TYPES:
            add_error(errors, f"Commentary entry {entry.get('clause_id')} has invalid node_type.")

    clause_ids = {entry.get("clause_id") for entry in clause_entries}
    commentary_ids = {entry.get("clause_id") for entry in commentary_entries}
    clause_tree_ids = {node.get("clause_id") for node in clause_tree_nodes}
    commentary_tree_ids = {node.get("clause_id") for node in commentary_tree_nodes}

    missing_ch4 = sorted(REQUIRED_CH4_SECTIONS - clause_ids)
    missing_ch5 = sorted(REQUIRED_CH5_SECTIONS - clause_ids)
    if missing_ch4:
        add_error(errors, f"Missing chapter 4 sections: {missing_ch4}")
    if missing_ch5:
        add_error(errors, f"Missing chapter 5 sections: {missing_ch5}")

    if len(clause_entries) < len(clause_tree_nodes):
        add_error(
            errors,
            f"clause_index.entries has only {len(clause_entries)} nodes but tree has {len(clause_tree_nodes)} nodes.",
        )
    if len(commentary_entries) < len(commentary_tree_nodes):
        add_error(
            errors,
            f"commentary_map_result.entries has only {len(commentary_entries)} nodes but tree has {len(commentary_tree_nodes)} nodes.",
        )

    missing_clause_tree_nodes = sorted(x for x in clause_tree_ids - clause_ids if x)
    missing_commentary_tree_nodes = sorted(x for x in commentary_tree_ids - commentary_ids if x)
    if missing_clause_tree_nodes:
        add_error(errors, f"Tree nodes missing from clause_index.entries: {missing_clause_tree_nodes}")
    if missing_commentary_tree_nodes:
        add_error(errors, f"Tree nodes missing from commentary_map_result.entries: {missing_commentary_tree_nodes}")

    if clause_entries and not any(entry.get("node_type") == "section" for entry in clause_entries):
        add_error(errors, "clause_index.entries does not contain section nodes.")
    if commentary_entries and not any(entry.get("depth") == 1 for entry in commentary_entries):
        add_error(errors, "commentary_map_result.entries does not contain chapter-level root nodes.")
    if commentary_entries and len(commentary_entries) < 10:
        add_warning(warnings, "commentary_map_result.entries count is suspiciously low.")

    null_pages = [
        entry.get("clause_id")
        for entry in clause_entries + commentary_entries
        if entry.get("page_start") is None or entry.get("page_end") is None
    ]
    if null_pages:
        add_warning(warnings, f"Entries with unresolved pages: {null_pages}")

    empty_child_placeholders = [
        entry.get("clause_id")
        for entry in clause_entries + commentary_entries
        if entry.get("child_count", 0) > 0 and not entry.get("children")
    ]
    if empty_child_placeholders:
        add_warning(
            warnings,
            "Entries with child_count > 0 but empty children: "
            + ", ".join(str(x) for x in empty_child_placeholders),
        )

    commentary_map = commentary.get("commentary_map", {})
    if commentary_map:
        for clause_id, payload in commentary_map.items():
            if clause_id not in commentary_ids:
                add_warning(warnings, f"commentary_map key {clause_id} missing from commentary entries.")
            if not isinstance(payload, dict):
                add_error(errors, f"commentary_map[{clause_id}] must be an object.")
                continue
            for key in ["commentary_text", "summary_text", "page_start", "page_end", "section_path"]:
                if key not in payload:
                    add_error(errors, f"commentary_map[{clause_id}] missing key: {key}")

    finish(errors, warnings)


def finish(errors, warnings):
    for line in errors:
        print(line)
    for line in warnings:
        print(line)

    if errors:
        print(f"FAIL: {len(errors)} error(s), {len(warnings)} warning(s)")
        raise SystemExit(1)

    if warnings:
        print(f"PASS WITH WARNINGS: 0 error(s), {len(warnings)} warning(s)")
        raise SystemExit(0)

    print("PASS: 0 error(s), 0 warning(s)")
    raise SystemExit(0)


if __name__ == "__main__":
    main()
```

### 16.5 推荐的最小使用模板

如果后续将该脚本单独保存为文件，例如：

- `services/api-server/scripts/validate_norm_structure.py`
- `services/api-server/scripts/generate_norm_json_with_deepseek.py`

则最小使用方式为：

```bash
python3 services/api-server/scripts/validate_norm_structure.py /path/to/deepseek-output.json
```

使用 API 生成并自动校验的最小命令为：

```bash
python3 services/api-server/scripts/generate_norm_json_with_deepseek.py \
  --full-md /path/to/full.md \
  --layout-json /path/to/layout.json \
  --output /path/to/deepseek-output.json \
  --debug-dir /path/to/debug-dir
```

环境变量建议：

```bash
export DEEPSEEK_API_KEY=your_api_key
export DEEPSEEK_API_BASE_URL=https://api.siliconflow.cn/v1
export DEEPSEEK_MODEL=deepseek-ai/DeepSeek-V3.2
```

如果校验结果包含以下错误，则不应直接接入：

- `Missing chapter 4 sections`
- `Missing chapter 5 sections`
- `Tree nodes missing from clause_index.entries`
- `Tree nodes missing from commentary_map_result.entries`
- `commentary_map_result.entries does not contain chapter-level root nodes`

### 16.6 人工抽查建议

即使脚本校验通过，仍建议做一轮人工抽查，优先检查：

1. `4.1.3`
2. `4.9.1`
3. `4.9.2`
4. `4.9.6`
5. `4.12.1`
6. `4.12.2`
7. `4.8.4`
8. `5.1.1`

重点核对：

- 条款原文是否在正文索引中正确挂接
- 条文说明是否被错误混入正文
- 页码是否落在合理页面窗口内
- `mandatory` 标签是否有明显漏标或误标
