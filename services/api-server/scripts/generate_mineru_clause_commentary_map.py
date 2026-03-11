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
SPECIAL_ROOT_TITLES = {"本规范用词说明", "引用标准名录"}
SKIP_TITLES = {"中华人民共和国国家标准", "关于发布国家标准", "Contents", "目次"}


@dataclass
class CommentaryNode:
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
    children: list["CommentaryNode"] = field(default_factory=list)

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


def _build_heading_node(text: str, order: int) -> CommentaryNode | None:
    decimal_match = HEADING_DECIMAL_RE.match(text)
    if decimal_match:
        clause_id = decimal_match.group(1).rstrip('.')
        title = _normalize_spaces(decimal_match.group(2))
        depth = clause_id.count('.') + 1
        node_type = 'chapter' if depth == 1 else 'section'
        return CommentaryNode(
            node_id=f"commentary-{clause_id}",
            clause_id=clause_id,
            title=title,
            node_type=node_type,
            depth=depth,
            raw_line=text,
            order=order,
        )

    if text in SPECIAL_ROOT_TITLES:
        return CommentaryNode(
            node_id=f"commentary-{_slugify(text)}",
            clause_id="",
            title=text,
            node_type='section',
            depth=1,
            raw_line=text,
            order=order,
        )

    return None


def _build_inline_clause_node(text: str, order: int) -> CommentaryNode | None:
    match = INLINE_DECIMAL_RE.match(text)
    if match is None:
        return None
    clause_id = match.group(1).rstrip('.')
    if clause_id.count('.') < 2:
        return None
    title = _normalize_spaces(match.group(2))
    return CommentaryNode(
        node_id=f"commentary-{clause_id}",
        clause_id=clause_id,
        title=title,
        node_type='clause_commentary',
        depth=clause_id.count('.') + 1,
        raw_line=text,
        order=order,
    )


def _find_parent_id(nodes_by_clause: dict[str, CommentaryNode], node: CommentaryNode) -> str | None:
    if node.clause_id:
        if '.' in node.clause_id:
            parent_clause = node.clause_id.rsplit('.', 1)[0]
            parent = nodes_by_clause.get(parent_clause)
            if parent is None and parent_clause.endswith('.0'):
                parent = nodes_by_clause.get(parent_clause.rsplit('.', 1)[0])
            if parent is None:
                parent = nodes_by_clause.get(node.clause_id.split('.', 1)[0])
            if parent is not None:
                return parent.node_id
        return None
    return None


def _extract_commentary_slice(md_text: str) -> str:
    marker = '# 修订说明'
    if marker not in md_text:
        return ''
    return md_text.split(marker, 1)[1]


def _parse_commentary(md_text: str) -> list[CommentaryNode]:
    commentary_text = _extract_commentary_slice(md_text)
    nodes: list[CommentaryNode] = []
    nodes_by_id: dict[str, CommentaryNode] = {}
    nodes_by_clause: dict[str, CommentaryNode] = {}
    current_node: CommentaryNode | None = None
    in_toc = False
    body_started = False

    for raw_line in commentary_text.splitlines():
        line = _normalize_spaces(raw_line)
        if not line or line == '条文说明':
            continue

        heading_match = HEADING_RE.match(line)
        if heading_match:
            text = _normalize_spaces(heading_match.group(2))
            if text in SKIP_TITLES:
                in_toc = text == '目次'
                current_node = None
                continue
            if in_toc and _is_toc_line(text):
                continue

            candidate = _build_heading_node(text, len(nodes) + 1)
            if candidate is not None:
                body_started = True
                in_toc = False
                candidate.parent_id = _find_parent_id(nodes_by_clause, candidate)
                nodes.append(candidate)
                nodes_by_id[candidate.node_id] = candidate
                if candidate.clause_id:
                    nodes_by_clause[candidate.clause_id] = candidate
                if candidate.parent_id is not None:
                    nodes_by_id[candidate.parent_id].children.append(candidate)
                current_node = candidate
            continue

        if not body_started or in_toc or _is_toc_line(line):
            continue

        inline_node = _build_inline_clause_node(line, len(nodes) + 1)
        if inline_node is not None and inline_node.clause_id not in nodes_by_clause:
            inline_node.parent_id = _find_parent_id(nodes_by_clause, inline_node)
            nodes.append(inline_node)
            nodes_by_id[inline_node.node_id] = inline_node
            nodes_by_clause[inline_node.clause_id] = inline_node
            if inline_node.parent_id is not None:
                nodes_by_id[inline_node.parent_id].children.append(inline_node)
            current_node = inline_node
            continue

        if current_node is not None:
            current_node.content_lines.append(line)

    return nodes


def _commentary_window(page_texts: list[str]) -> tuple[int, int]:
    compact_pages = [_compact_text(page_text) for page_text in page_texts]
    commentary_anchor = 0
    for index, page_text in enumerate(compact_pages):
        if '修订说明' in page_text:
            commentary_anchor = index
            break

    toc_after_commentary = commentary_anchor
    for index in range(commentary_anchor, len(compact_pages)):
        if '目次' in compact_pages[index]:
            toc_after_commentary = index
    body_start = toc_after_commentary
    for index in range(toc_after_commentary, len(compact_pages)):
        if '2术语' in compact_pages[index] or '4电力变压器、油浸电抗器' in compact_pages[index]:
            body_start = index
            break
    return body_start, len(compact_pages)


def _page_candidates(node: CommentaryNode) -> list[str]:
    candidates = [node.raw_line, node.full_label, node.title]
    if node.title:
        candidates.append(f"{node.clause_id}{node.title}" if node.clause_id else node.title)
        candidates.append(node.title[:48])
    return [_compact_text(candidate) for candidate in candidates if candidate]


def _assign_pages(nodes: list[CommentaryNode], page_texts: list[str]) -> None:
    page_compact = [_compact_text(page_text) for page_text in page_texts]
    start, end = _commentary_window(page_texts)
    cursor = start
    for node in nodes:
        candidates = _page_candidates(node)
        found_page: int | None = None
        for page_index in range(cursor, end):
            if any(candidate and candidate in page_compact[page_index] for candidate in candidates):
                found_page = page_index + 1
                cursor = page_index
                break
        if found_page is None:
            for page_index in range(start, end):
                if any(candidate and candidate in page_compact[page_index] for candidate in candidates):
                    found_page = page_index + 1
                    break
        node.page_start = found_page or (cursor + 1)
        node.page_end = node.page_start


def _update_ranges(node: CommentaryNode) -> tuple[int, int]:
    start = node.page_start or 1
    end = node.page_end or start
    for child in node.children:
        child_start, child_end = _update_ranges(child)
        start = min(start, child_start)
        end = max(end, child_end)
    node.page_start = start
    node.page_end = end
    return start, end


def _commentary_text(node: CommentaryNode) -> str:
    return _normalize_spaces(' '.join(node.content_lines))


def _summary_text(node: CommentaryNode) -> str:
    text = _commentary_text(node)
    if text:
        return text[:220]
    if node.children:
        labels = '；'.join(child.full_label for child in node.children[:3])
        suffix = '' if len(node.children) <= 3 else f' 等 {len(node.children)} 个说明节点'
        return f'围绕 {labels}{suffix} 展开。'
    return node.full_label


def _path_ids(node: CommentaryNode, nodes_by_id: dict[str, CommentaryNode]) -> list[str]:
    result: list[str] = []
    current: CommentaryNode | None = node
    while current is not None:
        result.append(current.clause_id or current.title)
        current = nodes_by_id.get(current.parent_id) if current.parent_id else None
    return list(reversed(result))


def _path_labels(node: CommentaryNode, nodes_by_id: dict[str, CommentaryNode]) -> list[str]:
    result: list[str] = []
    current: CommentaryNode | None = node
    while current is not None:
        result.append(current.full_label)
        current = nodes_by_id.get(current.parent_id) if current.parent_id else None
    return list(reversed(result))


def _serialize_node(node: CommentaryNode, nodes_by_id: dict[str, CommentaryNode]) -> dict[str, Any]:
    return {
        'node_id': node.node_id,
        'clause_id': node.clause_id,
        'title': node.title,
        'label': node.full_label,
        'node_type': node.node_type,
        'depth': node.depth,
        'parent_id': node.parent_id,
        'path_ids': _path_ids(node, nodes_by_id),
        'path_label': '/'.join(_path_ids(node, nodes_by_id)),
        'section_path': ' > '.join(_path_labels(node, nodes_by_id)),
        'anchor': node.node_id,
        'page_start': node.page_start,
        'page_end': node.page_end,
        'commentary_text': _commentary_text(node),
        'summary_text': _summary_text(node),
        'child_count': len(node.children),
        'tags': [
            tag for tag in (
                f'type:{node.node_type}',
                f'depth:{node.depth}',
                f'commentary_page:{node.page_start}',
                f'commentary_for:{node.clause_id}' if node.clause_id else '',
            ) if tag
        ],
        'children': [_serialize_node(child, nodes_by_id) for child in node.children],
    }


def build_commentary_map(full_md_path: Path, layout_path: Path) -> dict[str, Any]:
    md_text = full_md_path.read_text(encoding='utf-8')
    page_texts = _load_page_texts(layout_path)
    nodes = _parse_commentary(md_text)
    _assign_pages(nodes, page_texts)
    nodes_by_id = {node.node_id: node for node in nodes}
    roots = [node for node in nodes if node.parent_id is None]
    for root in roots:
        _update_ranges(root)

    tree = [_serialize_node(root, nodes_by_id) for root in roots]
    entries = [_serialize_node(node, nodes_by_id) | {'children': []} for node in nodes]
    commentary_map = {
        entry['clause_id']: {
            'clause_id': entry['clause_id'],
            'commentary_anchor': entry['anchor'],
            'commentary_page_start': entry['page_start'],
            'commentary_page_end': entry['page_end'],
            'section_path': entry['section_path'],
            'summary_text': entry['summary_text'],
            'commentary_text': entry['commentary_text'],
        }
        for entry in entries
        if entry['clause_id'] and entry['node_type'] == 'clause_commentary'
    }

    return {
        'document': {
            'title': 'GB 50148-2010 电气装置安装工程电力变压器、油浸电抗器、互感器施工及验收规范 条文说明映射',
            'source_engine': 'mineru',
            'source_markdown': str(full_md_path),
            'source_layout_json': str(layout_path),
            'generated_at': datetime.now(timezone.utc).isoformat(),
        },
        'stats': {
            'page_count': len(page_texts),
            'node_count': len(nodes),
            'commentary_clause_count': len(commentary_map),
            'root_count': len(roots),
            'max_depth': max((node.depth for node in nodes), default=0),
        },
        'summary_text': '基于 MinerU OCR 的条文说明映射，按条款编号关联解释性说明，可与正文索引分开召回或联合展示。',
        'tree': tree,
        'entries': entries,
        'commentary_map': commentary_map,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description='Generate clause-to-commentary mapping from MinerU OCR outputs.')
    parser.add_argument('--full-md', required=True, type=Path)
    parser.add_argument('--layout-json', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()

    payload = build_commentary_map(args.full_md, args.layout_json)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
