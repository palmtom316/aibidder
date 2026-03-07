from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from zipfile import ZIP_DEFLATED, ZipFile

from app.core.document_parser import parse_document


def _build_docx_with_table() -> bytes:
    content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>"""
    rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"""
    document = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>第二章 评分标准</w:t></w:r>
    </w:p>
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:t>评分项</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>分值</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>项目经理业绩</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>10分</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>"""

    buffer = BytesIO()
    with ZipFile(buffer, "w", ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types)
        archive.writestr("_rels/.rels", rels)
        archive.writestr("word/document.xml", document)
    return buffer.getvalue()


def test_parse_docx_extracts_table_text_into_markdown_and_sections() -> None:
    with TemporaryDirectory() as temp_dir:
        source_path = Path(temp_dir) / "table.docx"
        source_path.write_bytes(_build_docx_with_table())

        parsed = parse_document(str(source_path), "table.docx")

    assert parsed is not None
    assert "评分项" in parsed.markdown
    assert "项目经理业绩" in parsed.markdown
    assert "10分" in parsed.markdown
    assert parsed.structured_payload["sections"][0]["title"] == "第二章 评分标准"
    assert "项目经理业绩" in parsed.structured_payload["sections"][0]["content"]
