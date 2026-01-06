import test from "node:test";
import assert from "node:assert/strict";
import {
  buildProgress,
  parseProgress,
  formatProgressLabel,
  buildSubmissionPayload,
} from "../src/leaderboard.js";

test("buildProgress validates and formats progress", () => {
  assert.equal(buildProgress(3, 2), "3.2");
  assert.throws(() => buildProgress(0, 1), /invalid_level/);
  assert.throws(() => buildProgress(1, 0), /invalid_wave/);
});

test("parseProgress handles valid and invalid formats", () => {
  assert.deepEqual(parseProgress("4.1"), { level: 4, wave: 1 });
  assert.equal(parseProgress("0.1"), null);
  assert.equal(parseProgress("x.y"), null);
});

test("formatProgressLabel renders readable labels", () => {
  assert.equal(formatProgressLabel("2.3"), "第 2 关 · 第 3 波");
  assert.equal(formatProgressLabel(""), "—");
});

test("buildSubmissionPayload normalizes summary payload", () => {
  const payload = buildSubmissionPayload({
    summary: {
      levelReached: 2,
      waveReached: 1,
      score: 120,
    },
    playerName: "  Alex ",
    submissionId: "abc-123",
  });

  assert.deepEqual(payload, {
    submissionId: "abc-123",
    playerName: "Alex",
    score: 120,
    progress: "2.1",
  });
});
