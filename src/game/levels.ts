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
// Level 3 real puzzle: Anchor → Excavator → Vessel → Architect
// Layout: upper spawn → drop → Anchor reversal → Excavator shaft → Vessel kill zone → Architect bridge → exit
function createLevel3(): LevelDef {
  const map = emptyMap();

  // Side walls
  for (let r = 0; r < ROWS; r++) {
    map[r][0] = 1;
    map[r][COLS - 1] = 1;
  }

  // === SECTION 1: Upper spawn platform ===
  // Row 8, cols 1-14 — NPCs spawn left, walk right, drop off edge
  for (let c = 1; c <= 14; c++) setTile(map, 8, c, 1);

  // === SECTION 2: Mid platform (Anchor section) ===
  // Row 13, cols 10-28 — NPCs land here after dropping from spawn
  for (let c = 10; c <= 28; c++) setTile(map, 13, c, 1);

  // Right wall at col 29, rows 9-12 — stops NPCs, need Anchor before this
  for (let r = 9; r <= 12; r++) setTile(map, r, 29, 1);

  // === SECTION 3: Excavator dig zone ===
  // Diggable column at cols 12-13, rows 14-21 (8 rows deep)
  // Ends exactly at row 22 platform
  for (let r = 14; r <= 21; r++) {
    for (let c = 12; c <= 13; c++) setTile(map, r, c, 1);
  }

  // Wall to prevent NPCs walking left off bottom platform
  for (let r = 14; r <= 21; r++) setTile(map, r, 5, 1);

  // === SECTION 4: Bottom platform (Vessel + Architect) ===
  // Safe landing + walk zone: cols 5-15 at row 22
  // NPCs land at cols 12-13 after Excavator dig, then walk right through 14-15
  for (let c = 5; c <= 15; c++) setTile(map, 22, c, 1);

  // Kill zone: cols 16-20 on row 22 — several tiles away from landing
  // Player has time to activate Vessel while NPCs walk cols 13→15
  for (let c = 16; c <= 20; c++) setTile(map, 22, c, 2);

  // Post-kill-zone platform: cols 21-25
  for (let c = 21; c <= 25; c++) setTile(map, 22, c, 1);

  // Solid fill below safe landing & post-vessel platforms only
  for (let r = 23; r < ROWS; r++) {
    for (let c = 5; c <= 15; c++) setTile(map, r, c, 1);
    for (let c = 21; c <= 25; c++) setTile(map, r, c, 1);
  }
  // NO solid fill below exit tile (col 30) — Excavator can't dig to it

  // Kill tiles at bottom of all gaps/pits
  for (let c = 1; c <= 4; c++) setTile(map, ROWS - 1, c, 2);   // left death pit
  for (let c = 16; c <= 20; c++) setTile(map, ROWS - 1, c, 2); // under kill zone
  for (let c = 26; c <= 30; c++) setTile(map, ROWS - 1, c, 2); // architect gap + exit underside

  // Roles: Anchor → Excavator → Vessel → Architect
  const roles: Role[] = Array(12).fill("none") as Role[];
  roles[1] = "anchor";
  roles[2] = "excavator";
  roles[3] = "vessel";
  roles[4] = "architect";

  return {
    map,
    exitCol: 30,
    exitRow: 18,
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
