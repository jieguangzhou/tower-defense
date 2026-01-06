from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient

from backend.app import RateLimiter, create_app


def build_caps(tmp_path: Path, max_score: int = 200) -> Path:
    caps_path = tmp_path / "caps.json"
    caps_path.write_text(json.dumps({"maxScore": {"1": max_score}}), encoding="utf-8")
    return caps_path


def build_app(tmp_path: Path, max_score: int = 200, limiter: RateLimiter | None = None):
    db_path = tmp_path / "db.sqlite3"
    caps_path = build_caps(tmp_path, max_score=max_score)
    app = create_app(db_path=db_path, caps_path=caps_path, rate_limiter=limiter)
    return app


def test_submit_and_leaderboard(tmp_path: Path):
    app = build_app(tmp_path, max_score=500)
    client = TestClient(app)

    payload_1 = {
        "submissionId": "sub-1",
        "playerName": "Ada",
        "score": 120,
        "progress": "1.1",
    }
    payload_2 = {
        "submissionId": "sub-2",
        "playerName": "Lin",
        "score": 220,
        "progress": "1.2",
    }

    resp_1 = client.post("/api/score/submit", json=payload_1)
    assert resp_1.status_code == 200
    assert resp_1.json()["status"] == "accepted"

    resp_2 = client.post("/api/score/submit", json=payload_2)
    assert resp_2.status_code == 200
    assert resp_2.json()["status"] == "accepted"

    leaderboard = client.get("/api/leaderboard?limit=1")
    assert leaderboard.status_code == 200
    items = leaderboard.json()["items"]
    assert len(items) == 1
    assert items[0]["playerName"] == "Lin"
    assert items[0]["score"] == 220


def test_validation_rejects_high_score(tmp_path: Path):
    app = build_app(tmp_path, max_score=50)
    client = TestClient(app)
    payload = {
        "submissionId": "sub-3",
        "playerName": "Nope",
        "score": 80,
        "progress": "1.1",
    }
    resp = client.post("/api/score/submit", json=payload)
    assert resp.status_code == 400
    assert resp.json()["detail"] == "score_too_high"


def test_replay_rejected(tmp_path: Path):
    app = build_app(tmp_path, max_score=200)
    client = TestClient(app)
    payload = {
        "submissionId": "sub-4",
        "playerName": "Repeat",
        "score": 40,
        "progress": "1.1",
    }
    resp_1 = client.post("/api/score/submit", json=payload)
    assert resp_1.status_code == 200
    resp_2 = client.post("/api/score/submit", json=payload)
    assert resp_2.status_code == 409
    body = resp_2.json()
    assert body["status"] == "rejected"
    assert body["reason"] == "duplicate_submission"


def test_rate_limit(tmp_path: Path):
    limiter = RateLimiter(max_requests=2, window_seconds=60)
    app = build_app(tmp_path, max_score=200, limiter=limiter)
    client = TestClient(app)
    headers = {"X-Forwarded-For": "1.2.3.4"}
    payload = {
        "submissionId": "sub-5",
        "playerName": "Fast",
        "score": 30,
        "progress": "1.1",
    }

    resp_1 = client.post("/api/score/submit", json=payload, headers=headers)
    assert resp_1.status_code == 200
    payload["submissionId"] = "sub-6"
    resp_2 = client.post("/api/score/submit", json=payload, headers=headers)
    assert resp_2.status_code == 200
    payload["submissionId"] = "sub-7"
    resp_3 = client.post("/api/score/submit", json=payload, headers=headers)
    assert resp_3.status_code == 429
    assert resp_3.json()["reason"] == "rate_limited"


def test_invalid_progress_rejected(tmp_path: Path):
    app = build_app(tmp_path, max_score=200)
    client = TestClient(app)
    payload = {
        "submissionId": "sub-8",
        "playerName": "Oops",
        "score": 10,
        "progress": "bad",
    }
    resp = client.post("/api/score/submit", json=payload)
    assert resp.status_code == 400
    assert resp.json()["detail"] == "invalid_progress"
