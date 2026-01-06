import { PATH_RULES } from "./constants.js";
import { randomInt, shuffle, weightedChoice } from "./rng.js";

function keyOf(cell) {
  return `${cell.x},${cell.y}`;
}

function inBounds(cell, width, height) {
  return cell.x >= 0 && cell.x < width && cell.y >= 0 && cell.y < height;
}

function pickStartEnd(rng, width, height) {
  const diagonals = [
    [
      { x: 0, y: 0 },
      { x: width - 1, y: height - 1 },
    ],
    [
      { x: 0, y: height - 1 },
      { x: width - 1, y: 0 },
    ],
  ];
  const pair = diagonals[randomInt(rng, 0, diagonals.length - 1)];
  if (rng() < 0.5) {
    return { start: pair[0], end: pair[1] };
  }
  return { start: pair[1], end: pair[0] };
}

function walkPath(rng, width, height, start, end, weights, maxLen) {
  const path = [start];
  const visited = new Set([keyOf(start)]);

  function step(current) {
    if (maxLen != null && path.length > maxLen) return false;
    if (maxLen != null) {
      const minSteps = Math.abs(end.x - current.x) + Math.abs(end.y - current.y);
      if (path.length + minSteps > maxLen) return false;
    }
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
  const targetSteps = minLen === maxLen ? minLen : null;
  while (attempts < maxRetries) {
    attempts += 1;
    const { start, end } = pickStartEnd(rng, width, height);
    const manhattan = Math.abs(end.x - start.x) + Math.abs(end.y - start.y);
    if (
      targetSteps != null &&
      targetSteps >= manhattan &&
      (targetSteps - manhattan) % 2 === 0
    ) {
      const moves = [];
      const stepX = end.x > start.x ? 1 : -1;
      const stepY = end.y > start.y ? 1 : -1;
      for (let i = 0; i < Math.abs(end.x - start.x); i += 1) {
        moves.push({ dx: stepX, dy: 0 });
      }
      for (let i = 0; i < Math.abs(end.y - start.y); i += 1) {
        moves.push({ dx: 0, dy: stepY });
      }
      shuffle(rng, moves);
      const path = [{ ...start }];
      let current = { ...start };
      for (const move of moves) {
        current = { x: current.x + move.dx, y: current.y + move.dy };
        path.push(current);
      }
      const targetCells = targetSteps + 1;
      if (path.length === targetCells) {
        return {
          start,
          end,
          cells: path,
        };
      }
      const visited = new Set(path.map((cell) => keyOf(cell)));
      let detourAttempts = 0;
      while (path.length < targetCells && detourAttempts < 120) {
        detourAttempts += 1;
        insertDetour(rng, path, visited, width, height);
      }
      if (path.length === targetCells) {
        return {
          start,
          end,
          cells: path,
        };
      }
      continue;
    }
    const result = walkPath(
      rng,
      width,
      height,
      start,
      end,
      weights,
      maxLen + 1
    );
    if (!result) {
      continue;
    }

    const { path, visited } = result;
    if (targetSteps != null && path.length > targetSteps + 1) {
      continue;
    }
    if (path.length > maxLen + 1) {
      continue;
    }

    if (targetSteps != null && (targetSteps + 1 - path.length) % 2 !== 0) {
      continue;
    }

    let detourAttempts = 0;
    while (path.length < minLen + 1 && detourAttempts < 80) {
      detourAttempts += 1;
      insertDetour(rng, path, visited, width, height);
    }

    if (path.length < minLen + 1 || path.length > maxLen + 1) {
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
