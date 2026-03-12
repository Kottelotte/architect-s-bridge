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
// Flow: spawn upper-left → fall through cascading platforms → main floor →
// walk RIGHT into vertical wall → Anchor redirects LEFT → gap needs Architect → exit LEFT side
function createLevel1(): LevelDef {
  const map = emptyMap();

  // Side walls
  for (let r = 0; r < ROWS; r++) {
    map[r][0] = 1;
    map[r][COLS - 1] = 1;
  }

  // Spawn platform upper-left: cols 1-6, row 4
  for (let c = 1; c <= 6; c++) map[4][c] = 1;

  // Platform A: cols 10-16, row 8 (NPCs walk right off spawn, fall here)
  for (let c = 10; c <= 16; c++) map[8][c] = 1;

  // Platform B: cols 4-10, row 12 (NPCs walk left off A, fall here)
  for (let c = 4; c <= 10; c++) map[12][c] = 1;

  // Main floor: cols 1-28, row 17
  for (let c = 1; c <= 28; c++) map[17][c] = 1;

  // Fill below main floor
  for (let r = 18; r < ROWS; r++) {
    for (let c = 1; c < COLS - 1; c++) map[r][c] = 1;
  }

  // Vertical wall at col 25, rows 13-16 — blocks NPCs walking right
  for (let r = 13; r <= 16; r++) map[r][25] = 1;

  // After Anchor redirects left, NPCs walk toward a gap
  // Gap in main floor: cols 7-9 (3 tiles, left of center)
  for (let c = 7; c <= 9; c++) {
    map[17][c] = 0;
  }
  // Clear the pit below the gap
  for (let r = 18; r < ROWS - 1; r++) {
    for (let c = 7; c <= 9; c++) map[r][c] = 0;
  }
  // Kill tiles at gap bottom
  for (let c = 7; c <= 9; c++) map[ROWS - 1][c] = 2;

  // Exit on the left side of the gap: col 3, row 16
  // NPCs cross bridge over gap (cols 7-9), continue left to exit

  const roles: Role[] = Array(12).fill("none") as Role[];
  roles[1] = "architect";
  roles[3] = "anchor";

  return {
    map,
    exitCol: 3,
    exitRow: 16,
    spawnX: 2 * TILE,
    spawnY: 3 * TILE - NPC_H,
    roles,
  };
}

export const LEVELS: LevelDef[] = [createTutorial(), createLevel1()];

export function cloneLevelMap(level: LevelDef): number[][] {
  return level.map.map((row) => [...row]);
}
