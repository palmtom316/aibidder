import json
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from tempfile import TemporaryDirectory
from zipfile import BadZipFile, ZipFile

from app.core.document_parser import ParsedDocument, dump_structured_payload, parse_document
from app.core.storage import save_binary_artifact, save_generated_artifact


@dataclass(frozen=True)
class GeneratedArtifact:
    artifact_type: str
    storage_path: str


@dataclass(frozen=True)
class DocumentIngestionResult:
    status: str
    artifacts: list[GeneratedArtifact]
    parse_log: dict


def ingest_document(
    *,
    project_id: int,
    document_id: int,
    version_no: int,
    source_path: str,
    filename: str,
) -> DocumentIngestionResult:
    transitions = ["uploaded"]
    artifacts: list[GeneratedArtifact] = []
    parse_source_path = source_path
    parse_filename = filename
    normalized_from: str | None = None

    if Path(filename).suffix.lower() == ".doc":
        transitions.append("normalizing")
        normalized_source_path = normalize_doc_to_docx(
            project_id=project_id,
            document_id=document_id,
            version_no=version_no,
            source_path=source_path,
        )
        if normalized_source_path is None:
            transitions.append("failed")
            parse_log = {
                "parser": "normalization_failed",
                "transitions": transitions,
                "source_filename": filename,
                "normalized_from": "doc",
            }
            artifacts.append(
                GeneratedArtifact(
                    artifact_type="parse_log",
                    storage_path=save_generated_artifact(
                        project_id=project_id,
                        document_id=document_id,
                        version_no=version_no,
                        artifact_type="parse_log",
                        content=json.dumps(parse_log, ensure_ascii=False, indent=2),
                        extension=".json",
                    ),
                )
            )
            return DocumentIngestionResult(status="failed", artifacts=artifacts, parse_log=parse_log)

        parse_source_path = normalized_source_path
        parse_filename = f"{Path(filename).stem}.docx"
        normalized_from = "doc"
        transitions.append("normalized")
        artifacts.append(
            GeneratedArtifact(
                artifact_type="normalized_source",
                storage_path=normalized_source_path,
            )
        )

    transitions.append("parsing")
    parsed_document = parse_document(
        parse_source_path,
        parse_filename,
        normalized_from=normalized_from,
    )
    if parsed_document is None:
        transitions.append("failed")
        parse_log = {
            "parser": "parse_failed",
            "transitions": transitions,
            "source_filename": filename,
            "normalized_from": normalized_from,
        }
        artifacts.append(
            GeneratedArtifact(
                artifact_type="parse_log",
                storage_path=save_generated_artifact(
                    project_id=project_id,
                    document_id=document_id,
                    version_no=version_no,
                    artifact_type="parse_log",
                    content=json.dumps(parse_log, ensure_ascii=False, indent=2),
                    extension=".json",
                ),
            )
        )
        return DocumentIngestionResult(status="failed", artifacts=artifacts, parse_log=parse_log)

    markdown_path = save_generated_artifact(
        project_id=project_id,
        document_id=document_id,
        version_no=version_no,
        artifact_type="markdown",
        content=parsed_document.markdown,
        extension=".md",
    )
    json_path = save_generated_artifact(
        project_id=project_id,
        document_id=document_id,
        version_no=version_no,
        artifact_type="json",
        content=dump_structured_payload(parsed_document),
        extension=".json",
    )
    artifacts.extend(
        [
            GeneratedArtifact(artifact_type="markdown", storage_path=markdown_path),
            GeneratedArtifact(artifact_type="json", storage_path=json_path),
        ]
    )

    transitions.append("parsed")
    parse_log = build_parse_log(
        parsed_document=parsed_document,
        transitions=transitions,
        source_filename=filename,
        normalized_from=normalized_from,
    )
    parse_log_path = save_generated_artifact(
        project_id=project_id,
        document_id=document_id,
        version_no=version_no,
        artifact_type="parse_log",
        content=json.dumps(parse_log, ensure_ascii=False, indent=2),
        extension=".json",
    )
    artifacts.append(GeneratedArtifact(artifact_type="parse_log", storage_path=parse_log_path))
    return DocumentIngestionResult(status="parsed", artifacts=artifacts, parse_log=parse_log)


def normalize_doc_to_docx(
    *,
    project_id: int,
    document_id: int,
    version_no: int,
    source_path: str,
) -> str | None:
    source = Path(source_path)
    payload = source.read_bytes()

    if _looks_like_docx_zip(source_path):
        return save_binary_artifact(
            project_id=project_id,
            document_id=document_id,
            version_no=version_no,
            artifact_type="normalized_source",
            payload=payload,
            extension=".docx",
        )

    soffice_path = shutil.which("soffice")
    if soffice_path is None:
        return None

    with TemporaryDirectory() as temp_dir:
        command = [
            soffice_path,
            "--headless",
            "--convert-to",
            "docx",
            "--outdir",
            temp_dir,
            source_path,
        ]
        completed = subprocess.run(command, capture_output=True, text=True, check=False)
        if completed.returncode != 0:
            return None

        converted_path = Path(temp_dir) / f"{source.stem}.docx"
        if not converted_path.exists():
            return None

        return save_binary_artifact(
            project_id=project_id,
            document_id=document_id,
            version_no=version_no,
            artifact_type="normalized_source",
            payload=converted_path.read_bytes(),
            extension=".docx",
        )


def build_parse_log(
    *,
    parsed_document: ParsedDocument,
    transitions: list[str],
    source_filename: str,
    normalized_from: str | None,
) -> dict:
    return {
        "parser": parsed_document.parser_name,
        "transitions": transitions,
        "source_filename": source_filename,
        "normalized_from": normalized_from,
    }


def _looks_like_docx_zip(source_path: str) -> bool:
    try:
        with ZipFile(source_path) as archive:
            return "[Content_Types].xml" in archive.namelist() and "word/document.xml" in archive.namelist()
    except BadZipFile:
        return False
