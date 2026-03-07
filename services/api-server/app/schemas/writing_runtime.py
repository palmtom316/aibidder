from pydantic import BaseModel, Field


class HistoryCandidatePack(BaseModel):
    reuse_unit_ids: list[int] = Field(default_factory=list)


class HistoricalLeakageVerificationRequest(BaseModel):
    draft_text: str = Field(min_length=1)
    forbidden_legacy_terms: list[str] = Field(default_factory=list)
    history_candidate_pack: HistoryCandidatePack = Field(default_factory=HistoryCandidatePack)


class HistoricalLeakageVerificationResponse(BaseModel):
    ok: bool
    matched_terms: list[str]
