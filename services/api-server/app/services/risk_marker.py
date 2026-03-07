import re
from dataclasses import dataclass


@dataclass(frozen=True)
class RiskMarkResult:
    risk_type: str
    raw_value: str
    start_offset: int
    end_offset: int
    replacement_token: str


RISK_PATTERNS: tuple[tuple[str, str, str], ...] = (
    ("person_name", r"张三|李四|王五", "[PERSON_NAME]"),
    ("date", r"\d{4}年\d{1,2}月\d{1,2}日", "[DATE]"),
    ("duration", r"\d+\s*(日历天|天)", "[DURATION]"),
    ("money", r"\d+(?:\.\d+)?\s*万元", "[MONEY]"),
    ("qualification_code", r"[A-Z]{1,4}-?\d{4,}", "[QUALIFICATION_CODE]"),
)


def detect_risk_marks(text: str) -> list[RiskMarkResult]:
    marks: list[RiskMarkResult] = []
    for risk_type, pattern, replacement_token in RISK_PATTERNS:
        for match in re.finditer(pattern, text):
            marks.append(
                RiskMarkResult(
                    risk_type=risk_type,
                    raw_value=match.group(0),
                    start_offset=match.start(),
                    end_offset=match.end(),
                    replacement_token=replacement_token,
                )
            )
    return sorted(marks, key=lambda item: item.start_offset)


def sanitize_text(text: str, marks: list[RiskMarkResult]) -> str:
    sanitized = text
    for mark in marks:
        sanitized = sanitized.replace(mark.raw_value, mark.replacement_token)
    return sanitized
