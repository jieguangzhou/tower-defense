from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from backend.ruleset_series import build_series, resolve_wave_count, round_value


DAMAGE_OVERFLOW_MAX = 999


@dataclass(frozen=True)
class AuthorityRules:
    wave_count: int
    wave_rewards: list[int]
    max_mobs_per_wave: list[int]
    max_damage_per_wave: list[int]
    max_spike_ratio: float
    mob_defs: dict
    boss_multiplier: float
    wave_hp_step: float
    gold_start: int
    gold_tolerance: int
    scoring: dict
    max_client_score: int


@dataclass(frozen=True)
class AuthorityResult:
    ok: bool
    reason: str
    http_status: int = 200
    detail: dict[str, Any] | None = None
    total_kills: int = 0
    earned_drops: int = 0
    earned_total: int = 0


def build_authority_rules(ruleset: dict) -> AuthorityRules:
    scoring = ruleset["scoring"]
    economy = ruleset["economy"]
    caps = ruleset["caps"]
    mobs_rules = ruleset["mobs"]
    wave_count = resolve_wave_count(economy, caps)

    wave_rewards = build_series(economy.get("waveReward", {}), wave_count, "economy.waveReward")
    max_mobs_per_wave = build_series(caps.get("maxMobsPerWave", {}), wave_count, "caps.maxMobsPerWave")
    max_damage_per_wave = build_series(
        caps.get("maxDamagePerWave", {}), wave_count, "caps.maxDamagePerWave"
    )

    max_kills = sum(max_mobs_per_wave)
    max_client_score = (
        wave_count * int(scoring["STRIDE"]) + max_kills * int(scoring["KILL_UNIT"]) + int(scoring["HP_MAX"])
    )

    return AuthorityRules(
        wave_count=wave_count,
        wave_rewards=wave_rewards,
        max_mobs_per_wave=max_mobs_per_wave,
        max_damage_per_wave=max_damage_per_wave,
        max_spike_ratio=float(caps.get("maxSpikeRatio", 0)),
        mob_defs=mobs_rules.get("mobs", {}),
        boss_multiplier=float(mobs_rules.get("bossMultiplier", 1)),
        wave_hp_step=float(mobs_rules.get("waveHpStep", 0)),
        gold_start=int(economy.get("goldStart", 0)),
        gold_tolerance=int(economy.get("goldTolerance", 0)),
        scoring=scoring,
        max_client_score=max_client_score,
    )


def _failure(reason: str, http_status: int = 200, **detail: Any) -> AuthorityResult:
    return AuthorityResult(ok=False, reason=reason, http_status=http_status, detail=detail or None)


def validate_precheck(payload: Any, rules: AuthorityRules) -> AuthorityResult | None:
    if payload.rulesetVersion != "v1":
        return _failure("INVALID_PAYLOAD", http_status=400, ruleset=payload.rulesetVersion)
    if payload.progress > rules.wave_count:
        return _failure("INVALID_PAYLOAD", http_status=400, progress=payload.progress, maxWaves=rules.wave_count)
    if payload.hpLeft > payload.hpMax:
        return _failure(
            "INVALID_PAYLOAD",
            http_status=400,
            hpLeft=payload.hpLeft,
            hpMax=payload.hpMax,
        )
    if payload.hpMax > int(rules.scoring["HP_MAX"]):
        return _failure(
            "INVALID_PAYLOAD",
            http_status=400,
            hpMax=payload.hpMax,
            maxHp=rules.scoring["HP_MAX"],
        )
    if len(payload.waves) < payload.progress:
        return _failure(
            "INVALID_PAYLOAD",
            http_status=400,
            progress=payload.progress,
            waves=len(payload.waves),
        )
    if len(payload.waves) > rules.wave_count:
        return _failure(
            "INVALID_PAYLOAD",
            http_status=400,
            progress=payload.progress,
            waves=len(payload.waves),
        )
    if len(payload.waves) > payload.progress:
        if payload.hpLeft != 0 or len(payload.waves) != payload.progress + 1:
            return _failure(
                "INVALID_PAYLOAD",
                http_status=400,
                progress=payload.progress,
                waves=len(payload.waves),
            )
    if payload.clientScore > rules.max_client_score:
        return _failure(
            "INVALID_PAYLOAD",
            http_status=400,
            clientScore=payload.clientScore,
            maxClientScore=rules.max_client_score,
        )
    return None


def validate_authority(payload: Any, rules: AuthorityRules) -> AuthorityResult:
    total_kills = 0
    earned_drops = 0
    # On defeat we accept one extra (partial) wave payload; precheck guarantees hpLeft == 0 in that case.
    waves_to_process = len(payload.waves)
    for index in range(waves_to_process):
        wave_payload = payload.waves[index]
        expected_wave = index + 1
        if wave_payload.wave != expected_wave:
            return _failure(
                "INVALID_PAYLOAD",
                expectedWave=expected_wave,
                gotWave=wave_payload.wave,
            )
        mobs_list = wave_payload.mobs
        if len(mobs_list) > rules.max_mobs_per_wave[index]:
            return _failure(
                "MOB_INVALID",
                wave=expected_wave,
                count=len(mobs_list),
                cap=rules.max_mobs_per_wave[index],
            )

        # Allow small numeric drift by letting damageTaken exceed hp by a fixed overflow window.
        wave_multiplier = 1 + index * rules.wave_hp_step
        for mob in mobs_list:
            mob_rule = rules.mob_defs.get(mob.type)
            if not mob_rule:
                return _failure("MOB_INVALID", mob=mob.type)
            hp = mob_rule["hp"] * wave_multiplier
            drop_gold = mob_rule["dropGold"]
            if mob.isBoss:
                hp *= rules.boss_multiplier
                drop_gold = round_value(drop_gold * rules.boss_multiplier, "half_up")
            hp = round_value(hp, "half_up")
            damage_cap = hp + DAMAGE_OVERFLOW_MAX
            if mob.damageTaken > damage_cap:
                return _failure(
                    "DAMAGE_INVALID",
                    wave=expected_wave,
                    mob=mob.type,
                    damage=mob.damageTaken,
                    cap=damage_cap,
                )
            if mob.damageTaken >= hp:
                total_kills += 1
                earned_drops += int(drop_gold)

    # Wave rewards only count for fully completed waves (progress), keeping defeat rewards conservative.
    earned_wave = sum(rules.wave_rewards[: payload.progress])
    earned_total = earned_wave + earned_drops
    expected_end = rules.gold_start + earned_total - payload.economy.goldSpentTotal
    # gold_tolerance is the explicit drift budget for client-side rounding discrepancies.
    if abs(payload.economy.goldEnd - expected_end) > rules.gold_tolerance:
        return _failure(
            "ECONOMY_INVALID",
            goldEnd=payload.economy.goldEnd,
            expected=expected_end,
            spent=payload.economy.goldSpentTotal,
            earned=earned_total,
        )

    return AuthorityResult(
        ok=True,
        reason="NONE",
        total_kills=total_kills,
        earned_drops=earned_drops,
        earned_total=earned_total,
    )
