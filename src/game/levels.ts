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

  // Vertical wall at col 25 — short wall (rows 15-16) to redirect NPCs
  // Only 2 tiles tall so NPCs bounce off but don't get trapped
  for (let r = 15; r <= 16; r++) map[r][25] = 1;

  // Gap in main floor: cols 13-16 (4 tiles wide, right of center)
  // This gap is between spawn-side and the wall — NPCs walking RIGHT
  // will fall into it UNLESS Anchor redirects them first at col 25,
  // then they walk LEFT past the gap area... 
  // 
  // Actually: NPCs walk right → hit wall at 25 → bounce left → 
  // need Anchor placed BEFORE the gap so they get redirected again.
  //
  // Better design: gap is to the LEFT of the wall, so NPCs walking
  // right pass over it (no gap yet), hit wall, bounce left, then
  // fall into gap. Anchor must be placed to redirect BEFORE hitting wall,
  // sending them left toward the gap which needs Architect bridge.
  //
  // Clearest design:
  // NPCs walk right → reach wall at col 25 → bounce left naturally →
  // walk left into gap at cols 7-9 → need Architect bridge.
  // But we need Anchor to be required too.
  //
  // Solution: After bouncing off wall, NPCs walk left. Put a SECOND wall
  // at col 12 (rows 15-16) so they bounce right again → trapped between
  // walls. Player places Anchor between the walls to redirect them left
  // past the second wall. Gap is at cols 5-7, left of second wall.

  // Second wall at col 12, rows 15-16
  for (let r = 15; r <= 16; r++) map[r][12] = 1;

  // Gap in main floor: cols 5-7
  for (let c = 5; c <= 7; c++) {
    map[17][c] = 0;
  }
  // Clear pit below gap
  for (let r = 18; r < ROWS - 1; r++) {
    for (let c = 5; c <= 7; c++) map[r][c] = 0;
  }
  // Kill tiles at gap bottom
  for (let c = 5; c <= 7; c++) map[ROWS - 1][c] = 2;

  // Exit: col 2, row 16 (left of gap, NPCs cross bridge then reach exit)

  const roles: Role[] = Array(12).fill("none") as Role[];
  roles[1] = "architect";
  roles[3] = "anchor";

  return {
    map,
    exitCol: 2,
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
