#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


HEADING_RE = re.compile(r"^(#{1,6})\s+(.*)$")
HEADING_DECIMAL_RE = re.compile(r"^((?:\d+\.)+\d+|\d+)\s*(.*)$")
INLINE_DECIMAL_RE = re.compile(r"^((?:\d+\.)+\d+)(?:\s+|$)(.*)$")
APPENDIX_RE = re.compile(r"^(附录[A-ZＡ-Ｚa-z])(?:\s+|$)(.*)$")
SPECIAL_ROOT_TITLES = {"本规范用词说明", "引用标准名录"}
SKIP_TITLES = {
    "中华人民共和国国家标准",
    "关于发布国家标准",
    "前言",
    "修订说明",
    "Contents",
    "目次",
}


@dataclass
class IndexNode:
    node_id: str
    clause_id: str
    title: str
    node_type: str
    depth: int
    raw_line: str
    order: int
    parent_id: str | None = None
    page_start: int | None = None
    page_end: int | None = None
    content_lines: list[str] = field(default_factory=list)
    children: list["IndexNode"] = field(default_factory=list)

    @property
    def full_label(self) -> str:
        if self.clause_id and self.title:
            return f"{self.clause_id} {self.title}".strip()
        return self.title or self.clause_id


def _normalize_spaces(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _compact_text(text: str) -> str:
    compact = re.sub(r"\s+", "", text)
    return compact.replace("—", "-").replace("－", "-").replace("–", "-")


def _slugify(text: str) -> str:
    slug = re.sub(r"[^0-9A-Za-z\u4e00-\u9fff._-]+", "-", text).strip("-").lower()
    return slug or "node"


def _load_page_texts(layout_path: Path) -> list[str]:
    payload = json.loads(layout_path.read_text(encoding="utf-8"))
    page_texts: list[str] = []
    for page in payload.get("pdf_info", []):
        lines: list[str] = []
        for block in page.get("para_blocks", []):
            for line in block.get("lines", []):
                span_text = "".join(span.get("content", "") for span in line.get("spans", []))
                if span_text.strip():
                    lines.append(_normalize_spaces(span_text))
        page_texts.append("\n".join(lines))
    return page_texts


def _is_toc_line(text: str) -> bool:
    return bool(re.search(r"\(\d+\)\s*$", text) or "……………………" in text or "... (" in text)


def _build_heading_node(text: str, order: int) -> IndexNode | None:
    appendix_match = APPENDIX_RE.match(text)
    if appendix_match:
        clause_id = appendix_match.group(1)
        title = _normalize_spaces(appendix_match.group(2))
        return IndexNode(
            node_id=f"appendix-{_slugify(clause_id)}",
            clause_id=clause_id,
            title=title,
            node_type="appendix",
            depth=1,
            raw_line=text,
            order=order,
        )

    decimal_match = HEADING_DECIMAL_RE.match(text)
    if decimal_match:
        clause_id = decimal_match.group(1).rstrip(".")
        title = _normalize_spaces(decimal_match.group(2))
        depth = clause_id.count(".") + 1
        node_type = "chapter" if depth == 1 else "section"
        return IndexNode(
            node_id=f"clause-{clause_id}",
            clause_id=clause_id,
            title=title,
            node_type=node_type,
            depth=depth,
            raw_line=text,
            order=order,
        )

    if text in SPECIAL_ROOT_TITLES:
        return IndexNode(
            node_id=f"section-{_slugify(text)}",
            clause_id="",
            title=text,
            node_type="section",
            depth=1,
            raw_line=text,
            order=order,
        )

    return None


def _build_inline_clause_node(text: str, order: int) -> IndexNode | None:
    match = INLINE_DECIMAL_RE.match(text)
    if match is None:
        return None

    clause_id = match.group(1).rstrip(".")
    if clause_id.count(".") < 2:
        return None

    title = _normalize_spaces(match.group(2))
    return IndexNode(
        node_id=f"clause-{clause_id}",
        clause_id=clause_id,
        title=title,
        node_type="clause",
        depth=clause_id.count(".") + 1,
        raw_line=text,
        order=order,
    )


def _find_parent_id(nodes_by_clause: dict[str, IndexNode], stack: list[IndexNode], node: IndexNode) -> str | None:
    if node.clause_id.startswith("附录") or node.title in SPECIAL_ROOT_TITLES:
        return None

    if node.clause_id:
        if "." in node.clause_id:
            parent_clause = node.clause_id.rsplit(".", 1)[0]
            parent = nodes_by_clause.get(parent_clause)
            if parent is None and parent_clause.endswith(".0"):
                parent = nodes_by_clause.get(parent_clause.rsplit(".", 1)[0])
            if parent is None:
                parent = nodes_by_clause.get(node.clause_id.split(".", 1)[0])
            if parent is not None:
                return parent.node_id
        elif node.depth > 1:
            parent = nodes_by_clause.get(node.clause_id.split(".", 1)[0])
            if parent is not None:
                return parent.node_id
        return None

    for candidate in reversed(stack):
        if candidate.depth < node.depth:
            return candidate.node_id
    return None


def _parse_markdown(md_text: str) -> list[IndexNode]:
    nodes: list[IndexNode] = []
    nodes_by_id: dict[str, IndexNode] = {}
    nodes_by_clause: dict[str, IndexNode] = {}
    stack: list[IndexNode] = []
    current_node: IndexNode | None = None
    in_toc = False
    main_started = False

    for raw_line in md_text.splitlines():
        line = _normalize_spaces(raw_line)
        if not line:
            continue

        heading_match = HEADING_RE.match(line)
        if heading_match:
            text = _normalize_spaces(heading_match.group(2))
            if text == "修订说明":
                break
            if text in {"目次", "Contents"}:
                in_toc = True
                current_node = None
                continue

            candidate = _build_heading_node(text, len(nodes) + 1)
            if candidate is not None:
                main_started = True
                in_toc = False
                parent_id = _find_parent_id(nodes_by_clause, stack, candidate)
                candidate.parent_id = parent_id
                while stack and stack[-1].depth >= candidate.depth:
                    stack.pop()
                stack.append(candidate)
                nodes.append(candidate)
                nodes_by_id[candidate.node_id] = candidate
                if candidate.clause_id:
                    nodes_by_clause[candidate.clause_id] = candidate
                if parent_id is not None:
                    nodes_by_id[parent_id].children.append(candidate)
                current_node = candidate
            elif text in SKIP_TITLES:
                current_node = None
            continue

        if in_toc or not main_started:
            continue
        if _is_toc_line(line):
            continue

        inline_node = _build_inline_clause_node(line, len(nodes) + 1)
        if inline_node is not None and inline_node.clause_id not in nodes_by_clause:
            parent_id = _find_parent_id(nodes_by_clause, stack, inline_node)
            inline_node.parent_id = parent_id
            while stack and stack[-1].depth >= inline_node.depth:
                stack.pop()
            stack.append(inline_node)
            nodes.append(inline_node)
            nodes_by_id[inline_node.node_id] = inline_node
            nodes_by_clause[inline_node.clause_id] = inline_node
            if parent_id is not None:
                nodes_by_id[parent_id].children.append(inline_node)
            current_node = inline_node
            continue

        if current_node is not None:
            current_node.content_lines.append(line)

    return nodes


def _page_candidates(node: IndexNode) -> list[str]:
    candidates = [node.raw_line, node.full_label, node.title]
    if node.title:
        candidates.append(f"{node.clause_id}{node.title}" if node.clause_id else node.title)
        candidates.append(node.title[:48])
    if node.clause_id.count(".") >= 1:
        candidates.append(node.clause_id)
    return [_compact_text(candidate) for candidate in candidates if candidate]


def _main_body_window(page_texts: list[str]) -> tuple[int, int]:
    compact_pages = [_compact_text(page_text) for page_text in page_texts]
    body_start = 0
    body_end = len(compact_pages)

    for index, page_text in enumerate(compact_pages):
        if "1总则" in page_text:
            body_start = index
            break

    for index, page_text in enumerate(compact_pages[body_start:], start=body_start):
        if "修订说明" in page_text:
            body_end = index
            break

    return body_start, body_end


def _assign_pages(nodes: list[IndexNode], page_texts: list[str]) -> None:
    page_compact = [_compact_text(page_text) for page_text in page_texts]
    body_start, body_end = _main_body_window(page_texts)
    start_page = body_start

    for node in nodes:
        candidates = _page_candidates(node)
        found_page: int | None = None
        for page_index in range(start_page, body_end):
            if any(candidate and candidate in page_compact[page_index] for candidate in candidates):
                found_page = page_index + 1
                start_page = page_index
                break
        if found_page is None:
            for page_index in range(body_start, body_end):
                if any(candidate and candidate in page_compact[page_index] for candidate in candidates):
                    found_page = page_index + 1
                    break
        if found_page is None:
            found_page = start_page + 1
        node.page_start = found_page
        node.page_end = found_page


def _leaf_preview(node: IndexNode) -> str:
    text = _normalize_spaces(" ".join(node.content_lines))
    if not text:
        return ""
    text = re.sub(r"^[0-9]+[)）]\s*", "", text)
    return text[:180]


def _node_summary(node: IndexNode) -> str:
    preview = _leaf_preview(node)
    if preview:
        return preview
    if node.children:
        child_labels = [child.full_label for child in node.children[:3] if child.full_label]
        joined = "；".join(child_labels)
        suffix = "" if len(node.children) <= 3 else f" 等 {len(node.children)} 个下级节点"
        if joined:
            return f"围绕 {joined}{suffix} 展开。"
        return f"包含 {len(node.children)} 个下级节点。"
    return node.full_label


def _path_ids(node: IndexNode, nodes_by_id: dict[str, IndexNode]) -> list[str]:
    result: list[str] = []
    current: IndexNode | None = node
    while current is not None:
        result.append(current.clause_id or current.title)
        current = nodes_by_id.get(current.parent_id) if current.parent_id else None
    return list(reversed(result))


def _path_titles(node: IndexNode, nodes_by_id: dict[str, IndexNode]) -> list[str]:
    result: list[str] = []
    current: IndexNode | None = node
    while current is not None:
        result.append(current.full_label)
        current = nodes_by_id.get(current.parent_id) if current.parent_id else None
    return list(reversed(result))


def _update_page_ranges(node: IndexNode) -> tuple[int, int]:
    start = node.page_start or 1
    end = node.page_end or start
    for child in node.children:
        child_start, child_end = _update_page_ranges(child)
        start = min(start, child_start)
        end = max(end, child_end)
    node.page_start = start
    node.page_end = end
    return start, end


def _serialize_node(node: IndexNode, nodes_by_id: dict[str, IndexNode]) -> dict[str, Any]:
    path_ids = _path_ids(node, nodes_by_id)
    path_titles = _path_titles(node, nodes_by_id)
    preview = _leaf_preview(node)

    return {
        "node_id": node.node_id,
        "clause_id": node.clause_id,
        "title": node.title,
        "label": node.full_label,
        "node_type": node.node_type,
        "depth": node.depth,
        "parent_id": node.parent_id,
        "path_ids": path_ids,
        "path_label": "/".join(path_ids),
        "section_path": " > ".join(path_titles),
        "anchor": node.node_id,
        "page_start": node.page_start,
        "page_end": node.page_end,
        "summary_text": _node_summary(node),
        "content_preview": preview,
        "child_count": len(node.children),
        "tags": [
            tag
            for tag in (
                f"type:{node.node_type}",
                f"depth:{node.depth}",
                f"page:{node.page_start}",
                f"clause:{node.clause_id}" if node.clause_id else "",
            )
            if tag
        ],
        "children": [_serialize_node(child, nodes_by_id) for child in node.children],
    }


def build_index(full_md_path: Path, layout_path: Path) -> dict[str, Any]:
    md_text = full_md_path.read_text(encoding="utf-8")
    page_texts = _load_page_texts(layout_path)
    nodes = _parse_markdown(md_text)
    _assign_pages(nodes, page_texts)

    nodes_by_id = {node.node_id: node for node in nodes}
    roots = [node for node in nodes if node.parent_id is None]
    for root in roots:
        _update_page_ranges(root)

    tree = [_serialize_node(root, nodes_by_id) for root in roots]
    entries = [_serialize_node(node, nodes_by_id) | {"children": []} for node in nodes]

    return {
        "document": {
            "title": "GB 50148-2010 电气装置安装工程电力变压器、油浸电抗器、互感器施工及验收规范",
            "source_engine": "mineru",
            "source_markdown": str(full_md_path),
            "source_layout_json": str(layout_path),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        },
        "stats": {
            "page_count": len(page_texts),
            "node_count": len(nodes),
            "root_count": len(roots),
            "chapter_count": len([node for node in nodes if node.node_type == "chapter"]),
            "appendix_count": len([node for node in nodes if node.node_type == "appendix"]),
            "max_depth": max((node.depth for node in nodes), default=0),
        },
        "summary_text": (
            "基于 MinerU OCR 结果抽取的规范章节与条款索引，包含树状结构、条款标签、页码映射与简要概述，"
            "可直接用于后续切片、检索、召回与证据定位。"
        ),
        "tree": tree,
        "entries": entries,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a clause tree index from MinerU OCR outputs.")
    parser.add_argument("--full-md", required=True, type=Path, help="Path to MinerU full.md")
    parser.add_argument("--layout-json", required=True, type=Path, help="Path to MinerU layout.json")
    parser.add_argument("--output", required=True, type=Path, help="Output JSON path")
    args = parser.parse_args()

    payload = build_index(args.full_md, args.layout_json)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
