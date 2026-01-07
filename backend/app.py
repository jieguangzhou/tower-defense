from __future__ import annotations

import json
import logging
import sqlite3
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, Optional
from uuid import UUID

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from backend.guards.authority import AuthorityRules, validate_precheck
from backend.guards import build_authority_rules, is_replay, should_skip_authority, validate_authority


LEADERBOARD_LIMIT = 3
CHEAP_GATE_LIMIT = 3
CHEAP_GATE_MARGIN = 0.02
MAX_BODY_BYTES = 64 * 1024
LOGGER = logging.getLogger("leaderboard")
DEV_CORS_ORIGINS = (
    "http://localhost:30000",
    "http://127.0.0.1:30000",
)


@dataclass
class RateLimiter:
    max_requests: int = 10
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


class EconomyPayload(BaseModel):
    goldSpentTotal: int = Field(..., ge=0)
    goldEnd: int = Field(..., ge=0)


class MobPayload(BaseModel):
    type: str = Field(..., min_length=1)
    isBoss: bool
    damageTaken: int = Field(..., ge=0)


class WavePayload(BaseModel):
    wave: int = Field(..., ge=1)
    mobs: list[MobPayload]


class SubmitPayload(BaseModel):
    runId: str = Field(..., min_length=1)
    playerName: str = Field(default="", max_length=32)
    progress: int = Field(..., ge=0)
    clientScore: int = Field(..., ge=0)
    hpLeft: int = Field(..., ge=0)
    hpMax: int = Field(..., ge=1)
    economy: EconomyPayload
    waves: list[WavePayload]
    rulesetVersion: str = Field(..., min_length=1)


class SubmitResponse(BaseModel):
    ok: bool
    status: str
    reason: str
    serverScore: Optional[int] = None
    earnedGold: Optional[int] = None
    totalKills: Optional[int] = None


class LeaderboardItem(BaseModel):
    playerName: str
    score: int
    progress: int
    createdAt: str


class LeaderboardResponse(BaseModel):
    items: list[LeaderboardItem]


def load_ruleset(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    return payload


def init_db(db_path: Path) -> None:
    conn = sqlite3.connect(db_path)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS score_runs (
            run_id TEXT PRIMARY KEY,
            player_name TEXT NOT NULL,
            client_score INTEGER NOT NULL,
            server_score INTEGER NOT NULL,
            progress INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            ip TEXT NOT NULL
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_score_runs_score ON score_runs(server_score DESC, created_at ASC)"
    )
    conn.commit()
    conn.close()


def create_app(
    db_path: str | Path = Path("backend") / "leaderboard.db",
    ruleset_dir: str | Path = Path("shared") / "ruleset",
    rate_limiter: Optional[RateLimiter] = None,
    max_body_bytes: int = MAX_BODY_BYTES,
) -> FastAPI:
    if not logging.getLogger().handlers:
        logging.basicConfig(level=logging.INFO)
    db_path = Path(db_path)
    ruleset_dir = Path(ruleset_dir)
    scoring = load_ruleset(ruleset_dir / "scoring.v1.json")
    economy = load_ruleset(ruleset_dir / "economy.v1.json")
    mobs = load_ruleset(ruleset_dir / "mobs.v1.json")
    caps = load_ruleset(ruleset_dir / "caps.v1.json")
    init_db(db_path)

    app = FastAPI()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(DEV_CORS_ORIGINS),
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )
    app.state.max_body_bytes = max_body_bytes

    @app.middleware("http")
    async def limit_request_body(request: Request, call_next):
        if request.method == "POST" and request.url.path == "/api/score/submit":
            content_length = request.headers.get("content-length")
            if content_length:
                try:
                    length = int(content_length)
                except ValueError:
                    length = None
                if length is not None and length > app.state.max_body_bytes:
                    app.state.metrics["submit_rejected_invalid_payload_total"] += 1
                    log_rejection(None, "INVALID_PAYLOAD", detail="payload_too_large")
                    return JSONResponse(
                        status_code=400,
                        content={"ok": False, "status": "rejected", "reason": "INVALID_PAYLOAD"},
                    )
            body = await request.body()
            if len(body) > app.state.max_body_bytes:
                app.state.metrics["submit_rejected_invalid_payload_total"] += 1
                log_rejection(None, "INVALID_PAYLOAD", detail="payload_too_large")
                return JSONResponse(
                    status_code=400,
                    content={"ok": False, "status": "rejected", "reason": "INVALID_PAYLOAD"},
                )
        return await call_next(request)

    @app.exception_handler(RequestValidationError)
    def validation_exception_handler(_request: Request, exc: RequestValidationError):
        LOGGER.info("invalid payload: %s", exc.errors())
        metrics: Dict[str, int] = app.state.metrics
        metrics["submit_rejected_invalid_payload_total"] += 1
        return JSONResponse(
            status_code=400,
            content={"ok": False, "status": "rejected", "reason": "INVALID_PAYLOAD"},
        )
    app.state.db_path = db_path
    app.state.ruleset = {
        "scoring": scoring,
        "economy": economy,
        "mobs": mobs,
        "caps": caps,
    }
    app.state.authority_rules = build_authority_rules(app.state.ruleset)
    app.state.rate_limiter = rate_limiter or RateLimiter()
    app.state.metrics = {
        "submit_total": 0,
        "submit_accepted_total": 0,
        "submit_rejected_rate_limited_total": 0,
        "submit_rejected_already_submitted_total": 0,
        "submit_rejected_invalid_payload_total": 0,
    }

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

    def compute_rank(conn: sqlite3.Connection, score: int, created_at: str) -> int:
        row = conn.execute(
            """
            SELECT COUNT(*) as ahead
            FROM score_runs
            WHERE server_score > ? OR (server_score = ? AND created_at < ?)
            """,
            (score, score, created_at),
        ).fetchone()
        ahead = row["ahead"] if row else 0
        return int(ahead) + 1

    def log_rejection(run_id: str | None, reason: str, **detail: Any) -> None:
        payload = {"run": run_id, "reason": reason}
        if detail:
            payload.update(detail)
        LOGGER.info("submission rejected: %s", payload)

    @app.post("/api/score/submit", response_model=SubmitResponse)
    def submit(payload: SubmitPayload, request: Request, conn: sqlite3.Connection = Depends(get_db)):
        ip = get_client_ip(request)
        metrics: Dict[str, int] = app.state.metrics
        metrics["submit_total"] += 1
        limiter: RateLimiter = app.state.rate_limiter
        if not limiter.allow(ip):
            LOGGER.warning("rate limited submission ip=%s run=%s", ip, payload.runId)
            metrics["submit_rejected_rate_limited_total"] += 1
            return JSONResponse(
                status_code=429,
                content={"ok": False, "status": "rejected", "reason": "rate_limited"},
            )
        rules: AuthorityRules = app.state.authority_rules
        scoring = rules.scoring

        try:
            UUID(payload.runId, version=4)
        except ValueError:
            log_rejection(payload.runId, "INVALID_PAYLOAD", detail="invalid_run_id")
            metrics["submit_rejected_invalid_payload_total"] += 1
            return JSONResponse(
                status_code=400,
                content={"ok": False, "status": "rejected", "reason": "INVALID_PAYLOAD"},
            )

        precheck = validate_precheck(payload, rules)
        if precheck:
            log_rejection(payload.runId, precheck.reason, **(precheck.detail or {}))
            metrics["submit_rejected_invalid_payload_total"] += 1
            return JSONResponse(
                status_code=precheck.http_status,
                content={"ok": False, "status": "rejected", "reason": precheck.reason},
            )

        if is_replay(conn, payload.runId):
            log_rejection(payload.runId, "already_submitted")
            metrics["submit_rejected_already_submitted_total"] += 1
            return JSONResponse(
                status_code=409,
                content={"ok": False, "status": "rejected", "reason": "already_submitted"},
            )

        gate = should_skip_authority(conn, payload.clientScore, CHEAP_GATE_LIMIT, CHEAP_GATE_MARGIN)
        if gate.skip:
            LOGGER.info(
                "cheap gate skip: run=%s clientScore=%s minScore=%s threshold=%s",
                payload.runId,
                payload.clientScore,
                gate.min_score,
                gate.threshold,
            )
            return SubmitResponse(
                ok=True,
                status="not_in_topN",
                reason="NONE",
            )

        authority_result = validate_authority(payload, rules)
        if not authority_result.ok:
            log_rejection(payload.runId, authority_result.reason, **(authority_result.detail or {}))
            return SubmitResponse(
                ok=False,
                status="rejected",
                reason=authority_result.reason,
            )

        total_kills = authority_result.total_kills
        earned_drops = authority_result.earned_drops
        earned_total = authority_result.earned_total

        hp_score = int(payload.hpLeft * int(scoring["HP_MAX"]) / payload.hpMax)
        server_score = (
            payload.progress * int(scoring["STRIDE"]) + total_kills * int(scoring["KILL_UNIT"]) + hp_score
        )

        created_at = datetime.now(timezone.utc).isoformat()
        conn.execute(
            """
            INSERT INTO score_runs (run_id, player_name, client_score, server_score, progress, created_at, ip)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload.runId,
                payload.playerName or "anonymous",
                payload.clientScore,
                server_score,
                payload.progress,
                created_at,
                ip,
            ),
        )
        conn.commit()
        rank = compute_rank(conn, server_score, created_at)
        LOGGER.info(
            "accepted run=%s ip=%s progress=%s clientScore=%s serverScore=%s rank=%s kills=%s earned=%s",
            payload.runId,
            ip,
            payload.progress,
            payload.clientScore,
            server_score,
            rank,
            total_kills,
            earned_total,
        )
        metrics["submit_accepted_total"] += 1
        return SubmitResponse(
            ok=True,
            status="accepted",
            reason="NONE",
            serverScore=server_score,
            earnedGold=earned_drops,
            totalKills=total_kills,
        )

    @app.get("/api/leaderboard", response_model=LeaderboardResponse)
    def leaderboard(limit: int = LEADERBOARD_LIMIT, conn: sqlite3.Connection = Depends(get_db)):
        limit = max(1, min(limit, LEADERBOARD_LIMIT))
        LOGGER.info("leaderboard request limit=%s", limit)
        rows = conn.execute(
            """
            SELECT player_name, server_score, progress, created_at
            FROM score_runs
            ORDER BY server_score DESC, created_at ASC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        items = [
            LeaderboardItem(
                playerName=row["player_name"],
                score=row["server_score"],
                progress=row["progress"],
                createdAt=row["created_at"],
            )
            for row in rows
        ]
        return LeaderboardResponse(items=items)

    return app


app = create_app()
