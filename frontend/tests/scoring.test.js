import test from "node:test";
import assert from "node:assert/strict";
import { computeScore, buildSummary } from "../src/game/scoring.js";


test("computeScore applies hp penalty and clamps at zero", () => {
  const score = computeScore({
    killScore: 120,
    waveScore: 45,
    levelScore: 40,
    hpPenalty: 3,
  });
  assert.equal(score, 120 + 45 + 40 - 3);

  const negative = computeScore({
    killScore: 0,
    waveScore: 0,
    levelScore: 0,
    hpPenalty: 20,
  });
  assert.equal(negative, 0);
});

test("buildSummary normalizes duration and totals", () => {
  const summary = buildSummary({
    seed: 1234,
    levelReached: 3,
    waveReached: 2,
    killScore: 90,
    waveScore: 30,
    levelScore: 40,
    hpPenalty: 2,
    killed: 12,
    totalDamage: 450.5,
    moneyLeft: 18,
    durationMs: 12345.67,
    actionsCount: 22,
  });

  assert.equal(summary.seed, 1234);
  assert.equal(summary.levelReached, 3);
  assert.equal(summary.waveReached, 2);
  assert.equal(summary.durationMs, 12345);
  assert.equal(summary.actionsCount, 22);
  assert.equal(
    summary.score,
    computeScore({
      killScore: 90,
      waveScore: 30,
      levelScore: 40,
      hpPenalty: 2,
    })
  );
});
