import re
from dataclasses import dataclass
from typing import Any

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


def extract_clause_nodes(sections: list[dict[str, Any]]) -> list[ClauseNode]:
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


def build_rule_summary(*, sections: list[dict[str, Any]], clause_nodes: list[ClauseNode]) -> str:
    titles: list[str] = []
    for section in sections:
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


def _normalize_text(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    return re.sub(r"\s+", " ", value).strip()
