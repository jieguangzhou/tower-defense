import test from "node:test";
import assert from "node:assert/strict";
import { computeScore, buildSummary } from "../src/game/scoring.js";


test("computeScore uses progress, kills, and hp", () => {
  const score = computeScore({
    progress: 2,
    kills: 5,
    hpLeft: 8,
    hpMax: 10,
  });
  assert.equal(score, 2 * 1_000_000 + 5 * 10 + 7999);

  const negative = computeScore({
    progress: -1,
    kills: 0,
    hpLeft: 0,
    hpMax: 10,
  });
  assert.equal(negative, 0);
});

test("buildSummary normalizes duration and totals", () => {
  const summary = buildSummary({
    seed: 1234,
    progress: 4,
    hpLeft: 7,
    hpMax: 10,
    kills: 12,
    totalDamage: 450.5,
    economy: { goldSpentTotal: 12, goldEnd: 18 },
    waves: [{ wave: 1, mobs: [] }],
    durationMs: 12345.67,
    actionsCount: 22,
  });

  assert.equal(summary.seed, 1234);
  assert.equal(summary.progress, 4);
  assert.equal(summary.durationMs, 12345);
  assert.equal(summary.actionsCount, 22);
  assert.equal(
    summary.score,
    computeScore({
      progress: 4,
      kills: 12,
      hpLeft: 7,
      hpMax: 10,
    })
  );
});
