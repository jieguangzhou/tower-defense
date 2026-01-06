import { PATH_RULES } from "./constants.js";
import { randomInt, weightedChoice } from "./rng.js";

function keyOf(cell) {
  return `${cell.x},${cell.y}`;
}

function inBounds(cell, width, height) {
  return cell.x >= 0 && cell.x < width && cell.y >= 0 && cell.y < height;
}

function pickStartEnd(rng, width, height) {
  return {
    start: { x: 0, y: randomInt(rng, 0, height - 1) },
    end: { x: width - 1, y: randomInt(rng, 0, height - 1) },
  };
}

function walkPath(rng, width, height, start, end, weights) {
  const path = [start];
  const visited = new Set([keyOf(start)]);

  function step(current) {
    if (current.x === end.x && current.y === end.y) return true;

    const candidates = weights
      .map((dir) => ({
        ...dir,
        x: current.x + dir.dx,
        y: current.y + dir.dy,
      }))
      .filter((cell) =>
        inBounds(cell, width, height) && !visited.has(keyOf(cell))
      );

    while (candidates.length > 0) {
      const picked = weightedChoice(rng, candidates);
      const index = candidates.indexOf(picked);
      if (index !== -1) {
        candidates.splice(index, 1);
      }
      const next = { x: picked.x, y: picked.y };
      visited.add(keyOf(next));
      path.push(next);

      if (step(next)) return true;

      path.pop();
      visited.delete(keyOf(next));
    }

    return false;
  }

  const success = step(start);
  if (!success) return null;
  return { path, visited };
}

function insertDetour(rng, path, visited, width, height) {
  if (path.length < 3) return false;
  const minIndex = 1;
  const maxIndex = path.length - 2;
  const index = randomInt(rng, minIndex, maxIndex);
  const from = path[index];
  const to = path[index + 1];

  const candidates = [];
  if (from.x === to.x) {
    candidates.push({ dx: -1, dy: 0 });
    candidates.push({ dx: 1, dy: 0 });
  } else if (from.y === to.y) {
    candidates.push({ dx: 0, dy: -1 });
    candidates.push({ dx: 0, dy: 1 });
  } else {
    return false;
  }

  while (candidates.length > 0) {
    const pick = candidates.splice(randomInt(rng, 0, candidates.length - 1), 1)[0];
    const detourA = { x: from.x + pick.dx, y: from.y + pick.dy };
    const detourB = { x: to.x + pick.dx, y: to.y + pick.dy };
    if (!inBounds(detourA, width, height) || !inBounds(detourB, width, height)) {
      continue;
    }
    if (visited.has(keyOf(detourA)) || visited.has(keyOf(detourB))) {
      continue;
    }

    path.splice(index + 1, 0, detourA, detourB);
    visited.add(keyOf(detourA));
    visited.add(keyOf(detourB));
    return true;
  }

  return false;
}

export function generatePath({
  rng,
  width,
  height,
  minLen = PATH_RULES.minLen,
  maxLen = PATH_RULES.maxLen,
  weights = PATH_RULES.weights,
  maxRetries = PATH_RULES.maxRetries,
}) {
  let attempts = 0;
  while (attempts < maxRetries) {
    attempts += 1;
    const { start, end } = pickStartEnd(rng, width, height);
    const result = walkPath(rng, width, height, start, end, weights);
    if (!result) {
      continue;
    }

    const { path, visited } = result;
    if (path.length > maxLen) {
      continue;
    }

    let detourAttempts = 0;
    while (path.length < minLen && detourAttempts < 80) {
      detourAttempts += 1;
      insertDetour(rng, path, visited, width, height);
    }

    if (path.length < minLen || path.length > maxLen) {
      continue;
    }

    return {
      start,
      end,
      cells: path,
    };
  }

  return null;
}

export function buildPathSet(pathCells) {
  const set = new Set();
  for (const cell of pathCells) {
    set.add(keyOf(cell));
  }
  return set;
}

export function isAdjacent(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
}
