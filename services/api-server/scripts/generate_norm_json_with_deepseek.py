#!/usr/bin/env python3
from __future__ import annotations

import argparse
import copy
import json
import os
import re
import textwrap
from pathlib import Path
from typing import Any

import httpx

from validate_norm_structure import (
    REQUIRED_CLAUSE_KEYS,
    REQUIRED_COMMENTARY_KEYS,
    VALID_NODE_TYPES,
    print_report,
    validate_payload,
)


DEFAULT_API_BASE_URL = "https://api.siliconflow.cn/v1"
DEFAULT_MODEL = "deepseek-ai/DeepSeek-V3.2"
DEFAULT_OFFICIAL_DEEPSEEK_MODEL = "deepseek-chat"
DOCUMENT_NAME = "电气装置安装工程 电力变压器、油浸电抗器、互感器施工及验收规范"
DOCUMENT_CODE = "GB 50148-2010"
SYSTEM_PROMPT = (
    "You are a deterministic JSON generator for standards-document post-processing. "
    "Return exactly one JSON object and no surrounding prose."
)
SPECIAL_ROOT_ORDER = ["1", "2", "3", "4", "5", "附录A", "本规范用词说明", "引用标准名录"]
CLAUSE_SCOPES = [
    {
        "name": "clause-ch1-3",
        "description": "只输出正文窗口中的第1章、第2章、第3章全部节点，包括 chapter 和 clause。",
    },
    {
        "name": "clause-ch4-a",
        "description": "只输出正文窗口中的第4章以及 4.1、4.2、4.3、4.4 全部节点。",
    },
    {
        "name": "clause-ch4-b",
        "description": "只输出正文窗口中的第4章以及 4.5、4.6、4.7、4.8 全部节点。",
    },
    {
        "name": "clause-ch4-c",
        "description": "只输出正文窗口中的第4章以及 4.9、4.10、4.11、4.12 全部节点。",
    },
    {
        "name": "clause-ch4-c1",
        "description": "只输出正文窗口中的第4章下 4.9 注油的全部节点，必须展开到 clause 级，例如 4.9.1、4.9.2、4.9.6。",
    },
    {
        "name": "clause-ch4-c2",
        "description": "只输出正文窗口中的第4章下 4.10、4.11、4.12 的全部节点，必须展开到 clause 级。",
    },
    {
        "name": "clause-ch5",
        "description": "只输出正文窗口中的第5章全部节点，包括 chapter 5、5.1、5.2、5.3、5.4 及其 clause。",
    },
    {
        "name": "clause-special-roots",
        "description": "只输出正文窗口中的附录A、本规范用词说明、引用标准名录全部节点，不要输出第1章到第5章正文节点。",
    },
]
COMMENTARY_SCOPES = [
    {
        "name": "commentary-ch2",
        "description": "只输出条文说明窗口中的第2章说明节点（如果存在真实说明正文），包括 chapter、section、clause。",
    },
    {
        "name": "commentary-ch4-a1",
        "description": "只输出条文说明窗口中的第4章下 4.1、4.2、4.3 的说明节点。",
    },
    {
        "name": "commentary-ch4-a2",
        "description": "只输出条文说明窗口中的第4章下 4.4、4.5、4.6 的说明节点。",
    },
    {
        "name": "commentary-ch4-b1",
        "description": "只输出条文说明窗口中的第4章下 4.7、4.8、4.9 的说明节点。",
    },
    {
        "name": "commentary-ch4-b2",
        "description": "只输出条文说明窗口中的第4章下 4.10、4.11、4.12 的说明节点，并且必须优先识别 clause 级说明，例如 4.10.1、4.11.3、4.11.4、4.11.5、4.12.1、4.12.2。",
    },
    {
        "name": "commentary-ch5",
        "description": "只输出条文说明窗口中的第5章说明节点，包括 5.1、5.2、5.3、5.4 的说明节点；如果存在 clause 级说明，必须优先输出 5.1.1、5.1.2、5.2.2、5.2.3、5.3.1、5.3.2、5.3.3、5.3.4、5.3.6 等条目。",
    },
]
INPUT_TEMPLATE = textwrap.dedent(
    """
    文档名称：{document_name}
    文档编号：{document_code}

    通用规则：
    1. 不要编造不存在的条款、说明、页码、标题。
    2. 不要把目录页、页眉、页脚、页码、目录项混入结果。
    3. 正文窗口在第一次进入“1 总则”之后，到“修订说明”之前结束。
    4. 条文说明窗口从“修订说明”之后开始，必须跳过第二个“目次/目录”，不要混入修订背景引言。
    5. `page_start/page_end` 必须基于输入的按页文本窗口匹配得到；不能猜。
    6. 节点编号和 `node_id/anchor/parent_id` 必须稳定可程序消费。
    7. 输出必须是单个 JSON 对象，不要 Markdown，不要代码块，不要解释。

    [BEGIN_FULL_MD]
    {full_md}
    [END_FULL_MD]

    [BEGIN_LAYOUT_PAGE_TEXTS]
    {layout_json}
    [END_LAYOUT_PAGE_TEXTS]
    """
).strip()
CLAUSE_PROMPT_TEMPLATE = textwrap.dedent(
    """
    你现在只生成 `{scope_name}` 范围内的正文条款平铺节点，不要输出 commentary，也不要输出 document 包装层。

    范围要求：
    {scope_description}

    输出要求：
    1. 只输出本范围内需要的节点；如果某个 section 属于本范围，要同时输出其必要祖先节点，例如 chapter 4。
    2. 输出必须是一个 JSON 对象，格式如下：
       {{
         "summary_text": "本范围的简短概述",
         "entries": [ ... ]
       }}
    3. `entries` 中每个节点必须包含这些字段：
       `node_id` `clause_id` `title` `label` `node_type` `depth` `parent_id`
       `path_ids` `path_label` `section_path` `anchor`
       `page_start` `page_end` `summary_text` `content_preview` `child_count` `tags` `children`
    4. 这里的 `children` 先填空数组，`child_count` 可以先填 0，后续由程序重建。
    5. `node_type` 只能是：`chapter`、`section`、`clause`、`appendix`、`other`
    6. 正文索引里禁止出现 `explanation` 字段。
    7. 不要输出范围外节点。
    8. 不要遗漏本范围内的 chapter/section/clause。
    9. 如果本范围包含 `4.9`、`4.10`、`4.11`、`4.12` 这类 section，必须继续展开到 clause 级，不能只保留 section。
    """
).strip()
COMMENTARY_PROMPT_TEMPLATE = textwrap.dedent(
    """
    你现在只生成 `{scope_name}` 范围内的条文说明平铺节点，不要输出 clause_index，也不要输出 document 包装层。

    范围要求：
    {scope_description}

    输出要求：
    1. 只保留真正的条文说明正文，不要混入正文原文。
    2. 只输出本范围内需要的节点；如果某个 clause 属于本范围，要同时输出其必要祖先节点，例如 chapter 4 或 section 4.1。
    3. 如果说明正文中存在条款编号项，例如 `4.1.3`、`4.8.4`、`5.1.1`，必须逐条输出 clause 级节点；只输出 section 级总结视为不合格。
    4. 只有在本范围内确实不存在 clause 级说明时，才允许只保留 chapter/section 级节点。
    5. 输出必须是一个 JSON 对象，格式如下：
       {{
         "summary_text": "本范围的简短概述",
         "entries": [ ... ]
       }}
    6. `entries` 中每个节点必须包含这些字段：
       `node_id` `clause_id` `title` `label` `node_type` `depth` `parent_id`
       `path_ids` `path_label` `section_path` `anchor`
       `page_start` `page_end` `commentary_text` `summary_text` `child_count` `tags` `children`
    7. 这里的 `children` 先填空数组，`child_count` 可以先填 0，后续由程序重建。
    8. `node_type` 只能是：`chapter`、`section`、`clause`、`appendix`、`other`
    9. 不要输出范围外节点。
    """
).strip()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate norm clause/commentary JSON via chunked OpenAI-compatible requests and validate locally."
    )
    parser.add_argument("--full-md", required=True, type=Path)
    parser.add_argument("--layout-json", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--model", default=os.getenv("DEEPSEEK_MODEL", DEFAULT_MODEL))
    parser.add_argument(
        "--api-base-url",
        default=os.getenv("DEEPSEEK_API_BASE_URL", os.getenv("RUNTIME_API_BASE_URL", DEFAULT_API_BASE_URL)),
    )
    parser.add_argument("--api-key", default=os.getenv("DEEPSEEK_API_KEY", os.getenv("RUNTIME_API_KEY")))
    parser.add_argument("--temperature", type=float, default=0.0)
    parser.add_argument("--max-output-tokens", type=int, default=12000)
    parser.add_argument("--repair-attempts", type=int, default=1)
    parser.add_argument("--timeout-seconds", type=float, default=300.0)
    parser.add_argument("--debug-dir", type=Path)
    parser.add_argument("--layout-mode", choices=("page_texts", "raw"), default="page_texts")
    parser.add_argument("--allow-warnings", action="store_true")
    parser.add_argument("--no-response-format", action="store_true")
    parser.add_argument("--base-json", type=Path, help="Optional existing combined JSON to merge with newly generated scopes.")
    parser.add_argument(
        "--clause-scope",
        action="append",
        dest="clause_scopes",
        help="Limit clause generation to specific scope names. Can be passed multiple times.",
    )
    parser.add_argument(
        "--commentary-scope",
        action="append",
        dest="commentary_scopes",
        help="Limit commentary generation to specific scope names. Can be passed multiple times.",
    )
    return parser.parse_args()


def _normalize_spaces(text: str) -> str:
    return " ".join(text.split())


def _extract_layout_page_texts(layout_payload: dict[str, Any]) -> list[dict[str, Any]]:
    pages: list[dict[str, Any]] = []
    for index, page in enumerate(layout_payload.get("pdf_info", []), start=1):
        lines: list[str] = []
        for block in page.get("para_blocks", []):
            for line in block.get("lines", []):
                span_text = "".join(span.get("content", "") for span in line.get("spans", []))
                normalized = _normalize_spaces(span_text)
                if normalized:
                    lines.append(normalized)
        pages.append({"page": index, "text": "\n".join(lines)})
    return pages


def load_inputs(full_md_path: Path, layout_json_path: Path, layout_mode: str) -> tuple[str, str]:
    full_md = full_md_path.read_text(encoding="utf-8")
    layout_payload = json.loads(layout_json_path.read_text(encoding="utf-8"))
    if layout_mode == "raw":
        layout_json_serialized = json.dumps(layout_payload, ensure_ascii=False, separators=(",", ":"))
    else:
        layout_json_serialized = json.dumps(
            {"page_texts": _extract_layout_page_texts(layout_payload)},
            ensure_ascii=False,
            separators=(",", ":"),
        )
    return full_md, layout_json_serialized


def request_completion(
    *,
    api_base_url: str,
    api_key: str,
    model: str,
    temperature: float,
    max_output_tokens: int,
    timeout_seconds: float,
    messages: list[dict[str, Any]],
    use_response_format: bool,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "model": model,
        "temperature": temperature,
        "messages": [{"role": "system", "content": SYSTEM_PROMPT}, *messages],
        "max_tokens": max_output_tokens,
    }
    if use_response_format:
        payload["response_format"] = {"type": "json_object"}
    url = f"{api_base_url.rstrip('/')}/chat/completions"
    headers = {"Authorization": f"Bearer {api_key}"}
    with httpx.Client(timeout=timeout_seconds) as client:
        response = client.post(url, headers=headers, json=payload)
        if response.is_error:
            raise RuntimeError(f"HTTP {response.status_code} from {url}: {response.text}")
        return response.json()


def extract_message_text(payload: dict[str, Any]) -> str:
    choices = payload.get("choices", [])
    if not choices:
        raise ValueError("API returned no choices.")
    message = choices[0].get("message", {})
    content = message.get("content", "")
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        texts = [item["text"] for item in content if isinstance(item, dict) and isinstance(item.get("text"), str)]
        return "\n".join(texts).strip()
    raise ValueError("Unsupported response content format.")


def extract_usage(payload: dict[str, Any]) -> dict[str, Any]:
    usage = payload.get("usage")
    return usage if isinstance(usage, dict) else {}


def strip_code_fences(text: str) -> str:
    stripped = text.strip()
    if stripped.startswith("```"):
        lines = stripped.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        stripped = "\n".join(lines).strip()
    return stripped


def write_debug(debug_dir: Path | None, name: str, content: str) -> None:
    if debug_dir is None:
        return
    debug_dir.mkdir(parents=True, exist_ok=True)
    (debug_dir / name).write_text(content, encoding="utf-8")


def parse_json_text(text: str) -> Any:
    return json.loads(strip_code_fences(text))


def _make_scope_prompt(stage: str, scope: dict[str, str], full_md: str, layout_json: str) -> str:
    shared = INPUT_TEMPLATE.format(
        document_name=DOCUMENT_NAME,
        document_code=DOCUMENT_CODE,
        full_md=full_md,
        layout_json=layout_json,
    )
    template = CLAUSE_PROMPT_TEMPLATE if stage == "clause" else COMMENTARY_PROMPT_TEMPLATE
    return f"{template.format(scope_name=scope['name'], scope_description=scope['description'])}\n\n{shared}"


def _basic_entries_validate(payload: Any, required_keys: set[str], kind: str) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    if not isinstance(payload, dict):
        return [f"{kind} payload must be an object."], []
    if not isinstance(payload.get("summary_text"), str):
        errors.append(f"{kind}.summary_text must be a string.")
    entries = payload.get("entries", [])
    if not isinstance(entries, list):
        return [f"{kind}.entries must be an array."], []
    if not entries:
        errors.append(f"{kind}.entries is empty.")
    for entry in entries:
        if not isinstance(entry, dict):
            errors.append(f"{kind}.entries contains a non-object item.")
            continue
        missing = required_keys - set(entry.keys())
        if missing:
            errors.append(f"{kind} entry {entry.get('clause_id')} missing keys: {sorted(missing)}")
        if entry.get("node_type") not in VALID_NODE_TYPES:
            errors.append(f"{kind} entry {entry.get('clause_id')} has invalid node_type.")
    return errors, warnings


def validate_scope_payload(stage: str, scope_name: str, payload: Any) -> tuple[list[str], list[str]]:
    if stage == "clause":
        errors, warnings = _basic_entries_validate(payload, REQUIRED_CLAUSE_KEYS, "clause_index")
        entries = payload.get("entries", []) if isinstance(payload, dict) else []
        ids = {entry.get("clause_id") for entry in entries if isinstance(entry, dict)}
        if stage == "clause":
            if any(isinstance(entry, dict) and "explanation" in entry for entry in entries):
                errors.append("clause_index payload illegally contains explanation.")
            if not any(isinstance(entry, dict) and entry.get("node_type") == "section" for entry in entries):
                warnings.append("clause_index scope payload has no section nodes.")
            if not any(item in ids for item in ("4.1", "4.5", "4.9", "5.1", "附录A")):
                warnings.append("clause_index scope payload may be too small or missing expected roots.")
        return errors, warnings
    errors, warnings = _basic_entries_validate(payload, REQUIRED_COMMENTARY_KEYS, "commentary_map_result")
    entries = payload.get("entries", []) if isinstance(payload, dict) else []
    if not any(isinstance(entry, dict) and entry.get("depth") == 1 for entry in entries):
        warnings.append("commentary scope payload has no chapter-level nodes.")
    has_clause = any(isinstance(entry, dict) and entry.get("node_type") == "clause" for entry in entries)
    if entries and not has_clause:
        if scope_name in {"commentary-ch4-b2", "commentary-ch5"}:
            errors.append("commentary scope payload has no clause-level nodes.")
        else:
            warnings.append("commentary scope payload has no clause-level nodes.")
    if scope_name == "commentary-ch4-b2":
        wanted = {"4.10.1", "4.11.3", "4.11.4", "4.11.5", "4.12.1", "4.12.2"}
        ids = {entry.get("clause_id") for entry in entries if isinstance(entry, dict)}
        if not (wanted & ids):
            errors.append("commentary-ch4-b2 did not extract any expected clause-level commentary ids.")
    return errors, warnings


def build_repair_message(stage: str, errors: list[str], warnings: list[str]) -> str:
    problems = "\n".join(f"- {line}" for line in [*errors, *warnings])
    return textwrap.dedent(
        f"""
        你上一轮 `{stage}` 范围输出没有通过本地校验。请基于前一轮输出修复，并重新输出完整 JSON 对象。

        校验问题：
        {problems}

        修复要求：
        1. 只输出当前范围对应的完整 JSON 对象。
        2. 不要输出增量说明。
        3. 不要使用代码块。
        4. 只输出 JSON。
        """
    ).strip()


def run_scope(
    *,
    stage: str,
    scope: dict[str, str],
    full_md: str,
    layout_json: str,
    api_base_url: str,
    api_key: str,
    model: str,
    temperature: float,
    max_output_tokens: int,
    timeout_seconds: float,
    repair_attempts: int,
    use_response_format: bool,
    debug_dir: Path | None,
) -> tuple[Any | None, list[str], list[str]]:
    prompt = _make_scope_prompt(stage, scope, full_md, layout_json)
    messages: list[dict[str, Any]] = [{"role": "user", "content": prompt}]
    attempts = repair_attempts + 1
    final_payload: Any = None
    final_errors: list[str] = []
    final_warnings: list[str] = []

    for attempt in range(1, attempts + 1):
        api_payload = request_completion(
            api_base_url=api_base_url,
            api_key=api_key,
            model=model,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
            timeout_seconds=timeout_seconds,
            messages=messages,
            use_response_format=use_response_format,
        )
        response_text = extract_message_text(api_payload)
        write_debug(debug_dir, f"{scope['name']}-attempt-{attempt:02d}-response.txt", response_text)
        write_debug(
            debug_dir,
            f"{scope['name']}-attempt-{attempt:02d}-usage.json",
            json.dumps(extract_usage(api_payload), ensure_ascii=False, indent=2),
        )

        try:
            candidate = parse_json_text(response_text)
        except json.JSONDecodeError as exc:
            final_errors = [f"{scope['name']} JSON parse failed on attempt {attempt}: {exc}"]
            final_warnings = []
            if attempt >= attempts:
                return None, final_errors, final_warnings
            messages.extend(
                [
                    {"role": "assistant", "content": response_text},
                    {
                        "role": "user",
                        "content": (
                            f"你上一轮 `{scope['name']}` 输出不是合法 JSON。"
                            f" 解析错误：{exc}. 请重新输出完整 JSON 对象，不要解释。"
                        ),
                    },
                ]
            )
            continue

        errors, warnings = validate_scope_payload(stage, scope["name"], candidate)
        write_debug(
            debug_dir,
            f"{scope['name']}-attempt-{attempt:02d}-validation.txt",
            "\n".join([*(f"ERROR: {line}" for line in errors), *(f"WARNING: {line}" for line in warnings)]),
        )
        final_payload = candidate
        final_errors = errors
        final_warnings = warnings
        if not errors:
            return final_payload, final_errors, final_warnings
        if attempt >= attempts:
            return final_payload, final_errors, final_warnings
        messages.extend(
            [
                {"role": "assistant", "content": json.dumps(candidate, ensure_ascii=False)},
                {"role": "user", "content": build_repair_message(stage, errors, warnings)},
            ]
        )

    return final_payload, final_errors, final_warnings


def natural_sort_key(value: str) -> list[Any]:
    return [int(part) if part.isdigit() else part for part in re.split(r"(\d+)", value)]


def entry_order_key(entry: dict[str, Any]) -> tuple[int, list[Any], str]:
    clause_id = str(entry.get("clause_id") or "")
    if clause_id in SPECIAL_ROOT_ORDER:
        return (SPECIAL_ROOT_ORDER.index(clause_id), [], clause_id)
    prefix = clause_id.split(".", 1)[0]
    if prefix in SPECIAL_ROOT_ORDER:
        return (SPECIAL_ROOT_ORDER.index(prefix), natural_sort_key(clause_id), clause_id)
    return (len(SPECIAL_ROOT_ORDER) + 1, natural_sort_key(clause_id or str(entry.get("label") or "")), clause_id)


def dedupe_entries(chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}
    order: list[str] = []
    for chunk in chunks:
        for entry in chunk.get("entries", []):
            if not isinstance(entry, dict):
                continue
            clause_id = str(entry.get("clause_id") or "")
            if entry.get("node_type") == "appendix" and clause_id == "A":
                clause_id = "附录A"
                entry["clause_id"] = clause_id
                if isinstance(entry.get("label"), str) and entry["label"] == "附录A":
                    entry["node_id"] = "appendix-附录a"
                    entry["anchor"] = "appendix-附录a"
            if not clause_id and entry.get("node_type") == "other":
                fallback = str(entry.get("title") or entry.get("label") or "").strip()
                if fallback:
                    clause_id = fallback
                    entry["clause_id"] = clause_id
            if not clause_id:
                continue
            normalized = copy.deepcopy(entry)
            normalized["children"] = []
            normalized["child_count"] = 0
            if clause_id not in merged:
                merged[clause_id] = normalized
                order.append(clause_id)
                continue
            current = merged[clause_id]
            for key, value in normalized.items():
                if current.get(key) in (None, "", [], 0) and value not in (None, "", [], 0):
                    current[key] = value
            tags = sorted(set((current.get("tags") or []) + (normalized.get("tags") or [])))
            current["tags"] = tags
    ordered = [merged[clause_id] for clause_id in order]
    ordered.sort(key=entry_order_key)
    return ordered


def normalize_entry_shape(entry: dict[str, Any]) -> dict[str, Any]:
    normalized = copy.deepcopy(entry)
    clause_id = str(normalized.get("clause_id") or "")
    title = str(normalized.get("title") or "")
    label = str(normalized.get("label") or "")

    if normalized.get("node_type") == "appendix" and clause_id == "A":
        clause_id = "附录A"
        normalized["clause_id"] = clause_id
        normalized["label"] = "附录A"
        normalized["anchor"] = "appendix-附录a"
        normalized["node_id"] = "appendix-附录a"

    if clause_id in {"本规范用词说明", "引用标准名录"} or title in {"本规范用词说明", "引用标准名录"}:
        normalized["node_type"] = "other"
        normalized["depth"] = 1
        normalized["parent_id"] = None
        normalized["clause_id"] = clause_id or title
    elif clause_id.startswith("附录") or label.startswith("附录") or title.startswith("附录A"):
        normalized["node_type"] = "appendix"
        normalized["depth"] = 1
        normalized["parent_id"] = None
        if not clause_id or clause_id == "A":
            normalized["clause_id"] = "附录A"
    elif re.fullmatch(r"\d+", clause_id):
        normalized["node_type"] = "chapter"
        normalized["depth"] = 1
        normalized["parent_id"] = None
    elif re.fullmatch(r"\d+\.\d+", clause_id):
        normalized["node_type"] = "section"
        normalized["depth"] = 2
    elif re.fullmatch(r"(?:\d+\.)+\d+", clause_id):
        normalized["node_type"] = "clause"
        normalized["depth"] = clause_id.count(".") + 1

    return normalized


def clone_subtree(node_id: str, by_node_id: dict[str, dict[str, Any]], child_map: dict[str | None, list[str]]) -> dict[str, Any]:
    node = copy.deepcopy(by_node_id[node_id])
    children = [clone_subtree(child_id, by_node_id, child_map) for child_id in child_map.get(node_id, [])]
    node["children"] = children
    node["child_count"] = len(children)
    return node


def rebuild_hierarchy(entries: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    normalized_entries = [normalize_entry_shape(entry) for entry in entries]
    by_node_id = {str(entry["node_id"]): copy.deepcopy(entry) for entry in normalized_entries}
    child_map: dict[str | None, list[str]] = {}
    for entry in normalized_entries:
        parent_id = entry.get("parent_id")
        node_id = str(entry["node_id"])
        child_map.setdefault(parent_id, []).append(node_id)

    for parent_id, children in child_map.items():
        children.sort(key=lambda child_id: entry_order_key(by_node_id[child_id]))

    ordered_entries: list[dict[str, Any]] = []
    for entry in normalized_entries:
        node_id = str(entry["node_id"])
        rebuilt = clone_subtree(node_id, by_node_id, child_map)
        ordered_entries.append(rebuilt)

    root_ids = child_map.get(None, [])
    root_ids.sort(key=lambda node_id: entry_order_key(by_node_id[node_id]))
    tree = [clone_subtree(node_id, by_node_id, child_map) for node_id in root_ids]
    return tree, ordered_entries


def combine_scope_summaries(chunks: list[dict[str, Any]]) -> str:
    parts = [chunk.get("summary_text", "").strip() for chunk in chunks if isinstance(chunk.get("summary_text"), str)]
    parts = [part for part in parts if part]
    return " ".join(parts[:4])


def build_commentary_map(entries: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for entry in entries:
        if entry.get("node_type") != "clause":
            continue
        commentary_text = str(entry.get("commentary_text") or "").strip()
        if not commentary_text:
            continue
        clause_id = str(entry.get("clause_id") or "")
        if not clause_id:
            continue
        result[clause_id] = {
            "commentary_text": commentary_text,
            "summary_text": entry.get("summary_text"),
            "page_start": entry.get("page_start"),
            "page_end": entry.get("page_end"),
            "section_path": entry.get("section_path"),
        }
    return result


def run_scopes(
    *,
    stage: str,
    scopes: list[dict[str, str]],
    full_md: str,
    layout_json: str,
    api_base_url: str,
    api_key: str,
    model: str,
    temperature: float,
    max_output_tokens: int,
    timeout_seconds: float,
    repair_attempts: int,
    use_response_format: bool,
    debug_dir: Path | None,
) -> tuple[list[dict[str, Any]], list[str], list[str], str]:
    outputs: list[dict[str, Any]] = []
    errors: list[str] = []
    warnings: list[str] = []
    for scope in scopes:
        payload, scope_errors, scope_warnings = run_scope(
            stage=stage,
            scope=scope,
            full_md=full_md,
            layout_json=layout_json,
            api_base_url=api_base_url,
            api_key=api_key,
            model=model,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
            timeout_seconds=timeout_seconds,
            repair_attempts=repair_attempts,
            use_response_format=use_response_format,
            debug_dir=debug_dir,
        )
        errors.extend(f"{scope['name']}: {line}" for line in scope_errors)
        warnings.extend(f"{scope['name']}: {line}" for line in scope_warnings)
        if payload is not None:
            outputs.append(payload)
        if scope_errors:
            break
    return outputs, errors, warnings, combine_scope_summaries(outputs)


def save_output(output_path: Path, payload: Any) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def select_scopes(all_scopes: list[dict[str, str]], selected_names: list[str] | None) -> list[dict[str, str]]:
    if not selected_names:
        return all_scopes
    by_name = {scope["name"]: scope for scope in all_scopes}
    missing = [name for name in selected_names if name not in by_name]
    if missing:
        raise SystemExit(f"Unknown scope names: {missing}")
    return [by_name[name] for name in selected_names]


def load_base_payload(base_json: Path | None) -> dict[str, Any] | None:
    if base_json is None:
        return None
    return json.loads(base_json.read_text(encoding="utf-8"))


def main() -> None:
    args = parse_args()
    if not args.api_key:
        raise SystemExit("Missing API key. Set --api-key or DEEPSEEK_API_KEY/RUNTIME_API_KEY.")

    model = args.model
    if "api.deepseek.com" in args.api_base_url and model == DEFAULT_MODEL:
        model = DEFAULT_OFFICIAL_DEEPSEEK_MODEL

    full_md, layout_json = load_inputs(args.full_md, args.layout_json, args.layout_mode)
    base_payload = load_base_payload(args.base_json)

    clause_chunks: list[dict[str, Any]] = []
    commentary_chunks: list[dict[str, Any]] = []
    if base_payload:
        clause_chunks.append(base_payload["clause_index"])
        commentary_chunks.append(base_payload["commentary_map_result"])

    clause_scope_names = args.clause_scopes
    commentary_scope_names = args.commentary_scopes
    if args.base_json and clause_scope_names is not None and commentary_scope_names is None:
        commentary_scope_names = []
    if args.base_json and commentary_scope_names is not None and clause_scope_names is None:
        clause_scope_names = []

    clause_scope_list = select_scopes(CLAUSE_SCOPES, clause_scope_names) if clause_scope_names != [] else []
    commentary_scope_list = (
        select_scopes(COMMENTARY_SCOPES, commentary_scope_names) if commentary_scope_names != [] else []
    )

    new_clause_chunks, clause_errors, clause_warnings, _ = run_scopes(
        stage="clause",
        scopes=clause_scope_list,
        full_md=full_md,
        layout_json=layout_json,
        api_base_url=args.api_base_url,
        api_key=args.api_key,
        model=model,
        temperature=args.temperature,
        max_output_tokens=args.max_output_tokens,
        timeout_seconds=args.timeout_seconds,
        repair_attempts=args.repair_attempts,
        use_response_format=not args.no_response_format,
        debug_dir=args.debug_dir,
    )
    if clause_errors:
        print_report(clause_errors, clause_warnings)
        raise SystemExit(1)
    clause_chunks.extend(new_clause_chunks)

    new_commentary_chunks, commentary_errors, commentary_warnings, _ = run_scopes(
        stage="commentary",
        scopes=commentary_scope_list,
        full_md=full_md,
        layout_json=layout_json,
        api_base_url=args.api_base_url,
        api_key=args.api_key,
        model=model,
        temperature=args.temperature,
        max_output_tokens=args.max_output_tokens,
        timeout_seconds=args.timeout_seconds,
        repair_attempts=args.repair_attempts,
        use_response_format=not args.no_response_format,
        debug_dir=args.debug_dir,
    )
    if commentary_errors:
        print_report(commentary_errors, commentary_warnings)
        raise SystemExit(1)
    commentary_chunks.extend(new_commentary_chunks)

    clause_summary = combine_scope_summaries(clause_chunks)
    commentary_summary = combine_scope_summaries(commentary_chunks)

    clause_entries = dedupe_entries(clause_chunks)
    clause_tree, clause_entries_rebuilt = rebuild_hierarchy(clause_entries)
    commentary_entries = dedupe_entries(commentary_chunks)
    commentary_tree, commentary_entries_rebuilt = rebuild_hierarchy(commentary_entries)

    combined_payload = {
        "document": {"name": DOCUMENT_NAME, "code": DOCUMENT_CODE},
        "clause_index": {
            "summary_text": clause_summary,
            "tree": clause_tree,
            "entries": clause_entries_rebuilt,
        },
        "commentary_map_result": {
            "summary_text": commentary_summary,
            "tree": commentary_tree,
            "entries": commentary_entries_rebuilt,
            "commentary_map": build_commentary_map(commentary_entries_rebuilt),
        },
    }
    final_errors, final_warnings = validate_payload(combined_payload)
    write_debug(
        args.debug_dir,
        "final-validation.txt",
        "\n".join([*(f"ERROR: {line}" for line in final_errors), *(f"WARNING: {line}" for line in final_warnings)]),
    )
    print_report(final_errors, final_warnings)
    save_output(args.output, combined_payload)
    print(f"Wrote output to {args.output}")

    if final_errors:
        raise SystemExit(1)
    if final_warnings and not args.allow_warnings:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
