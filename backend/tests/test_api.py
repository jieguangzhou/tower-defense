from __future__ import annotations

import json
from uuid import uuid4
from pathlib import Path

from fastapi.testclient import TestClient

from backend.app import RateLimiter, create_app
from backend.guards.authority import build_authority_rules
from backend.ruleset_series import round_value
from backend.tests.factories import build_seeded_payload, clone_payload, compute_score


SCORING = {"STRIDE": 1000, "KILL_UNIT": 10, "HP_MAX": 100}
ECONOMY = {
    "goldStart": 10,
    "goldTolerance": 5,
    "waveCount": 2,
    "waveReward": {"base": 2, "growthRate": 0.25, "round": "half_up"},
}
MOBS = {
    "bossMultiplier": 2.0,
    "waveHpStep": 0.0,
    "mobs": {
        "slime": {"hp": 10, "dropGold": 1},
        "bat": {"hp": 5, "dropGold": 2},
    },
}
CAPS = {
    "waveCount": 2,
    "maxMobsPerWave": {"base": 3, "growthRate": 0.2, "round": "ceil"},
    "maxDamagePerWave": {"base": 50, "growthRate": 0.0, "round": "ceil"},
    "maxSpikeRatio": 3.0,
}


def write_ruleset(tmp_path: Path) -> Path:
    ruleset_dir = tmp_path / "ruleset"
    ruleset_dir.mkdir()
    (ruleset_dir / "scoring.v1.json").write_text(json.dumps(SCORING), encoding="utf-8")
    (ruleset_dir / "economy.v1.json").write_text(json.dumps(ECONOMY), encoding="utf-8")
    (ruleset_dir / "mobs.v1.json").write_text(json.dumps(MOBS), encoding="utf-8")
    (ruleset_dir / "caps.v1.json").write_text(json.dumps(CAPS), encoding="utf-8")
    return ruleset_dir


def build_app(tmp_path: Path, limiter: RateLimiter | None = None, max_body_bytes: int | None = None):
    db_path = tmp_path / "db.sqlite3"
    ruleset_dir = write_ruleset(tmp_path)
    app = create_app(
        db_path=db_path,
        ruleset_dir=ruleset_dir,
        rate_limiter=limiter,
        max_body_bytes=max_body_bytes or 64 * 1024,
    )
    return app


def make_ruleset() -> dict:
    return {"scoring": SCORING, "economy": ECONOMY, "mobs": MOBS, "caps": CAPS}


def expected_score(progress: int, kills: int, hp_left: int, hp_max: int) -> int:
    return compute_score(SCORING, progress, kills, hp_left, hp_max)


def test_submit_and_leaderboard(tmp_path: Path):
    app = build_app(tmp_path)
    client = TestClient(app)

    ruleset = make_ruleset()
    payload_1, meta_1 = build_seeded_payload(ruleset, seed=11, progress=2)
    resp_1 = client.post("/api/score/submit", json=payload_1)
    assert resp_1.status_code == 200
    body_1 = resp_1.json()
    assert body_1["status"] == "accepted"
    assert body_1["serverScore"] == expected_score(2, meta_1["total_kills"], 10, 10)

    payload_2, _ = build_seeded_payload(ruleset, seed=11, progress=2, hp_left=9)
    resp_2 = client.post("/api/score/submit", json=payload_2)
    assert resp_2.status_code == 200
    body_2 = resp_2.json()
    assert body_2["status"] == "accepted"

    leaderboard = client.get("/api/leaderboard?limit=1")
    assert leaderboard.status_code == 200
    items = leaderboard.json()["items"]
    assert len(items) == 1
    assert items[0]["playerName"] == "Tester"
    assert items[0]["score"] == body_1["serverScore"]


def test_economy_invalid_rejected(tmp_path: Path):
    app = build_app(tmp_path)
    client = TestClient(app)
    ruleset = make_ruleset()
    payload, _ = build_seeded_payload(ruleset, seed=21, progress=1)
    bad_payload = clone_payload(payload)
    bad_payload["economy"]["goldEnd"] += ECONOMY["goldTolerance"] + 1
    resp = client.post("/api/score/submit", json=bad_payload)
    assert resp.status_code == 200
    assert resp.json()["reason"] == "ECONOMY_INVALID"


def test_damage_invalid_rejected(tmp_path: Path):
    app = build_app(tmp_path)
    client = TestClient(app)
    ruleset = make_ruleset()
    rules = build_authority_rules(ruleset)
    payload, _ = build_seeded_payload(ruleset, seed=22, progress=1)
    bad_payload = clone_payload(payload)
    mob = bad_payload["waves"][0]["mobs"][0]
    mob_rule = rules.mob_defs[mob["type"]]
    hp = mob_rule["hp"] * (1 + 0 * rules.wave_hp_step)
    if mob["isBoss"]:
        hp *= rules.boss_multiplier
    hp = round_value(hp, "half_up")
    mob["damageTaken"] = hp + 1000
    resp = client.post("/api/score/submit", json=bad_payload)
    assert resp.status_code == 200
    assert resp.json()["reason"] == "DAMAGE_INVALID"


def test_partial_wave_drops_counted_on_defeat(tmp_path: Path):
    app = build_app(tmp_path)
    client = TestClient(app)
    ruleset = make_ruleset()
    rules = build_authority_rules(ruleset)
    payload, meta = build_seeded_payload(ruleset, seed=77, progress=2)
    payload["progress"] = 1
    payload["hpLeft"] = 0
    earned_wave = sum(rules.wave_rewards[: payload["progress"]])
    earned_total = earned_wave + meta["earned_drops"]
    payload["economy"]["goldSpentTotal"] = 0
    payload["economy"]["goldEnd"] = rules.gold_start + earned_total
    payload["clientScore"] = compute_score(
        SCORING, payload["progress"], meta["total_kills"], payload["hpLeft"], payload["hpMax"]
    )

    resp = client.post("/api/score/submit", json=payload)
    assert resp.status_code == 200
    assert resp.json()["status"] == "accepted"


def test_not_in_topN_skips_authority(tmp_path: Path):
    app = build_app(tmp_path)
    client = TestClient(app)
    ruleset = make_ruleset()
    payload, _ = build_seeded_payload(ruleset, seed=33, progress=2)
    resp = client.post("/api/score/submit", json=payload)
    assert resp.status_code == 200

    low_payload = clone_payload(payload)
    low_payload["runId"] = str(uuid4())
    low_payload["clientScore"] = 1
    resp_low = client.post("/api/score/submit", json=low_payload)
    assert resp_low.status_code == 200
    assert resp_low.json()["status"] == "not_in_topN"


def test_duplicate_run_rejected(tmp_path: Path):
    app = build_app(tmp_path)
    client = TestClient(app)
    run_id = str(uuid4())
    ruleset = make_ruleset()
    payload, _ = build_seeded_payload(ruleset, seed=44, progress=1, run_id=run_id)
    resp_1 = client.post("/api/score/submit", json=payload)
    assert resp_1.status_code == 200
    resp_2 = client.post("/api/score/submit", json=payload)
    assert resp_2.status_code == 409
    assert resp_2.json()["reason"] == "already_submitted"


def test_mob_overflow_rejected(tmp_path: Path):
    app = build_app(tmp_path)
    client = TestClient(app)
    ruleset = make_ruleset()
    rules = build_authority_rules(ruleset)
    payload, _ = build_seeded_payload(ruleset, seed=88, progress=1)
    bad_payload = clone_payload(payload)
    extra_mobs = rules.max_mobs_per_wave[0] + 11
    bad_payload["waves"][0]["mobs"] = bad_payload["waves"][0]["mobs"] * (extra_mobs)
    bad_payload["waves"][0]["mobs"] = bad_payload["waves"][0]["mobs"][:extra_mobs]
    resp = client.post("/api/score/submit", json=bad_payload)
    assert resp.status_code == 200
    assert resp.json()["reason"] == "MOB_INVALID"


def test_rate_limit(tmp_path: Path):
    limiter = RateLimiter(max_requests=2, window_seconds=60)
    app = build_app(tmp_path, limiter=limiter)
    client = TestClient(app)
    headers = {"X-Forwarded-For": "1.2.3.4"}
    ruleset = make_ruleset()
    payload, _ = build_seeded_payload(ruleset, seed=55, progress=1)

    resp_1 = client.post("/api/score/submit", json=payload, headers=headers)
    assert resp_1.status_code == 200
    payload["runId"] = str(uuid4())
    resp_2 = client.post("/api/score/submit", json=payload, headers=headers)
    assert resp_2.status_code == 200
    payload["runId"] = str(uuid4())
    resp_3 = client.post("/api/score/submit", json=payload, headers=headers)
    assert resp_3.status_code == 429
    assert resp_3.json()["reason"] == "rate_limited"


def test_payload_too_large_rejected(tmp_path: Path):
    app = build_app(tmp_path, max_body_bytes=200)
    client = TestClient(app)
    ruleset = make_ruleset()
    payload, _ = build_seeded_payload(ruleset, seed=66, progress=1)
    payload["playerName"] = "A" * 500
    resp = client.post("/api/score/submit", json=payload)
    assert resp.status_code == 400
    assert resp.json()["reason"] == "INVALID_PAYLOAD"
