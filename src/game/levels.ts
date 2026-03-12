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

  // Deterministic roles: NPC 0 = architect, rest = none
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

// Level 1: Cascading platforms, Anchor + Architect required
// Flow: spawn upper-left → fall to platform A → fall to platform B → main floor →
// walk right into wall → Anchor redirects left → gap needs Architect bridge → exit
function createLevel1(): LevelDef {
  const map = emptyMap();

  // Side walls
  for (let r = 0; r < ROWS; r++) {
    map[r][0] = 1;
    map[r][COLS - 1] = 1;
  }

  // Spawn platform upper-left: cols 1-5, row 4
  for (let c = 1; c <= 5; c++) map[4][c] = 1;

  // Platform A: cols 8-14, row 8 (NPCs fall right from spawn)
  for (let c = 8; c <= 14; c++) map[8][c] = 1;

  // Platform B: cols 3-9, row 12 (NPCs fall left from A)
  for (let c = 3; c <= 9; c++) map[12][c] = 1;

  // Main floor: cols 1-24, row 17
  for (let c = 1; c <= 24; c++) map[17][c] = 1;

  // Vertical wall at col 24, rows 13-16 — blocks NPCs walking right
  for (let r = 13; r < 17; r++) map[r][24] = 1;

  // After Anchor redirects left, NPCs walk toward gap
  // Gap in main floor: cols 11-13 (3 tiles wide, needs Architect)
  for (let c = 11; c <= 13; c++) map[17][c] = 0;

  // Exit platform left of gap: cols 1-10 already have floor at row 17
  // Exit at col 3, row 16

  // Fill below main floor
  for (let r = 18; r < ROWS; r++) {
    for (let c = 1; c < COLS - 1; c++) map[r][c] = 1;
  }

  // Clear the gap pit: cols 11-13
  for (let r = 18; r < ROWS - 1; r++) {
    for (let c = 11; c <= 13; c++) map[r][c] = 0;
  }
  // Kill tiles at gap bottom
  for (let c = 11; c <= 13; c++) map[ROWS - 1][c] = 2;

  // Deterministic roles: NPC 1 = architect, NPC 3 = anchor
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
