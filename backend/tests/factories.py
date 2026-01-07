from __future__ import annotations

import copy
import random
from typing import Any
from uuid import uuid4

from backend.guards.authority import build_authority_rules
from backend.ruleset_series import round_value


def compute_score(scoring: dict, progress: int, kills: int, hp_left: int, hp_max: int) -> int:
    hp_score = int(hp_left * int(scoring["HP_MAX"]) / hp_max)
    return progress * int(scoring["STRIDE"]) + kills * int(scoring["KILL_UNIT"]) + hp_score


def build_seeded_payload(
    ruleset: dict,
    seed: int,
    progress: int,
    *,
    run_id: str | None = None,
    player_name: str = "Tester",
    hp_left: int = 10,
    hp_max: int = 10,
) -> tuple[dict, dict[str, Any]]:
    rules = build_authority_rules(ruleset)
    rng = random.Random(seed)
    mob_keys = list(rules.mob_defs.keys())
    if not mob_keys:
        raise ValueError("ruleset mobs cannot be empty")

    waves: list[dict] = []
    total_kills = 0
    earned_drops = 0
    for wave_index in range(progress):
        max_mobs = rules.max_mobs_per_wave[wave_index]
        mob_count = rng.randint(1, max(1, max_mobs))
        mobs = []
        for _ in range(mob_count):
            mob_type = rng.choice(mob_keys)
            is_boss = rng.random() < 0.2
            mob_rule = rules.mob_defs[mob_type]
            wave_multiplier = 1 + wave_index * rules.wave_hp_step
            hp = mob_rule["hp"] * wave_multiplier
            drop_gold = mob_rule["dropGold"]
            if is_boss:
                hp *= rules.boss_multiplier
                drop_gold = round_value(drop_gold * rules.boss_multiplier, "half_up")
            hp = round_value(hp, "half_up")
            mobs.append({"type": mob_type, "isBoss": is_boss, "damageTaken": hp})
            total_kills += 1
            earned_drops += int(drop_gold)
        waves.append({"wave": wave_index + 1, "mobs": mobs})

    earned_wave = sum(rules.wave_rewards[:progress])
    earned_total = earned_wave + earned_drops
    payload = {
        "runId": run_id or str(uuid4()),
        "playerName": player_name,
        "progress": progress,
        "clientScore": compute_score(rules.scoring, progress, total_kills, hp_left, hp_max),
        "hpLeft": hp_left,
        "hpMax": hp_max,
        "economy": {"goldSpentTotal": 0, "goldEnd": rules.gold_start + earned_total},
        "waves": waves,
        "rulesetVersion": "v1",
    }
    return payload, {
        "total_kills": total_kills,
        "earned_drops": earned_drops,
        "earned_total": earned_total,
    }


def clone_payload(payload: dict) -> dict:
    return copy.deepcopy(payload)
