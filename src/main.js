import { GRID, WAVES } from "./game/constants.js";
import { createGame } from "./game/game.js";
import { computeScore } from "./game/scoring.js";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const seedInput = document.getElementById("seedInput");
const seedDisplay = document.getElementById("seedDisplay");
const phaseDisplay = document.getElementById("phaseDisplay");
const messageEl = document.getElementById("message");

const startBtn = document.getElementById("startBtn");
const endBtn = document.getElementById("endBtn");
const newSeedBtn = document.getElementById("newSeedBtn");
const towerButtons = Array.from(document.querySelectorAll(".btn.tower"));
const upgradeBtn = document.getElementById("upgradeBtn");
const sellBtn = document.getElementById("sellBtn");
const selectedInfo = document.getElementById("selectedInfo");

const hpValue = document.getElementById("hpValue");
const moneyValue = document.getElementById("moneyValue");
const scoreValue = document.getElementById("scoreValue");
const levelValue = document.getElementById("levelValue");
const waveValue = document.getElementById("waveValue");
const timeValue = document.getElementById("timeValue");
const killedValue = document.getElementById("killedValue");
const damageValue = document.getElementById("damageValue");
const actionsValue = document.getElementById("actionsValue");
const waveInfo = document.getElementById("waveInfo");

const summaryPanel = document.getElementById("summaryPanel");
const summaryJson = document.getElementById("summaryJson");
const copySummaryBtn = document.getElementById("copySummaryBtn");

let cellSize = 40;
let animationFrame = null;
let lastTime = null;
let messageTimeout = null;

const game = createGame({
  onLog(message, detail) {
    console.info("[game]", message, detail ?? "");
  },
  onMessage(text) {
    showMessage(text);
  },
});

game.reset("");

function showMessage(text) {
  if (!text) return;
  messageEl.textContent = text;
  messageEl.classList.add("show");
  if (messageTimeout) window.clearTimeout(messageTimeout);
  messageTimeout = window.setTimeout(() => {
    messageEl.classList.remove("show");
  }, 1800);
}

function resizeCanvas() {
  const shell = canvas.parentElement;
  const width = shell.clientWidth;
  const height = Math.round(width * (GRID.height / GRID.width));
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.floor(width * scale);
  canvas.height = Math.floor(height * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  cellSize = width / GRID.width;
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

  hpValue.textContent = `${state.player.hp}`;
  moneyValue.textContent = `${state.player.money}`;
  const runningScore = computeScore({
    killScore: state.stats.killScore,
    waveScore: state.stats.waveScore,
    levelScore: state.stats.levelScore,
    leakPenalty: state.stats.leakPenalty,
    moneyLeft: state.player.money,
  });
  scoreValue.textContent = `${state.summary?.score ?? runningScore}`;
  levelValue.textContent = `${level}`;
  waveValue.textContent = `${wave}`;
  timeValue.textContent = `${minutes.toFixed(1)}s`;
  killedValue.textContent = `${state.stats.killed}`;
  damageValue.textContent = `${Math.floor(state.stats.totalDamage)}`;
  actionsValue.textContent = `${state.stats.actionsCount}`;

  renderWaveInfo(state);
  renderSelection(state);

  if (state.phase === "ended" && state.summary) {
    summaryPanel.classList.remove("hidden");
    summaryJson.textContent = JSON.stringify(state.summary, null, 2);
  }
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
    selectedInfo.textContent = "未选中塔";
    return;
  }
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

function updateButtonStates() {
  const state = game.getState();
  for (const button of towerButtons) {
    const type = button.dataset.tower;
    button.classList.toggle("active", state.selection.buildMode === type);
  }
}

function render() {
  resizeCanvas();
  game.render(ctx, cellSize);
  updateStats();
  updateButtonStates();
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

function resetGame() {
  const value = seedInput.value.trim();
  game.reset(value);
  summaryPanel.classList.add("hidden");
  summaryJson.textContent = "";
  render();
}

newSeedBtn.addEventListener("click", () => {
  seedInput.value = `${Math.floor(Math.random() * 1_000_000)}`;
  resetGame();
});

startBtn.addEventListener("click", () => {
  const state = game.getState();
  if (state.phase === "ended" || state.phase === "setup") {
    resetGame();
  }
  game.startRun();
  startLoop();
});

endBtn.addEventListener("click", () => {
  game.endRun("manual");
});

upgradeBtn.addEventListener("click", () => {
  game.upgradeSelected();
  render();
});

sellBtn.addEventListener("click", () => {
  game.sellSelected();
  render();
});

copySummaryBtn.addEventListener("click", async () => {
  const text = summaryJson.textContent.trim();
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    showMessage("摘要已复制");
  } catch (error) {
    console.warn("copy failed", error);
    showMessage("复制失败，请手动选中");
  }
});

towerButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const state = game.getState();
    const type = button.dataset.tower;
    if (state.selection.buildMode === type) {
      game.setBuildMode(null);
    } else {
      game.setBuildMode(type);
    }
    updateButtonStates();
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

window.addEventListener("resize", () => {
  render();
});

render();
startLoop();

window.addEventListener("beforeunload", () => {
  stopLoop();
});
