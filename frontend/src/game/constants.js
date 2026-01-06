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
  minLen: 20,
  maxLen: 20,
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
  bat: {
    key: "bat",
    emoji: "🦇",
    name: "蝠",
    hp: 50,
    speed: 1.6,
    gold: 4,
    pts: 10,
  },
  fox: {
    key: "fox",
    emoji: "🦊",
    name: "狐",
    hp: 90,
    speed: 1.2,
    gold: 6,
    pts: 16,
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
  boar: {
    key: "boar",
    emoji: "🐗",
    name: "豕",
    hp: 150,
    speed: 1.05,
    gold: 9,
    pts: 23,
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
    [
      { type: "bug", count: 6 },
      { type: "bat", count: 4 },
      { type: "wolf", count: 2 },
    ],
    [
      { type: "bug", count: 5 },
      { type: "bat", count: 5 },
      { type: "wolf", count: 3 },
    ],
    [
      { type: "bug", count: 4 },
      { type: "bat", count: 5 },
      { type: "wolf", count: 4 },
    ],
  ],
  [
    [
      { type: "bug", count: 3 },
      { type: "bat", count: 4 },
      { type: "wolf", count: 5 },
      { type: "fox", count: 2 },
    ],
    [
      { type: "bug", count: 2 },
      { type: "bat", count: 4 },
      { type: "wolf", count: 6 },
      { type: "fox", count: 3 },
    ],
    [
      { type: "bug", count: 2 },
      { type: "bat", count: 3 },
      { type: "wolf", count: 6 },
      { type: "fox", count: 4 },
    ],
  ],
  [
    [
      { type: "wolf", count: 5 },
      { type: "fox", count: 4 },
      { type: "snake", count: 4 },
    ],
    [
      { type: "wolf", count: 4 },
      { type: "fox", count: 4 },
      { type: "snake", count: 6 },
    ],
    [
      { type: "wolf", count: 4 },
      { type: "fox", count: 3 },
      { type: "snake", count: 7 },
    ],
  ],
  [
    [
      { type: "snake", count: 6 },
      { type: "turtle", count: 4 },
      { type: "boar", count: 3 },
    ],
    [
      { type: "snake", count: 5 },
      { type: "turtle", count: 5 },
      { type: "boar", count: 4 },
    ],
    [
      { type: "snake", count: 4 },
      { type: "turtle", count: 6 },
      { type: "boar", count: 5 },
    ],
  ],
  [
    [
      { type: "turtle", count: 5 },
      { type: "boar", count: 5 },
      { type: "bear", count: 4 },
    ],
    [
      { type: "turtle", count: 4 },
      { type: "boar", count: 5 },
      { type: "bear", count: 6 },
    ],
    [
      { type: "turtle", count: 4 },
      { type: "boar", count: 4 },
      { type: "bear", count: 7 },
    ],
  ],
  [
    [
      { type: "bear", count: 5 },
      { type: "scorpion", count: 4 },
      { type: "eagle", count: 3 },
    ],
    [
      { type: "bear", count: 4 },
      { type: "scorpion", count: 5 },
      { type: "eagle", count: 4 },
    ],
    [
      { type: "bear", count: 4 },
      { type: "scorpion", count: 6 },
      { type: "eagle", count: 4 },
    ],
  ],
  [
    [
      { type: "scorpion", count: 6 },
      { type: "eagle", count: 4 },
      { type: "rhino", count: 3 },
    ],
    [
      { type: "scorpion", count: 5 },
      { type: "eagle", count: 5 },
      { type: "rhino", count: 4 },
    ],
    [
      { type: "scorpion", count: 4 },
      { type: "eagle", count: 5 },
      { type: "rhino", count: 5 },
    ],
  ],
  [
    [
      { type: "eagle", count: 5 },
      { type: "rhino", count: 5 },
      { type: "elephant", count: 3 },
    ],
    [
      { type: "eagle", count: 4 },
      { type: "rhino", count: 5 },
      { type: "elephant", count: 4 },
    ],
    [
      { type: "eagle", count: 4 },
      { type: "rhino", count: 4 },
      { type: "elephant", count: 5 },
    ],
  ],
  [
    [
      { type: "rhino", count: 6 },
      { type: "elephant", count: 4 },
      { type: "dragon", count: 2 },
    ],
    [
      { type: "rhino", count: 5 },
      { type: "elephant", count: 5 },
      { type: "dragon", count: 3 },
    ],
    [
      { type: "rhino", count: 4 },
      { type: "elephant", count: 5 },
      { type: "dragon", count: 4 },
    ],
  ],
  [
    [
      { type: "elephant", count: 5 },
      { type: "dragon", count: 4 },
      { type: "scorpion", count: 3 },
    ],
    [
      { type: "elephant", count: 4 },
      { type: "dragon", count: 5 },
      { type: "scorpion", count: 4 },
    ],
    [
      { type: "elephant", count: 3 },
      { type: "dragon", count: 6 },
      { type: "scorpion", count: 4 },
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
