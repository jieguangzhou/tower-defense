export const GRID = {
  width: 10,
  height: 10,
};

export const MAP_COLORS = {
  buildable: "#fdf7ee",
  path: "#d9b384",
  start: "#2f7d32",
  end: "#a23b2a",
  grid: "#e8dcd0",
};

export const PATH_RULES = {
  minLen: 19,
  maxLen: 19,
  maxRetries: 160,
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
  waveMoney: 7,
  waveScore: 15,
  levelScore: 40,
  leakPenalty: 20,
  economyDivisor: 5,
};

export const GOLD_MULTIPLIER = 0.7;

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
  snake: {
    key: "snake",
    emoji: "🐍",
    name: "蛇",
    hp: 80,
    speed: 1.2,
    gold: 6,
    pts: 15,
  },
  turtle: {
    key: "turtle",
    emoji: "🐢",
    name: "龟",
    hp: 120,
    speed: 0.8,
    gold: 8,
    pts: 20,
  },
  bear: {
    key: "bear",
    emoji: "🐻",
    name: "熊",
    hp: 160,
    speed: 0.9,
    gold: 10,
    pts: 25,
  },
  scorpion: {
    key: "scorpion",
    emoji: "🦂",
    name: "蝎",
    hp: 200,
    speed: 1.0,
    gold: 12,
    pts: 30,
  },
  eagle: {
    key: "eagle",
    emoji: "🦅",
    name: "鹰",
    hp: 140,
    speed: 1.6,
    gold: 11,
    pts: 28,
  },
  rhino: {
    key: "rhino",
    emoji: "🦏",
    name: "犀",
    hp: 260,
    speed: 0.75,
    gold: 15,
    pts: 38,
  },
  elephant: {
    key: "elephant",
    emoji: "🐘",
    name: "象",
    hp: 320,
    speed: 0.7,
    gold: 18,
    pts: 45,
  },
  dragon: {
    key: "dragon",
    emoji: "🐲",
    name: "龙",
    hp: 400,
    speed: 0.65,
    gold: 25,
    pts: 60,
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
  { level: 2, multiplier: 2 },
  { level: 3, multiplier: 2 },
];

export const WAVE_TIMING = {
  spawnIntervalMin: 0.6,
  spawnIntervalMax: 1.2,
  intermissionSeconds: 2.0,
};

export const WAVES = [
  [
    [{ type: "bug", count: 10 }],
    [{ type: "bug", count: 12 }],
    [
      { type: "bug", count: 10 },
      { type: "wolf", count: 2 },
    ],
  ],
  [
    [
      { type: "bug", count: 6 },
      { type: "wolf", count: 6 },
    ],
    [
      { type: "bug", count: 5 },
      { type: "wolf", count: 8 },
    ],
    [
      { type: "bug", count: 4 },
      { type: "wolf", count: 10 },
    ],
  ],
  [
    [
      { type: "wolf", count: 8 },
      { type: "snake", count: 4 },
    ],
    [
      { type: "wolf", count: 6 },
      { type: "snake", count: 6 },
    ],
    [
      { type: "wolf", count: 6 },
      { type: "snake", count: 8 },
    ],
  ],
  [
    [
      { type: "snake", count: 8 },
      { type: "turtle", count: 4 },
    ],
    [
      { type: "snake", count: 6 },
      { type: "turtle", count: 6 },
    ],
    [
      { type: "snake", count: 6 },
      { type: "turtle", count: 8 },
    ],
  ],
  [
    [
      { type: "turtle", count: 8 },
      { type: "bear", count: 4 },
    ],
    [
      { type: "turtle", count: 6 },
      { type: "bear", count: 6 },
    ],
    [
      { type: "turtle", count: 6 },
      { type: "bear", count: 8 },
    ],
  ],
  [
    [
      { type: "bear", count: 8 },
      { type: "scorpion", count: 4 },
    ],
    [
      { type: "bear", count: 6 },
      { type: "scorpion", count: 6 },
    ],
    [
      { type: "bear", count: 6 },
      { type: "scorpion", count: 8 },
    ],
  ],
  [
    [
      { type: "scorpion", count: 8 },
      { type: "eagle", count: 4 },
    ],
    [
      { type: "scorpion", count: 6 },
      { type: "eagle", count: 6 },
    ],
    [
      { type: "scorpion", count: 6 },
      { type: "eagle", count: 8 },
    ],
  ],
  [
    [
      { type: "eagle", count: 8 },
      { type: "rhino", count: 4 },
    ],
    [
      { type: "eagle", count: 6 },
      { type: "rhino", count: 6 },
    ],
    [
      { type: "eagle", count: 6 },
      { type: "rhino", count: 8 },
    ],
  ],
  [
    [
      { type: "rhino", count: 8 },
      { type: "elephant", count: 4 },
    ],
    [
      { type: "rhino", count: 6 },
      { type: "elephant", count: 6 },
    ],
    [
      { type: "rhino", count: 6 },
      { type: "elephant", count: 8 },
    ],
  ],
  [
    [
      { type: "elephant", count: 7 },
      { type: "dragon", count: 3 },
    ],
    [
      { type: "elephant", count: 6 },
      { type: "dragon", count: 4 },
    ],
    [
      { type: "elephant", count: 5 },
      { type: "dragon", count: 6 },
    ],
  ],
];

export const TOTAL_WAVES = WAVES.length * 3;

export const EFFECT_COLORS = {
  arrow: {
    stroke: "rgba(255, 111, 60, 0.9)",
    glow: "rgba(255, 177, 122, 0.4)",
  },
  ice: {
    stroke: "rgba(79, 179, 255, 0.9)",
    glow: "rgba(176, 229, 255, 0.45)",
  },
  bomb: {
    stroke: "rgba(255, 78, 94, 0.9)",
    glow: "rgba(255, 142, 150, 0.35)",
  },
};
