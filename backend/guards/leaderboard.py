from __future__ import annotations

from dataclasses import dataclass
import sqlite3
from typing import Optional


@dataclass(frozen=True)
class CheapGateResult:
    skip: bool
    min_score: Optional[int] = None
    threshold: Optional[int] = None


def fetch_min_score(conn: sqlite3.Connection, limit: int) -> Optional[int]:
    if limit <= 0:
        return None
    count_row = conn.execute("SELECT COUNT(*) as total FROM score_runs").fetchone()
    total = int(count_row["total"]) if count_row else 0
    if total == 0:
        return None
    if total < limit:
        row = conn.execute("SELECT MIN(server_score) as min_score FROM score_runs").fetchone()
        return int(row["min_score"]) if row and row["min_score"] is not None else None
    row = conn.execute(
        """
        SELECT server_score
        FROM score_runs
        ORDER BY server_score DESC, created_at ASC
        LIMIT 1 OFFSET ?
        """,
        (limit - 1,),
    ).fetchone()
    if not row:
        return None
    return int(row["server_score"])


def should_skip_authority(
    conn: sqlite3.Connection,
    client_score: int,
    limit: int,
    margin: float,
) -> CheapGateResult:
    min_score = fetch_min_score(conn, limit)
    if min_score is None:
        return CheapGateResult(skip=False)
    threshold = int(min_score * (1 - margin))
    return CheapGateResult(skip=client_score < threshold, min_score=min_score, threshold=threshold)
