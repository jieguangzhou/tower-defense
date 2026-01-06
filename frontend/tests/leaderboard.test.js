import test from "node:test";
import assert from "node:assert/strict";
import {
  parseProgress,
  formatProgressLabel,
  buildSubmissionPayload,
} from "../src/leaderboard.js";

test("parseProgress handles valid and invalid formats", () => {
  assert.equal(parseProgress("4"), 4);
  assert.equal(parseProgress(3), 3);
  assert.equal(parseProgress(-1), null);
  assert.equal(parseProgress("x.y"), null);
});

test("formatProgressLabel renders readable labels", () => {
  assert.equal(formatProgressLabel(5), "第 5 波");
  assert.equal(formatProgressLabel(""), "—");
});

test("buildSubmissionPayload normalizes summary payload", () => {
  const payload = buildSubmissionPayload({
    summary: {
      progress: 3,
      score: 120,
      hpLeft: 6,
      hpMax: 10,
      economy: { goldSpentTotal: 5, goldEnd: 12 },
      waves: [{ wave: 1, mobs: [] }],
    },
    playerName: "  Alex ",
    runId: "run-123",
  });

  assert.deepEqual(payload, {
    runId: "run-123",
    playerName: "Alex",
    progress: 3,
    clientScore: 120,
    hpLeft: 6,
    hpMax: 10,
    economy: { goldSpentTotal: 5, goldEnd: 12 },
    waves: [{ wave: 1, mobs: [] }],
    rulesetVersion: "v1",
  });
});
