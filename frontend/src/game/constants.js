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

import { MOB_RULES, TOWER_RULES } from "../ruleset.js";

export const MONSTERS = Object.fromEntries(
  Object.entries(MOB_RULES.mobs ?? {}).map(([key, mob]) => [
    key,
    {
      key,
      emoji: mob.emoji,
      name: mob.name,
      hp: mob.hp,
      speed: mob.speed,
      gold: mob.dropGold,
      pts: mob.pts,
    },
  ])
);

export const TOWERS = { ...TOWER_RULES };

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
