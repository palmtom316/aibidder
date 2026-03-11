#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any


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


def walk_tree(nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for node in nodes:
        result.append(node)
        children = node.get("children", [])
        if isinstance(children, list):
            result.extend(walk_tree(children))
    return result


def validate_payload(obj: Any) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []

    if not isinstance(obj, dict):
        return ["Top-level JSON must be an object."], []

    missing_top = REQUIRED_TOP_KEYS - set(obj.keys())
    if missing_top:
        errors.append(f"Missing top-level keys: {sorted(missing_top)}")

    clause_index = obj.get("clause_index", {})
    commentary = obj.get("commentary_map_result", {})
    if not isinstance(clause_index, dict):
        errors.append("clause_index must be an object.")
        clause_index = {}
    if not isinstance(commentary, dict):
        errors.append("commentary_map_result must be an object.")
        commentary = {}

    clause_entries = clause_index.get("entries", [])
    commentary_entries = commentary.get("entries", [])
    clause_tree = clause_index.get("tree", [])
    commentary_tree = commentary.get("tree", [])

    if not isinstance(clause_entries, list):
        errors.append("clause_index.entries must be an array.")
        clause_entries = []
    if not isinstance(commentary_entries, list):
        errors.append("commentary_map_result.entries must be an array.")
        commentary_entries = []
    if not isinstance(clause_tree, list):
        errors.append("clause_index.tree must be an array.")
        clause_tree = []
    if not isinstance(commentary_tree, list):
        errors.append("commentary_map_result.tree must be an array.")
        commentary_tree = []

    clause_tree_nodes = walk_tree(clause_tree)
    commentary_tree_nodes = walk_tree(commentary_tree)

    if not clause_entries:
        errors.append("clause_index.entries is empty.")
    if not commentary_entries:
        errors.append("commentary_map_result.entries is empty.")

    commentary_map = commentary.get("commentary_map", {})
    if not isinstance(commentary_map, dict):
        errors.append("commentary_map_result.commentary_map must be an object.")
        commentary_map = {}
    elif not commentary_map:
        warnings.append("commentary_map_result.commentary_map is empty.")

    for entry in clause_entries:
        if not isinstance(entry, dict):
            errors.append("clause_index.entries contains a non-object item.")
            continue
        missing = REQUIRED_CLAUSE_KEYS - set(entry.keys())
        if missing:
            errors.append(f"Clause entry {entry.get('clause_id')} missing keys: {sorted(missing)}")
        if entry.get("node_type") not in VALID_NODE_TYPES:
            errors.append(f"Clause entry {entry.get('clause_id')} has invalid node_type.")
        if "explanation" in entry:
            errors.append(f"Clause entry {entry.get('clause_id')} illegally contains explanation.")

    for entry in commentary_entries:
        if not isinstance(entry, dict):
            errors.append("commentary_map_result.entries contains a non-object item.")
            continue
        missing = REQUIRED_COMMENTARY_KEYS - set(entry.keys())
        if missing:
            errors.append(f"Commentary entry {entry.get('clause_id')} missing keys: {sorted(missing)}")
        if entry.get("node_type") not in VALID_NODE_TYPES:
            errors.append(f"Commentary entry {entry.get('clause_id')} has invalid node_type.")

    clause_ids = {entry.get("clause_id") for entry in clause_entries if isinstance(entry, dict)}
    commentary_ids = {entry.get("clause_id") for entry in commentary_entries if isinstance(entry, dict)}
    clause_tree_ids = {node.get("clause_id") for node in clause_tree_nodes if isinstance(node, dict)}
    commentary_tree_ids = {node.get("clause_id") for node in commentary_tree_nodes if isinstance(node, dict)}

    missing_ch4 = sorted(REQUIRED_CH4_SECTIONS - clause_ids)
    missing_ch5 = sorted(REQUIRED_CH5_SECTIONS - clause_ids)
    if missing_ch4:
        errors.append(f"Missing chapter 4 sections: {missing_ch4}")
    if missing_ch5:
        errors.append(f"Missing chapter 5 sections: {missing_ch5}")

    if len(clause_entries) < len(clause_tree_nodes):
        errors.append(
            f"clause_index.entries has only {len(clause_entries)} nodes but tree has {len(clause_tree_nodes)} nodes."
        )
    if len(commentary_entries) < len(commentary_tree_nodes):
        errors.append(
            "commentary_map_result.entries has only "
            f"{len(commentary_entries)} nodes but tree has {len(commentary_tree_nodes)} nodes."
        )

    missing_clause_tree_nodes = sorted(node_id for node_id in clause_tree_ids - clause_ids if node_id)
    missing_commentary_tree_nodes = sorted(node_id for node_id in commentary_tree_ids - commentary_ids if node_id)
    if missing_clause_tree_nodes:
        errors.append(f"Tree nodes missing from clause_index.entries: {missing_clause_tree_nodes}")
    if missing_commentary_tree_nodes:
        errors.append(f"Tree nodes missing from commentary_map_result.entries: {missing_commentary_tree_nodes}")

    if clause_entries and not any(entry.get("node_type") == "section" for entry in clause_entries if isinstance(entry, dict)):
        errors.append("clause_index.entries does not contain section nodes.")
    if commentary_entries and not any(entry.get("depth") == 1 for entry in commentary_entries if isinstance(entry, dict)):
        errors.append("commentary_map_result.entries does not contain chapter-level root nodes.")
    if commentary_entries and len(commentary_entries) < 10:
        warnings.append("commentary_map_result.entries count is suspiciously low.")

    null_pages = [
        entry.get("clause_id")
        for entry in clause_entries + commentary_entries
        if isinstance(entry, dict) and (entry.get("page_start") is None or entry.get("page_end") is None)
    ]
    if null_pages:
        warnings.append(f"Entries with unresolved pages: {null_pages}")

    empty_child_placeholders = [
        entry.get("clause_id")
        for entry in clause_entries + commentary_entries
        if isinstance(entry, dict) and entry.get("child_count", 0) > 0 and not entry.get("children")
    ]
    if empty_child_placeholders:
        warnings.append(
            "Entries with child_count > 0 but empty children: " + ", ".join(str(item) for item in empty_child_placeholders)
        )

    for clause_id, payload in commentary_map.items():
        if clause_id not in commentary_ids:
            warnings.append(f"commentary_map key {clause_id} missing from commentary entries.")
        if not isinstance(payload, dict):
            errors.append(f"commentary_map[{clause_id}] must be an object.")
            continue
        for key in ("commentary_text", "summary_text", "page_start", "page_end", "section_path"):
            if key not in payload:
                errors.append(f"commentary_map[{clause_id}] missing key: {key}")

    return errors, warnings


def load_payload(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def print_report(errors: list[str], warnings: list[str]) -> None:
    for line in errors:
        print(f"ERROR: {line}")
    for line in warnings:
        print(f"WARNING: {line}")
    if errors:
        print(f"FAIL: {len(errors)} error(s), {len(warnings)} warning(s)")
        return
    if warnings:
        print(f"PASS WITH WARNINGS: 0 error(s), {len(warnings)} warning(s)")
        return
    print("PASS: 0 error(s), 0 warning(s)")


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: python3 validate_norm_structure.py /path/to/output.json")
        raise SystemExit(2)

    payload = load_payload(Path(sys.argv[1]))
    errors, warnings = validate_payload(payload)
    print_report(errors, warnings)
    raise SystemExit(1 if errors else 0)


if __name__ == "__main__":
    main()
