export const GRID = {
  width: 10,
  height: 6,
};

export const PATH_RULES = {
  minLen: 14,
  maxLen: 26,
  maxRetries: 40,
  weights: [
    { dx: 1, dy: 0, weight: 0.55 },
    { dx: 0, dy: -1, weight: 0.15 },
    { dx: 0, dy: 1, weight: 0.15 },
    { dx: -1, dy: 0, weight: 0.15 },
  ],
};

export const PLAYER_START = {
  hp: 10,
  money: 60,
  score: 0,
};

export const GAME_REWARDS = {
  waveMoney: 10,
  waveScore: 15,
  levelScore: 40,
  leakPenalty: 20,
  economyDivisor: 5,
};

export const MONSTERS = {
  bug: {
    key: "bug",
    emoji: "🐛",
    name: "小虫",
    hp: 20,
    speed: 1.4,
    gold: 2,
    pts: 5,
  },
  wolf: {
    key: "wolf",
    emoji: "🐺",
    name: "狼",
    hp: 60,
    speed: 1.0,
    gold: 5,
    pts: 12,
  },
  dragon: {
    key: "dragon",
    emoji: "🐲",
    name: "龙",
    hp: 180,
    speed: 0.7,
    gold: 12,
    pts: 35,
  },
};

export const TOWERS = {
  arrow: {
    key: "arrow",
    emoji: "🏹",
    name: "箭塔",
    cost: 20,
    range: 2.8,
    attackSpeed: 1.0,
    damage: 12,
    upgradeDamagePct: 0.4,
  },
  ice: {
    key: "ice",
    emoji: "❄️",
    name: "冰塔",
    cost: 25,
    range: 2.4,
    attackSpeed: 0.8,
    damage: 7,
    slowPct: 0.35,
    slowDuration: 1.2,
    slowUpgradePct: 0.1,
    slowCap: 0.6,
    upgradeDamagePct: 0.2,
  },
  bomb: {
    key: "bomb",
    emoji: "💣",
    name: "炸弹塔",
    cost: 35,
    range: 2.2,
    attackSpeed: 0.45,
    damage: 26,
    splashRadius: 1.0,
    splashUpgrade: 0.2,
    splashCap: 1.6,
    upgradeDamagePct: 0.3,
  },
};

export const UPGRADE_COSTS = [
  { level: 2, multiplier: 0.6 },
  { level: 3, multiplier: 0.9 },
];

export const WAVE_TIMING = {
  spawnIntervalMin: 0.6,
  spawnIntervalMax: 1.2,
  intermissionSeconds: 2.0,
};

export const WAVES = [
  [
    [{ type: "bug", count: 10 }],
    [{ type: "bug", count: 14 }],
    [
      { type: "bug", count: 10 },
      { type: "wolf", count: 2 },
    ],
  ],
  [
    [
      { type: "bug", count: 8 },
      { type: "wolf", count: 6 },
    ],
    [
      { type: "bug", count: 6 },
      { type: "wolf", count: 8 },
    ],
    [
      { type: "bug", count: 6 },
      { type: "wolf", count: 10 },
    ],
  ],
  [
    [{ type: "wolf", count: 12 }],
    [{ type: "wolf", count: 14 }],
    [
      { type: "wolf", count: 12 },
      { type: "dragon", count: 1 },
    ],
  ],
  [
    [
      { type: "wolf", count: 8 },
      { type: "dragon", count: 2 },
    ],
    [
      { type: "wolf", count: 10 },
      { type: "dragon", count: 3 },
    ],
    [
      { type: "wolf", count: 8 },
      { type: "dragon", count: 4 },
    ],
  ],
  [
    [
      { type: "dragon", count: 6 },
      { type: "wolf", count: 6 },
    ],
    [
      { type: "dragon", count: 7 },
      { type: "wolf", count: 8 },
    ],
    [
      { type: "dragon", count: 6 },
      { type: "wolf", count: 8 },
    ],
  ],
];

export const TOTAL_WAVES = WAVES.length * 3;
