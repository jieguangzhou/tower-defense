import { GAME_REWARDS } from "./constants.js";

export function computeScore({
  killScore,
  waveScore,
  levelScore,
  hpPenalty,
}) {
  const total = killScore + waveScore + levelScore - Math.max(0, hpPenalty);
  return Math.max(0, Math.floor(total));
}

export function buildSummary({
  seed,
  levelReached,
  waveReached,
  killScore,
  waveScore,
  levelScore,
  hpPenalty,
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
      hpPenalty,
    }),
    killed,
    totalDamage,
    moneyLeft,
    durationMs: Math.max(0, Math.floor(durationMs)),
    actionsCount,
  };
}
