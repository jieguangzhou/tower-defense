from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient

from backend.app import RateLimiter, create_app


SCORING = {"STRIDE": 1000, "KILL_UNIT": 10, "HP_MAX": 100}
ECONOMY = {"goldStart": 10, "waveReward": [2, 2], "goldTolerance": 5}
MOBS = {
    "bossMultiplier": 2.0,
    "waveHpStep": 0.0,
    "mobs": {
        "slime": {"hp": 10, "dropGold": 1},
        "bat": {"hp": 5, "dropGold": 2},
    },
}
CAPS = {"maxMobsPerWave": [3, 3], "maxDamagePerWave": [50, 50], "maxSpikeRatio": 3.0}


def write_ruleset(tmp_path: Path) -> Path:
    ruleset_dir = tmp_path / "ruleset"
    ruleset_dir.mkdir()
    (ruleset_dir / "scoring.v1.json").write_text(json.dumps(SCORING), encoding="utf-8")
    (ruleset_dir / "economy.v1.json").write_text(json.dumps(ECONOMY), encoding="utf-8")
    (ruleset_dir / "mobs.v1.json").write_text(json.dumps(MOBS), encoding="utf-8")
    (ruleset_dir / "caps.v1.json").write_text(json.dumps(CAPS), encoding="utf-8")
    return ruleset_dir


def build_app(tmp_path: Path, limiter: RateLimiter | None = None):
    db_path = tmp_path / "db.sqlite3"
    ruleset_dir = write_ruleset(tmp_path)
    app = create_app(db_path=db_path, ruleset_dir=ruleset_dir, rate_limiter=limiter)
    return app


def build_payload(
    run_id: str,
    client_score: int,
    progress: int,
    waves: list[dict],
    gold_spent: int,
    gold_end: int,
    hp_left: int = 10,
    hp_max: int = 10,
):
    return {
        "runId": run_id,
        "playerName": "Tester",
        "progress": progress,
        "clientScore": client_score,
        "hpLeft": hp_left,
        "hpMax": hp_max,
        "economy": {"goldSpentTotal": gold_spent, "goldEnd": gold_end},
        "waves": waves,
        "rulesetVersion": "v1",
    }


def expected_score(progress: int, kills: int, hp_left: int, hp_max: int) -> int:
    hp_score = int(hp_left * SCORING["HP_MAX"] / hp_max)
    return progress * SCORING["STRIDE"] + kills * SCORING["KILL_UNIT"] + hp_score


def test_submit_and_leaderboard(tmp_path: Path):
    app = build_app(tmp_path)
    client = TestClient(app)

    waves = [
        {"wave": 1, "mobs": [{"type": "slime", "isBoss": False, "damageTaken": 10}]},
        {"wave": 2, "mobs": [{"type": "bat", "isBoss": True, "damageTaken": 10}]},
    ]
    payload_1 = build_payload(
        run_id="run-1",
        client_score=2100,
        progress=2,
        waves=waves,
        gold_spent=0,
        gold_end=19,
    )
    resp_1 = client.post("/api/score/submit", json=payload_1)
    assert resp_1.status_code == 200
    body_1 = resp_1.json()
    assert body_1["status"] == "accepted"
    assert body_1["serverScore"] == expected_score(2, 2, 10, 10)

    payload_2 = build_payload(
        run_id="run-2",
        client_score=2300,
        progress=2,
        waves=waves,
        gold_spent=0,
        gold_end=19,
        hp_left=9,
    )
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
    waves = [{"wave": 1, "mobs": [{"type": "slime", "isBoss": False, "damageTaken": 10}]}]
    payload = build_payload(
        run_id="run-3",
        client_score=1200,
        progress=1,
        waves=waves,
        gold_spent=0,
        gold_end=30,
    )
    resp = client.post("/api/score/submit", json=payload)
    assert resp.status_code == 200
    assert resp.json()["reason"] == "ECONOMY_INVALID"


def test_damage_invalid_rejected(tmp_path: Path):
    app = build_app(tmp_path)
    client = TestClient(app)
    waves = [{"wave": 1, "mobs": [{"type": "slime", "isBoss": False, "damageTaken": 100}]}]
    payload = build_payload(
        run_id="run-4",
        client_score=1200,
        progress=1,
        waves=waves,
        gold_spent=0,
        gold_end=13,
    )
    resp = client.post("/api/score/submit", json=payload)
    assert resp.status_code == 200
    assert resp.json()["reason"] == "DAMAGE_INVALID"


def test_not_in_topN_skips_authority(tmp_path: Path):
    app = build_app(tmp_path)
    client = TestClient(app)
    waves = [
        {"wave": 1, "mobs": [{"type": "slime", "isBoss": False, "damageTaken": 10}]},
        {"wave": 2, "mobs": [{"type": "bat", "isBoss": True, "damageTaken": 10}]},
    ]
    payload = build_payload(
        run_id="run-5",
        client_score=2500,
        progress=2,
        waves=waves,
        gold_spent=0,
        gold_end=19,
    )
    resp = client.post("/api/score/submit", json=payload)
    assert resp.status_code == 200

    low_payload = build_payload(
        run_id="run-6",
        client_score=1,
        progress=2,
        waves=waves,
        gold_spent=0,
        gold_end=19,
    )
    resp_low = client.post("/api/score/submit", json=low_payload)
    assert resp_low.status_code == 200
    assert resp_low.json()["status"] == "not_in_topN"


def test_duplicate_run_rejected(tmp_path: Path):
    app = build_app(tmp_path)
    client = TestClient(app)
    waves = [{"wave": 1, "mobs": [{"type": "slime", "isBoss": False, "damageTaken": 10}]}]
    payload = build_payload(
        run_id="run-7",
        client_score=1200,
        progress=1,
        waves=waves,
        gold_spent=0,
        gold_end=13,
    )
    resp_1 = client.post("/api/score/submit", json=payload)
    assert resp_1.status_code == 200
    resp_2 = client.post("/api/score/submit", json=payload)
    assert resp_2.status_code == 409
    assert resp_2.json()["reason"] == "INVALID_PAYLOAD"


def test_rate_limit(tmp_path: Path):
    limiter = RateLimiter(max_requests=2, window_seconds=60)
    app = build_app(tmp_path, limiter=limiter)
    client = TestClient(app)
    headers = {"X-Forwarded-For": "1.2.3.4"}
    waves = [{"wave": 1, "mobs": [{"type": "slime", "isBoss": False, "damageTaken": 10}]}]
    payload = build_payload(
        run_id="run-8",
        client_score=1200,
        progress=1,
        waves=waves,
        gold_spent=0,
        gold_end=13,
    )

    resp_1 = client.post("/api/score/submit", json=payload, headers=headers)
    assert resp_1.status_code == 200
    payload["runId"] = "run-9"
    resp_2 = client.post("/api/score/submit", json=payload, headers=headers)
    assert resp_2.status_code == 200
    payload["runId"] = "run-10"
    resp_3 = client.post("/api/score/submit", json=payload, headers=headers)
    assert resp_3.status_code == 429
    assert resp_3.json()["reason"] == "rate_limited"
