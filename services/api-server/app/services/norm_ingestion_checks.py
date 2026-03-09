import json
import re
from dataclasses import dataclass
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.storage import read_text_artifact
from app.db.models import DocumentArtifact, DocumentVersion, KnowledgeBaseEntry
from app.services.risk_marker import detect_risk_marks

_CHINESE_DIGITS = {
    "零": 0,
    "一": 1,
    "二": 2,
    "三": 3,
    "四": 4,
    "五": 5,
    "六": 6,
    "七": 7,
    "八": 8,
    "九": 9,
    "十": 10,
    "两": 2,
}
_CHINESE_UNITS = {"十": 10, "百": 100, "千": 1000}
_CHINESE_CLAUSE_RE = re.compile(r"^(第([一二三四五六七八九十百千万零两0-9]+)([篇编部分章节条]))(?=[\s\u3000:：、.)）-]|$)")
_DECIMAL_CLAUSE_RE = re.compile(r"^((?:\d+\.)+\d+|\d+)(?=[\s\u3000:：、.)）-]|$)")
_LIST_ITEM_RE = re.compile(r"^[（(]([一二三四五六七八九十]+)[)）](?=[\s\u3000:：、.-]|$)")


@dataclass(frozen=True)
class ClauseNode:
    clause_id: str
    title: str
    kind: str
    depth: int
    page: int
    sort_index: int


@dataclass(frozen=True)
class ParsedNormArtifacts:
    parser_name: str
    markdown: str
    sections: list[dict[str, Any]]


def run_norm_entry_check(db: Session, entry: KnowledgeBaseEntry) -> tuple[str, str]:
    parsed = _load_norm_artifacts(db, entry)
    if parsed is None:
        return (
            "attention_needed",
            "规范文件未生成可用解析产物，暂无法执行条款号抽取、摘要补全和树校验。",
        )

    clause_nodes = _extract_clause_nodes(parsed.sections)
    tree_issues = _validate_clause_tree(clause_nodes)
    source_text = _build_source_text(entry=entry, parsed=parsed)
    risk_marks = detect_risk_marks(source_text)
    rule_summary = _build_rule_summary(parsed=parsed, clause_nodes=clause_nodes)
    model_summary = _try_model_supplement_summary(parsed=parsed, clause_nodes=clause_nodes)
    summary_mode = "1M模型补结" if model_summary else "规则摘要回退"

    issues: list[str] = []
    if not clause_nodes:
        issues.append("未识别到有效条款号")
    issues.extend(tree_issues)
    if risk_marks:
        issues.append(f"发现 {len(risk_marks)} 处疑似项目化信息")

    status = "attention_needed" if issues else "checked"
    summary_parts = [
        f"规范入库检测完成，解析来源 {parsed.parser_name}，联合读取 markdown/json",
        _summarize_clause_nodes(clause_nodes),
        f"摘要补全（{summary_mode}）：{model_summary or rule_summary}",
        _summarize_tree_issues(tree_issues),
    ]
    if risk_marks:
        summary_parts.append(_summarize_risk_marks(risk_marks))
    return status, "；".join(part for part in summary_parts if part)


def _load_norm_artifacts(db: Session, entry: KnowledgeBaseEntry) -> ParsedNormArtifacts | None:
    if entry.source_document_id is None:
        return None

    artifacts = list(
        db.execute(
            select(DocumentArtifact.artifact_type, DocumentArtifact.storage_path)
            .join(DocumentVersion, DocumentVersion.id == DocumentArtifact.document_version_id)
            .where(DocumentVersion.document_id == entry.source_document_id)
            .order_by(DocumentVersion.version_no.desc(), DocumentArtifact.id.desc())
        ).all()
    )
    markdown_path = next((path for artifact_type, path in artifacts if artifact_type == "markdown"), None)
    json_path = next((path for artifact_type, path in artifacts if artifact_type == "json"), None)
    parse_log_path = next((path for artifact_type, path in artifacts if artifact_type == "parse_log"), None)
    if json_path is None:
        return None

    try:
        payload = json.loads(read_text_artifact(json_path))
    except (OSError, json.JSONDecodeError):
        return None

    parser_name = "unknown"
    if parse_log_path is not None:
        try:
            parse_log = json.loads(read_text_artifact(parse_log_path))
            parser_name = str(parse_log.get("parser") or parser_name)
        except (OSError, json.JSONDecodeError):
            parser_name = "unknown"

    markdown = ""
    if markdown_path is not None:
        try:
            markdown = read_text_artifact(markdown_path)
        except OSError:
            markdown = ""

    sections = payload.get("sections", [])
    if not isinstance(sections, list):
        return None
    return ParsedNormArtifacts(parser_name=parser_name, markdown=markdown, sections=sections)


def _extract_clause_nodes(sections: list[dict[str, Any]]) -> list[ClauseNode]:
    nodes: list[ClauseNode] = []
    seen: set[tuple[str, int, int]] = set()
    sort_index = 0

    for section in sections:
        page = int(section.get("page") or 1)
        title = _normalize_text(section.get("title"))
        lines = [title]
        lines.extend(_iter_candidate_lines(section.get("content")))

        for line in lines:
            match = _match_clause(line)
            if match is None:
                continue

            clause_id, kind, depth = match
            key = (clause_id, page, depth)
            if key in seen:
                continue
            seen.add(key)
            sort_index += 1
            nodes.append(
                ClauseNode(
                    clause_id=clause_id,
                    title=_strip_clause_prefix(line, clause_id) or title or line,
                    kind=kind,
                    depth=depth,
                    page=page,
                    sort_index=sort_index,
                )
            )

    return nodes


def _iter_candidate_lines(content: Any) -> list[str]:
    if not isinstance(content, str):
        return []
    return [_normalize_text(line) for line in content.splitlines() if _normalize_text(line)]


def _match_clause(text: str) -> tuple[str, str, int] | None:
    if not text:
        return None

    chinese_match = _CHINESE_CLAUSE_RE.match(text)
    if chinese_match:
        clause_id = chinese_match.group(1)
        clause_type = chinese_match.group(3)
        if clause_type in {"篇", "编", "部", "分", "章"}:
            return clause_id, "chapter", 1
        if clause_type == "节":
            return clause_id, "section", 2
        return clause_id, "article", 3

    decimal_match = _DECIMAL_CLAUSE_RE.match(text)
    if decimal_match:
        clause_id = decimal_match.group(1).rstrip(".")
        return clause_id, "decimal", clause_id.count(".") + 1

    list_match = _LIST_ITEM_RE.match(text)
    if list_match:
        clause_id = f"（{list_match.group(1)}）"
        return clause_id, "list_item", 4

    return None


def _strip_clause_prefix(text: str, clause_id: str) -> str:
    stripped = text[len(clause_id) :].lstrip(" \u3000:：、.)）-")
    return _normalize_text(stripped)


def _validate_clause_tree(clause_nodes: list[ClauseNode]) -> list[str]:
    issues: list[str] = []
    chinese_nodes = [node for node in clause_nodes if node.kind in {"chapter", "section", "article"}]
    chapter_orders = {
        order
        for node in chinese_nodes
        if node.kind == "chapter"
        for order in [_parse_chinese_clause_order(node.clause_id)]
        if order is not None
    }
    issues.extend(_validate_decimal_tree([node for node in clause_nodes if node.kind == "decimal"], chapter_orders))
    issues.extend(_validate_chinese_tree(chinese_nodes))
    return issues


def _validate_decimal_tree(nodes: list[ClauseNode], chapter_orders: set[int]) -> list[str]:
    issues: list[str] = []
    seen: dict[str, ClauseNode] = {}
    last_child_by_parent: dict[str, int] = {}

    for node in nodes:
        if node.clause_id in seen:
            issues.append(f"条款号重复 {node.clause_id}")
            continue
        seen[node.clause_id] = node

        parts = [int(part) for part in node.clause_id.split(".")]
        if len(parts) > 1:
            parent_id = ".".join(str(part) for part in parts[:-1])
            if parent_id not in seen and not _allows_missing_decimal_parent(parts, chapter_orders):
                issues.append(f"缺少父条款 {parent_id}")
            sibling_key = parent_id
        else:
            sibling_key = "__root__"

        current_leaf = parts[-1]
        previous_leaf = last_child_by_parent.get(sibling_key)
        if previous_leaf is not None and current_leaf <= previous_leaf:
            issues.append(f"同级条款顺序异常 {node.clause_id}")
        last_child_by_parent[sibling_key] = current_leaf

    return _dedupe_preserve_order(issues)


def _allows_missing_decimal_parent(parts: list[int], chapter_orders: set[int]) -> bool:
    if not parts:
        return False
    if len(parts) == 2:
        return parts[0] in chapter_orders
    if len(parts) == 3 and parts[1] == 0:
        return parts[0] in chapter_orders
    return False


def _validate_chinese_tree(nodes: list[ClauseNode]) -> list[str]:
    issues: list[str] = []
    seen_depths: set[int] = set()
    last_order_by_depth: dict[int, int] = {}

    for node in nodes:
        order = _parse_chinese_clause_order(node.clause_id)
        if order is None:
            continue
        if node.depth > 1 and (node.depth - 1) not in seen_depths:
            issues.append(f"{node.clause_id} 缺少上级标题")
        previous_order = last_order_by_depth.get(node.depth)
        if previous_order is not None and order <= previous_order:
            issues.append(f"{node.clause_id} 顺序异常")
        seen_depths.add(node.depth)
        last_order_by_depth[node.depth] = order

    return _dedupe_preserve_order(issues)


def _parse_chinese_clause_order(clause_id: str) -> int | None:
    match = _CHINESE_CLAUSE_RE.match(clause_id)
    if match is None:
        return None
    raw_number = match.group(2)
    if raw_number.isdigit():
        return int(raw_number)
    return _parse_chinese_number(raw_number)


def _parse_chinese_number(value: str) -> int | None:
    if not value:
        return None
    if value.isdigit():
        return int(value)

    total = 0
    current = 0
    for character in value:
        if character in _CHINESE_UNITS:
            unit = _CHINESE_UNITS[character]
            total += (current or 1) * unit
            current = 0
            continue
        digit = _CHINESE_DIGITS.get(character)
        if digit is None:
            return None
        current = digit
    return total + current


def _build_source_text(*, entry: KnowledgeBaseEntry, parsed: ParsedNormArtifacts) -> str:
    parts = [entry.title, entry.owner_name, parsed.markdown]
    parts.extend(str(section.get("title") or "") for section in parsed.sections)
    parts.extend(str(section.get("content") or "") for section in parsed.sections)
    return "\n".join(part for part in parts if part)


def _build_rule_summary(*, parsed: ParsedNormArtifacts, clause_nodes: list[ClauseNode]) -> str:
    titles: list[str] = []
    for section in parsed.sections:
        title = _normalize_text(section.get("title"))
        if title and title not in titles and not title.lower().startswith("page "):
            titles.append(title)
        if len(titles) >= 4:
            break

    clause_count = len([node for node in clause_nodes if node.kind != "list_item"])
    if titles:
        focus = "、".join(titles[:3])
        return f"文档重点围绕 {focus} 等章节展开，当前已抽取 {clause_count} 个候选条款，建议以条款树为主索引入库。"
    return f"文档已完成解析，当前已抽取 {clause_count} 个候选条款，适合作为规范真值资料入库。"


def _try_model_supplement_summary(*, parsed: ParsedNormArtifacts, clause_nodes: list[ClauseNode]) -> str | None:
    if not settings.runtime_api_base_url or not settings.runtime_api_key:
        return None

    prompt = (
        "你是建设规范资料入库助手。"
        "请基于给定的规范解析稿，输出一段120字以内的中文摘要，"
        "补充说明适用范围、关键约束和推荐索引方式，不要编造未出现的事实。"
    )
    source_excerpt = _build_model_source_excerpt(parsed=parsed, clause_nodes=clause_nodes)
    payload = {
        "model": settings.norm_summary_role_model,
        "messages": [
            {"role": "system", "content": prompt},
            {
                "role": "user",
                "content": (
                    "以下是建设规范解析稿，请补结摘要：\n"
                    f"{source_excerpt}"
                ),
            },
        ],
    }
    url = f"{settings.runtime_api_base_url.rstrip('/')}/chat/completions"
    headers = {"Authorization": f"Bearer {settings.runtime_api_key}"}
    try:
        with httpx.Client(timeout=settings.norm_summary_request_timeout_seconds) as client:
            response = client.post(url, headers=headers, json=payload)
            response.raise_for_status()
    except httpx.HTTPError:
        return None

    text = _extract_openai_text(response.json())
    compact = _compact_text(text, limit=160)
    return compact or None


def _build_model_source_excerpt(*, parsed: ParsedNormArtifacts, clause_nodes: list[ClauseNode]) -> str:
    samples = ", ".join(node.clause_id for node in clause_nodes[:8])
    section_chunks: list[str] = []
    for section in parsed.sections[:8]:
        title = _normalize_text(section.get("title"))
        content = _compact_text(str(section.get("content") or ""), limit=220)
        chunk = "\n".join(part for part in (title, content) if part)
        if chunk:
            section_chunks.append(chunk)
    joined = "\n\n".join(section_chunks)
    prefix = f"候选条款号：{samples}\n\n" if samples else ""
    return _compact_text(f"{prefix}{joined}", limit=4000)


def _extract_openai_text(payload: dict[str, Any]) -> str:
    choices = payload.get("choices", [])
    if not choices:
        return ""
    message = choices[0].get("message", {})
    content = message.get("content", "")
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        chunks: list[str] = []
        for item in content:
            if isinstance(item, dict) and isinstance(item.get("text"), str):
                chunks.append(item["text"].strip())
        return "\n".join(chunk for chunk in chunks if chunk)
    return ""


def _summarize_clause_nodes(clause_nodes: list[ClauseNode]) -> str:
    if not clause_nodes:
        return "规则抽条款号未命中有效候选"
    unique_ids = []
    seen: set[str] = set()
    for node in clause_nodes:
        if node.clause_id in seen or node.kind == "list_item":
            continue
        seen.add(node.clause_id)
        unique_ids.append(node.clause_id)
        if len(unique_ids) >= 5:
            break
    return f"规则抽条款号得到 {len(clause_nodes)} 个候选，示例：{'、'.join(unique_ids) if unique_ids else clause_nodes[0].clause_id}"


def _summarize_tree_issues(tree_issues: list[str]) -> str:
    if not tree_issues:
        return "规则验树通过"
    preview = "；".join(tree_issues[:3])
    return f"规则验树需关注：{preview}"


def _summarize_risk_marks(risk_marks: list) -> str:
    preview = []
    seen: set[tuple[str, str]] = set()
    for mark in risk_marks:
        pair = (mark.raw_value, mark.replacement_token)
        if pair in seen:
            continue
        seen.add(pair)
        preview.append(f"{mark.raw_value}→{mark.replacement_token}")
        if len(preview) >= 3:
            break
    return f"疑似项目化信息：{'；'.join(preview)}"


def _normalize_text(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    return re.sub(r"\s+", " ", value).strip()


def _compact_text(value: str, *, limit: int) -> str:
    compact = re.sub(r"\s+", " ", value).strip()
    if len(compact) <= limit:
        return compact
    return f"{compact[:limit].rstrip()}..."


def _dedupe_preserve_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        ordered.append(value)
    return ordered
