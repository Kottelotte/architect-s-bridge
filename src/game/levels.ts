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
// Flow: NPCs cascade down platforms → land on floor → walk right → floor ends
// (open pit on right) → Anchor needed to redirect left → gap on left needs Architect → exit
function createLevel1(): LevelDef {
  const map = emptyMap();

  // Side walls (left only — right side is open pit)
  for (let r = 0; r < ROWS; r++) {
    map[r][0] = 1;
  }

  // Spawn platform upper-left: cols 1-6, row 4
  for (let c = 1; c <= 6; c++) map[4][c] = 1;

  // Platform A: cols 10-16, row 8
  for (let c = 10; c <= 16; c++) map[8][c] = 1;

  // Platform B: cols 4-10, row 12
  for (let c = 4; c <= 10; c++) map[12][c] = 1;

  // Main floor: cols 1-22, row 17 (floor ENDS at col 22 — open right edge)
  for (let c = 1; c <= 22; c++) map[17][c] = 1;

  // Fill below main floor
  for (let r = 18; r < ROWS; r++) {
    for (let c = 1; c <= 22; c++) map[r][c] = 1;
  }

  // Right pit: cols 23-31 are empty — NPCs walking right fall and die
  // Kill tiles at bottom of right pit
  for (let c = 23; c < COLS; c++) map[ROWS - 1][c] = 2;

  // Player must place Anchor near col 22 to redirect NPCs LEFT before they fall.
  // After redirect, NPCs walk left toward a gap.

  // Gap in main floor: cols 8-10 (left side)
  for (let c = 8; c <= 10; c++) {
    map[17][c] = 0;
  }
  // Clear pit below gap
  for (let r = 18; r < ROWS - 1; r++) {
    for (let c = 8; c <= 10; c++) map[r][c] = 0;
  }
  // Kill tiles at gap bottom
  for (let c = 8; c <= 10; c++) map[ROWS - 1][c] = 2;

  // Exit: col 3, row 16 (left of gap — NPCs cross Architect bridge, continue left to exit)

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
