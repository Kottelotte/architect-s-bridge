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

// Level 2: Anchor + Excavator + Architect
// Flow: Spawn mid-right on top floor → walk right → open pit → Anchor redirects left
//       → fall through drop hole → mid platform → Excavator digs shaft down
//       → lower platform → gap → Architect bridges → exit
function createLevel2(): LevelDef {
  const map = emptyMap();

  // Side walls
  for (let r = 0; r < ROWS; r++) {
    map[r][0] = 1;
    map[r][COLS - 1] = 1;
  }

  // === SECTION A: Top floor with Anchor redirect (lowered +2) ===
  // Top floor: row 9, cols 1-25
  for (let c = 1; c <= 25; c++) map[9][c] = 1;
  // Drop hole in top floor: cols 5-6
  map[9][5] = 0;
  map[9][6] = 0;

  // Top floor is 1 tile thick (row 9 only) — no fill below, revealing background sky

  // Right pit: cols 26-30 open with kill tiles at bottom
  for (let c = 26; c <= 30; c++) map[ROWS - 1][c] = 2;

  // === SECTION B: Mid platform with Excavator (lowered +2) ===
  // Mid floor: row 14, cols 1-15
  for (let c = 1; c <= 15; c++) map[14][c] = 1;

  // Tall wall on right blocking passage: col 16, rows 10-14
  for (let r = 10; r <= 14; r++) map[r][16] = 1;

  // Solid fill below mid floor: rows 15-19, cols 1-15
  for (let r = 15; r <= 19; r++) {
    for (let c = 1; c <= 15; c++) map[r][c] = 1;
  }

  // Kill tiles under wrong excavation area (cols 1-9 at row 20)
  for (let c = 1; c <= 9; c++) map[20][c] = 2;

  // === SECTION C: Lower platform with Architect bridge (lowered +1) ===
  // Safe landing from correct excavation: row 19, cols 10-20
  for (let c = 10; c <= 20; c++) map[19][c] = 1;
  // Gap: cols 21-23 (needs Architect bridge)
  // Exit platform: row 19, cols 24-30
  for (let c = 24; c <= 30; c++) map[19][c] = 1;

  // Solid fill below lower platforms
  for (let r = 20; r < ROWS; r++) {
    for (let c = 10; c <= 20; c++) map[r][c] = 1;
    for (let c = 24; c <= 30; c++) map[r][c] = 1;
  }

  // Kill tiles in gap at bottom
  for (let c = 21; c <= 23; c++) map[ROWS - 1][c] = 2;

  // Roles: early indices so they're available even with few survivors
  const roles: Role[] = Array(12).fill("none") as Role[];
  roles[0] = "anchor";
  roles[1] = "excavator";
  roles[2] = "architect";

  return {
    map,
    exitCol: 28,
    exitRow: 18,
    spawnX: 15 * TILE,
    spawnY: 8 * TILE - NPC_H,
    roles,
  };
}

export const LEVELS: LevelDef[] = [createTutorial(), createLevel1(), createLevel2()];

export function cloneLevelMap(level: LevelDef): number[][] {
  return level.map.map((row) => [...row]);
}
