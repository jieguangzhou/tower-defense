import { SCORING_RULES } from "../ruleset.js";

export function computeScore({ progress, kills, hpLeft, hpMax }) {
  if (!Number.isFinite(progress) || progress < 0) return 0;
  if (!Number.isFinite(kills) || kills < 0) return 0;
  if (!Number.isFinite(hpLeft) || !Number.isFinite(hpMax) || hpMax <= 0) return 0;
  const hpScore = Math.floor((hpLeft * SCORING_RULES.HP_MAX) / hpMax);
  const total =
    progress * SCORING_RULES.STRIDE + kills * SCORING_RULES.KILL_UNIT + hpScore;
  return Math.max(0, Math.floor(total));
}

export function buildSummary({
  seed,
  progress,
  hpLeft,
  hpMax,
  kills,
  totalDamage,
  economy,
  waves,
  durationMs,
  actionsCount,
}) {
  return {
    seed,
    progress,
    hpLeft,
    hpMax,
    score: computeScore({
      progress,
      kills,
      hpLeft,
      hpMax,
    }),
    kills,
    totalDamage,
    economy,
    waves,
    durationMs: Math.max(0, Math.floor(durationMs)),
    actionsCount,
  };
}
