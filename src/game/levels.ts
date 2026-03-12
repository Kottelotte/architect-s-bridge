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

  // Main floor at row 18 (lowered by 3 from row 15)
  // Spawn platform: cols 0-11, row 18
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

// Level 1: vertical flow with wall + gap
function createLevel1(): LevelDef {
  const map = emptyMap();

  // Spawn platform upper-left: cols 1-6, row 8
  for (let c = 1; c < 7; c++) map[8][c] = 1;

  // Middle platform: cols 1-14, row 14 (NPCs fall down from spawn)
  for (let c = 1; c < 15; c++) map[14][c] = 1;

  // Vertical wall at col 15, rows 9-13 (blocks walking NPCs, need Anchor)
  for (let r = 9; r < 14; r++) map[r][15] = 1;
  // Floor continues under wall
  map[14][15] = 1;

  // Platform after wall: cols 16-20, row 14
  for (let c = 16; c < 21; c++) map[14][c] = 1;

  // Gap: cols 21-23 (needs Architect bridge)

  // Exit platform: cols 24-30, row 14
  for (let c = 24; c < COLS - 1; c++) map[14][c] = 1;

  // Side walls
  for (let r = 0; r < ROWS; r++) {
    map[r][0] = 1;
    map[r][COLS - 1] = 1;
  }

  // Bottom fill under platforms
  for (let r = 15; r < ROWS; r++) {
    for (let c = 1; c < COLS - 1; c++) map[r][c] = 1;
  }

  // Kill tiles at gap bottom
  for (let c = 21; c < 24; c++) map[15][c] = 0; // clear fill
  for (let c = 21; c < 24; c++) map[ROWS - 1][c] = 2;
  // Clear gap column
  for (let r = 15; r < ROWS - 1; r++) for (let c = 21; c < 24; c++) map[r][c] = 0;

  const roles: Role[] = ["anchor", "architect"];

  return {
    map,
    exitCol: 28,
    exitRow: 13,
    spawnX: 2 * TILE,
    spawnY: 7 * TILE - NPC_H,
    roles,
  };
}

export const LEVELS: LevelDef[] = [createTutorial(), createLevel1()];

export function cloneLevelMap(level: LevelDef): number[][] {
  return level.map.map((row) => [...row]);
}
