import { RULESET_VERSION } from "./ruleset.js";

export function parseProgress(progress) {
  if (typeof progress === "number") {
    if (!Number.isInteger(progress) || progress < 0) return null;
    return progress;
  }
  if (typeof progress === "string") {
    if (progress.trim() === "") return null;
    const parsed = Number(progress);
    if (!Number.isInteger(parsed) || parsed < 0) return null;
    return parsed;
  }
  return null;
}

export function formatProgressLabel(progress) {
  const parsed = parseProgress(progress);
  if (parsed == null) {
    return progress ? `进度 ${progress}` : "—";
  }
  if (parsed === 0) return "未通关";
  return `第 ${parsed} 波`;
}

export function buildSubmissionPayload({ summary, playerName, runId }) {
  if (!summary) {
    throw new Error("summary_required");
  }
  if (!runId) {
    throw new Error("run_id_required");
  }
  const progress = parseProgress(summary.progress);
  if (progress == null) {
    throw new Error("invalid_progress");
  }
  const score = Number(summary.score);
  if (!Number.isFinite(score) || score < 0) {
    throw new Error("invalid_score");
  }
  if (!summary.economy || !summary.waves) {
    throw new Error("invalid_summary");
  }
  return {
    runId,
    playerName: (playerName ?? "").trim(),
    progress,
    clientScore: Math.floor(score),
    hpLeft: summary.hpLeft,
    hpMax: summary.hpMax,
    economy: summary.economy,
    waves: summary.waves,
    rulesetVersion: RULESET_VERSION,
  };
}
