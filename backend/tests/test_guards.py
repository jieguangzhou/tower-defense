from __future__ import annotations

import sqlite3

from backend.app import SubmitPayload
from backend.guards.authority import build_authority_rules, validate_authority, validate_precheck
from backend.guards.leaderboard import should_skip_authority
from backend.guards.replay import is_replay
from backend.tests.factories import build_seeded_payload, clone_payload


SCORING = {"STRIDE": 100, "KILL_UNIT": 5, "HP_MAX": 50}
ECONOMY = {
    "goldStart": 5,
    "goldTolerance": 2,
    "waveCount": 3,
    "waveReward": {"base": 2, "growthRate": 0.2, "round": "half_up"},
}
MOBS = {
    "bossMultiplier": 2.0,
    "waveHpStep": 0.05,
    "mobs": {
        "slime": {"hp": 8, "dropGold": 1},
        "bat": {"hp": 6, "dropGold": 2},
    },
}
CAPS = {
    "waveCount": 3,
    "maxMobsPerWave": {"base": 2, "growthRate": 0.3, "round": "ceil"},
    "maxDamagePerWave": {"base": 40, "growthRate": 0.1, "round": "ceil"},
    "maxSpikeRatio": 3.0,
    "mobOverflowMax": 10,
    "damageOverflowMax": 999,
}


def make_ruleset() -> dict:
    return {"scoring": SCORING, "economy": ECONOMY, "mobs": MOBS, "caps": CAPS}


def test_authority_validation_success_and_failure():
    ruleset = make_ruleset()
    rules = build_authority_rules(ruleset)
    payload_dict, _ = build_seeded_payload(ruleset, seed=7, progress=2)
    payload = SubmitPayload(**payload_dict)

    assert validate_precheck(payload, rules) is None
    result = validate_authority(payload, rules)
    assert result.ok is True

    bad_payload = clone_payload(payload_dict)
    bad_payload["economy"]["goldEnd"] += ECONOMY["goldTolerance"] + 1
    bad_result = validate_authority(SubmitPayload(**bad_payload), rules)
    assert bad_result.ok is False
    assert bad_result.reason == "ECONOMY_INVALID"


def test_precheck_rejects_invalid_progress():
    ruleset = make_ruleset()
    rules = build_authority_rules(ruleset)
    payload_dict, _ = build_seeded_payload(ruleset, seed=9, progress=1)
    payload_dict["progress"] = rules.wave_count + 1
    payload = SubmitPayload(**payload_dict)

    result = validate_precheck(payload, rules)
    assert result is not None
    assert result.reason == "INVALID_PAYLOAD"
    assert result.http_status == 400


def test_replay_guard_detects_duplicate_run():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("CREATE TABLE score_runs (run_id TEXT PRIMARY KEY)")
    conn.execute("INSERT INTO score_runs (run_id) VALUES (?)", ("run-1",))
    conn.commit()

    assert is_replay(conn, "run-1") is True
    assert is_replay(conn, "run-2") is False


def test_leaderboard_guard_skips_low_scores():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute(
        "CREATE TABLE score_runs (run_id TEXT PRIMARY KEY, server_score INTEGER, created_at TEXT)"
    )
    conn.executemany(
        "INSERT INTO score_runs (run_id, server_score, created_at) VALUES (?, ?, ?)",
        [("run-1", 2000, "2024-01-01"), ("run-2", 1500, "2024-01-02")],
    )
    conn.commit()

    result = should_skip_authority(conn, client_score=100, limit=3, margin=0.02)
    assert result.skip is True
    assert result.min_score == 1500
