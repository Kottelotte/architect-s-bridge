import { LevelDef, Role } from "./types";
import { COLS, ROWS, TILE, NPC_H } from "./constants";

function emptyMap(): number[][] {
  const map: number[][] = [];
  for (let r = 0; r < ROWS; r++) {
    map[r] = [];
    for (let c = 0; c < COLS; c++) {
      map[r][c] = 0;
    }
  }
  return map;
}

/** Safe tile write — silently ignores out-of-bounds coordinates */
function setTile(map: number[][], r: number, c: number, v: number) {
  if (r >= 0 && r < map.length && c >= 0 && c < (map[0]?.length ?? 0)) {
    map[r][c] = v;
  }
}

// Tutorial: simple gap, architect only
function createTutorial(): LevelDef {
  const map = emptyMap();

  // Main floor at row 18
  for (let c = 0; c < 12; c++) map[18][c] = 1;
  for (let r = 19; r < ROWS; r++) for (let c = 0; c < 12; c++) map[r][c] = 1;

  // Gap: cols 12-14

  // Exit platform: cols 15-31, row 18
  for (let c = 15; c < COLS; c++) map[18][c] = 1;
  for (let r = 19; r < ROWS; r++) for (let c = 15; c < COLS; c++) map[r][c] = 1;

  // Side walls
  for (let r = 0; r < ROWS; r++) {
    map[r][0] = 1;
    map[r][COLS - 1] = 1;
  }

  // Kill tiles at pit bottom
  for (let c = 12; c < 15; c++) map[ROWS - 1][c] = 2;

  const roles: Role[] = Array(12).fill("none") as Role[];
  roles[0] = "architect";

  return {
    map,
    exitCol: 28,
    exitRow: 17,
    spawnX: 3 * TILE,
    spawnY: 17 * TILE - NPC_H,
    roles,
  };
}

// Level 1: Anchor + Architect required
function createLevel1(): LevelDef {
  const map = emptyMap();

  for (let r = 0; r < ROWS; r++) {
    map[r][0] = 1;
  }

  for (let c = 1; c <= 6; c++) map[4][c] = 1;
  for (let c = 10; c <= 16; c++) map[8][c] = 1;
  for (let c = 4; c <= 10; c++) map[12][c] = 1;

  for (let c = 1; c <= 22; c++) map[17][c] = 1;
  for (let r = 18; r < ROWS; r++) {
    for (let c = 1; c <= 22; c++) map[r][c] = 1;
  }

  for (let c = 23; c < COLS; c++) map[ROWS - 1][c] = 2;

  for (let c = 8; c <= 10; c++) {
    map[17][c] = 0;
  }
  for (let r = 18; r < ROWS - 1; r++) {
    for (let c = 8; c <= 10; c++) map[r][c] = 0;
  }
  for (let c = 8; c <= 10; c++) map[ROWS - 1][c] = 2;

  const roles: Role[] = Array(12).fill("none") as Role[];
  roles[1] = "anchor";
  roles[3] = "architect";

  return {
    map,
    exitCol: 3,
    exitRow: 16,
    spawnX: 2 * TILE,
    spawnY: 3 * TILE - NPC_H,
    roles,
  };
}

// Level 2: Death gate (in right wall) → Anchor redirect → Excavator drop → Architect bridge → Exit
// Layout: open airy design with minimal solid mass. Death gate integrated into right boundary.
// Left edge is a fatal drop. Single controlled fall hole for Excavator section.
// All geometry shifted +3 rows down for background horizon visibility.
function createLevel2(): LevelDef {
  const map = emptyMap();

  // === Boundary walls ===
  // Left wall: col 0 (solid except leave cols 1-2 open for left death pit)
  for (let r = 0; r < ROWS; r++) {
    map[r][0] = 1;
  }
  // Right wall: col 31 — solid everywhere EXCEPT the death gate zone
  for (let r = 0; r < ROWS; r++) {
    map[r][COLS - 1] = 1;
  }
  // Death gate: kill zone raised by 1 tile → rows 8-11 (4 tiles tall)
  // Bottom of gate (row 12) is now normal wall so NPCs visibly enter before dying
  for (let r = 8; r <= 11; r++) setTile(map, r, COLS - 1, 2);

  // === SECTION A: Spawn platform + Death gate ===
  // Continuous top platform: row 12, cols 3-30
  for (let c = 3; c <= 30; c++) setTile(map, 12, c, 1);

  // Left death pit: cols 1-2 have no platform, kill tiles at bottom
  for (let c = 1; c <= 2; c++) setTile(map, ROWS - 1, c, 2);

  // Excavator fall hole: cols 5-6 — clean vertical drop, no right wall
  // Open from col 5 leftward to col 3 (no narrow corridor)
  for (let c = 3; c <= 6; c++) setTile(map, 12, c, 0);

  // === SECTION B: Mid platform (Excavator) ===
  // NPCs fall through hole, land on mid platform
  // Mid floor: row 17, cols 3-12 (trimmed right to reduce terrain mass)
  for (let c = 3; c <= 12; c++) setTile(map, 17, c, 1);

  // Wall blocking rightward escape from mid level: col 13, rows 13-17
  for (let r = 13; r <= 17; r++) setTile(map, r, 13, 1);

  // Solid fill below mid floor (Excavator digs through this)
  // rows 18-22, cols 3-12 (reduced footprint)
  for (let r = 18; r <= 22; r++) {
    for (let c = 3; c <= 12; c++) setTile(map, r, c, 1);
  }

  // Kill tiles under wrong excavation area (cols 3-9)
  for (let c = 3; c <= 9; c++) setTile(map, ROWS - 1, c, 2);

  // === SECTION C: Lower platform (Architect bridge) ===
  // Extended walking space: cols 10-23 so NPCs walk several tiles before hitting wall
  for (let c = 10; c <= 23; c++) setTile(map, 22, c, 1);

  // Blocking wall: col 23, rows 13-21 — moved right for more walking/realization space
  for (let r = 13; r <= 21; r++) setTile(map, r, 23, 1);

  // Gap: cols 24-26 (needs Architect bridge)

  // Exit platform: row 22, cols 27-30
  for (let c = 27; c <= 30; c++) setTile(map, 22, c, 1);

  // Solid fill below lower platforms
  for (let r = 23; r < ROWS; r++) {
    for (let c = 10; c <= 23; c++) setTile(map, r, c, 1);
    for (let c = 27; c <= 30; c++) setTile(map, r, c, 1);
  }

  // Kill tiles in Architect gap at bottom
  for (let c = 24; c <= 26; c++) setTile(map, ROWS - 1, c, 2);

  // Roles: NPC 0 = none (dies in death gate), 1 = anchor, 2 = excavator, 3 = architect
  const roles: Role[] = Array(12).fill("none") as Role[];
  roles[1] = "anchor";
  roles[2] = "excavator";
  roles[3] = "architect";

  return {
    map,
    exitCol: 28,
    exitRow: 21,
    spawnX: 15 * TILE,
    spawnY: 11 * TILE - NPC_H,
    roles,
  };
}

export const LEVELS: LevelDef[] = [createTutorial(), createLevel1(), createLevel2()];

export function cloneLevelMap(level: LevelDef): number[][] {
  return level.map.map((row) => [...row]);
}
