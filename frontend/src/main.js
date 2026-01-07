import { GRID, TOWERS, WAVES } from "./game/constants.js";
import { createGame } from "./game/game.js";
import { computeScore } from "./game/scoring.js";
import {
  buildSubmissionPayload,
  formatProgressLabel,
} from "./leaderboard.js";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const seedDisplay = document.getElementById("seedDisplay");
const phaseDisplay = document.getElementById("phaseDisplay");
const messageEl = document.getElementById("message");

const startBtn = document.getElementById("startBtn");
const resetBtn = document.getElementById("resetBtn");
const selectedInfo = document.getElementById("selectedInfo");
const towerActions = document.getElementById("towerActions");
const upgradeBtn = document.getElementById("upgradeBtn");
const sellBtn = document.getElementById("sellBtn");
const towerCards = Array.from(document.querySelectorAll(".tower-card"));

const hpValue = document.getElementById("hpValue");
const moneyValue = document.getElementById("moneyValue");
const scoreValue = document.getElementById("scoreValue");
const levelValue = document.getElementById("levelValue");
const waveValue = document.getElementById("waveValue");
const timeValue = document.getElementById("timeValue");
const waveInfo = document.getElementById("waveInfo");

const leaderboardBtn = document.getElementById("leaderboardBtn");
const leaderboardModal = document.getElementById("leaderboardModal");
const leaderboardList = document.getElementById("leaderboardList");
const leaderboardStatus = document.getElementById("leaderboardStatus");
const leaderboardRefreshBtn = document.getElementById("leaderboardRefreshBtn");

const submitModal = document.getElementById("submitModal");
const submitOutcome = document.getElementById("submitOutcome");
const submitScoreValue = document.getElementById("submitScoreValue");
const submitProgressValue = document.getElementById("submitProgressValue");
const submitTimeValue = document.getElementById("submitTimeValue");
const playerNameInput = document.getElementById("playerNameInput");
const submitScoreBtn = document.getElementById("submitScoreBtn");
const submitStatus = document.getElementById("submitStatus");

const API_BASE = (() => {
  const config = window.__APP_CONFIG__;
  if (!config || typeof config.apiBaseUrl !== "string") return "";
  return config.apiBaseUrl.replace(/\/+$/, "");
})();

let cellSize = 40;
let animationFrame = null;
let lastTime = null;
let messageTimeout = null;
let currentSeed = "";
let runState = null;

const game = createGame({
  onLog(message, detail) {
    console.info("[game]", message, detail ?? "");
  },
  onMessage(text) {
    showMessage(text);
  },
});

function showMessage(text) {
  if (!text) return;
  messageEl.textContent = text;
  messageEl.classList.add("show");
  if (messageTimeout) window.clearTimeout(messageTimeout);
  messageTimeout = window.setTimeout(() => {
    messageEl.classList.remove("show");
  }, 1800);
}

function randomSeed() {
  return `${Math.floor(Math.random() * 1_000_000)}`;
}

function createRunState(seed) {
  return {
    runId: crypto.randomUUID(),
    seed,
    ended: false,
    submitted: false,
    inFlight: false,
  };
}

function formatDuration(ms) {
  if (!Number.isFinite(ms)) return "—";
  const seconds = ms / 1000;
  return `${seconds.toFixed(1)}s`;
}

function setStatus(element, message, variant) {
  if (!element) return;
  element.textContent = message;
  element.classList.remove("success", "error");
  if (variant) {
    element.classList.add(variant);
  }
}

function setModalOpen(modal, open) {
  if (!modal) return;
  modal.classList.toggle("show", open);
  modal.setAttribute("aria-hidden", open ? "false" : "true");
}

function resetSubmitUi() {
  submitOutcome.textContent = "—";
  submitScoreValue.textContent = "0";
  submitProgressValue.textContent = "—";
  submitTimeValue.textContent = "—";
  submitScoreBtn.disabled = false;
  setStatus(submitStatus, "");
}

function updateSubmitSummary(state) {
  const summary = state.summary;
  if (!summary) return;
  submitScoreValue.textContent = `${summary.score}`;
  submitProgressValue.textContent = formatProgressLabel(summary.progress);
  submitTimeValue.textContent = formatDuration(summary.durationMs);
  const outcome = state.player.hp > 0 ? "胜利" : "失败";
  submitOutcome.textContent = `对局${outcome} · 可提交成绩`;
}

function prepareSubmission(state) {
  if (!runState || runState.ended) return;
  runState.ended = true;
  runState.submitted = false;
  runState.inFlight = false;
  updateSubmitSummary(state);
  setStatus(submitStatus, "");
  submitScoreBtn.disabled = false;
  setModalOpen(submitModal, true);
}

function resetGame(newSeed) {
  currentSeed = newSeed ?? currentSeed ?? randomSeed();
  game.reset(currentSeed);
  game.setHoverCell(null);
  runState = createRunState(currentSeed);
  resetSubmitUi();
  setModalOpen(submitModal, false);
  render();
}

function resizeCanvas() {
  const shell = canvas.parentElement;
  const styles = window.getComputedStyle(shell);
  const paddingX =
    parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
  const width = Math.max(0, shell.clientWidth - paddingX);
  const height = Math.round(width * (GRID.height / GRID.width));
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.floor(width * scale);
  canvas.height = Math.floor(height * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  cellSize = width / GRID.width;
}

function renderWaveInfo(state) {
  if (state.phase === "ended") {
    waveInfo.textContent = "对局结束";
    return;
  }
  const { level, wave } = game.getLevelWave(state.wave.index);
  const definition = WAVES[level - 1]?.[wave - 1];
  if (!definition) {
    waveInfo.textContent = "等待开始";
    return;
  }
  const total = definition.reduce((sum, entry) => sum + entry.count, 0);
  const remaining = state.wave.spawnQueue.length;
  const alive = state.monsters.length;
  if (state.wave.state === "intermission") {
    waveInfo.textContent = `第 ${level} 关 · 第 ${wave} 波结束，下一波准备中`;
    return;
  }
  waveInfo.textContent = `第 ${level} 关 · 第 ${wave} 波 · 已刷 ${
    total - remaining
  }/${total} · 场上 ${alive}`;
}

function renderSelection(state) {
  const tower = state.towers.find((item) => item.id === state.selection.towerId);
  if (!tower) {
    selectedInfo.textContent = "未选中塔 · 点击塔后可升级/卖塔";
    towerActions.classList.add("hidden");
    upgradeBtn.disabled = true;
    upgradeBtn.textContent = "升级";
    sellBtn.disabled = true;
    sellBtn.textContent = "卖塔";
    return;
  }
  towerActions.classList.remove("hidden");
  const canUpgrade = tower.level < 3;
  const upgradeCost = tower.baseCost * 2;
  const invested =
    tower.baseCost + (tower.level - 1) * upgradeCost;
  const refund = Math.floor(invested * 0.5);
  upgradeBtn.disabled = !canUpgrade;
  upgradeBtn.textContent = canUpgrade ? `升级 (${upgradeCost})` : "满级";
  sellBtn.disabled = false;
  sellBtn.textContent = `卖塔 (+${refund})`;
  const details = [`${tower.emoji} ${tower.type} · Lv.${tower.level}`];
  details.push(`伤害 ${tower.damage.toFixed(1)} / 攻速 ${tower.attackSpeed}`);
  details.push(`射程 ${tower.range.toFixed(1)}`);
  if (tower.type === "ice") {
    details.push(`减速 ${(tower.slowPct * 100).toFixed(0)}% / ${tower.slowDuration}s`);
  }
  if (tower.type === "bomb") {
    details.push(`爆炸半径 ${tower.splashRadius.toFixed(1)}`);
  }
  selectedInfo.textContent = details.join(" · ");
}

function renderTowerSelection(state) {
  const type = game.buildOrder[state.selection.buildIndex % game.buildOrder.length];
  towerCards.forEach((card) => {
    card.classList.toggle("active", card.dataset.tower === type);
  });
}

function updateStats() {
  const state = game.getState();
  if (!state) return;
  const { level, wave } = game.getLevelWave(state.wave.index);
  const minutes = state.stats.elapsedMs / 1000;

  seedDisplay.textContent = state.seed;
  phaseDisplay.textContent =
    state.phase === "running"
      ? "进行中"
      : state.phase === "ended"
        ? "结束"
        : "待机";

  const runningScore = computeScore({
    progress: state.waves?.length ?? 0,
    kills: state.stats.killed,
    hpLeft: state.player.hp,
    hpMax: state.player.hpMax,
  });

  hpValue.textContent = `${state.player.hp}`;
  moneyValue.textContent = `${state.player.money}`;
  scoreValue.textContent = `${state.summary?.score ?? runningScore}`;
  levelValue.textContent = `${level}`;
  waveValue.textContent = `${wave}`;
  timeValue.textContent = `${minutes.toFixed(1)}s`;

  renderWaveInfo(state);
  renderSelection(state);
  renderTowerSelection(state);
  maybeHandleEndgame(state);

}

function maybeHandleEndgame(state) {
  if (!state || state.phase !== "ended" || !state.summary) return;
  if (runState?.ended) return;
  prepareSubmission(state);
}

function renderLeaderboard(items) {
  leaderboardList.textContent = "";
  if (!items || items.length === 0) {
    setStatus(leaderboardStatus, "暂无排行榜数据");
    return;
  }
  setStatus(leaderboardStatus, "");
  items.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "leaderboard-row";

    const rank = document.createElement("span");
    rank.className = "leaderboard-rank";
    rank.textContent = `#${index + 1}`;

    const main = document.createElement("div");
    main.className = "leaderboard-main";
    const name = document.createElement("strong");
    name.textContent = item.playerName?.trim() || "匿名玩家";
    const meta = document.createElement("small");
    const created = item.createdAt ? new Date(item.createdAt) : null;
    const createdLabel =
      created && !Number.isNaN(created.getTime())
        ? created.toLocaleString()
        : "未知时间";
    meta.textContent = `${formatProgressLabel(item.progress)} · ${createdLabel}`;
    main.append(name, meta);

    const score = document.createElement("div");
    score.className = "leaderboard-score";
    score.textContent = `${item.score ?? 0}`;

    row.append(rank, main, score);
    leaderboardList.append(row);
  });
}

async function loadLeaderboard() {
  setStatus(leaderboardStatus, "加载中...");
  leaderboardList.textContent = "";
  console.info("[leaderboard] fetch start");
  try {
    const response = await fetch(`${API_BASE}/api/leaderboard?limit=20`);
    const data = await response.json();
    if (!response.ok) {
      console.warn("[leaderboard] fetch failed", response.status, data);
      setStatus(leaderboardStatus, "排行榜加载失败，请稍后再试", "error");
      return;
    }
    console.info("[leaderboard] fetch success", { count: data.items?.length ?? 0 });
    renderLeaderboard(data.items);
  } catch (error) {
    console.error("[leaderboard] fetch error", error);
    setStatus(leaderboardStatus, "排行榜加载失败，请检查网络", "error");
  }
}

function mapSubmitFailure(reason, status) {
  if (reason === "rate_limited") {
    return "提交过于频繁，请稍后再试";
  }
  if (reason === "ECONOMY_INVALID") {
    return "金币结算异常，请重新开局后再试";
  }
  if (reason === "DAMAGE_INVALID") {
    return "伤害数据异常，请重新开局后再试";
  }
  if (reason === "already_submitted") {
    return "本局成绩已提交";
  }
  if (reason === "MOB_INVALID") {
    return "怪物数据异常，请重新开局后再试";
  }
  if (reason === "INVALID_PAYLOAD") {
    return "提交数据异常，请重新开局后再试";
  }
  if (status) {
    return `提交失败（${status}）`;
  }
  return "提交失败，请稍后再试";
}

async function submitScore() {
  const state = game.getState();
  if (!state?.summary) {
    setStatus(submitStatus, "当前没有可提交的成绩", "error");
    return;
  }
  if (!runState?.runId) {
    setStatus(submitStatus, "提交编号缺失，请重新开始对局", "error");
    return;
  }
  if (runState.submitted) {
    setStatus(submitStatus, "本局成绩已提交", "success");
    return;
  }
  if (runState.inFlight) return;

  let payload;
  try {
    payload = buildSubmissionPayload({
      summary: state.summary,
      playerName: playerNameInput.value,
      runId: runState.runId,
    });
  } catch (error) {
    console.warn("[leaderboard] invalid submission payload", error);
    setStatus(submitStatus, "成绩数据异常，请重试", "error");
    return;
  }

  runState.inFlight = true;
  submitScoreBtn.disabled = true;
  setStatus(submitStatus, "提交中...");
  console.info("[leaderboard] submit start", {
    score: payload.clientScore,
    progress: payload.progress,
  });

  try {
    const response = await fetch(`${API_BASE}/api/score/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const reason = data.reason ?? data.detail;
      const message = mapSubmitFailure(reason, response.status);
      console.warn("[leaderboard] submit rejected", { reason, status: response.status });
      setStatus(submitStatus, message, "error");
      submitScoreBtn.disabled = false;
      return;
    }

    if (data.status === "accepted") {
      runState.submitted = true;
      if (Number.isFinite(data.serverScore)) {
        submitScoreValue.textContent = `${data.serverScore}`;
      }
      console.info("[leaderboard] submit accepted", {
        serverScore: data.serverScore,
        totalKills: data.totalKills,
      });
      setStatus(submitStatus, "提交成功，已写入排行榜", "success");
      submitScoreBtn.disabled = true;
      return;
    }

    if (data.status === "not_in_topN") {
      runState.submitted = true;
      console.info("[leaderboard] submit skipped (not_in_topN)");
      setStatus(submitStatus, "当前分数未进入排行榜门槛", "success");
      submitScoreBtn.disabled = true;
      return;
    }

    const reason = data.reason ?? "UNKNOWN";
    const message = mapSubmitFailure(reason, response.status);
    console.warn("[leaderboard] submit rejected", { reason, status: response.status });
    setStatus(submitStatus, message, "error");
    if (reason === "already_submitted") {
      runState.submitted = true;
      submitScoreBtn.disabled = true;
    }
  } catch (error) {
    console.error("[leaderboard] submit error", error);
    setStatus(submitStatus, "提交失败，请检查网络后重试", "error");
  } finally {
    runState.inFlight = false;
    if (!runState.submitted) {
      submitScoreBtn.disabled = false;
    }
  }
}

function render() {
  resizeCanvas();
  game.render(ctx, cellSize);
  updateStats();
}

function tick(time) {
  if (!lastTime) lastTime = time;
  const dt = Math.min(0.05, (time - lastTime) / 1000);
  lastTime = time;
  const state = game.getState();
  if (state?.phase === "running") {
    game.update(dt);
  }
  render();
  animationFrame = requestAnimationFrame(tick);
}

function startLoop() {
  if (animationFrame) return;
  animationFrame = requestAnimationFrame(tick);
}

function stopLoop() {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = null;
  lastTime = null;
}

startBtn.addEventListener("click", () => {
  const state = game.getState();
  if (state.phase === "ended") {
    resetGame(currentSeed);
  }
  game.startRun();
  startLoop();
});

leaderboardBtn.addEventListener("click", () => {
  setModalOpen(leaderboardModal, true);
  loadLeaderboard();
});

leaderboardRefreshBtn.addEventListener("click", () => {
  loadLeaderboard();
});

resetBtn.addEventListener("click", () => {
  resetGame(randomSeed());
});

upgradeBtn.addEventListener("click", () => {
  game.upgradeSelected();
  render();
});

sellBtn.addEventListener("click", () => {
  game.sellSelected();
  render();
});

submitScoreBtn.addEventListener("click", () => {
  submitScore();
});

document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.close;
    const modal = document.getElementById(target);
    setModalOpen(modal, false);
  });
});

[submitModal, leaderboardModal].forEach((modal) => {
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      setModalOpen(modal, false);
    }
  });
});

canvas.addEventListener("click", (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  const cell = {
    x: Math.floor(x * GRID.width),
    y: Math.floor(y * GRID.height),
  };
  if (cell.x < 0 || cell.y < 0 || cell.x >= GRID.width || cell.y >= GRID.height) {
    return;
  }
  game.handleCellClick(cell);
  render();
});

canvas.addEventListener("mousemove", (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  const cell = {
    x: Math.floor(x * GRID.width),
    y: Math.floor(y * GRID.height),
  };
  if (cell.x < 0 || cell.y < 0 || cell.x >= GRID.width || cell.y >= GRID.height) {
    game.setHoverCell(null);
    return;
  }
  game.setHoverCell(cell);
  render();
});

canvas.addEventListener("mouseleave", () => {
  game.setHoverCell(null);
  render();
});

towerCards.forEach((card) => {
  card.addEventListener("click", () => {
    const type = card.dataset.tower;
    if (!type) return;
    game.setNextTower(type);
    render();
  });
});

window.addEventListener("keydown", (event) => {
  if (event.key === "1") {
    game.setNextTower("arrow");
    showMessage(`下一座：${TOWERS.arrow.emoji} ${TOWERS.arrow.name}`);
  }
  if (event.key === "2") {
    game.setNextTower("ice");
    showMessage(`下一座：${TOWERS.ice.emoji} ${TOWERS.ice.name}`);
  }
  if (event.key === "3") {
    game.setNextTower("bomb");
    showMessage(`下一座：${TOWERS.bomb.emoji} ${TOWERS.bomb.name}`);
  }
});

window.addEventListener("resize", () => {
  render();
});

window.addEventListener("beforeunload", () => {
  stopLoop();
});

currentSeed = randomSeed();
resetGame(currentSeed);
render();
startLoop();
