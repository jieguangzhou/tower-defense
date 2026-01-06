import { GAME_REWARDS } from "./constants.js";

export function computeScore({
  killScore,
  waveScore,
  levelScore,
  leakPenalty,
  moneyLeft,
}) {
  const economyBonus = Math.floor(moneyLeft / GAME_REWARDS.economyDivisor);
  const total =
    killScore + waveScore + levelScore + economyBonus - leakPenalty;
  return Math.max(0, Math.floor(total));
}

export function buildSummary({
  seed,
  levelReached,
  waveReached,
  killScore,
  waveScore,
  levelScore,
  leakPenalty,
  killed,
  totalDamage,
  moneyLeft,
  durationMs,
  actionsCount,
}) {
  return {
    seed,
    levelReached,
    waveReached,
    score: computeScore({
      killScore,
      waveScore,
      levelScore,
      leakPenalty,
      moneyLeft,
    }),
    killed,
    totalDamage,
    moneyLeft,
    durationMs: Math.max(0, Math.floor(durationMs)),
    actionsCount,
  };
}
