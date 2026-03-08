import json
from dataclasses import dataclass
from pathlib import Path
from xml.etree import ElementTree
from zipfile import ZipFile


@dataclass(frozen=True)
class ParsedSection:
    title: str
    level: int
    anchor: str
    page: int
    content: str


@dataclass(frozen=True)
class ParsedDocument:
    parser_name: str
    markdown: str
    structured_payload: dict


W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NAMESPACE = {"w": W_NS}
W_TAG = f"{{{W_NS}}}"


def parse_document(
    source_path: str,
    filename: str,
    normalized_from: str | None = None,
) -> ParsedDocument | None:
    suffix = Path(filename).suffix.lower()
    if suffix == ".docx":
        return _parse_docx(source_path, filename, normalized_from=normalized_from)
    if suffix == ".pdf":
        return _parse_pdf(source_path, filename)
    return None


def _parse_docx(
    source_path: str,
    filename: str,
    normalized_from: str | None = None,
) -> ParsedDocument | None:
    with ZipFile(source_path) as archive:
        document_xml = archive.read("word/document.xml")

    root = ElementTree.fromstring(document_xml)
    body = root.find(".//w:body", NAMESPACE)
    if body is None:
        return None

    markdown_lines: list[str] = []
    sections: list[ParsedSection] = []
    current_section: ParsedSection | None = None
    section_index = 0

    for child in list(body):
        if child.tag == f"{W_TAG}p":
            level, text = _extract_paragraph(child)
            if not text:
                continue

            if level > 0:
                if current_section is not None:
                    sections.append(current_section)
                section_index += 1
                current_section = ParsedSection(
                    title=text,
                    level=level,
                    anchor=f"section-{section_index}",
                    page=1,
                    content="",
                )
                markdown_lines.append(f"{'#' * min(level, 6)} {text}")
                continue

            markdown_lines.append(text)
            current_section = _append_text_to_section(
                current_section=current_section,
                section_index=section_index,
                text=text,
            )
            if current_section.anchor == f"section-{section_index + 1}":
                section_index += 1
            continue

        if child.tag == f"{W_TAG}tbl":
            table_rows = _extract_table(child)
            if not table_rows:
                continue
            table_markdown = _table_to_markdown(table_rows)
            markdown_lines.extend(table_markdown)
            table_text = "\n".join(" | ".join(row) for row in table_rows if any(row))
            current_section = _append_text_to_section(
                current_section=current_section,
                section_index=section_index,
                text=table_text,
            )
            if current_section.anchor == f"section-{section_index + 1}":
                section_index += 1

    if current_section is not None:
        sections.append(current_section)

    if not sections and not markdown_lines:
        return None

    structured_payload = {
        "document": {
            "format": "docx",
            "filename": filename,
            "normalized_from": normalized_from,
        },
        "sections": [
            {
                "title": section.title,
                "level": section.level,
                "anchor": section.anchor,
                "page": section.page,
                "content": section.content,
            }
            for section in sections
        ],
    }
    return ParsedDocument(
        parser_name="docx_ooxml",
        markdown="\n\n".join(markdown_lines),
        structured_payload=structured_payload,
    )


def _extract_paragraph(paragraph: ElementTree.Element) -> tuple[int, str]:
    style = paragraph.find("./w:pPr/w:pStyle", NAMESPACE)
    level = 0
    if style is not None:
        style_name = style.attrib.get(f"{W_TAG}val", "")
        if style_name.lower().startswith("heading"):
            try:
                level = int(style_name[len("Heading") :])
            except ValueError:
                level = 1

    text = "".join(node.text or "" for node in paragraph.findall(".//w:t", NAMESPACE)).strip()
    return level, text


def _extract_table(table: ElementTree.Element) -> list[list[str]]:
    rows: list[list[str]] = []
    for row in table.findall("./w:tr", NAMESPACE):
        cells: list[str] = []
        for cell in row.findall("./w:tc", NAMESPACE):
            text = "".join(node.text or "" for node in cell.findall(".//w:t", NAMESPACE)).strip()
            cells.append(text)
        if any(cells):
            rows.append(cells)
    return rows


def _table_to_markdown(rows: list[list[str]]) -> list[str]:
    if not rows:
        return []
    width = max(len(row) for row in rows)
    normalized_rows = [row + [""] * (width - len(row)) for row in rows]
    header = normalized_rows[0]
    separator = ["---"] * width
    markdown_rows = [f"| {' | '.join(header)} |", f"| {' | '.join(separator)} |"]
    markdown_rows.extend(f"| {' | '.join(row)} |" for row in normalized_rows[1:])
    return markdown_rows


def _append_text_to_section(
    *,
    current_section: ParsedSection | None,
    section_index: int,
    text: str,
) -> ParsedSection:
    if current_section is None:
        return ParsedSection(
            title="Document",
            level=1,
            anchor=f"section-{section_index + 1}",
            page=1,
            content=text,
        )

    content = f"{current_section.content}\n{text}".strip()
    return ParsedSection(
        title=current_section.title,
        level=current_section.level,
        anchor=current_section.anchor,
        page=current_section.page,
        content=content,
    )


def _parse_pdf(source_path: str, filename: str) -> ParsedDocument | None:
    return (
        _parse_pdf_with_pymupdf(source_path, filename)
        or _parse_pdf_with_pypdf(source_path, filename)
        or _parse_pdf_fallback(source_path, filename)
    )


def _parse_pdf_with_pymupdf(source_path: str, filename: str) -> ParsedDocument | None:
    try:
        import fitz
    except ImportError:
        return None

    document = fitz.open(source_path)
    page_sections: list[dict] = []
    markdown_pages: list[str] = []
    for index, page in enumerate(document, start=1):
        text = page.get_text("text").strip()
        if not text:
            continue
        markdown_pages.append(text)
        page_sections.append(
            {
                "title": f"Page {index}",
                "level": 1,
                "anchor": f"section-{index}",
                "page": index,
                "content": text,
            }
        )

    if not page_sections:
        return None

    return ParsedDocument(
        parser_name="pdf_pymupdf",
        markdown="\n\n".join(markdown_pages),
        structured_payload={
            "document": {
                "format": "pdf",
                "filename": filename,
                "normalized_from": None,
            },
            "sections": page_sections,
        },
    )


def _parse_pdf_with_pypdf(source_path: str, filename: str) -> ParsedDocument | None:
    try:
        from pypdf import PdfReader
    except ImportError:
        return None

    reader = PdfReader(source_path)
    page_sections: list[dict] = []
    markdown_pages: list[str] = []
    for index, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").strip()
        if not text:
            continue
        markdown_pages.append(text)
        page_sections.append(
            {
                "title": f"Page {index}",
                "level": 1,
                "anchor": f"section-{index}",
                "page": index,
                "content": text,
            }
        )

    if not page_sections:
        return None

    return ParsedDocument(
        parser_name="pdf_pypdf",
        markdown="\n\n".join(markdown_pages),
        structured_payload={
            "document": {
                "format": "pdf",
                "filename": filename,
                "normalized_from": None,
            },
            "sections": page_sections,
        },
    )


def _parse_pdf_fallback(source_path: str, filename: str) -> ParsedDocument | None:
    data = Path(source_path).read_bytes()
    try:
        text = data.decode("utf-8").strip()
    except UnicodeDecodeError:
        text = data.decode("latin-1", errors="ignore").strip()

    if not text:
        return None

    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines:
        return None

    markdown = "\n\n".join(lines)
    structured_payload = {
        "document": {
            "format": "pdf",
            "filename": filename,
            "normalized_from": None,
        },
        "sections": [
            {
                "title": "Page 1",
                "level": 1,
                "anchor": "section-1",
                "page": 1,
                "content": "\n".join(lines),
            }
        ],
    }
    return ParsedDocument(
        parser_name="pdf_fallback",
        markdown=markdown,
        structured_payload=structured_payload,
    )


def dump_structured_payload(parsed_document: ParsedDocument) -> str:
    return json.dumps(parsed_document.structured_payload, ensure_ascii=False, indent=2)
