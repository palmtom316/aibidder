from app.schemas.writing_runtime import HistoricalLeakageVerificationResponse


def verify_historical_leakage(
    draft_text: str,
    forbidden_legacy_terms: list[str],
) -> HistoricalLeakageVerificationResponse:
    matched_terms = [term for term in forbidden_legacy_terms if term and term in draft_text]
    return HistoricalLeakageVerificationResponse(ok=not matched_terms, matched_terms=matched_terms)
