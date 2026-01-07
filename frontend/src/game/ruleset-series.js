export function roundValue(value, mode = "half_up") {
  if (mode === "ceil") return Math.ceil(value);
  if (mode === "floor") return Math.floor(value);
  if (mode === "half_up") return Math.floor(value + 0.5);
  throw new Error(`[ruleset] unknown round mode: ${mode}`);
}

export function buildSeries(config, count, label = "series") {
  if (!config || typeof config !== "object") {
    throw new Error(`[ruleset] ${label} must be an object`);
  }
  const base = Number(config.base);
  const growthRate = Number(config.growthRate);
  const roundMode = config.round ?? "half_up";
  if (!Number.isFinite(base) || base < 0) {
    throw new Error(`[ruleset] ${label}.base must be >= 0`);
  }
  if (!Number.isFinite(growthRate) || growthRate < 0) {
    throw new Error(`[ruleset] ${label}.growthRate must be >= 0`);
  }
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error(`[ruleset] ${label} count must be > 0`);
  }
  const series = [];
  for (let index = 0; index < count; index += 1) {
    const value = base * Math.pow(1 + growthRate, index);
    series.push(roundValue(value, roundMode));
  }
  return series;
}
