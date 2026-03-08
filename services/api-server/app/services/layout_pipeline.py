from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import GeneratedSection, LayoutJob, RenderedOutput


def execute_layout_job(db: Session, job: LayoutJob) -> LayoutJob:
    if job.source_document_id is None:
        job.status = "failed"
        db.commit()
        db.refresh(job)
        return job

    sections = list(
        db.scalars(
            select(GeneratedSection).where(
                GeneratedSection.project_id == job.project_id,
                GeneratedSection.source_document_id == job.source_document_id,
            )
        )
    )
    if not sections:
        job.status = "failed"
        db.commit()
        db.refresh(job)
        return job

    output_dir = Path(settings.storage_root) / f"project-{job.project_id}" / f"layout-{job.id}"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / "bid-package.docx"
    _write_simple_docx(output_path, sections)

    db.execute(delete(RenderedOutput).where(RenderedOutput.layout_job_id == job.id))
    db.flush()
    db.add(
        RenderedOutput(
            organization_id=job.organization_id,
            project_id=job.project_id,
            source_document_id=job.source_document_id,
            layout_job_id=job.id,
            output_type="docx",
            storage_path=str(output_path.resolve()),
            version_tag="v1",
            created_by_user_id=job.created_by_user_id,
        )
    )
    job.status = "completed"
    db.commit()
    db.refresh(job)
    return job


def _write_simple_docx(path: Path, sections: list[GeneratedSection]) -> None:
    content_types = """<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">
  <Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>
  <Default Extension=\"xml\" ContentType=\"application/xml\"/>
  <Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/>
</Types>"""
    rels = """<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">
  <Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/>
</Relationships>"""
    body = []
    for section in sections:
        body.append(
            f"<w:p><w:pPr><w:pStyle w:val=\"Heading1\"/></w:pPr><w:r><w:t>{section.title}</w:t></w:r></w:p>"
        )
        for paragraph in [item.strip() for item in section.draft_text.splitlines() if item.strip()]:
            body.append(f"<w:p><w:r><w:t>{paragraph}</w:t></w:r></w:p>")
    document = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f'<w:body>{"".join(body)}</w:body></w:document>'
    )
    with ZipFile(path, "w", ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types)
        archive.writestr("_rels/.rels", rels)
        archive.writestr("word/document.xml", document)
