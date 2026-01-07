from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Iterable


VALID_ROUND_MODES = {"ceil", "floor", "half_up"}


@dataclass(frozen=True)
class GrowthSeriesConfig:
    base: float
    growth_rate: float
    round_mode: str = "half_up"


def round_value(value: float, mode: str) -> int:
    if mode == "ceil":
        return int(math.ceil(value))
    if mode == "floor":
        return int(math.floor(value))
    if mode == "half_up":
        return int(value + 0.5)
    raise ValueError(f"unknown round mode: {mode}")


def parse_growth_config(raw: dict, label: str) -> GrowthSeriesConfig:
    if not isinstance(raw, dict):
        raise ValueError(f"{label} must be an object")
    base = raw.get("base")
    growth_rate = raw.get("growthRate")
    round_mode = raw.get("round", "half_up")
    if base is None or growth_rate is None:
        raise ValueError(f"{label} requires base and growthRate")
    if not isinstance(round_mode, str) or round_mode not in VALID_ROUND_MODES:
        raise ValueError(f"{label} round must be one of {sorted(VALID_ROUND_MODES)}")
    try:
        base_val = float(base)
        growth_val = float(growth_rate)
    except (TypeError, ValueError):
        raise ValueError(f"{label} base/growthRate must be numbers") from None
    if base_val < 0:
        raise ValueError(f"{label} base must be >= 0")
    if growth_val < 0:
        raise ValueError(f"{label} growthRate must be >= 0")
    return GrowthSeriesConfig(base=base_val, growth_rate=growth_val, round_mode=round_mode)


def resolve_wave_count(economy: dict, caps: dict) -> int:
    econ_count = economy.get("waveCount")
    caps_count = caps.get("waveCount")
    if econ_count is None or caps_count is None:
        raise ValueError("ruleset requires economy.waveCount and caps.waveCount")
    if econ_count != caps_count:
        raise ValueError("ruleset waveCount mismatch between economy and caps")
    try:
        count = int(econ_count)
    except (TypeError, ValueError):
        raise ValueError("ruleset waveCount must be an integer") from None
    if count <= 0:
        raise ValueError("ruleset waveCount must be > 0")
    return count


def generate_series(config: GrowthSeriesConfig, count: int) -> Iterable[int]:
    for index in range(count):
        value = config.base * ((1 + config.growth_rate) ** index)
        yield round_value(value, config.round_mode)


def build_series(raw: dict, count: int, label: str) -> list[int]:
    config = parse_growth_config(raw, label)
    return list(generate_series(config, count))
