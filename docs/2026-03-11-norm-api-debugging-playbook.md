# 规范文件 API 解析调试专题（2026-03-11）

## 1. 文档目的

本文沉淀 2026-03-11 围绕“规范 PDF OCR 结果通过大模型 API 生成结构化 JSON”的完整调试过程。

目标不是记录零散结论，而是形成后续项目可直接复用的专题文档，覆盖：

- 输入文件路径
- 输出文件路径
- 测试过的模型与平台
- 失败与成功路径
- 分片策略
- 本地拼接与校验方法
- 代码设计思路
- 实际命令模板

本文适用于后续处理类似“规范类 PDF -> OCR -> 正文条款索引 + 条文说明映射”的任务。

---

## 2. 本次测试对象

### 2.1 输入文件

本次测试使用同一组 OCR 产物：

- `C:\Users\palmtom\Desktop\电力工程投标规范\GB20148-2010电气装置安装工程电力变压器、油浸电抗器、互感器施工及验收规范.pdf-e967373f-88c3-4c3b-802e-b28e7c282b2f\full.md`
- `C:\Users\palmtom\Desktop\电力工程投标规范\GB20148-2010电气装置安装工程电力变压器、油浸电抗器、互感器施工及验收规范.pdf-e967373f-88c3-4c3b-802e-b28e7c282b2f\layout.json`

WSL 路径对应为：

- `/mnt/c/Users/palmtom/Desktop/电力工程投标规范/GB20148-2010电气装置安装工程电力变压器、油浸电抗器、互感器施工及验收规范.pdf-e967373f-88c3-4c3b-802e-b28e7c282b2f/full.md`
- `/mnt/c/Users/palmtom/Desktop/电力工程投标规范/GB20148-2010电气装置安装工程电力变压器、油浸电抗器、互感器施工及验收规范.pdf-e967373f-88c3-4c3b-802e-b28e7c282b2f/layout.json`

### 2.2 输入规模

本次实测输入规模大致如下：

- `full.md` 约 `42,808` 字符
- `layout.json` 原始约 `1,352,335` 字符

这直接影响 API 策略选型：

- `layout.json` 原文不适合直接整份塞入普通 `/chat/completions`
- 必须先做本地压缩或抽取

---

## 3. 目标产物

本次目标是生成一份可直接被后续系统消费的规范结构化中间层，包含两部分：

1. `clause_index`
   - 正文条款索引
   - 用于检索、写作约束、页码锚点、章节树
2. `commentary_map_result`
   - 条文说明映射
   - 用于解释增强，不与正文硬约束混淆

最终期望结构与 [2026-03-11-norm-pdf-processing-workflow.md](/home/palmtom/projects/aibidder/docs/2026-03-11-norm-pdf-processing-workflow.md) 中定义的 schema 一致。

---

## 4. 先验结论

在今天的调试结束后，可以先给出几个稳定结论：

1. 不要用单轮大 JSON 直出。
2. 不要把原始 `layout.json` 整份塞给普通聊天补全接口。
3. 单纯依赖一个 prompt，不做本地校验和本地拼接，不足以稳定产出可用结果。
4. 最可行路线是：
   `MinerU OCR -> 本地裁剪 layout 页文本 -> 大模型分片生成平铺 entries -> 本地拼接 tree/commentary_map -> 本地校验 -> 必要时定点补片`
5. “拼接、去重、树重建、占位节点清理、结构验收” 应由本地算法完成，而不是继续交给模型。

---

## 5. 本次测试过的 API 路径

### 5.1 DeepSeek 官方 API

- `base_url = https://api.deepseek.com`
- 官方模型兼容名：`deepseek-chat`

表现：

- 单轮 combined 输出会被 `completion_tokens = 8000` 截断
- 分片后可跑通
- 适合本次最终成功路径

### 5.2 硅基流动

- `base_url = https://api.siliconflow.cn/v1`
- 使用模型：`deepseek-ai/DeepSeek-V3.2`

表现：

- 单轮 combined 模式能返回，但经常截断半个 JSON
- 增大输出上限后又容易长时间无返回，最终读超时
- 两阶段 split 仍然不稳定

### 5.3 白山智算

- `base_url = https://api.edgefn.net/v1`
- 使用模型：`DeepSeek-V3.2`

表现：

- 在本次输入规模下首阶段即读超时
- 未拿到可用结果

---

## 6. 失败路径总结

### 6.1 单轮 combined 失败

第一种尝试是让模型一次性输出：

- `document`
- `clause_index`
- `commentary_map_result`

结果：

- JSON 容易被截断
- 即使 schema 看起来正确，也常出现：
  - `tree` 有，`entries` 不全
  - 只展开一部分 `chapter 4/5`
  - `commentary_map` 极少

失败原因：

- 输出体积过大
- completion 上限不足
- 模型更容易在长输出后半段偷懒或截断

### 6.2 两阶段 split 仍不稳定

第二种尝试是拆成：

1. 整份 `clause_index`
2. 整份 `commentary_map_result`

虽然比 combined 好，但仍有两个问题：

- `clause_index` 仍然太大，特别是第 4 章
- `commentary_map_result` 容易只给 section 级，不下钻到 clause 级

### 6.3 原始 `layout.json` 不适合直接入模

原始 `layout.json` 体积超过 130 万字符，直接作为 prompt 文本输入普通补全接口几乎不可行。

本次改进方式是：

- 不把原始 `layout.json` 整份塞给模型
- 先本地提取按页文本窗口 `page_texts`
- 仅将 `{page, text}` 的压缩版本作为 layout 输入

---

## 7. 最终成功路线

最终跑通的路线是：

1. 读取 `full.md`
2. 本地读取并压缩 `layout.json` 为按页文本窗口
3. 将任务拆成多个 scope
4. 每个 scope 只让模型生成“平铺 entries”
5. 本地做：
   - 去重
   - 归一化
   - 重建 `tree`
   - 回填 `children`
   - 生成 `commentary_map`
6. 跑本地校验脚本
7. 对缺口 scope 做定点重跑
8. 对最后遗留的小问题做本地修补

这一套比“让模型一次性输出最终结构”更稳定，也更可控。

---

## 8. 本地与模型的职责边界

### 8.1 模型负责什么

模型只负责某个 scope 内的语义提取，例如：

- `第1-3章正文`
- `第4章下 4.1-4.4`
- `第4章下 4.9-4.12`
- `第5章条文说明`

模型输出的是：

- 平铺 `entries`
- 本范围 `summary_text`

### 8.2 本地算法负责什么

以下工作全部由本地代码完成，不再交给额外的 AI 模型：

- `layout.json` 压缩
- scope 切分
- 去重
- clause_id 归一化
- appendix / other 根节点修正
- `tree` 重建
- `children` 回填
- `child_count` 重建
- `commentary_map` 生成
- 规则校验
- 最后的小型人工逻辑修补

本次没有引入“第二个 reviewer 模型”负责拼接或审核。

---

## 9. 分片策略是如何确定的

切片大小不是由 MinerU、DeepSeek 或平台自动决定，而是**本地编排策略人工定义**。

本次分片策略是根据以下因素不断收缩出来的：

1. prompt token 体积
2. completion token 是否撞上限
3. 是否出现半截 JSON
4. 是否出现长时间无响应
5. 是否只输出 section，不输出 clause

### 9.1 正文最终分片

正文索引最终按这些 scope 拆分：

- `clause-ch1-3`
- `clause-ch4-a`
- `clause-ch4-b`
- `clause-ch4-c`
- `clause-ch5`
- `clause-special-roots`
- 后续补片：
  - `clause-ch4-c1`
  - `clause-ch4-c2`

### 9.2 条文说明最终分片

条文说明最终按这些 scope 拆分：

- `commentary-ch2`
- `commentary-ch4-a1`
- `commentary-ch4-a2`
- `commentary-ch4-b1`
- `commentary-ch4-b2`
- `commentary-ch5`

分片越小，模型越容易：

- 保持 JSON 完整
- 下钻到 clause 级
- 不在大章末尾偷懒

---

## 10. 代码文件与职责

### 10.1 结构校验脚本

文件：

- [validate_norm_structure.py](/home/palmtom/projects/aibidder/services/api-server/scripts/validate_norm_structure.py)

职责：

- 校验顶层 schema
- 校验 `chapter 4/5` section 完整性
- 校验 `tree` / `entries` 一致性
- 校验 commentary 根节点和映射字段
- 输出 `PASS / PASS WITH WARNINGS / FAIL`

### 10.2 生成脚本

文件：

- [generate_norm_json_with_deepseek.py](/home/palmtom/projects/aibidder/services/api-server/scripts/generate_norm_json_with_deepseek.py)

职责：

- 读取 `full.md + layout.json`
- 将 `layout.json` 压缩为按页文本
- 按 scope 调用 OpenAI-compatible 接口
- 保存每轮：
  - 响应文本
  - usage
  - 校验结果
- 合并多个 scope 结果
- 重建层级树
- 输出最终 JSON

---

## 11. 代码设计思路

### 11.1 不让模型负责最终结构闭环

代码层面最重要的设计选择是：

- 不要求模型一次性输出最终闭合结构
- 只要求模型输出“本分片平铺节点”
- 最终结构由本地代码重建

这样做的原因：

- 降低单次 completion 压力
- 避免 `tree` 与 `entries` 不一致
- 避免 children 被模型胡乱填充
- 后续更容易定点补片

### 11.2 先平铺，再重建树

核心思路不是“让模型直接给完美 tree”，而是：

1. 模型输出平铺 `entries`
2. 本地按 `parent_id` 重建 `tree`
3. 同步回填 `children`
4. 再跑结构校验

这让最终结构更稳定，也更容易修补。

### 11.3 允许本地归一化

模型输出不是绝对可信的，所以代码中允许一些轻量归一化：

- `A` -> `附录A`
- `other` 根节点没有 `clause_id` 时，用 `title/label` 回填
- `chapter/section/clause` 根据编号模式修正

这类修正属于“结构归一化”，不是篡改语义。

### 11.4 最后一个 warning 不一定靠模型修

今天最后的 `5.4` warning 就说明：

- 如果某条 commentary 节点没有实际说明正文
- 继续强行让模型给页码意义不大
- 本地将其判定为“空占位节点”并清理掉，反而更正确

因此最终代码设计上要接受一种现实：

- 有些问题应该让模型补
- 有些问题应该在本地规则层收口

---

## 12. 今日生成过程中的中间产物

以下文件来自今天的实际调试过程。

### 12.1 早期不稳定产物

- `/tmp/deepseek-gb50148-generated.json`
- `/tmp/deepseek-gb50148-debug/`
- `/tmp/deepseek-gb50148-generated-32k.json`
- `/tmp/deepseek-gb50148-debug-32k/`

这些主要用于验证：

- 单轮 combined 不稳定
- 输出会截断
- 供应商之间差异明显

### 12.2 第一版可跑通分片产物

- `/tmp/deepseek-gb50148-chunked-official.json`
- `/tmp/deepseek-gb50148-chunked-official-debug/`

意义：

- 证明 DeepSeek 官方 + 分片生成是可行路线

缺点：

- 特殊根节点不全
- commentary 仍偏少

### 12.3 中间修正版

- `/tmp/deepseek-gb50148-chunked-official-patched-merged.json`
- `/tmp/deepseek-gb50148-chunked-official-patched-debug/`

意义：

- 通过定点补片把 commentary 从粗粒度拉回 clause 级
- 根节点恢复完整

### 12.4 最终推荐产物

- `/tmp/deepseek-gb50148-final-v3.json`

这是今天最终推荐使用的结果。

---

## 13. 最终产物质量结论

最终推荐文件：

- `/tmp/deepseek-gb50148-final-v3.json`

最终统计：

- `clause_entries = 132`
- `commentary_entries = 61`
- `commentary_map = 42`

最终校验结果：

- `0 error`
- `0 warning`

### 13.1 已验证覆盖的关键条目

正文条款已覆盖：

- `4.9.1`
- `4.9.2`
- `4.9.6`
- `4.12.1`
- `5.1.1`
- `5.3.6`

条文说明映射已覆盖：

- `4.1.3`
- `4.1.4`
- `4.1.7`
- `4.2.1`
- `4.2.4`
- `4.3.1`
- `4.4.1`
- `4.4.3`
- `4.5.3`
- `4.5.5`
- `4.5.6`
- `4.5.7`
- `4.5.8`
- `4.7.2`
- `4.7.3`
- `4.8.4`
- `4.8.5`
- `4.8.7`
- `4.8.10`
- `4.8.12`
- `4.10.1`
- `4.11.3`
- `4.11.4`
- `4.11.5`
- `4.12.1`
- `4.12.2`
- `5.1.1`
- `5.1.2`
- `5.2.2`
- `5.2.3`
- `5.3.1`
- `5.3.2`
- `5.3.3`
- `5.3.4`
- `5.3.6`

### 13.2 对需求的判断

结论：

- **可以认为已经满足当前需求质量。**

更准确地说：

- 正文条款索引：达标
- 条文说明映射：基本达标，且已接近参考目标统计
- 可作为当前规范处理链路的正式参考样例

---

## 14. 推荐命令模板

### 14.1 全量生成

```bash
export DEEPSEEK_API_KEY=your_api_key
export DEEPSEEK_API_BASE_URL=https://api.deepseek.com

python3 services/api-server/scripts/generate_norm_json_with_deepseek.py \
  --full-md /path/to/full.md \
  --layout-json /path/to/layout.json \
  --output /tmp/norm-output.json \
  --debug-dir /tmp/norm-output-debug \
  --max-output-tokens 8000 \
  --timeout-seconds 300
```

### 14.2 基于已有结果定点补片

```bash
python3 services/api-server/scripts/generate_norm_json_with_deepseek.py \
  --base-json /tmp/base.json \
  --commentary-scope commentary-ch4-b2 \
  --commentary-scope commentary-ch5 \
  --full-md /path/to/full.md \
  --layout-json /path/to/layout.json \
  --output /tmp/patched.json \
  --debug-dir /tmp/patched-debug
```

### 14.3 本地校验

```bash
python3 services/api-server/scripts/validate_norm_structure.py /tmp/norm-output.json
```

---

## 15. 后续项目复用建议

后续如果换成别的规范，不要直接照搬整个 prompt 再赌运气，建议按下面顺序复用：

1. 复用 MinerU / OCR 输入规范
2. 复用按页文本压缩方法，不要直接喂原始 `layout.json`
3. 默认采用分片生成，不要再试单轮 combined
4. 先做正文索引，再做条文说明
5. 将模型输出限制为平铺 entries
6. 本地重建 tree/commentary_map
7. 本地校验通过后再进入人工抽查
8. 对缺口用定点 scope 重跑，而不是整份重跑

### 15.1 建议保留的工程原则

- 让模型负责抽取，不让模型负责最终结构闭环
- 让本地代码负责拼接、归一化、校验
- 优先做可重复执行的调试流程，而不是手工 chat 试错
- 永远保存每轮 response / usage / validation 文件

### 15.2 不建议的做法

- 直接整份 `layout.json` 入模
- 单轮 combined 输出最终 JSON
- 看到 chat 界面能生成，就假设 API 也能稳定生成
- 不做本地校验就直接落库

---

## 16. 更换模型时的复用与回归清单

今天这套调试结果在更换模型后依然有较高复用价值，但不是“换个模型名直接就能稳定跑”。

### 16.1 哪些内容可以直接复用

以下资产基本不依赖具体模型，可直接复用：

1. 输入规范
   - `full.md + layout.json`
   - `layout.json` 先压缩为按页文本窗口
2. 本地编排框架
   - 分片生成
   - 本地拼接
   - 本地去重
   - 本地重建 `tree`
   - 本地生成 `commentary_map`
3. 本地验收脚本
   - `validate_norm_structure.py`
4. 结构设计原则
   - 模型负责抽取
   - 本地负责闭环
5. 已验证有效的分片思路
   - `1-3章`
   - `4章分块`
   - `5章/附录/特殊根节点`
   - `commentary` 再细拆

### 16.2 哪些内容通常需要重新调试

更换模型后，以下内容通常仍需重新验证：

1. 模型名与 API 兼容性
2. completion 上限
3. timeout 是否需要调整
4. 同一分片大小是否仍合适
5. prompt 是否仍能稳定下钻到 clause 级
6. section/clause 挂接是否容易跑偏
7. usage 返回格式是否一致

也就是说：

- 架构与代码可复用
- prompt 细节和分片粒度往往要重调

### 16.3 最小回归测试顺序

更换模型后，不建议直接跑全量。

推荐按下面顺序做最小回归：

1. 先跑一个容易 scope
   - 例如 `commentary-ch4-a1`
2. 再跑一个难 scope
   - 例如 `commentary-ch4-b2`
   - 或 `clause-ch4-c1`
3. 检查这两类典型问题：
   - JSON 是否完整闭合
   - 是否能下钻到 clause 级
   - 是否乱挂层级
   - 是否出现明显截断
4. 如果两块都稳，再跑完整 chunked 流程
5. 最后再决定是否需要微调：
   - `--max-output-tokens`
   - `--timeout-seconds`
   - scope 大小
   - prompt 约束语句

### 16.4 换模型时建议重点看的 scope

如果时间有限，优先回归这几个 scope：

1. `clause-ch4-c1`
   - 检查 `4.9.1`、`4.9.2`、`4.9.6`
2. `commentary-ch4-b2`
   - 检查 `4.10.1`、`4.11.3`、`4.12.1`、`4.12.2`
3. `commentary-ch5`
   - 检查 `5.1.1`、`5.3.6`
4. `clause-special-roots`
   - 检查 `附录A`、`本规范用词说明`、`引用标准名录`

这几块最能暴露模型的真实边界。

### 16.5 何时可以判定“新模型适配通过”

如果一个新模型满足以下条件，可认为基本适配通过：

1. 不再频繁输出半截 JSON
2. `commentary-ch4-b2` 能稳定输出 clause 级说明
3. `clause-ch4-c1` 能稳定输出 `4.9.x` 条款级正文
4. 最终合并结果经 `validate_norm_structure.py` 校验通过
5. 不需要大量人工修补结构性错误

### 16.6 何时说明模型不适合当前任务

如果一个模型持续出现以下问题，说明它不适合直接承担该任务：

1. completion 经常撞上限
2. 分片后仍频繁超时
3. 总是只给 section，不给 clause
4. `tree/entries` 长期不一致
5. 即使加严 prompt 仍无法稳定通过本地校验

这种情况下，不应继续堆 prompt，而应：

- 换模型
- 继续缩分片
- 或退回本地规则抽取

---

## 17. 最后结论

今天的调试说明：

- 规范类 PDF 的 API 结构化生成并不是“写一个 prompt 就结束”
- 真正可靠的方案必须包含：
  - 输入压缩
  - 分片策略
  - 本地拼接
  - 本地校验
  - 定点补片

对后续项目最重要的复用价值不是某一版 prompt，而是今天沉淀出的**整套编排方法**。

在当前项目内，这套方法已经被实际跑通，并产出了可用结果：

- `/tmp/deepseek-gb50148-final-v3.json`

后续如果将其纳入正式工程流程，建议再把：

- 结果输出路径
- 调试目录规范
- scope 列表配置化

进一步产品化。
