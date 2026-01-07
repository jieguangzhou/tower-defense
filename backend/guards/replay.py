from __future__ import annotations

import sqlite3


def is_replay(conn: sqlite3.Connection, run_id: str) -> bool:
    row = conn.execute("SELECT 1 FROM score_runs WHERE run_id = ?", (run_id,)).fetchone()
    return row is not None
