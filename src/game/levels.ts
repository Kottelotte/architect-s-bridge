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

// Level 2: Anchor → Excavator → Architect
// Flow: Spawn mid-platform → walk RIGHT toward death pit → Anchor stops march
//       → reversed NPCs walk LEFT → fall through left hole → mid platform
//       → Excavator digs shaft down → lower platform → Architect bridges gap → exit
function createLevel2(): LevelDef {
  const map = emptyMap();

  // Side walls
  for (let r = 0; r < ROWS; r++) {
    map[r][0] = 1;
    map[r][COLS - 1] = 1;
  }

  // === SECTION A: Top platform with death wall (Anchor teaching) ===
  // Continuous solid platform: row 9, cols 1-26
  for (let c = 1; c <= 26; c++) setTile(map, 9, c, 1);

  // Sky opening: cols 2-3 (visual — NPCs walk right first, never reach here)
  setTile(map, 9, 2, 0);
  setTile(map, 9, 3, 0);

  // Death pit right side: cols 27-28 are open with kill tiles at bottom
  // First NPC walks off col 26 edge → falls → dies on kill tiles
  // This teaches the player they MUST use Anchor to stop the march
  for (let r = 10; r <= ROWS - 2; r++) {
    setTile(map, r, 27, 0);
    setTile(map, r, 28, 0);
  }
  // Tall visual wall at col 29 (beside side wall) to frame the death pit
  for (let r = 5; r <= ROWS - 2; r++) setTile(map, r, 29, 1);
  // Kill tiles at bottom of death pit
  for (let c = 27; c <= 29; c++) setTile(map, ROWS - 1, c, 2);

  // Left fall hole: cols 7-8 removed from top platform
  // After Anchor redirects NPCs left, they fall through here
  setTile(map, 9, 7, 0);
  setTile(map, 9, 8, 0);

  // === SECTION B: Mid platform (Excavator) ===
  // NPCs land here after falling through left hole
  // Mid floor: row 14, cols 1-15
  for (let c = 1; c <= 15; c++) setTile(map, 14, c, 1);

  // Wall blocking rightward escape from mid level: col 16, rows 10-14
  for (let r = 10; r <= 14; r++) setTile(map, r, 16, 1);

  // Solid fill below mid floor (Excavator digs through this)
  // rows 15-19, cols 1-15
  for (let r = 15; r <= 19; r++) {
    for (let c = 1; c <= 15; c++) setTile(map, r, c, 1);
  }

  // Kill tiles under wrong excavation area (cols 1-9)
  // If Excavator digs too far left, NPCs fall to death
  for (let c = 1; c <= 9; c++) setTile(map, 20, c, 2);

  // === SECTION C: Lower platform (Architect bridge) ===
  // Safe landing from correct excavation (cols 10-11 shaft): row 19, cols 10-20
  for (let c = 10; c <= 20; c++) setTile(map, 19, c, 1);

  // Blocking wall: col 20, rows 10-18 — prevents shortcut to exit
  for (let r = 10; r <= 18; r++) setTile(map, r, 20, 1);

  // Gap: cols 21-23 (needs Architect bridge)

  // Exit platform: row 19, cols 24-30
  for (let c = 24; c <= 30; c++) setTile(map, 19, c, 1);

  // Solid fill below lower platforms
  for (let r = 20; r < ROWS; r++) {
    for (let c = 10; c <= 20; c++) setTile(map, r, c, 1);
    for (let c = 24; c <= 30; c++) setTile(map, r, c, 1);
  }

  // Kill tiles in Architect gap at bottom
  for (let c = 21; c <= 23; c++) setTile(map, ROWS - 1, c, 2);

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
