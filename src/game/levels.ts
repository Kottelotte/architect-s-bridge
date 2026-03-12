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

  const roles: Role[] = ["architect"];

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
// Flow: spawn upper-left → fall to middle platform → walk right into wall →
// Anchor redirects left → gap needs Architect bridge → exit on far side
function createLevel1(): LevelDef {
  const map = emptyMap();

  // Side walls
  for (let r = 0; r < ROWS; r++) {
    map[r][0] = 1;
    map[r][COLS - 1] = 1;
  }

  // Spawn platform upper-left: cols 1-5, row 6
  for (let c = 1; c <= 5; c++) map[6][c] = 1;

  // Main middle platform: cols 1-22, row 14
  // NPCs fall from spawn onto this
  for (let c = 1; c <= 22; c++) map[14][c] = 1;

  // Vertical wall at col 22, rows 10-13 — blocks NPCs walking right
  for (let r = 10; r < 14; r++) map[r][22] = 1;

  // After being redirected left by Anchor, NPCs walk left toward gap
  // Gap in middle platform: cols 8-10 (3 tiles wide, needs Architect)
  for (let c = 8; c <= 10; c++) map[14][c] = 0;

  // Exit platform left of gap: cols 1-7, row 14 already placed
  // But exit is on the LEFT side past the gap

  // Exit platform: cols 1-7 already have floor at row 14
  // Place exit at col 3, row 13
  
  // Fill below platforms
  for (let r = 15; r < ROWS; r++) {
    for (let c = 1; c < COLS - 1; c++) map[r][c] = 1;
  }

  // Clear the gap pit: cols 8-10
  for (let r = 15; r < ROWS - 1; r++) {
    for (let c = 8; c <= 10; c++) map[r][c] = 0;
  }
  // Kill tiles at gap bottom
  for (let c = 8; c <= 10; c++) map[ROWS - 1][c] = 2;

  // Roles: anchor first (NPC id 0), architect second (NPC id 1)
  const roles: Role[] = ["anchor", "architect"];

  return {
    map,
    exitCol: 3,
    exitRow: 13,
    spawnX: 2 * TILE,
    spawnY: 5 * TILE - NPC_H,
    roles,
  };
}

export const LEVELS: LevelDef[] = [createTutorial(), createLevel1()];

export function cloneLevelMap(level: LevelDef): number[][] {
  return level.map.map((row) => [...row]);
}
