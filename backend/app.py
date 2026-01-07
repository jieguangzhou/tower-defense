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


DEFAULT_LIMIT = 100
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


def round_half_up(value: float) -> int:
    return int(value + 0.5)


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

    def max_waves() -> int:
        caps = app.state.ruleset["caps"]
        return len(caps.get("maxDamagePerWave", []))

    def max_client_score() -> int:
        caps = app.state.ruleset["caps"]
        scoring = app.state.ruleset["scoring"]
        max_kills = sum(caps.get("maxMobsPerWave", []))
        return max_waves() * int(scoring["STRIDE"]) + max_kills * int(scoring["KILL_UNIT"]) + int(
            scoring["HP_MAX"]
        )

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
        ruleset = app.state.ruleset
        caps = ruleset["caps"]
        scoring = ruleset["scoring"]
        economy = ruleset["economy"]
        mobs_rules = ruleset["mobs"]

        try:
            UUID(payload.runId, version=4)
        except ValueError:
            log_rejection(payload.runId, "INVALID_PAYLOAD", detail="invalid_run_id")
            metrics["submit_rejected_invalid_payload_total"] += 1
            return JSONResponse(
                status_code=400,
                content={"ok": False, "status": "rejected", "reason": "INVALID_PAYLOAD"},
            )

        if payload.rulesetVersion != "v1":
            log_rejection(payload.runId, "INVALID_PAYLOAD", ruleset=payload.rulesetVersion)
            metrics["submit_rejected_invalid_payload_total"] += 1
            return JSONResponse(
                status_code=400,
                content={"ok": False, "status": "rejected", "reason": "INVALID_PAYLOAD"},
            )
        if payload.progress > max_waves():
            log_rejection(payload.runId, "INVALID_PAYLOAD", progress=payload.progress)
            metrics["submit_rejected_invalid_payload_total"] += 1
            return JSONResponse(
                status_code=400,
                content={"ok": False, "status": "rejected", "reason": "INVALID_PAYLOAD"},
            )
        if payload.hpLeft > payload.hpMax:
            log_rejection(
                payload.runId,
                "INVALID_PAYLOAD",
                hpLeft=payload.hpLeft,
                hpMax=payload.hpMax,
            )
            metrics["submit_rejected_invalid_payload_total"] += 1
            return JSONResponse(
                status_code=400,
                content={"ok": False, "status": "rejected", "reason": "INVALID_PAYLOAD"},
            )
        if payload.hpMax > int(scoring["HP_MAX"]):
            log_rejection(
                payload.runId,
                "INVALID_PAYLOAD",
                hpMax=payload.hpMax,
                maxHp=scoring["HP_MAX"],
            )
            metrics["submit_rejected_invalid_payload_total"] += 1
            return JSONResponse(
                status_code=400,
                content={"ok": False, "status": "rejected", "reason": "INVALID_PAYLOAD"},
            )
        if len(payload.waves) < payload.progress:
            log_rejection(
                payload.runId,
                "INVALID_PAYLOAD",
                progress=payload.progress,
                waves=len(payload.waves),
            )
            metrics["submit_rejected_invalid_payload_total"] += 1
            return JSONResponse(
                status_code=400,
                content={"ok": False, "status": "rejected", "reason": "INVALID_PAYLOAD"},
            )
        if len(payload.waves) > max_waves():
            log_rejection(
                payload.runId,
                "INVALID_PAYLOAD",
                progress=payload.progress,
                waves=len(payload.waves),
            )
            metrics["submit_rejected_invalid_payload_total"] += 1
            return JSONResponse(
                status_code=400,
                content={"ok": False, "status": "rejected", "reason": "INVALID_PAYLOAD"},
            )
        if payload.clientScore > max_client_score():
            log_rejection(
                payload.runId,
                "INVALID_PAYLOAD",
                clientScore=payload.clientScore,
                maxClientScore=max_client_score(),
            )
            metrics["submit_rejected_invalid_payload_total"] += 1
            return JSONResponse(
                status_code=400,
                content={"ok": False, "status": "rejected", "reason": "INVALID_PAYLOAD"},
            )

        exists = conn.execute(
            "SELECT 1 FROM score_runs WHERE run_id = ?", (payload.runId,)
        ).fetchone()
        if exists:
            log_rejection(payload.runId, "already_submitted")
            metrics["submit_rejected_already_submitted_total"] += 1
            return JSONResponse(
                status_code=409,
                content={"ok": False, "status": "rejected", "reason": "already_submitted"},
            )

        cheap_gate_limit = DEFAULT_LIMIT
        cheap_gate_margin = 0.02
        min_score = fetch_min_score(conn, cheap_gate_limit)
        if min_score is not None:
            threshold = int(min_score * (1 - cheap_gate_margin))
            if payload.clientScore < threshold:
                LOGGER.info(
                    "cheap gate skip: run=%s clientScore=%s minScore=%s threshold=%s",
                    payload.runId,
                    payload.clientScore,
                    min_score,
                    threshold,
                )
                return SubmitResponse(
                    ok=True,
                    status="not_in_topN",
                    reason="NONE",
                )

        max_mobs = caps.get("maxMobsPerWave", [])
        max_damage = caps.get("maxDamagePerWave", [])
        max_spike_ratio = float(caps.get("maxSpikeRatio", 0))
        mob_defs = mobs_rules.get("mobs", {})
        boss_multiplier = float(mobs_rules.get("bossMultiplier", 1))
        wave_hp_step = float(mobs_rules.get("waveHpStep", 0))

        total_kills = 0
        earned_drops = 0
        prev_wave_damage = None
        for index in range(payload.progress):
            wave_payload = payload.waves[index]
            expected_wave = index + 1
            if wave_payload.wave != expected_wave:
                log_rejection(
                    payload.runId,
                    "INVALID_PAYLOAD",
                    expectedWave=expected_wave,
                    gotWave=wave_payload.wave,
                )
                metrics["submit_rejected_invalid_payload_total"] += 1
                return SubmitResponse(
                    ok=False,
                    status="rejected",
                    reason="INVALID_PAYLOAD",
                )
            mobs_list = wave_payload.mobs
            if index < len(max_mobs) and len(mobs_list) > max_mobs[index]:
                log_rejection(
                    payload.runId,
                    "MOB_INVALID",
                    wave=expected_wave,
                    count=len(mobs_list),
                    cap=max_mobs[index],
                )
                return SubmitResponse(
                    ok=False,
                    status="rejected",
                    reason="MOB_INVALID",
                )

            wave_damage = 0
            wave_multiplier = 1 + index * wave_hp_step
            for mob in mobs_list:
                mob_rule = mob_defs.get(mob.type)
                if not mob_rule:
                    log_rejection(payload.runId, "MOB_INVALID", mob=mob.type)
                    return SubmitResponse(
                        ok=False,
                        status="rejected",
                        reason="MOB_INVALID",
                    )
                wave_damage += mob.damageTaken
                hp = mob_rule["hp"] * wave_multiplier
                drop_gold = mob_rule["dropGold"]
                if mob.isBoss:
                    hp *= boss_multiplier
                    drop_gold = round_half_up(drop_gold * boss_multiplier)
                hp = round_half_up(hp)
                if mob.damageTaken >= hp:
                    total_kills += 1
                    earned_drops += int(drop_gold)

            if index < len(max_damage) and wave_damage > max_damage[index]:
                log_rejection(
                    payload.runId,
                    "DAMAGE_INVALID",
                    wave=expected_wave,
                    damage=wave_damage,
                    cap=max_damage[index],
                )
                return SubmitResponse(
                    ok=False,
                    status="rejected",
                    reason="DAMAGE_INVALID",
                )
            if prev_wave_damage is not None and max_spike_ratio > 0:
                spike_limit = prev_wave_damage * max_spike_ratio
                if prev_wave_damage > 0 and wave_damage > spike_limit:
                    log_rejection(
                        payload.runId,
                        "DAMAGE_INVALID",
                        wave=expected_wave,
                        damage=wave_damage,
                        spikeLimit=spike_limit,
                    )
                    return SubmitResponse(
                        ok=False,
                        status="rejected",
                        reason="DAMAGE_INVALID",
                    )
            prev_wave_damage = wave_damage

        wave_rewards = economy.get("waveReward", [])
        if payload.progress > len(wave_rewards):
            log_rejection(payload.runId, "INVALID_PAYLOAD", progress=payload.progress)
            metrics["submit_rejected_invalid_payload_total"] += 1
            return SubmitResponse(
                ok=False,
                status="rejected",
                reason="INVALID_PAYLOAD",
            )
        earned_wave = sum(wave_rewards[: payload.progress])
        earned_total = earned_wave + earned_drops
        expected_end = int(economy.get("goldStart", 0)) + earned_total - payload.economy.goldSpentTotal
        gold_tolerance = int(economy.get("goldTolerance", 0))
        if abs(payload.economy.goldEnd - expected_end) > gold_tolerance:
            log_rejection(
                payload.runId,
                "ECONOMY_INVALID",
                goldEnd=payload.economy.goldEnd,
                expected=expected_end,
                spent=payload.economy.goldSpentTotal,
                earned=earned_total,
            )
            return SubmitResponse(
                ok=False,
                status="rejected",
                reason="ECONOMY_INVALID",
            )

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
    def leaderboard(limit: int = DEFAULT_LIMIT, conn: sqlite3.Connection = Depends(get_db)):
        limit = max(1, min(limit, DEFAULT_LIMIT))
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
