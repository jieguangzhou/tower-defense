from __future__ import annotations

import json
import logging
import re
import sqlite3
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, Optional, Tuple

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field


LEVEL_PROGRESS_RE = re.compile(r"^(\d+)\.(\d+)$")
DEFAULT_LIMIT = 100
LOGGER = logging.getLogger("leaderboard")
DEV_CORS_ORIGINS = (
    "http://localhost:30000",
    "http://127.0.0.1:30000",
)


@dataclass
class RateLimiter:
    max_requests: int = 5
    window_seconds: int = 60
    time_fn: Callable[[], float] = time.time
    _buckets: Dict[str, list] = None

    def __post_init__(self) -> None:
        if self._buckets is None:
            self._buckets = {}

    def allow(self, key: str) -> bool:
        now = float(self.time_fn())
        bucket = self._buckets.setdefault(key, [])
        threshold = now - self.window_seconds
        while bucket and bucket[0] <= threshold:
            bucket.pop(0)
        if len(bucket) >= self.max_requests:
            return False
        bucket.append(now)
        return True


class SubmitPayload(BaseModel):
    submissionId: str = Field(..., min_length=1)
    playerName: str = Field(default="")
    score: int = Field(..., ge=0)
    progress: str = Field(..., min_length=3)


class SubmitResponse(BaseModel):
    status: str
    rank: Optional[int] = None
    reason: Optional[str] = None


class LeaderboardItem(BaseModel):
    playerName: str
    score: int
    progress: str
    createdAt: str


class LeaderboardResponse(BaseModel):
    items: list[LeaderboardItem]


def load_caps(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        caps = json.load(handle)
    if "maxScore" not in caps:
        raise ValueError("validation caps missing maxScore")
    return caps


def parse_progress(progress: str) -> Tuple[int, int]:
    match = LEVEL_PROGRESS_RE.match(progress)
    if not match:
        raise ValueError("invalid progress format")
    level = int(match.group(1))
    wave = int(match.group(2))
    if level <= 0 or wave <= 0:
        raise ValueError("progress values must be positive")
    return level, wave


def init_db(db_path: Path) -> None:
    conn = sqlite3.connect(db_path)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS submissions (
            submission_id TEXT PRIMARY KEY,
            player_name TEXT NOT NULL,
            score INTEGER NOT NULL,
            progress TEXT NOT NULL,
            created_at TEXT NOT NULL,
            ip TEXT NOT NULL
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_submissions_score ON submissions(score DESC, created_at ASC)"
    )
    conn.commit()
    conn.close()


def create_app(
    db_path: str | Path = Path("backend") / "leaderboard.db",
    caps_path: str | Path = Path("backend") / "config" / "validation_caps.json",
    rate_limiter: Optional[RateLimiter] = None,
) -> FastAPI:
    db_path = Path(db_path)
    caps_path = Path(caps_path)
    caps = load_caps(caps_path)
    init_db(db_path)

    app = FastAPI()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(DEV_CORS_ORIGINS),
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )
    app.state.db_path = db_path
    app.state.caps = caps
    app.state.rate_limiter = rate_limiter or RateLimiter()

    def get_db():
        conn = sqlite3.connect(app.state.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def get_client_ip(request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        if request.client:
            return request.client.host
        return "unknown"

    def validate_score(score: int, progress: str) -> None:
        try:
            level, _wave = parse_progress(progress)
        except ValueError as exc:
            LOGGER.info("invalid progress format: %s", exc)
            raise HTTPException(status_code=400, detail="invalid_progress") from exc
        max_score = app.state.caps.get("maxScore", {}).get(str(level))
        if max_score is None:
            LOGGER.info("unknown level in progress: %s", progress)
            raise HTTPException(status_code=400, detail="unknown_level")
        if score > int(max_score):
            LOGGER.info("score too high: score=%s progress=%s max=%s", score, progress, max_score)
            raise HTTPException(status_code=400, detail="score_too_high")

    def compute_rank(conn: sqlite3.Connection, score: int, created_at: str) -> int:
        row = conn.execute(
            """
            SELECT COUNT(*) as ahead
            FROM submissions
            WHERE score > ? OR (score = ? AND created_at < ?)
            """,
            (score, score, created_at),
        ).fetchone()
        ahead = row["ahead"] if row else 0
        return int(ahead) + 1

    @app.post("/api/score/submit", response_model=SubmitResponse)
    def submit(payload: SubmitPayload, request: Request, conn: sqlite3.Connection = Depends(get_db)):
        ip = get_client_ip(request)
        limiter: RateLimiter = app.state.rate_limiter
        if not limiter.allow(ip):
            LOGGER.warning("rate limited submission ip=%s submission=%s", ip, payload.submissionId)
            return JSONResponse(
                status_code=429,
                content={"status": "rejected", "reason": "rate_limited"},
            )
        validate_score(payload.score, payload.progress)

        exists = conn.execute(
            "SELECT 1 FROM submissions WHERE submission_id = ?", (payload.submissionId,)
        ).fetchone()
        if exists:
            LOGGER.info("duplicate submission: %s", payload.submissionId)
            return JSONResponse(
                status_code=409,
                content={"status": "rejected", "reason": "duplicate_submission"},
            )

        created_at = datetime.now(timezone.utc).isoformat()
        conn.execute(
            """
            INSERT INTO submissions (submission_id, player_name, score, progress, created_at, ip)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                payload.submissionId,
                payload.playerName or "anonymous",
                payload.score,
                payload.progress,
                created_at,
                ip,
            ),
        )
        conn.commit()
        rank = compute_rank(conn, payload.score, created_at)
        LOGGER.info(
            "accepted submission id=%s ip=%s score=%s progress=%s rank=%s",
            payload.submissionId,
            ip,
            payload.score,
            payload.progress,
            rank,
        )
        return SubmitResponse(status="accepted", rank=rank)

    @app.get("/api/leaderboard", response_model=LeaderboardResponse)
    def leaderboard(limit: int = DEFAULT_LIMIT, conn: sqlite3.Connection = Depends(get_db)):
        limit = max(1, min(limit, DEFAULT_LIMIT))
        LOGGER.info("leaderboard request limit=%s", limit)
        rows = conn.execute(
            """
            SELECT player_name, score, progress, created_at
            FROM submissions
            ORDER BY score DESC, created_at ASC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        items = [
            LeaderboardItem(
                playerName=row["player_name"],
                score=row["score"],
                progress=row["progress"],
                createdAt=row["created_at"],
            )
            for row in rows
        ]
        return LeaderboardResponse(items=items)

    return app


app = create_app()
