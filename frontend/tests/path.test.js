import test from "node:test";
import assert from "node:assert/strict";
import { GRID, PATH_RULES } from "../src/game/constants.js";
import { generatePath, isAdjacent } from "../src/game/path.js";
import { createRng, hashSeed } from "../src/game/rng.js";

function key(cell) {
  return `${cell.x},${cell.y}`;
}

test("generatePath produces deterministic, valid corridor", () => {
  const seed = hashSeed("mvp-seed-1");
  const rng = createRng(seed);
  const result = generatePath({
    rng,
    width: GRID.width,
    height: GRID.height,
  });
  assert.ok(result, "path should be generated");
  assert.equal(result.start.x, 0);
  assert.equal(result.end.x, GRID.width - 1);
  assert.deepEqual(result.cells[0], result.start);
  assert.deepEqual(result.cells[result.cells.length - 1], result.end);
  assert.ok(
    result.cells.length >= PATH_RULES.minLen &&
      result.cells.length <= PATH_RULES.maxLen,
    "path length should stay within bounds"
  );
  const unique = new Set(result.cells.map(key));
  assert.equal(unique.size, result.cells.length, "no repeated cells");
  for (let i = 1; i < result.cells.length; i += 1) {
    assert.ok(
      isAdjacent(result.cells[i - 1], result.cells[i]),
      `cells ${i - 1} and ${i} should be adjacent`
    );
  }

  const rng2 = createRng(seed);
  const again = generatePath({
    rng: rng2,
    width: GRID.width,
    height: GRID.height,
  });
  assert.ok(again, "path should be generated for same seed");
  assert.deepEqual(result.cells, again.cells, "paths should match for same seed");
});
