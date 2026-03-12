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

  // Spawn platform: cols 0-11, row 15
  for (let c = 0; c < 12; c++) map[15][c] = 1;
  for (let r = 16; r < ROWS; r++) for (let c = 0; c < 12; c++) map[r][c] = 1;

  // Gap: cols 12-14

  // Exit platform: cols 15-31, row 15
  for (let c = 15; c < COLS; c++) map[15][c] = 1;
  for (let r = 16; r < ROWS; r++) for (let c = 15; c < COLS; c++) map[r][c] = 1;

  // Side walls
  for (let r = 0; r < ROWS; r++) {
    map[r][0] = 1;
    map[r][COLS - 1] = 1;
  }

  // Kill tiles at pit bottom
  for (let c = 12; c < 15; c++) map[ROWS - 1][c] = 2;

  const roles: Role[] = ["architect"];
  // rest are "none"

  return {
    map,
    exitCol: 28,
    exitRow: 14,
    spawnX: 3 * TILE,
    spawnY: 14 * TILE - NPC_H,
    totalNpc: 6,
    roles,
  };
}

// Level 1: wall obstacle + gap
function createLevel1(): LevelDef {
  const map = emptyMap();

  // Spawn platform: cols 0-8, row 15
  for (let c = 0; c < 9; c++) map[15][c] = 1;
  for (let r = 16; r < ROWS; r++) for (let c = 0; c < 9; c++) map[r][c] = 1;

  // Vertical wall at col 9, rows 10-14 (blocks walking NPCs)
  for (let r = 10; r < 15; r++) map[r][9] = 1;
  // Floor continues under wall: col 9 row 15
  map[15][9] = 1;
  for (let r = 16; r < ROWS; r++) map[r][9] = 1;

  // After wall: cols 10-14, row 15
  for (let c = 10; c < 15; c++) map[15][c] = 1;
  for (let r = 16; r < ROWS; r++) for (let c = 10; c < 15; c++) map[r][c] = 1;

  // Gap: cols 15-17 (3 tiles wide, needs architect)

  // Exit platform: cols 18-31, row 15
  for (let c = 18; c < COLS; c++) map[15][c] = 1;
  for (let r = 16; r < ROWS; r++) for (let c = 18; c < COLS; c++) map[r][c] = 1;

  // Side walls
  for (let r = 0; r < ROWS; r++) {
    map[r][0] = 1;
    map[r][COLS - 1] = 1;
  }

  // Kill tiles at pit bottom
  for (let c = 15; c < 18; c++) map[ROWS - 1][c] = 2;

  // Roles: first NPC = anchor (to redirect at wall), second = architect (to bridge gap)
  const roles: Role[] = ["anchor", "architect"];

  return {
    map,
    exitCol: 27,
    exitRow: 14,
    spawnX: 2 * TILE,
    spawnY: 14 * TILE - NPC_H,
    totalNpc: 10,
    roles,
  };
}

export const LEVELS: LevelDef[] = [createTutorial(), createLevel1()];

// Deep copy a level's map
export function cloneLevelMap(level: LevelDef): number[][] {
  return level.map.map((row) => [...row]);
}
