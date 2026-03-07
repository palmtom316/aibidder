from dataclasses import dataclass

from fastapi import Query


@dataclass(frozen=True)
class PaginationParams:
    limit: int
    offset: int


def pagination_params(
    limit: int = Query(1000, ge=1, le=2000),
    offset: int = Query(0, ge=0),
) -> PaginationParams:
    return PaginationParams(limit=limit, offset=offset)
