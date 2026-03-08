from pathlib import Path

from app.core.config import settings
from app.core.document_ingestion import ingest_document
from app.core.document_parser import ParsedDocument, parse_document



def test_parse_document_uses_ocr_fallback_when_enabled(monkeypatch, tmp_path) -> None:
    from app.core import document_parser

    source_path = tmp_path / "ocr.pdf"
    source_path.write_bytes(b"%PDF-1.4 fake")

    monkeypatch.setattr(settings, "enable_pdf_ocr_fallback", True)
    monkeypatch.setattr(document_parser, "_parse_pdf_with_pymupdf", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(document_parser, "_parse_pdf_with_pypdf", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(document_parser, "_parse_pdf_fallback", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(
        document_parser,
        "_parse_pdf_with_ocr",
        lambda *_args, **_kwargs: ParsedDocument(
            parser_name="pdf_ocr",
            markdown="OCR extracted text",
            structured_payload={
                "document": {"format": "pdf", "filename": "ocr.pdf", "normalized_from": None},
                "sections": [{"title": "Page 1", "level": 1, "anchor": "section-1", "page": 1, "content": "OCR extracted text"}],
            },
        ),
    )

    parsed = parse_document(str(source_path), "ocr.pdf")

    assert parsed is not None
    assert parsed.parser_name == "pdf_ocr"
    assert "OCR extracted text" in parsed.markdown



def test_ingest_document_writes_structured_parse_failure_code(monkeypatch, tmp_path) -> None:
    source_path = tmp_path / "broken.pdf"
    source_path.write_bytes(b"%PDF-1.4 broken")

    monkeypatch.setattr(settings, "storage_backend", "local")
    monkeypatch.setattr(settings, "storage_root", str(tmp_path / "storage"))
    monkeypatch.setattr("app.core.document_ingestion.parse_document", lambda *_args, **_kwargs: None)

    result = ingest_document(
        project_id=1,
        document_id=2,
        version_no=1,
        source_path=str(source_path),
        filename="broken.pdf",
    )

    assert result.status == "failed"
    assert result.parse_log["code"] == "document_parse_failed"
    assert result.parse_log["message"]
