const PROGRESS_RE = /^(\d+)\.(\d+)$/;

export function buildProgress(level, wave) {
  if (!Number.isInteger(level) || level <= 0) {
    throw new Error("invalid_level");
  }
  if (!Number.isInteger(wave) || wave <= 0) {
    throw new Error("invalid_wave");
  }
  return `${level}.${wave}`;
}

export function parseProgress(progress) {
  if (typeof progress !== "string") return null;
  const match = PROGRESS_RE.exec(progress);
  if (!match) return null;
  const level = Number(match[1]);
  const wave = Number(match[2]);
  if (!Number.isInteger(level) || !Number.isInteger(wave)) return null;
  if (level <= 0 || wave <= 0) return null;
  return { level, wave };
}

export function formatProgressLabel(progress) {
  const parsed = parseProgress(progress);
  if (!parsed) {
    return progress ? `进度 ${progress}` : "—";
  }
  return `第 ${parsed.level} 关 · 第 ${parsed.wave} 波`;
}

export function buildSubmissionPayload({ summary, playerName, submissionId }) {
  if (!summary) {
    throw new Error("summary_required");
  }
  if (!submissionId) {
    throw new Error("submission_id_required");
  }
  const score = Number(summary.score);
  if (!Number.isFinite(score) || score < 0) {
    throw new Error("invalid_score");
  }
  const progress = buildProgress(summary.levelReached, summary.waveReached);
  return {
    submissionId,
    playerName: (playerName ?? "").trim(),
    score: Math.floor(score),
    progress,
  };
}
