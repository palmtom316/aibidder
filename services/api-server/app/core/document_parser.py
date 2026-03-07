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
    markdown: str
    structured_payload: dict


def parse_document(source_path: str, filename: str) -> ParsedDocument | None:
    suffix = Path(filename).suffix.lower()
    if suffix == ".docx":
        return _parse_docx(source_path)
    if suffix == ".pdf":
        return _parse_pdf_fallback(source_path)
    return None


def _parse_docx(source_path: str) -> ParsedDocument | None:
    with ZipFile(source_path) as archive:
        document_xml = archive.read("word/document.xml")

    root = ElementTree.fromstring(document_xml)
    namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    paragraphs: list[tuple[int, str]] = []
    for paragraph in root.findall(".//w:body/w:p", namespace):
        style = paragraph.find("./w:pPr/w:pStyle", namespace)
        level = 0
        if style is not None:
            style_name = style.attrib.get("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val", "")
            if style_name.lower().startswith("heading"):
                try:
                    level = int(style_name[len("Heading") :])
                except ValueError:
                    level = 1

        text = "".join(node.text or "" for node in paragraph.findall(".//w:t", namespace)).strip()
        if text:
            paragraphs.append((level, text))

    if not paragraphs:
        return None

    markdown_lines: list[str] = []
    sections: list[ParsedSection] = []
    current_section: ParsedSection | None = None
    section_index = 0

    for level, text in paragraphs:
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
        if current_section is None:
            section_index += 1
            current_section = ParsedSection(
                title="Document",
                level=1,
                anchor=f"section-{section_index}",
                page=1,
                content=text,
            )
        else:
            content = f"{current_section.content}\n{text}".strip()
            current_section = ParsedSection(
                title=current_section.title,
                level=current_section.level,
                anchor=current_section.anchor,
                page=current_section.page,
                content=content,
            )

    if current_section is not None:
        sections.append(current_section)

    structured_payload = {
        "sections": [
            {
                "title": section.title,
                "level": section.level,
                "anchor": section.anchor,
                "page": section.page,
                "content": section.content,
            }
            for section in sections
        ]
    }
    return ParsedDocument(markdown="\n\n".join(markdown_lines), structured_payload=structured_payload)


def _parse_pdf_fallback(source_path: str) -> ParsedDocument | None:
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
        "sections": [
            {
                "title": "Page 1",
                "level": 1,
                "anchor": "section-1",
                "page": 1,
                "content": "\n".join(lines),
            }
        ]
    }
    return ParsedDocument(markdown=markdown, structured_payload=structured_payload)


def dump_structured_payload(parsed_document: ParsedDocument) -> str:
    return json.dumps(parsed_document.structured_payload, ensure_ascii=False, indent=2)
