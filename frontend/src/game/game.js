import {
  EFFECT_COLORS,
  GRID,
  GAME_REWARDS,
  GOLD_MULTIPLIER,
  MAP_COLORS,
  MONSTERS,
  PLAYER_START,
  TOWERS,
  TOTAL_WAVES,
  UPGRADE_COSTS,
  WAVES,
  WAVE_TIMING,
} from "./constants.js";
import { buildSummary } from "./scoring.js";
import { createRng, hashSeed, randomInt, randomRange, shuffle } from "./rng.js";
import { buildPathSet, generatePath } from "./path.js";

const EFFECT_LIFETIME = 0.18;

function formatSeed(seedInput) {
  if (seedInput === "" || seedInput == null) {
    return `${Date.now()}`;
  }
  return String(seedInput);
}

function getWaveIndex(level, wave) {
  return (level - 1) * 3 + (wave - 1);
}

function getLevelWave(waveIndex) {
  return {
    level: Math.floor(waveIndex / 3) + 1,
    wave: (waveIndex % 3) + 1,
  };
}

function expandWave(definition) {
  const list = [];
  for (const entry of definition) {
    for (let i = 0; i < entry.count; i += 1) {
      list.push({ type: entry.type });
    }
  }
  return list;
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function towerStats(base, level) {
  const levelSteps = level - 1;
  const damage = base.damage * (1 + base.upgradeDamagePct * levelSteps);
  if (base.key === "ice") {
    const slowPct = Math.min(
      base.slowCap,
      base.slowPct + base.slowUpgradePct * levelSteps
    );
    return {
      ...base,
      damage,
      slowPct,
    };
  }
  if (base.key === "bomb") {
    const splashRadius = Math.min(
      base.splashCap,
      base.splashRadius + base.splashUpgrade * levelSteps
    );
    return {
      ...base,
      damage,
      splashRadius,
    };
  }
  return {
    ...base,
    damage,
  };
}

function upgradeCost(baseCost, nextLevel) {
  const match = UPGRADE_COSTS.find((entry) => entry.level === nextLevel);
  if (!match) return null;
  return Math.round(baseCost * match.multiplier);
}

function totalInvested(tower) {
  let total = tower.baseCost;
  if (tower.level >= 2) total += upgradeCost(tower.baseCost, 2) ?? 0;
  if (tower.level >= 3) total += upgradeCost(tower.baseCost, 3) ?? 0;
  return total;
}

export function createGame({ seedInput, onLog, onMessage }) {
  let rng = null;
  let state = null;
  const buildOrder = ["arrow", "ice", "bomb"];

  function log(message, detail) {
    if (onLog) onLog(message, detail);
  }

  function message(text) {
    if (onMessage) onMessage(text);
  }

  function reset(seedValue) {
    const seedText = formatSeed(seedValue);
    const seedNumber = hashSeed(seedText);
    rng = createRng(seedNumber);

    const pathResult = generatePath({
      rng,
      width: GRID.width,
      height: GRID.height,
    });

    if (!pathResult) {
      throw new Error("路径生成失败：请更换种子后重试");
    }

    const pathSet = buildPathSet(pathResult.cells);
    const buildable = Array.from({ length: GRID.height }, (_, y) =>
      Array.from({ length: GRID.width }, (_, x) => !pathSet.has(`${x},${y}`))
    );

    state = {
      phase: "setup",
      seed: seedText,
      seedNumber,
      grid: { ...GRID },
      path: pathResult,
      pathSet,
      buildable,
      towers: [],
      monsters: [],
      effects: [],
      selection: {
        towerId: null,
        buildIndex: 0,
      },
      hoverCell: null,
      player: {
        hp: PLAYER_START.hp,
        money: PLAYER_START.money,
      },
      stats: {
        killScore: 0,
        waveScore: 0,
        levelScore: 0,
        leakPenalty: 0,
        killed: 0,
        totalDamage: 0,
        actionsCount: 0,
        startTime: null,
        elapsedMs: 0,
      },
      wave: {
        index: 0,
        state: "idle",
        spawnQueue: [],
        spawnCooldown: 0,
        intermission: 0,
      },
      summary: null,
    };

    log("对局重置", { seed: seedText, pathLength: pathResult.cells.length });
  }

  function ensureState() {
    if (!state) throw new Error("game not initialized");
  }

  function startRun() {
    ensureState();
    if (state.phase === "running") return;
    if (!state.stats.startTime) {
      state.stats.startTime = performance.now();
    }
    state.phase = "running";
    if (state.wave.state === "idle") {
      startWave();
    }
    log("对局开始", { wave: state.wave.index + 1 });
  }

  function endRun(reason) {
    ensureState();
    if (state.phase === "ended") return;
    state.phase = "ended";
    state.wave.state = "ended";
    state.summary = buildSummary({
      seed: state.seedNumber,
      levelReached: getLevelWave(state.wave.index).level,
      waveReached: getLevelWave(state.wave.index).wave,
      killScore: state.stats.killScore,
      waveScore: state.stats.waveScore,
      levelScore: state.stats.levelScore,
      hpPenalty: Math.max(0, PLAYER_START.hp - state.player.hp),
      killed: state.stats.killed,
      totalDamage: state.stats.totalDamage,
      moneyLeft: state.player.money,
      durationMs: state.stats.elapsedMs,
      actionsCount: state.stats.actionsCount,
    });
    log("对局结束", { reason, summary: state.summary });
  }

  function buildBoss(definition) {
    const types = Array.from(new Set(definition.map((entry) => entry.type)));
    if (types.length === 0) return null;
    const type = types[randomInt(rng, 0, types.length - 1)];
    const multiplier = Number(randomRange(rng, 2, 5).toFixed(2));
    return {
      type,
      isBoss: true,
      multiplier,
    };
  }

  function startWave() {
    const { level, wave } = getLevelWave(state.wave.index);
    const definition = WAVES[level - 1]?.[wave - 1];
    if (!definition) {
      endRun("victory");
      return;
    }
    const queue = expandWave(definition);
    shuffle(rng, queue);
    const boss = buildBoss(definition);
    if (boss) {
      let minIndex = Math.floor(queue.length * 0.35);
      if (minIndex < 0) minIndex = 0;
      if (minIndex > queue.length) minIndex = queue.length;
      const insertAt = randomInt(rng, minIndex, queue.length);
      queue.splice(insertAt, 0, boss);
    }
    state.wave.spawnQueue = queue;
    state.wave.spawnCooldown = randomRange(
      rng,
      WAVE_TIMING.spawnIntervalMin,
      WAVE_TIMING.spawnIntervalMax
    );
    state.wave.state = "spawning";
    log("波次开始", { level, wave, total: queue.length });
  }

  function finishWave() {
    const { level, wave } = getLevelWave(state.wave.index);
    state.stats.waveScore += GAME_REWARDS.waveScore;
    state.player.money += GAME_REWARDS.waveMoney;
    if (wave === 3) {
      state.stats.levelScore += GAME_REWARDS.levelScore;
    }
    log("波次结束", { level, wave, hp: state.player.hp });
    const completedIndex = state.wave.index;
    state.wave.index += 1;
    if (state.wave.index >= TOTAL_WAVES) {
      state.wave.index = completedIndex;
      endRun("victory");
      return;
    }
    state.wave.state = "intermission";
    state.wave.intermission = WAVE_TIMING.intermissionSeconds;
  }

  function spawnMonster(type, options = {}) {
    const template = MONSTERS[type];
    if (!template) return;
    const waveMultiplier = 1 + state.wave.index * 0.1;
    const bossMultiplier = options.multiplier ?? 1;
    const isBoss = options.isBoss ?? false;
    const hpMultiplier = isBoss ? bossMultiplier : 1;
    const goldMultiplier = isBoss ? bossMultiplier : 1;
    const id = crypto.randomUUID();
    const start = state.path.cells[0];
    state.monsters.push({
      id,
      type: template.key,
      emoji: template.emoji,
      maxHp: Math.round(template.hp * waveMultiplier * hpMultiplier),
      hp: Math.round(template.hp * waveMultiplier * hpMultiplier),
      baseSpeed: template.speed * waveMultiplier,
      gold: Math.round(template.gold * GOLD_MULTIPLIER * goldMultiplier),
      pts: template.pts,
      isBoss,
      scale: isBoss ? 1.4 + (bossMultiplier - 2) * 0.15 : 1,
      pathIndex: 0,
      pathProgress: 0,
      slowPct: 0,
      slowRemaining: 0,
      position: { x: start.x + 0.5, y: start.y + 0.5 },
    });
  }

  function applyDamage(monster, amount) {
    if (monster.hp <= 0) return;
    const dealt = Math.min(monster.hp, amount);
    monster.hp -= dealt;
    state.stats.totalDamage += dealt;
    if (monster.hp <= 0) {
      state.stats.killed += 1;
      state.stats.killScore += monster.pts;
      state.player.money += monster.gold;
      state.effects.push({
        type: "gold",
        x: monster.position.x,
        y: monster.position.y,
        amount: monster.gold,
        ttl: 0.9,
      });
    }
  }

  function targetPriority(monster) {
    return monster.pathIndex + monster.pathProgress;
  }

  function updateMonsters(dt) {
    const path = state.path.cells;
    const endIndex = path.length - 1;
    for (const monster of state.monsters) {
      if (monster.hp <= 0) continue;
      if (monster.slowRemaining > 0) {
        monster.slowRemaining -= dt;
        if (monster.slowRemaining <= 0) {
          monster.slowRemaining = 0;
          monster.slowPct = 0;
        }
      }
      const speed = monster.baseSpeed * (1 - monster.slowPct);
      let remaining = speed * dt;

      while (remaining > 0 && monster.pathIndex < endIndex) {
        const stepLeft = 1 - monster.pathProgress;
        if (remaining < stepLeft) {
          monster.pathProgress += remaining;
          remaining = 0;
        } else {
          remaining -= stepLeft;
          monster.pathIndex += 1;
          monster.pathProgress = 0;
        }
      }

      if (monster.pathIndex >= endIndex) {
        monster.hp = 0;
        state.player.hp -= 1;
        state.stats.leakPenalty += GAME_REWARDS.leakPenalty;
        if (state.player.hp <= 0) {
          endRun("defeat");
        }
        continue;
      }

      const current = path[monster.pathIndex];
      const next = path[monster.pathIndex + 1];
      monster.position.x =
        current.x + 0.5 + (next.x - current.x) * monster.pathProgress;
      monster.position.y =
        current.y + 0.5 + (next.y - current.y) * monster.pathProgress;
    }
  }

  function updateTowers(dt) {
    const living = state.monsters.filter((monster) => monster.hp > 0);
    for (const tower of state.towers) {
      tower.cooldown -= dt;
      if (tower.cooldown > 0) continue;
      const towerPos = { x: tower.x + 0.5, y: tower.y + 0.5 };
      const inRange = living.filter(
        (monster) => distance(towerPos, monster.position) <= tower.range
      );
      if (inRange.length === 0) {
        tower.cooldown = 0;
        continue;
      }
      inRange.sort((a, b) => targetPriority(b) - targetPriority(a));
      const target = inRange[0];
      tower.cooldown = 1 / tower.attackSpeed;

      if (tower.type === "bomb") {
        for (const monster of living) {
          if (distance(target.position, monster.position) <= tower.splashRadius) {
            applyDamage(monster, tower.damage);
          }
        }
        state.effects.push({
          type: "blast",
          x: target.position.x,
          y: target.position.y,
          radius: tower.splashRadius,
          color: EFFECT_COLORS.bomb,
          ttl: EFFECT_LIFETIME,
        });
      } else {
        applyDamage(target, tower.damage);
        if (tower.type === "ice") {
          target.slowPct = Math.max(target.slowPct, tower.slowPct);
          target.slowRemaining = Math.max(
            target.slowRemaining,
            tower.slowDuration
          );
        }
        state.effects.push({
          type: "shot",
          towerType: tower.type,
          color: EFFECT_COLORS[tower.type],
          from: towerPos,
          to: { ...target.position },
          ttl: EFFECT_LIFETIME,
        });
      }
    }
  }

  function clearDead() {
    state.monsters = state.monsters.filter((monster) => monster.hp > 0);
  }

  function updateWave(dt) {
    if (state.phase !== "running") return;
    if (state.wave.state === "spawning") {
      if (state.wave.spawnQueue.length === 0) {
        if (state.monsters.length === 0) {
          finishWave();
        }
        return;
      }
      state.wave.spawnCooldown -= dt;
      if (state.wave.spawnCooldown <= 0) {
        const entry = state.wave.spawnQueue.shift();
        if (entry) {
          if (typeof entry === "string") {
            spawnMonster(entry);
          } else {
            spawnMonster(entry.type, entry);
          }
        }
        state.wave.spawnCooldown = randomRange(
          rng,
          WAVE_TIMING.spawnIntervalMin,
          WAVE_TIMING.spawnIntervalMax
        );
      }
    } else if (state.wave.state === "intermission") {
      state.wave.intermission -= dt;
      if (state.wave.intermission <= 0) {
        if (state.wave.index < TOTAL_WAVES) {
          startWave();
        }
      }
    }
  }

  function update(dt) {
    ensureState();
    if (state.phase !== "running") return;
    state.stats.elapsedMs = performance.now() - state.stats.startTime;
    updateWave(dt);
    updateMonsters(dt);
    updateTowers(dt);
    clearDead();
    state.effects.forEach((effect) => {
      effect.ttl -= dt;
      if (effect.type === "gold") {
        effect.y -= dt * 0.6;
      }
    });
    state.effects = state.effects.filter((effect) => effect.ttl > 0);
  }

  function drawGrid(ctx, cellSize) {
    ctx.strokeStyle = MAP_COLORS.grid;
    ctx.lineWidth = 1;
    for (let x = 0; x <= GRID.width; x += 1) {
      ctx.beginPath();
      ctx.moveTo(x * cellSize, 0);
      ctx.lineTo(x * cellSize, GRID.height * cellSize);
      ctx.stroke();
    }
    for (let y = 0; y <= GRID.height; y += 1) {
      ctx.beginPath();
      ctx.moveTo(0, y * cellSize);
      ctx.lineTo(GRID.width * cellSize, y * cellSize);
      ctx.stroke();
    }
  }

  function render(ctx, cellSize) {
    ensureState();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = "#fffdf9";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    for (let y = 0; y < GRID.height; y += 1) {
      for (let x = 0; x < GRID.width; x += 1) {
        const isPath = state.pathSet.has(`${x},${y}`);
        ctx.fillStyle = isPath ? MAP_COLORS.path : MAP_COLORS.buildable;
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }

    const start = state.path.start;
    const end = state.path.end;
    ctx.fillStyle = MAP_COLORS.start;
    ctx.fillRect(start.x * cellSize, start.y * cellSize, cellSize, cellSize);
    ctx.fillStyle = MAP_COLORS.end;
    ctx.fillRect(end.x * cellSize, end.y * cellSize, cellSize, cellSize);

    drawGrid(ctx, cellSize);

    if (state.hoverCell) {
      const { x, y } = state.hoverCell;
      const hasTower = state.towers.some((tower) => tower.x === x && tower.y === y);
      const buildable = state.buildable[y]?.[x];
      if (buildable && !hasTower) {
        const type = buildOrder[state.selection.buildIndex % buildOrder.length];
        const base = TOWERS[type];
        const preview = towerStats(base, 1);
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = "#fff4e4";
        ctx.fillRect(
          x * cellSize + 6,
          y * cellSize + 6,
          cellSize - 12,
          cellSize - 12
        );
        ctx.font = `${cellSize * 0.5}px "Kanit", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#5a4631";
        ctx.fillText(base.emoji, (x + 0.5) * cellSize, (y + 0.5) * cellSize);
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = "rgba(34, 87, 122, 0.35)";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.arc(
          (x + 0.5) * cellSize,
          (y + 0.5) * cellSize,
          preview.range * cellSize,
          0,
          Math.PI * 2
        );
        ctx.stroke();
        ctx.restore();
      }
    }

    for (const tower of state.towers) {
      const x = tower.x * cellSize;
      const y = tower.y * cellSize;
      ctx.fillStyle = "#fff4e4";
      ctx.fillRect(x + 6, y + 6, cellSize - 12, cellSize - 12);
      ctx.font = `${cellSize * 0.5}px "Space Grotesk", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#5a4631";
      ctx.fillText(tower.emoji, x + cellSize / 2, y + cellSize / 2);
    }

    for (const monster of state.monsters) {
      if (monster.hp <= 0) continue;
      const x = monster.position.x * cellSize;
      const y = monster.position.y * cellSize;
      const scale = monster.scale ?? 1;
      ctx.font = `${cellSize * 0.55 * scale}px "Kanit", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(monster.emoji, x, y);

      const hpWidth = cellSize * 0.7;
      const hpX = x - hpWidth / 2;
      const hpY = y - cellSize * 0.45;
      ctx.fillStyle = "rgba(90,70,49,0.3)";
      ctx.fillRect(hpX, hpY, hpWidth, 4);
      ctx.fillStyle = "#d95d39";
      ctx.fillRect(hpX, hpY, hpWidth * (monster.hp / monster.maxHp), 4);
    }

    for (const effect of state.effects) {
      const color = effect.color ?? EFFECT_COLORS.arrow;
      if (effect.type === "shot") {
        ctx.strokeStyle = color.glow;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(effect.from.x * cellSize, effect.from.y * cellSize);
        ctx.lineTo(effect.to.x * cellSize, effect.to.y * cellSize);
        ctx.stroke();

        ctx.strokeStyle = color.stroke;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(effect.from.x * cellSize, effect.from.y * cellSize);
        ctx.lineTo(effect.to.x * cellSize, effect.to.y * cellSize);
        ctx.stroke();

        ctx.fillStyle = color.stroke;
        ctx.beginPath();
        ctx.arc(
          effect.to.x * cellSize,
          effect.to.y * cellSize,
          cellSize * 0.08,
          0,
          Math.PI * 2
        );
        ctx.fill();
      } else if (effect.type === "blast") {
        const radius = effect.radius * cellSize;
        ctx.fillStyle = color.glow;
        ctx.beginPath();
        ctx.arc(effect.x * cellSize, effect.y * cellSize, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = color.stroke;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(
          effect.x * cellSize,
          effect.y * cellSize,
          radius,
          0,
          Math.PI * 2
        );
        ctx.stroke();

        ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(
          effect.x * cellSize,
          effect.y * cellSize,
          radius * 0.65,
          0,
          Math.PI * 2
        );
        ctx.stroke();
      } else if (effect.type === "gold") {
        const alpha = Math.max(0, Math.min(1, effect.ttl / 0.9));
        ctx.fillStyle = `rgba(255, 193, 7, ${alpha})`;
        ctx.font = `${cellSize * 0.35}px "Kanit", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`+${effect.amount}`, effect.x * cellSize, effect.y * cellSize);
      }
    }

    if (state.selection.towerId) {
      const tower = state.towers.find((item) => item.id === state.selection.towerId);
      if (tower) {
        ctx.strokeStyle = "rgba(34, 87, 122, 0.4)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(
          (tower.x + 0.5) * cellSize,
          (tower.y + 0.5) * cellSize,
          tower.range * cellSize,
          0,
          Math.PI * 2
        );
        ctx.stroke();
      }
    }
  }

  function handleCellClick(cell) {
    ensureState();
    const existing = state.towers.find(
      (tower) => tower.x === cell.x && tower.y === cell.y
    );

    if (existing) {
      state.selection.towerId = existing.id;
      return;
    }

    if (!state.buildable[cell.y]?.[cell.x]) {
      message("道路上无法建塔");
      return;
    }
    const type = buildOrder[state.selection.buildIndex % buildOrder.length];
    const base = TOWERS[type];
    if (!base) return;
    if (state.player.money < base.cost) {
      message("金币不足");
      return;
    }
    const tower = towerStats(base, 1);
    state.player.money -= base.cost;
    state.towers.push({
      id: crypto.randomUUID(),
      type: base.key,
      emoji: base.emoji,
      level: 1,
      baseCost: base.cost,
      range: tower.range,
      damage: tower.damage,
      attackSpeed: tower.attackSpeed,
      slowPct: tower.slowPct ?? 0,
      slowDuration: tower.slowDuration ?? 0,
      splashRadius: tower.splashRadius ?? 0,
      x: cell.x,
      y: cell.y,
      cooldown: 0,
    });
    state.selection.towerId = null;
    state.stats.actionsCount += 1;
    log("建造塔", { type: base.key, x: cell.x, y: cell.y });
    return;

    state.selection.towerId = null;
  }

  function setNextTower(type) {
    ensureState();
    const index = buildOrder.indexOf(type);
    if (index === -1) return;
    state.selection.buildIndex = index;
  }

  function setHoverCell(cell) {
    ensureState();
    state.hoverCell = cell;
  }

  function upgradeSelected() {
    ensureState();
    const tower = state.towers.find((item) => item.id === state.selection.towerId);
    if (!tower) {
      message("请先选中塔");
      return;
    }
    if (tower.level >= 3) {
      message("已满级");
      return;
    }
    const nextLevel = tower.level + 1;
    const cost = upgradeCost(tower.baseCost, nextLevel);
    if (cost == null) return;
    if (state.player.money < cost) {
      message("金币不足");
      return;
    }
    state.player.money -= cost;
    tower.level = nextLevel;
    const updated = towerStats(TOWERS[tower.type], tower.level);
    tower.range = updated.range;
    tower.damage = updated.damage;
    tower.attackSpeed = updated.attackSpeed;
    tower.slowPct = updated.slowPct ?? 0;
    tower.slowDuration = updated.slowDuration ?? 0;
    tower.splashRadius = updated.splashRadius ?? 0;
    state.stats.actionsCount += 1;
    log("升级塔", { id: tower.id, level: tower.level });
  }

  function sellSelected() {
    ensureState();
    const index = state.towers.findIndex(
      (item) => item.id === state.selection.towerId
    );
    if (index === -1) {
      message("请先选中塔");
      return;
    }
    const tower = state.towers[index];
    const refund = Math.floor(totalInvested(tower) * 0.5);
    state.player.money += refund;
    state.towers.splice(index, 1);
    state.selection.towerId = null;
    state.stats.actionsCount += 1;
    log("卖塔", { refund });
  }

  function getState() {
    return state;
  }

  return {
    reset,
    startRun,
    endRun,
    update,
    render,
    getState,
    handleCellClick,
    setNextTower,
    buildOrder,
    setHoverCell,
    upgradeSelected,
    sellSelected,
    getLevelWave,
    getWaveIndex,
  };
}
