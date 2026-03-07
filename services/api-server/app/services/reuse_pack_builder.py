from app.db.models import HistoricalReuseUnit


def build_reuse_pack(reuse_units: list[HistoricalReuseUnit]) -> dict:
    pack = {
        "safe_reuse": [],
        "slot_reuse": [],
        "style_only": [],
    }
    for reuse_unit in reuse_units:
        item = {
            "id": reuse_unit.id,
            "historical_bid_section_id": reuse_unit.historical_bid_section_id,
            "unit_type": reuse_unit.unit_type,
            "sanitized_text": reuse_unit.sanitized_text,
            "reuse_mode": reuse_unit.reuse_mode,
            "fact_density_score": reuse_unit.fact_density_score,
            "risk_level": reuse_unit.risk_level,
        }
        bucket = pack.get(reuse_unit.reuse_mode)
        if bucket is None:
            pack["style_only"].append(item)
        else:
            bucket.append(item)
    return pack
