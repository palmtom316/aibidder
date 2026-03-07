from collections.abc import Sequence
from typing import TypeVar

from fastapi import Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from sqlalchemy.sql import Select

T = TypeVar("T")


def slice_results(items: Sequence[T], *, offset: int = 0, limit: int = 50) -> list[T]:
    return list(items[offset : offset + limit])


def paginate_scalars(*, db: Session, stmt: Select, response: Response, offset: int = 0, limit: int = 50) -> list:
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    response.headers["X-Total-Count"] = str(total)
    return list(db.scalars(stmt.limit(limit).offset(offset)))
