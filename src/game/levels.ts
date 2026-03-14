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
  // Right wall: col 31 — solid everywhere EXCEPT the death gate zone
  for (let r = 0; r < ROWS; r++) {
    map[r][COLS - 1] = 1;
  }
  // Death gate: rows 9-12 (4 tiles tall), NPCs walk into wall and die
  for (let r = 9; r <= 12; r++) setTile(map, r, COLS - 1, 2);

  // === SECTION A: Spawn platform + Death gate ===
  // Continuous top platform: row 12, cols 3-30
  for (let c = 3; c <= 30; c++) setTile(map, 12, c, 1);

  // Left death pit: cols 1-2 have no platform, kill tiles at bottom
  for (let c = 1; c <= 2; c++) setTile(map, ROWS - 1, c, 2);

  // Excavator fall hole: cols 3-5 — completely open vertical drop
  for (let c = 3; c <= 5; c++) setTile(map, 12, c, 0);

  // Chamber wall at col 9, rows 13-16
  // Prevents NPCs from walking back toward the fall hole
  for (let r = 13; r <= 16; r++) setTile(map, r, 9, 1);

  // === SECTION B: Mid platform (Excavator) ===
  // Mid floor: row 17, cols 3-12
  for (let c = 3; c <= 12; c++) setTile(map, 17, c, 1);


  // Solid fill below mid floor (Excavator digs through this)
  // rows 18-22, cols 10-12 only (minimal mass, just the diggable column)
  for (let r = 18; r <= 22; r++) {
    for (let c = 10; c <= 12; c++) setTile(map, r, c, 1);
  }

  // Kill tiles under wrong excavation area (cols 3-9)
  for (let c = 3; c <= 9; c++) setTile(map, ROWS - 1, c, 2);

  // === SECTION C: Lower platform (Architect bridge) ===
  // Extended walking space: cols 10-23 so NPCs walk several tiles before hitting wall
  for (let c = 10; c <= 23; c++) setTile(map, 22, c, 1);

  // Right chamber wall removed — NPCs walk freely toward Architect bridge

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

// Level 3: Vessel introduction — sacrifice one NPC to cross kill tiles
function createLevel3(): LevelDef {
  const map = emptyMap();

  // Side walls
  for (let r = 0; r < ROWS; r++) {
    map[r][0] = 1;
    map[r][COLS - 1] = 1;
  }

  // === Spawn platform: row 8, cols 1-18 ===
  for (let c = 1; c <= 18; c++) setTile(map, 8, c, 1);
  for (let r = 9; r < ROWS; r++) {
    for (let c = 1; c <= 10; c++) setTile(map, r, c, 1);
  }

  // Fall hole: cols 11-13 (NPCs drop through)
  // cols 11-13 have no floor at row 8 already since we only built up to 18
  // Actually clear the hole explicitly
  for (let c = 11; c <= 13; c++) setTile(map, 8, c, 0);

  // === Lower platform: row 16, cols 5-28 ===
  for (let c = 5; c <= 28; c++) setTile(map, 16, c, 1);
  // Solid fill below
  for (let r = 17; r < ROWS; r++) {
    for (let c = 5; c <= 28; c++) setTile(map, r, c, 1);
  }

  // Wall under fall hole left edge to prevent walking back left
  for (let r = 9; r <= 15; r++) setTile(map, r, 11, 1);

  // === Kill tile strip on lower platform: row 15 (surface), cols 17-21 ===
  // Remove floor tiles and place kill tiles where NPCs walk
  for (let c = 17; c <= 21; c++) {
    setTile(map, 16, c, 2); // kill tiles on the walking surface
  }

  // Kill tiles at bottom of fall area for wrong drops
  for (let c = 1; c <= 4; c++) setTile(map, ROWS - 1, c, 2);

  // Exit platform on right side
  // Exit is at row 15 on top of the solid area
  const roles: Role[] = Array(12).fill("none") as Role[];
  roles[1] = "vessel";

  return {
    map,
    exitCol: 26,
    exitRow: 15,
    spawnX: 3 * TILE,
    spawnY: 7 * TILE - NPC_H,
    roles,
  };
}

// Level 3 intro: false victory — longer platform with a distant fake exit
function createLevel3Intro(): LevelDef {
  const map = emptyMap();

  // Side walls
  for (let r = 0; r < ROWS; r++) {
    map[r][0] = 1;
    map[r][COLS - 1] = 1;
  }

  // Lowered platform at row 18 (lower half of screen), cols 1-28 (doubled width)
  for (let c = 1; c <= 28; c++) setTile(map, 18, c, 1);
  // Solid fill below
  for (let r = 19; r < ROWS; r++) {
    for (let c = 1; c <= 28; c++) setTile(map, r, c, 1);
  }

  // Kill pit right side
  for (let c = 29; c < COLS - 1; c++) setTile(map, ROWS - 1, c, 2);

  const roles: Role[] = Array(12).fill("none") as Role[];

  return {
    map,
    exitCol: 26,
    exitRow: 17,
    spawnX: 3 * TILE,
    spawnY: 17 * TILE - NPC_H,
    roles,
  };
}

export const LEVELS: LevelDef[] = [createTutorial(), createLevel1(), createLevel2(), createLevel3Intro(), createLevel3()];

export function cloneLevelMap(level: LevelDef): number[][] {
  return level.map.map((row) => [...row]);
}
