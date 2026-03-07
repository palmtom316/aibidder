from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db.models import HistoricalBidDocument, HistoricalBidSection, HistoricalReuseUnit, HistoricalRiskMark
from app.services.risk_marker import detect_risk_marks, sanitize_text


def rebuild_reuse_units(db: Session, historical_bid: HistoricalBidDocument) -> list[HistoricalReuseUnit]:
    sections = list(
        db.scalars(
            select(HistoricalBidSection)
            .where(HistoricalBidSection.historical_bid_document_id == historical_bid.id)
            .order_by(HistoricalBidSection.id.asc())
        )
    )

    section_ids = [section.id for section in sections]
    if section_ids:
        reuse_units = list(
            db.scalars(
                select(HistoricalReuseUnit)
                .where(HistoricalReuseUnit.historical_bid_section_id.in_(section_ids))
                .order_by(HistoricalReuseUnit.id.asc())
            )
        )
        reuse_unit_ids = [reuse_unit.id for reuse_unit in reuse_units]
        if reuse_unit_ids:
            db.execute(
                delete(HistoricalRiskMark).where(
                    HistoricalRiskMark.historical_reuse_unit_id.in_(reuse_unit_ids)
                )
            )
        db.execute(
            delete(HistoricalReuseUnit).where(
                HistoricalReuseUnit.historical_bid_section_id.in_(section_ids)
            )
        )

    created_reuse_units: list[HistoricalReuseUnit] = []
    for section in sections:
        marks = detect_risk_marks(section.raw_text)
        sanitized_text = sanitize_text(section.raw_text, marks)
        risk_level = "high" if marks else "low"
        reuse_mode = "slot_reuse" if marks else "safe_reuse"
        reuse_unit = HistoricalReuseUnit(
            historical_bid_section_id=section.id,
            raw_text=section.raw_text,
            sanitized_text=sanitized_text,
            reuse_mode=reuse_mode,
            fact_density_score=len(marks),
            risk_level=risk_level,
        )
        db.add(reuse_unit)
        db.flush()
        for mark in marks:
            db.add(
                HistoricalRiskMark(
                    historical_reuse_unit_id=reuse_unit.id,
                    risk_type=mark.risk_type,
                    raw_value=mark.raw_value,
                    start_offset=mark.start_offset,
                    end_offset=mark.end_offset,
                    replacement_token=mark.replacement_token,
                )
            )
        created_reuse_units.append(reuse_unit)

    historical_bid.ingestion_status = "reuse_built"
    db.commit()

    for reuse_unit in created_reuse_units:
        db.refresh(reuse_unit)
    return created_reuse_units
