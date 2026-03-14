import { useEffect, useRef, useCallback } from "react";
import type { NPC, GameState, TransitionPhase } from "../game/types";
import {
  TILE, COLS, ROWS, W, H, NPC_W, NPC_H, SPEED, GRAVITY, MAX_FALL,
  SPAWN_INTERVAL, BRIDGE_TILES, BRIDGE_DELAY, GLITCH_DURATION,
  ANCHOR_PUSH, TYPEWRITER_SPEED, STATIC_DURATION, TRANSITION_TEXT,
  TOTAL_NPCS, FAIL_MESSAGES, EXCAVATE_DEPTH, EXCAVATE_DELAY,
} from "../game/constants";
import { LEVELS, cloneLevelMap } from "../game/levels";
import { playBuildTick, playAnchorClick, playFleshTear, startTransitionHum, stopTransitionHum, startAmbientDrone } from "../game/audio";

// --- HELPERS ---
function isSolid(map: number[][], col: number, row: number): boolean {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return true;
  return map[row][col] === 1;
}

function isKill(map: number[][], col: number, row: number): boolean {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return false;
  return map[row][col] === 2;
}

function initState(levelIndex: number): GameState {
  const level = LEVELS[levelIndex];
  return {
    map: cloneLevelMap(level),
    npcs: [],
    spawnTimer: 0,
    spawnCount: 0,
    lastTime: 0,
    mouseX: -1,
    mouseY: -1,
    hoveredNpcId: null,
    rescued: 0,
    dead: 0,
    pauseTimer: 0,
    currentLevel: levelIndex,
    exitCol: level.exitCol,
    exitRow: level.exitRow,
    spawnX: level.spawnX,
    spawnY: level.spawnY,
    totalNpc: TOTAL_NPCS,
    roles: level.roles,
    transition: "none",
    transitionTimer: 0,
    transitionText: "",
    transitionCharIndex: 0,
    inputDisabled: false,
    failMessage: "",
  };
}

// --- COMPONENT ---
// Martyr horizon visibility caps per level index
const MARTYR_CAPS: Record<number, number> = { 0: 0, 1: 1, 2: 3, 3: 3, 4: Infinity };
// Seeded pseudo-random positions for martyrs (asymmetric, clustered)
function generateMartyrPositions(count: number): number[] {
  const positions: number[] = [];
  let seed = 7919;
  const seededRand = () => { seed = (seed * 16807 + 0) % 2147483647; return seed / 2147483647; };
  // Generate clustered, irregular positions in 0.1–0.9 range
  const clusters = [0.2, 0.35, 0.55, 0.7, 0.85];
  for (let i = 0; i < count; i++) {
    const cluster = clusters[i % clusters.length];
    const offset = (seededRand() - 0.5) * 0.12;
    positions.push(Math.max(0.08, Math.min(0.92, cluster + offset + seededRand() * 0.04)));
  }
  return positions;
}

const Index = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(initState(0));
  const globalMartyrsRef = useRef<number>(0);
  const martyrPositionsRef = useRef<number[]>(generateMartyrPositions(50));
  const survivorsRef = useRef<number>(TOTAL_NPCS);

  const getNpcAt = useCallback((x: number, y: number): NPC | null => {
    const { npcs } = stateRef.current;
    const hw = NPC_W * 2;
    const hh = NPC_H * 2;
    for (let i = npcs.length - 1; i >= 0; i--) {
      const n = npcs[i];
      if (!n.isAlive || n.isRescued) continue;
      if (n.countsAsDead) continue;
      const cx = n.x + NPC_W / 2;
      const cy = n.y + NPC_H / 2;
      if (x >= cx - hw / 2 && x <= cx + hw / 2 && y >= cy - hh / 2 && y <= cy + hh / 2) return n;
    }
    return null;
  }, []);

  // Helper: find gap distance ahead (returns tile count to first gap, or -1)
  const findGapDistance = useCallback((npc: NPC, map: number[][], maxDist: number): number => {
    const dir = npc.direction;
    const buildRow = Math.floor((npc.y + NPC_H) / TILE);
    const startCol = Math.floor((npc.x + NPC_W / 2) / TILE);
    for (let look = 1; look <= maxDist; look++) {
      const checkCol = startCol + dir * look;
      if (checkCol >= 0 && checkCol < COLS && !isSolid(map, checkCol, buildRow)) {
        return look;
      }
    }
    return -1;
  }, []);

  const activateArchitect = useCallback((npc: NPC) => {
    const s = stateRef.current;
    const gapDist = findGapDistance(npc, s.map, 4);

    if (gapDist >= 1 && gapDist <= 4) {
      npc.architectState = "armed";
      return;
    }

    npc.glitchUntil = performance.now() + GLITCH_DURATION;
  }, [findGapDistance]);

  const executeArchitectBuild = useCallback((npc: NPC) => {
    const s = stateRef.current;
    const dir = npc.direction;
    const buildRow = Math.floor((npc.y + NPC_H) / TILE);
    const startCol = Math.floor((npc.x + NPC_W / 2) / TILE);

    // Find the first gap tile to start building from
    let gapStart = 1;
    for (let look = 1; look <= 4; look++) {
      const checkCol = startCol + dir * look;
      if (checkCol >= 0 && checkCol < COLS && !isSolid(s.map, checkCol, buildRow)) {
        gapStart = look;
        break;
      }
    }

    s.pauseTimer = Number.POSITIVE_INFINITY;
    npc.isBuilding = true;
    npc.architectState = "building";
    npc.vy = 0;

    let offset = gapStart;
    const placeNext = () => {
      const col = startCol + dir * offset;
      const row = buildRow;
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS || isSolid(s.map, col, row)) {
        npc.isBuilding = false;
        npc.architectState = "finished";
        s.pauseTimer = 0;
        return;
      }
      s.map[row][col] = 1;
      playBuildTick();
      offset++;
      setTimeout(placeNext, BRIDGE_DELAY);
    };
    setTimeout(placeNext, BRIDGE_DELAY);
  }, []);

  const activateAnchor = useCallback((npc: NPC) => {
    const s = stateRef.current;
    s.pauseTimer = 400;
    npc.glitchUntil = performance.now() + GLITCH_DURATION;
    npc.roleActivated = true;
    npc.stopsMoving = true;
    npc.isSolid = true;
    npc.countsAsDead = true;
    playAnchorClick();
  }, []);

  const activateExcavator = useCallback((npc: NPC) => {
    const s = stateRef.current;
    // Must be grounded
    const footRow = Math.floor((npc.y + NPC_H) / TILE);
    const footCol1 = Math.floor(npc.x / TILE);
    const footCol2 = Math.floor((npc.x + NPC_W - 1) / TILE);
    const grounded = isSolid(s.map, footCol1, footRow) || isSolid(s.map, footCol2, footRow);
    if (!grounded) {
      npc.glitchUntil = performance.now() + GLITCH_DURATION;
      return;
    }

    s.pauseTimer = Number.POSITIVE_INFINITY;
    npc.roleActivated = true;
    npc.stopsMoving = true;
    npc.isBuilding = true;
    npc.countsAsDead = true;
    npc.glitchUntil = performance.now() + GLITCH_DURATION;
    playAnchorClick();

    const digCol = Math.floor((npc.x + NPC_W / 2) / TILE);
    const startRow = footRow; // row below NPC's feet
    let depth = 0;

    const digNext = () => {
      const row = startRow + depth;
      if (depth >= EXCAVATE_DEPTH || row >= ROWS) {
        npc.isBuilding = false;
        s.pauseTimer = 0;
        return;
      }
      // Dig this tile and adjacent tile for 2-wide shaft
      if (row >= 0 && row < ROWS) {
        if (digCol >= 0 && digCol < COLS && s.map[row][digCol] === 1) {
          s.map[row][digCol] = 0;
        }
        const adjCol = digCol + 1;
        if (adjCol >= 0 && adjCol < COLS && s.map[row][adjCol] === 1) {
          s.map[row][adjCol] = 0;
        }
      }
      playBuildTick();
      depth++;
      setTimeout(digNext, EXCAVATE_DELAY);
    };
    setTimeout(digNext, EXCAVATE_DELAY);
  }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    startAmbientDrone();
    const s = stateRef.current;
    if (s.inputDisabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const npc = getNpcAt(mx, my);
    if (!npc) return;

    if (npc.role === "architect") {
      if (npc.architectState === "building" || npc.architectState === "finished") {
        npc.glitchUntil = performance.now() + GLITCH_DURATION;
        return;
      }
      activateArchitect(npc);
      return;
    }

    if (npc.role === "anchor") {
      if (!npc.roleActivated) {
        activateAnchor(npc);
      } else {
        npc.glitchUntil = performance.now() + GLITCH_DURATION;
      }
      return;
    }

    if (npc.role === "excavator") {
      if (!npc.roleActivated) {
        activateExcavator(npc);
      } else {
        npc.glitchUntil = performance.now() + GLITCH_DURATION;
      }
      return;
    }

    if (npc.role === "vessel") {
      if (!npc.roleActivated) {
        // Activate vessel: NPC is now primed to sacrifice on kill tiles
        s.pauseTimer = 400;
        npc.glitchUntil = performance.now() + GLITCH_DURATION;
        npc.roleActivated = true;
        playAnchorClick();
      } else {
        npc.glitchUntil = performance.now() + GLITCH_DURATION;
      }
      return;
    }

    if (npc.role !== "none") {
      npc.glitchUntil = performance.now() + GLITCH_DURATION;
    }
  }, [getNpcAt, activateArchitect, activateAnchor, activateExcavator]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    stateRef.current.mouseX = (e.clientX - rect.left) * scaleX;
    stateRef.current.mouseY = (e.clientY - rect.top) * scaleY;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let animId: number;

    const spawnNpc = (id: number, s: GameState): NPC => {
      const role = s.roles[id] ?? "none";
      return {
        id,
        x: s.spawnX,
        y: s.spawnY,
        direction: 1 as const,
        isAlive: true,
        isRescued: false,
        role,
        roleActivated: false,
        isBuilding: false,
        glitchUntil: 0,
        vy: 0,
        spawnDelayTimer: 800,
        stopsMoving: false,
        isSolid: false,
        countsAsDead: false,
        architectState: "idle" as const,
        deathPhase: "none" as const,
        deathTimer: 0,
        vesselBridgeStart: 0,
        vesselBridgeEnd: 0,
      };
    };

    // Check if NPC collides with any solid anchor
    const collidesWithAnchor = (npc: NPC, nx: number, s: GameState): NPC | null => {
      for (const other of s.npcs) {
        if (other.id === npc.id || !other.isAlive || !other.isSolid) continue;
        // AABB overlap
        if (
          nx < other.x + NPC_W &&
          nx + NPC_W > other.x &&
          npc.y < other.y + NPC_H &&
          npc.y + NPC_H > other.y
        ) {
          return other;
        }
      }
      return null;
    };

    const startTransition = (s: GameState, fail = false) => {
      if (fail) {
        s.transition = "fail_static";
        s.failMessage = FAIL_MESSAGES[Math.floor(Math.random() * FAIL_MESSAGES.length)];
      } else {
        s.transition = "static1";
      }
      s.transitionTimer = STATIC_DURATION;
      s.transitionText = "";
      s.transitionCharIndex = 0;
      s.inputDisabled = true;
      startTransitionHum();
    };

    const updateTransition = (dt: number, s: GameState) => {
      s.transitionTimer -= dt;
      if (s.transition === "static1" && s.transitionTimer <= 0) {
        s.transition = "typewriter";
        s.transitionTimer = TYPEWRITER_SPEED;
        s.transitionCharIndex = 0;
        s.transitionText = "";
      } else if (s.transition === "typewriter") {
        const targetText = TRANSITION_TEXT;
        if (s.transitionTimer <= 0 && s.transitionCharIndex < targetText.length) {
          s.transitionText += targetText[s.transitionCharIndex];
          s.transitionCharIndex++;
          s.transitionTimer = TYPEWRITER_SPEED;
        } else if (s.transitionCharIndex >= targetText.length) {
          s.transitionTimer -= dt;
          if (s.transitionTimer <= -400) {
            s.transition = "static2";
            s.transitionTimer = STATIC_DURATION;
          }
        }
      } else if (s.transition === "static2" && s.transitionTimer <= 0) {
        stopTransitionHum();
        const rescued = s.rescued;
        const nextLevel = s.currentLevel + 1;
        if (nextLevel < LEVELS.length) {
          survivorsRef.current = rescued;
          const ns = initState(nextLevel);
          ns.totalNpc = rescued;
          ns.lastTime = s.lastTime;
          Object.assign(s, ns);
        }
        s.transition = "none";
        s.inputDisabled = false;
      } else if (s.transition === "fail_static" && s.transitionTimer <= 0) {
        s.transition = "fail_typewriter";
        s.transitionTimer = TYPEWRITER_SPEED;
        s.transitionCharIndex = 0;
        s.transitionText = "";
      } else if (s.transition === "fail_typewriter") {
        const targetText = s.failMessage || FAIL_MESSAGES[0];
        if (s.transitionTimer <= 0 && s.transitionCharIndex < targetText.length) {
          s.transitionText += targetText[s.transitionCharIndex];
          s.transitionCharIndex++;
          s.transitionTimer = TYPEWRITER_SPEED;
        } else if (s.transitionCharIndex >= targetText.length) {
          s.transitionTimer -= dt;
          if (s.transitionTimer <= -400) {
            s.transition = "fail_static2";
            s.transitionTimer = STATIC_DURATION;
          }
        }
      } else if (s.transition === "fail_static2" && s.transitionTimer <= 0) {
        stopTransitionHum();
        // Reload same level with same survivor count
        const ns = initState(s.currentLevel);
        ns.totalNpc = survivorsRef.current;
        ns.lastTime = s.lastTime;
        Object.assign(s, ns);
        s.transition = "none";
        s.inputDisabled = false;
      }
      // False victory phases
      else if (s.transition === "fv_freeze" && s.transitionTimer <= 0) {
        // Start slash sequence (3 slashes, ~60ms apart = 180ms total)
        s.transition = "fv_slash";
        s.transitionTimer = 180;
        s.transitionCharIndex = 0; // reuse as slash counter
      } else if (s.transition === "fv_slash") {
        // Count slashes by charIndex: 0,1,2
        const slashProgress = 180 - s.transitionTimer;
        const newSlashCount = Math.min(3, Math.floor(slashProgress / 60));
        if (newSlashCount > s.transitionCharIndex) {
          s.transitionCharIndex = newSlashCount;
        }
        if (s.transitionTimer <= 0) {
          // Play destruction sound, kill NPC, go to text phase
          playFleshTear();
          for (const npc of s.npcs) {
            if (npc.isAlive && npc.stopsMoving) {
              npc.deathPhase = "stasis";
              npc.deathTimer = 400;
              globalMartyrsRef.current++;
            }
          }
          s.transition = "fv_scream";
          s.transitionTimer = 1200;
          s.transitionText = "";
          s.transitionCharIndex = 0;
        }
      } else if (s.transition === "fv_scream") {
        const targetText = "NOT YET";
        // Typewriter effect: one char per tick
        if (s.transitionTimer <= 0 && s.transitionCharIndex < targetText.length) {
          s.transitionText += targetText[s.transitionCharIndex];
          s.transitionCharIndex++;
          s.transitionTimer = TYPEWRITER_SPEED * 2.5; // slower for dramatic effect
        }
        // Hold after complete
        if (s.transitionCharIndex >= targetText.length) {
          s.transitionTimer -= dt;
          if (s.transitionTimer <= -600) {
            s.transition = "fv_static";
            s.transitionTimer = STATIC_DURATION;
            startTransitionHum();
          }
        }
      } else if (s.transition === "fv_static" && s.transitionTimer <= 0) {
        stopTransitionHum();
        // Load real Level 3 (index 4) with same survivor count
        const nextLevel = s.currentLevel + 1;
        if (nextLevel < LEVELS.length) {
          const ns = initState(nextLevel);
          ns.totalNpc = survivorsRef.current;
          ns.lastTime = s.lastTime;
          Object.assign(s, ns);
        }
        s.transition = "none";
        s.inputDisabled = false;
      }
    };

    const update = (dt: number) => {
      const s = stateRef.current;

      // Transition
      if (s.transition !== "none") {
        updateTransition(dt, s);
        return;
      }

      // Spawning
      if (s.spawnCount < s.totalNpc) {
        s.spawnTimer += dt;
        if (s.spawnTimer >= SPAWN_INTERVAL) {
          s.spawnTimer -= SPAWN_INTERVAL;
          s.npcs.push(spawnNpc(s.spawnCount, s));
          s.spawnCount++;
        }
      }

      // Hover detection
      const hoveredNpc = getNpcAt(s.mouseX, s.mouseY);
      s.hoveredNpcId = hoveredNpc?.id ?? null;

      // Hover pause for unactivated role NPCs
      const hoverPause = hoveredNpc != null && (
        (hoveredNpc.role === "architect" && hoveredNpc.architectState === "idle") ||
        (hoveredNpc.role === "anchor" && !hoveredNpc.roleActivated) ||
        (hoveredNpc.role === "excavator" && !hoveredNpc.roleActivated) ||
        (hoveredNpc.role === "vessel" && !hoveredNpc.roleActivated)
      );

      if (s.pauseTimer > 0) {
        s.pauseTimer -= dt;
        return;
      }
      if (hoverPause) return;

      // Check level complete or fail
      if (s.spawnCount >= s.totalNpc) {
        const allResolved = s.npcs.every(
          (n) => n.isRescued || !n.isAlive || n.countsAsDead
        );
        if (allResolved && s.transition === "none") {
          const anyRescued = s.npcs.some((n) => n.isRescued);
          if (!anyRescued) {
            startTransition(s, true);
          } else if (s.currentLevel === 2 && s.rescued < 6) {
            startTransition(s, true);
            s.failMessage = "NOT ENOUGH.";
          } else {
            startTransition(s);
          }
          return;
        }
      }

      // NPC update
      for (const npc of s.npcs) {
        // Death animation update (runs even when "dead")
        if (npc.deathPhase === "stasis") {
          npc.deathTimer -= dt;
          if (npc.deathTimer <= 0) {
            npc.deathPhase = "dissolve";
            npc.deathTimer = 700;
          }
          continue;
        }
        if (npc.deathPhase === "dissolve") {
          npc.deathTimer -= dt;
          if (npc.deathTimer <= 0) {
            npc.isAlive = false;
            npc.deathPhase = "none";
            s.dead++;
            globalMartyrsRef.current++;
          }
          continue;
        }
        // Vessel sacrifice animation phases
        if (npc.deathPhase === "vessel_freeze") {
          npc.deathTimer -= dt;
          if (npc.deathTimer <= 0) {
            npc.deathPhase = "vessel_slice";
            npc.deathTimer = 300;
          }
          continue;
        }
        if (npc.deathPhase === "vessel_slice") {
          npc.deathTimer -= dt;
          if (npc.deathTimer <= 0) {
            npc.deathPhase = "vessel_stretch";
            npc.deathTimer = 400;
            // Convert entire connected kill tile strip to walkable terrain
            const impactCol = Math.floor((npc.x + NPC_W / 2) / TILE);
            const killRow = Math.floor((npc.y + NPC_H) / TILE);
            if (killRow >= 0 && killRow < ROWS) {
              // Expand left
              let startC = impactCol;
              while (startC > 0 && s.map[killRow][startC - 1] === 2) startC--;
              // Expand right
              let endC = impactCol;
              while (endC < COLS - 1 && s.map[killRow][endC + 1] === 2) endC++;
              // Convert all connected kill tiles
              for (let c = startC; c <= endC; c++) {
                s.map[killRow][c] = 1;
              }
              npc.vesselBridgeStart = startC;
              npc.vesselBridgeEnd = endC;
            }
            playBuildTick();
          }
          continue;
        }
        if (npc.deathPhase === "vessel_stretch") {
          npc.deathTimer -= dt;
          if (npc.deathTimer <= 0) {
            npc.isAlive = false;
            npc.deathPhase = "none";
            npc.countsAsDead = true;
            s.dead++;
            globalMartyrsRef.current++;
          }
          continue;
        }

        if (!npc.isAlive || npc.isRescued || npc.isBuilding) continue;
        if (npc.stopsMoving) continue;

        if (npc.spawnDelayTimer > 0) {
          npc.spawnDelayTimer -= dt;
          continue;
        }

        // Gravity
        npc.vy = Math.min(npc.vy + GRAVITY, MAX_FALL);
        npc.y += npc.vy;

        // Floor collision
        const footCol1 = Math.floor(npc.x / TILE);
        const footCol2 = Math.floor((npc.x + NPC_W - 1) / TILE);
        const footRow = Math.floor((npc.y + NPC_H) / TILE);

        if (isSolid(s.map, footCol1, footRow) || isSolid(s.map, footCol2, footRow)) {
          npc.y = footRow * TILE - NPC_H;
          npc.vy = 0;
        }

        // Auto-execute armed architect when gap is within 2 tiles
        if (npc.architectState === "armed" && npc.role === "architect") {
          const gapDist = findGapDistance(npc, s.map, 4);
          if (gapDist >= 1 && gapDist <= 2) {
            executeArchitectBuild(npc);
          }
        }

        // Kill tile check — start death animation instead of instant death
        const killRow = Math.floor((npc.y + NPC_H) / TILE);
        if (isKill(s.map, footCol1, killRow) || isKill(s.map, footCol2, killRow)) {
          // Vessel role: become a permanent martyr on the kill tile
          if (npc.role === "vessel" && npc.roleActivated) {
            npc.stopsMoving = true;
            npc.vy = 0;
            npc.deathPhase = "vessel_freeze";
            npc.deathTimer = 350;
            continue;
          }
          npc.deathPhase = "stasis";
          npc.deathTimer = 400;
          npc.vy = 0;
          npc.stopsMoving = true;
          continue;
        }

        // Horizontal movement
        const nx = npc.x + npc.direction * SPEED;
        const headRow = Math.floor(npc.y / TILE);
        const midRow = Math.floor((npc.y + NPC_H / 2) / TILE);
        const checkCol = npc.direction === 1
          ? Math.floor((nx + NPC_W) / TILE)
          : Math.floor(nx / TILE);

        // Wall collision
        if (isSolid(s.map, checkCol, headRow) || isSolid(s.map, checkCol, midRow)) {
          npc.direction = (npc.direction * -1) as 1 | -1;
        } else {
          // Check anchor collision
          const anchor = collidesWithAnchor(npc, nx, s);
          if (anchor) {
            npc.direction = (npc.direction * -1) as 1 | -1;
            // Push away from anchor
            if (npc.x < anchor.x) {
              npc.x -= ANCHOR_PUSH;
            } else {
              npc.x += ANCHOR_PUSH;
            }
          } else {
            npc.x = nx;
          }
        }

        // Exit check
        const npcCenterCol = Math.floor((npc.x + NPC_W / 2) / TILE);
        const npcRow = Math.floor((npc.y + NPC_H / 2) / TILE);
        if (npcCenterCol === s.exitCol && npcRow === s.exitRow) {
          // False victory on Level 3 intro (index 3)
          if (s.currentLevel === 3 && s.transition === "none") {
            // Freeze this NPC, trigger false victory
            npc.stopsMoving = true;
            npc.vy = 0;
            s.transition = "fv_freeze";
            s.transitionTimer = 500;
            s.inputDisabled = true;
            // Mark all NPCs for death
            s.hoveredNpcId = npc.id; // track the victim
            continue;
          }
          npc.isRescued = true;
          s.rescued++;
        }
      }
    };

    const drawStatic = (ctx: CanvasRenderingContext2D) => {
      for (let y = 0; y < H; y += 4) {
        for (let x = 0; x < W; x += 4) {
          const v = Math.random() * 100;
          ctx.fillStyle = `rgb(${v},${v},${v})`;
          ctx.fillRect(x, y, 4, 4);
        }
      }
    };

    const draw = (now: number) => {
      const s = stateRef.current;
      ctx.clearRect(0, 0, W, H);

      // Transition rendering
      if (s.transition === "static1" || s.transition === "static2" || s.transition === "fail_static" || s.transition === "fail_static2" || s.transition === "fv_static") {
        drawStatic(ctx);
        return;
      }
      if (s.transition === "typewriter" || s.transition === "fail_typewriter") {
        ctx.fillStyle = "#0a0a12";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = s.transition === "fail_typewriter" ? "#ff4444" : "#00ff88";
        ctx.font = "14px monospace";
        ctx.fillText(s.transitionText + (Math.floor(now / 300) % 2 === 0 ? "█" : ""), W / 2 - 160, H / 2);
        return;
      }
      if (s.transition === "fv_scream") {
        ctx.fillStyle = "#0a0a12";
        ctx.fillRect(0, 0, W, H);
        // Typewriter "NOT YET" in large dark red
        const targetText = "NOT YET";
        const flicker = 0.7 + Math.random() * 0.3;
        ctx.fillStyle = `rgba(139, 0, 0, ${flicker})`;
        ctx.font = "bold 36px monospace";
        const displayText = s.transitionText + (Math.floor(now / 250) % 2 === 0 ? "█" : "");
        const textW = ctx.measureText(displayText).width;
        ctx.fillText(displayText, (W - textW) / 2, H / 2);
        // Scanline distortion
        for (let y = 0; y < H; y += 4) {
          if (Math.random() > 0.6) {
            ctx.fillStyle = `rgba(139, 0, 0, ${Math.random() * 0.1})`;
            ctx.fillRect(0, y, W, 2);
          }
        }
        return;
      }

      // Background
      ctx.fillStyle = "#0a0a12";
      ctx.fillRect(0, 0, W, H);

      // --- Distant horizon landscape ---

      // Mega-distant ridge — furthest visible landform, behind all other layers
      const megaParallax = Math.sin(now / 120000) * 3;
      const megaBaseY = H * 0.22; // high on screen — very distant
      ctx.fillStyle = "rgba(82, 88, 112, 0.32)"; // brighter for clear sky contrast
      ctx.beginPath();
      ctx.moveTo(-20, H);
      const megaSteps = 70;
      for (let i = 0; i <= megaSteps; i++) {
        const xr = i / megaSteps;
        const x = W * xr + megaParallax;
        // Wide bell centered at ~0.45, spanning 60-80% of screen
        const bell = Math.exp(-Math.pow((xr - 0.45) / 0.25, 2));
        const tilt = (xr - 0.5) * 4; // very subtle perspective
        const y = megaBaseY + tilt + 80 - 70 * bell
          + 10 * Math.sin(xr * Math.PI * 1.4 + 0.3)
          + 5 * Math.cos(xr * Math.PI * 2.8 + 1.2);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W + 20, H);
      ctx.closePath();
      ctx.fill();

      // --- Martyr Horizon: cruciform silhouettes on the mega-distant ridge ---
      {
        const cap = MARTYR_CAPS[s.currentLevel] ?? Infinity;
        const visibleMartyrs = Math.min(globalMartyrsRef.current, cap);
        const positions = martyrPositionsRef.current;
        if (visibleMartyrs > 0) {
          ctx.fillStyle = "rgba(55, 58, 72, 0.45)";
          for (let mi = 0; mi < visibleMartyrs; mi++) {
            const xr = positions[mi] ?? 0.5;
            const mx = W * xr + megaParallax;
            const bell = Math.exp(-Math.pow((xr - 0.45) / 0.25, 2));
            const tilt = (xr - 0.5) * 4;
            const ridgeY = megaBaseY + tilt + 80 - 70 * bell
              + 10 * Math.sin(xr * Math.PI * 1.4 + 0.3)
              + 5 * Math.cos(xr * Math.PI * 2.8 + 1.2);
            const bodyH = 6;
            const bodyW = 1.5;
            const armW = 4;
            const armH = 1;
            const headR = 1;
            const baseY = ridgeY - 1;
            ctx.fillRect(mx - bodyW / 2, baseY - bodyH, bodyW, bodyH);
            ctx.fillRect(mx - armW / 2, baseY - bodyH * 0.65, armW, armH);
            ctx.beginPath();
            ctx.arc(mx, baseY - bodyH - headR * 0.5, headR, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      const ultraParallax = Math.sin(now / 90000) * 5;
      const ultraY = H * 0.30; // highest layer — most distant
      ctx.fillStyle = "rgba(58, 65, 88, 0.38)"; // #3a4158 at low opacity
      ctx.beginPath();
      ctx.moveTo(-20, H);
      const ultraSteps = 60;
      for (let i = 0; i <= ultraSteps; i++) {
        const xr = i / ultraSteps;
        const x = W * xr + ultraParallax;
        const tilt = (xr - 0.5) * 6; // subtle perspective tilt
        const y = ultraY + tilt
          + 40 * Math.sin(xr * Math.PI * 0.8 + 0.2)
          + 15 * Math.sin(xr * Math.PI * 1.6 + 1.0)
          + 8 * Math.cos(xr * Math.PI * 2.4 + 0.5);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W + 20, H);
      ctx.closePath();
      ctx.fill();

      // Distant central massif — large soft ridge behind terrain layers
      const massifParallax = Math.sin(now / 70000) * 6;
      const massifBaseY = H * 0.36; // overlaps ridge, below it
      ctx.fillStyle = "rgba(38, 44, 58, 0.25)";
      ctx.beginPath();
      ctx.moveTo(-20, H);
      const massifSteps = 50;
      for (let i = 0; i <= massifSteps; i++) {
        const xr = i / massifSteps;
        const x = W * xr + massifParallax;
        // Bell-curve centered at 0.5 with gentle shoulders
        const bell = Math.exp(-Math.pow((xr - 0.5) / 0.28, 2));
        const tilt = (xr - 0.5) * 10; // slightly more tilt
        const y = massifBaseY + tilt + 60 - 55 * bell
          + 6 * Math.sin(xr * Math.PI * 2.2 + 0.8);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W + 20, H);
      ctx.closePath();
      ctx.fill();

      // Distant central hill — single large soft hill behind terrain
      const hillParallax = Math.sin(now / 80000) * 4;
      const hillBaseY = H * 0.41; // raised slightly higher
      ctx.fillStyle = "rgba(32, 38, 58, 0.38)"; // darkened for mid-distance depth
      ctx.beginPath();
      ctx.moveTo(-20, H);
      const hillSteps = 50;
      for (let i = 0; i <= hillSteps; i++) {
        const xr = i / hillSteps;
        const x = W * xr + hillParallax;
        const bell = Math.exp(-Math.pow((xr - 0.48) / 0.26, 2)); // wider silhouette
        const tilt = (xr - 0.5) * 14;
        const y = hillBaseY + tilt + 50 - 52 * bell // taller peak
          + 4 * Math.sin(xr * Math.PI * 3.0 + 1.2);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W + 20, H);
      ctx.closePath();
      ctx.fill();

      // Atmospheric horizon haze — soft band above far terrain for depth
      const hazeHorizonGrad = ctx.createLinearGradient(0, H * 0.38, 0, H * 0.54);
      hazeHorizonGrad.addColorStop(0, "rgba(30, 34, 52, 0)");
      hazeHorizonGrad.addColorStop(0.35, "rgba(38, 42, 58, 0.15)");
      hazeHorizonGrad.addColorStop(0.6, "rgba(34, 38, 54, 0.12)");
      hazeHorizonGrad.addColorStop(1, "rgba(14, 17, 32, 0)");
      ctx.fillStyle = hazeHorizonGrad;
      ctx.fillRect(0, H * 0.38, W, H * 0.16);

      const horizonY = H * 0.52;
      // Subtle parallax offset based on time
      const parallaxFar = Math.sin(now / 60000) * 10;
      const parallaxMid = Math.sin(now / 40000) * 16;
      const parallaxNear = Math.sin(now / 25000) * 24;

      // Helper: get terrain Y at a given X ratio (0-1) for far layer
      const farTerrainY = (xRatio: number): number => {
        // Rolling hills with varied elevation
        const tilt = (xRatio - 0.5) * 18; // progressive tilt for far terrain
        return horizonY + tilt
          - 30 * Math.sin(xRatio * Math.PI * 1.2)
          - 18 * Math.sin(xRatio * Math.PI * 2.8 + 0.5)
          - 8 * Math.cos(xRatio * Math.PI * 4.5 + 1.2);
      };

      // Helper: get terrain Y for mid layer (slightly lower)
      const midTerrainY = (xRatio: number): number => {
        return horizonY + 12
          - 22 * Math.sin(xRatio * Math.PI * 1.5 + 0.3)
          - 12 * Math.sin(xRatio * Math.PI * 3.2 + 1.0)
          - 6 * Math.cos(xRatio * Math.PI * 5.0 + 0.8);
      };

      // Far layer: eroded hills — lighter tone for distance
      ctx.fillStyle = "#23283a";
      ctx.beginPath();
      const farSteps = 40;
      ctx.moveTo(0, farTerrainY(0) + parallaxFar * 0.2);
      for (let i = 1; i <= farSteps; i++) {
        const xr = i / farSteps;
        ctx.lineTo(W * xr + parallaxFar * (0.2 + 0.1 * Math.sin(xr * 3)), farTerrainY(xr) + parallaxFar * 0.15);
      }
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.closePath();
      ctx.fill();

      // Garnet atmospheric band at horizon
      const garnetGrad = ctx.createLinearGradient(0, horizonY - 30, 0, horizonY + 60);
      garnetGrad.addColorStop(0, "rgba(10, 10, 18, 0)");
      garnetGrad.addColorStop(0.25, "rgba(42, 10, 13, 0.35)");
      garnetGrad.addColorStop(0.5, "rgba(42, 10, 13, 0.25)");
      garnetGrad.addColorStop(0.75, "rgba(42, 10, 13, 0.1)");
      garnetGrad.addColorStop(1, "rgba(10, 10, 18, 0)");
      ctx.fillStyle = garnetGrad;
      ctx.fillRect(0, horizonY - 30, W, 90);

      // Atmospheric depth haze
      const hazeGrad = ctx.createLinearGradient(0, horizonY - 12, 0, horizonY + 40);
      hazeGrad.addColorStop(0, "rgba(14, 18, 30, 0)");
      hazeGrad.addColorStop(0.5, "rgba(14, 18, 30, 0.25)");
      hazeGrad.addColorStop(1, "rgba(10, 10, 18, 0)");
      ctx.fillStyle = hazeGrad;
      ctx.fillRect(0, horizonY - 12, W, 52);

      // Mid layer: darker terrain shapes + ruin fragments
      ctx.fillStyle = "#181d2e";
      ctx.beginPath();
      const midSteps = 40;
      ctx.moveTo(0, midTerrainY(0) + parallaxMid * 0.1);
      for (let i = 1; i <= midSteps; i++) {
        const xr = i / midSteps;
        ctx.lineTo(W * xr + parallaxMid * (0.15 + 0.1 * Math.sin(xr * 2.5)), midTerrainY(xr) + parallaxMid * 0.08);
      }
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.closePath();
      ctx.fill();

      // Mid ruin fragments — placed on mid terrain
      ctx.fillStyle = "#0a0e1a";
      const mx1 = W * 0.22 + parallaxMid;
      const my1 = midTerrainY(0.22);
      ctx.fillRect(mx1, my1 - 14, 4, 18);
      ctx.fillRect(mx1 - 2, my1 - 8, 8, 3);
      ctx.save();
      const mx2x = 0.55;
      ctx.translate(W * mx2x + parallaxMid, midTerrainY(mx2x));
      ctx.rotate(-0.12);
      ctx.fillRect(0, -18, 3, 18);
      ctx.restore();
      ctx.fillRect(W * 0.78 + parallaxMid, midTerrainY(0.78), 10, 4);
      ctx.fillRect(W * 0.80 + parallaxMid, midTerrainY(0.80) - 4, 5, 4);

      // Near terrain silhouette — softened to reduce visual weight
      ctx.fillStyle = "#111525"; // slightly lighter to reduce contrast against ground
      ctx.beginPath();
      const nearBaseY = horizonY + 28;
      const nearSteps = 80;
      ctx.moveTo(-5, H);
      for (let i = 0; i <= nearSteps; i++) {
        const xr = i / nearSteps;
        const x = W * xr + parallaxNear * 0.2;
        const y = nearBaseY
          + 8 * Math.sin(xr * Math.PI * 3.2 + 0.7) // softened amplitudes
          - 5 * Math.cos(xr * Math.PI * 5.1 + 1.3)
          + 3 * Math.sin(xr * Math.PI * 8.0 + 2.0)
          - 2 * Math.cos(xr * Math.PI * 12.0 + 0.4);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W + 5, H);
      ctx.closePath();
      ctx.fill();

      // Near layer: large monolith silhouettes — darkest, placed on terrain
      ctx.fillStyle = "#050710";

      // Monolith 1: tall leaning slab (left) — on mid terrain slope
      const m1x = 0.12;
      const m1baseY = midTerrainY(m1x) + 4;
      ctx.save();
      ctx.translate(W * m1x + parallaxNear, m1baseY);
      ctx.rotate(-0.05);
      ctx.fillRect(0, -110, 12, 110);
      ctx.fillRect(-3, -116, 18, 7);
      ctx.fillRect(-1, -85, 14, 3);
      ctx.restore();

      // Monolith 2: broken pillar (center-right) — on terrain
      const m2x = 0.65;
      const m2baseY = midTerrainY(m2x) + 2;
      ctx.save();
      ctx.translate(W * m2x + parallaxNear, m2baseY);
      ctx.rotate(0.03);
      ctx.fillRect(0, -95, 14, 95);
      ctx.fillRect(-2, -102, 7, 9);
      ctx.fillRect(9, -100, 5, 7);
      ctx.fillRect(2, -108, 6, 7);
      ctx.restore();

      // Monolith 3: half-collapsed wall (far right) — on terrain
      const m3x = 0.88;
      const m3baseY = midTerrainY(m3x);
      ctx.save();
      ctx.translate(W * m3x + parallaxNear, m3baseY);
      ctx.rotate(0.06);
      ctx.fillRect(0, -65, 22, 65);
      ctx.fillRect(22, -42, 7, 42);
      ctx.fillRect(-4, -48, 4, 48);
      ctx.fillStyle = "#0a0a12";
      ctx.fillRect(5, -46, 12, 14);
      ctx.restore();

      // --- End horizon landscape ---

      // Tiles
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const v = s.map[r][c];
          if (v === 1) {
            ctx.fillStyle = "#2a2a3a";
            ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
            ctx.strokeStyle = "#3a3a4a";
            ctx.lineWidth = 0.5;
            ctx.strokeRect(c * TILE, r * TILE, TILE, TILE);
          } else if (v === 2) {
            ctx.fillStyle = "#1a0a0a";
            ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
          }
        }
      }

      // Exit — with glitch effect on false victory level
      {
        const exitX = s.exitCol * TILE + 2;
        const exitY = s.exitRow * TILE + 2;
        const exitSize = TILE - 4;

        // Calculate glitch intensity for fake exit (level 3 = intro)
        let fakeExitGlitch = 0;
        if (s.currentLevel === 3) {
          // Find closest alive NPC distance to exit
          let minDist = Infinity;
          for (const npc of s.npcs) {
            if (!npc.isAlive || npc.isRescued || npc.stopsMoving) continue;
            const dx = (npc.x + NPC_W / 2) - (s.exitCol * TILE + TILE / 2);
            const dy = (npc.y + NPC_H / 2) - (s.exitRow * TILE + TILE / 2);
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDist) minDist = dist;
          }
          // Glitch intensifies within 200px, max at 0
          fakeExitGlitch = Math.max(0, 1 - minDist / 200);
        }

        if (fakeExitGlitch > 0.05) {
          // Glitchy fake exit: jitter, brightness flicker, scanlines
          const jitterX = (Math.random() - 0.5) * fakeExitGlitch * 4;
          const jitterY = (Math.random() - 0.5) * fakeExitGlitch * 3;
          const flicker = 0.3 + 0.15 * Math.sin(now / 300) + fakeExitGlitch * 0.3 * Math.random();

          ctx.fillStyle = "#00ff88";
          ctx.globalAlpha = flicker;
          ctx.fillRect(exitX + jitterX, exitY + jitterY, exitSize, exitSize);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = "#00ff88";
          ctx.lineWidth = 1;
          ctx.strokeRect(exitX + jitterX, exitY + jitterY, exitSize, exitSize);

          // Scanline distortion over exit area
          if (fakeExitGlitch > 0.3) {
            const scanCount = Math.floor(fakeExitGlitch * 5);
            for (let sl = 0; sl < scanCount; sl++) {
              const sy = exitY + Math.random() * exitSize;
              ctx.fillStyle = `rgba(0, 255, 136, ${fakeExitGlitch * 0.15})`;
              ctx.fillRect(exitX - 4, sy, exitSize + 8, 1);
            }
          }

          // Ghost duplicate at offset
          if (fakeExitGlitch > 0.5) {
            ctx.globalAlpha = fakeExitGlitch * 0.2;
            ctx.fillStyle = "#00ff88";
            ctx.fillRect(exitX + 3, exitY - 2, exitSize, exitSize);
            ctx.globalAlpha = 1;
          }
        } else {
          // Normal exit rendering
          ctx.fillStyle = "#00ff88";
          ctx.globalAlpha = 0.3 + 0.15 * Math.sin(now / 300);
          ctx.fillRect(exitX, exitY, exitSize, exitSize);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = "#00ff88";
          ctx.lineWidth = 1;
          ctx.strokeRect(exitX, exitY, exitSize, exitSize);
        }
      }

      // NPCs
      for (const npc of s.npcs) {
        // Skip fully dead NPCs (not in death animation)
        const inDeathAnim = npc.deathPhase === "stasis" || npc.deathPhase === "dissolve";
        const inVesselAnim = npc.deathPhase === "vessel_freeze" || npc.deathPhase === "vessel_slice" || npc.deathPhase === "vessel_stretch";
        if (!inDeathAnim && !inVesselAnim && !npc.isAlive && !npc.countsAsDead) continue;
        if (npc.isRescued) continue;
        if (!inDeathAnim && !inVesselAnim && !npc.isAlive && !npc.isSolid) continue;

        // Vessel sacrifice animation rendering
        if (inVesselAnim) {
          const vesselColor = "#882299";
          if (npc.deathPhase === "vessel_freeze") {
            // Frozen NPC with pulsing glow
            const pulse = 0.6 + 0.4 * Math.sin(now * 0.015);
            ctx.globalAlpha = pulse;
            ctx.shadowColor = "#cc44ff";
            ctx.shadowBlur = 8;
            ctx.fillStyle = vesselColor;
            ctx.beginPath();
            ctx.arc(npc.x + NPC_W / 2, npc.y + 4, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(npc.x + 3, npc.y + 8, NPC_W - 6, 8);
            ctx.fillRect(npc.x + 3, npc.y + 16, 3, 4);
            ctx.fillRect(npc.x + NPC_W - 6, npc.y + 16, 3, 4);
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
          } else if (npc.deathPhase === "vessel_slice") {
            // Three diagonal slicing effects
            const progress = 1 - npc.deathTimer / 300;
            ctx.fillStyle = vesselColor;
            ctx.globalAlpha = 0.9;
            const pieceH = NPC_H / 3;
            for (let p = 0; p < 3; p++) {
              const offsetX = (p - 1) * progress * 4;
              const offsetY = (p - 1) * progress * 3;
              ctx.fillRect(npc.x + offsetX, npc.y + p * pieceH + offsetY, NPC_W, pieceH - 1);
            }
            ctx.strokeStyle = "#ff44ff";
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.8 * (1 - progress * 0.5);
            for (let sl = 0; sl < 3; sl++) {
              const sy = npc.y + (sl + 1) * pieceH * progress;
              ctx.beginPath();
              ctx.moveTo(npc.x - 3, sy - 3);
              ctx.lineTo(npc.x + NPC_W + 3, sy + 3);
              ctx.stroke();
            }
            ctx.globalAlpha = 1;
          } else if (npc.deathPhase === "vessel_stretch") {
            const progress = 1 - npc.deathTimer / 400;
            const bridgeStartPx = npc.vesselBridgeStart * TILE;
            const bridgeEndPx = (npc.vesselBridgeEnd + 1) * TILE;
            const bridgeW = bridgeEndPx - bridgeStartPx;
            const cx = npc.x + NPC_W / 2;
            const targetCx = bridgeStartPx + bridgeW / 2;
            const currentW = NPC_W + progress * (bridgeW - NPC_W);
            const currentCx = cx + progress * (targetCx - cx);
            const currentX = currentCx - currentW / 2;
            const stretchH = Math.max(2, NPC_H * (1 - progress * 0.85));
            const drawY = npc.y + NPC_H - stretchH;
            ctx.globalAlpha = 1 - progress * 0.7;
            ctx.fillStyle = vesselColor;
            ctx.fillRect(currentX, drawY, currentW, stretchH);
            const particleCount = Math.max(6, Math.floor(currentW / 8));
            for (let i = 0; i < particleCount; i++) {
              const px = currentX + (currentW * i) / (particleCount - 1);
              const py = drawY + stretchH / 2 + Math.sin(now * 0.01 + i) * 3;
              ctx.fillStyle = "#cc44ff";
              ctx.globalAlpha = (1 - progress) * 0.6;
              ctx.fillRect(px, py, 2, 2);
            }
            ctx.globalAlpha = 1;
          }
          continue;
        }

        // Death animation rendering
        if (inDeathAnim) {
          if (npc.deathPhase === "stasis") {
            // Frozen NPC rendered normally (no red tint)
             let bodyColor = "#cccccc";
            if (npc.role === "architect") bodyColor = "#00ccff";
            else if (npc.role === "anchor") bodyColor = npc.roleActivated ? "#884400" : "#ff6600";
            else if (npc.role === "excavator") bodyColor = npc.roleActivated ? "#997700" : "#ffcc00";
            else if (npc.role === "vessel") bodyColor = npc.roleActivated ? "#882299" : "#cc44ff";
            ctx.fillStyle = bodyColor;
            ctx.beginPath();
            ctx.arc(npc.x + NPC_W / 2, npc.y + 4, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(npc.x + 3, npc.y + 8, NPC_W - 6, 8);
            ctx.fillRect(npc.x + 3, npc.y + 16, 3, 4);
            ctx.fillRect(npc.x + NPC_W - 6, npc.y + 16, 3, 4);
          } else {
            // Dissolve: progressive erosion - particles spawn gradually
            const progress = 1 - npc.deathTimer / 700; // 0→1
            const totalParticles = 40;
            // How many particles have been "born" so far (progressive spawn)
            const spawnedCount = Math.floor(progress * totalParticles);
            const seed = npc.id * 7;

            // Draw remaining body pixels that haven't eroded yet
            // Body fades as more particles spawn
            const bodyAlpha = Math.max(0, 1 - progress * 1.2);
            if (bodyAlpha > 0) {
               let bodyColor = "#cccccc";
              if (npc.role === "architect") bodyColor = "#00ccff";
              else if (npc.role === "anchor") bodyColor = npc.roleActivated ? "#884400" : "#ff6600";
              else if (npc.role === "excavator") bodyColor = npc.roleActivated ? "#997700" : "#ffcc00";
              else if (npc.role === "vessel") bodyColor = npc.roleActivated ? "#882299" : "#cc44ff";
              ctx.globalAlpha = bodyAlpha;
              ctx.fillStyle = bodyColor;
              ctx.beginPath();
              ctx.arc(npc.x + NPC_W / 2, npc.y + 4, 4, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillRect(npc.x + 3, npc.y + 8, NPC_W - 6, 8);
              ctx.fillRect(npc.x + 3, npc.y + 16, 3, 4);
              ctx.fillRect(npc.x + NPC_W - 6, npc.y + 16, 3, 4);
              ctx.globalAlpha = 1;
            }

            // Draw only the particles that have spawned so far
            for (let i = 0; i < spawnedCount; i++) {
              const h = (seed + i * 137) % 256;
              const srcX = (h % NPC_W);
              const srcY = ((h * 3 + i * 11) % NPC_H);
              // Each particle's individual age: fraction of time since it spawned
              const spawnTime = i / totalParticles; // when this particle was born (0→1)
              const particleAge = Math.max(0, progress - spawnTime); // how long it's been alive
              const particleLife = 1 - spawnTime; // total lifespan available
              const particleProgress = Math.min(1, particleAge / Math.max(0.05, particleLife));

              const angle = ((i / totalParticles) * Math.PI * 2) + (h % 10) * 0.1;
              const drift = particleProgress * (3 + (h % 4));
              const dx = Math.cos(angle) * drift;
              const dy = -Math.abs(Math.sin(angle)) * drift - particleProgress * 3;
              const alpha = (1 - particleProgress) * 0.9;
              if (alpha <= 0.01) continue;
              ctx.globalAlpha = alpha;
              const brightness = 160 + (h % 80);
              ctx.fillStyle = `rgb(${brightness},${Math.floor(brightness * 0.6)},${Math.floor(brightness * 0.5)})`;
              ctx.fillRect(npc.x + srcX + dx, npc.y + srcY + dy, 1, 1);
            }
            ctx.globalAlpha = 1;
          }
          continue;
        }

        const isGlitching = now < npc.glitchUntil;

        // Hover glow with flickering glitch outline
        if (s.hoveredNpcId === npc.id && !isGlitching) {
          const isArchitectReady = npc.role === "architect" && npc.architectState === "idle";
          const isAnchorReady = npc.role === "anchor" && !npc.roleActivated;
          const isExcavatorReady = npc.role === "excavator" && !npc.roleActivated;
          const isVesselReady = npc.role === "vessel" && !npc.roleActivated;
          const isRoleReady = isArchitectReady || isAnchorReady || isExcavatorReady || isVesselReady;
          const glitchColor = isArchitectReady ? "#00ccff" : isAnchorReady ? "#ff6600" : isExcavatorReady ? "#ffcc00" : isVesselReady ? "#cc44ff" : "#ffffff";
          
          // Flickering effect
          const flicker = Math.sin(now / 40) * 0.3 + 0.7;
          const glitchOffset = Math.floor(Math.sin(now / 60) * 2);
          
          ctx.shadowColor = glitchColor;
          ctx.shadowBlur = isRoleReady ? 25 * flicker : 15 * flicker;
          ctx.strokeStyle = glitchColor;
          ctx.globalAlpha = flicker;
          ctx.lineWidth = isRoleReady ? 2.5 : 2;
          
          // Main outline with glitch offset
          ctx.strokeRect(npc.x - 3 + glitchOffset, npc.y - 3, NPC_W + 6, NPC_H + 6);
          if (isRoleReady) {
            // Second flickering outline offset in opposite direction
            ctx.globalAlpha = flicker * 0.5;
            ctx.strokeRect(npc.x - 5 - glitchOffset, npc.y - 5, NPC_W + 10, NPC_H + 10);
          }
          ctx.globalAlpha = 1;
          ctx.shadowBlur = 0;
        }

        if (isGlitching) {
          for (let py = 0; py < NPC_H; py += 2) {
            for (let px = 0; px < NPC_W; px += 2) {
              const v = Math.random() * 255;
              ctx.fillStyle = `rgb(${v},${v * 0.7},${v * 0.9})`;
              ctx.fillRect(npc.x + px, npc.y + py, 2, 2);
            }
          }
        } else {
          let bodyColor: string;
          if (npc.role === "architect" && npc.architectState === "idle") {
            bodyColor = "#00ccff";
          } else if (npc.role === "architect" && npc.architectState === "armed") {
            bodyColor = "#0099bb";
          } else if (npc.role === "architect" && (npc.architectState === "building" || npc.architectState === "finished")) {
            bodyColor = "#006688";
           } else if (npc.role === "anchor" && !npc.roleActivated) {
            bodyColor = "#ff6600";
          } else if (npc.role === "anchor" && npc.roleActivated) {
            bodyColor = "#884400";
           } else if (npc.role === "excavator" && !npc.roleActivated) {
            bodyColor = "#ffcc00";
          } else if (npc.role === "excavator" && npc.roleActivated) {
            bodyColor = "#997700";
          } else if (npc.role === "vessel" && !npc.roleActivated) {
            bodyColor = "#cc44ff";
          } else if (npc.role === "vessel" && npc.roleActivated) {
            bodyColor = "#882299";
          } else {
            bodyColor = "#cccccc";
          }

          ctx.fillStyle = bodyColor;
          // Head
          ctx.beginPath();
          ctx.arc(npc.x + NPC_W / 2, npc.y + 4, 4, 0, Math.PI * 2);
          ctx.fill();
          // Body
          ctx.fillRect(npc.x + 3, npc.y + 8, NPC_W - 6, 8);
          // Legs
          ctx.fillRect(npc.x + 3, npc.y + 16, 3, 4);
          ctx.fillRect(npc.x + NPC_W - 6, npc.y + 16, 3, 4);

          // Anchor activated: draw X on body
          if (npc.role === "anchor" && npc.roleActivated) {
            ctx.strokeStyle = "#ffaa00";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(npc.x + 3, npc.y + 8);
            ctx.lineTo(npc.x + NPC_W - 3, npc.y + 16);
            ctx.moveTo(npc.x + NPC_W - 3, npc.y + 8);
            ctx.lineTo(npc.x + 3, npc.y + 16);
            ctx.stroke();
          }

          // Excavator activated: draw downward arrow on body
          if (npc.role === "excavator" && npc.roleActivated) {
            ctx.strokeStyle = "#ffee00";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(npc.x + NPC_W / 2, npc.y + 8);
            ctx.lineTo(npc.x + NPC_W / 2, npc.y + 16);
            ctx.moveTo(npc.x + NPC_W / 2 - 2, npc.y + 14);
            ctx.lineTo(npc.x + NPC_W / 2, npc.y + 16);
            ctx.lineTo(npc.x + NPC_W / 2 + 2, npc.y + 14);
            ctx.stroke();
          }

          // Direction indicator (not for anchored)
          if (!npc.stopsMoving) {
            ctx.fillStyle = "#ffffff";
            const eyeX = npc.x + NPC_W / 2 + npc.direction * 2;
            ctx.fillRect(eyeX - 1, npc.y + 3, 2, 2);
          }

          // Building indicator
          if (npc.isBuilding) {
            ctx.fillStyle = "#00ccff";
            ctx.globalAlpha = 0.5 + 0.3 * Math.sin(now / 100);
            ctx.fillRect(npc.x - 1, npc.y - 4, NPC_W + 2, 2);
            ctx.globalAlpha = 1;
          }
        }

        // DEBUG: display info above architect NPCs
        if (npc.role === "architect" && npc.isAlive && !npc.isRescued) {
          const gapDist = findGapDistance(npc, s.map, 4);
          const vx = npc.stopsMoving ? 0 : npc.direction * SPEED;
          ctx.font = "8px monospace";
          ctx.fillStyle = "#ffff00";
          ctx.globalAlpha = 0.9;
          const lx = npc.x - 20;
          let ly = npc.y - 38;
          ctx.fillText(`st:${npc.architectState}`, lx, ly); ly += 9;
          ctx.fillText(`gap:${gapDist}`, lx, ly); ly += 9;
          ctx.fillText(`bld:${npc.isBuilding}`, lx, ly); ly += 9;
          ctx.fillText(`spd:${SPEED} vx:${vx.toFixed(1)}`, lx, ly);
          ctx.globalAlpha = 1;
        }
      }

      // HUD
      ctx.fillStyle = "#aaaaaa";
      ctx.font = "12px monospace";
      ctx.fillText(`Rescued: ${s.rescued} / ${s.totalNpc}`, 8, 14);
    };

    const loop = (time: number) => {
      const s = stateRef.current;
      const dt = s.lastTime === 0 ? 16 : Math.min(time - s.lastTime, 50);
      s.lastTime = time;
      update(dt);
      draw(time);
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [getNpcAt, findGapDistance, executeArchitectBuild]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#08080f]">
      <div className="flex flex-col items-center gap-4">
        <h1 className="font-mono text-lg tracking-widest text-[#aaaacc]">NULL CYCLE</h1>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          className="border border-[#2a2a3a] cursor-crosshair"
          style={{ imageRendering: "pixelated" }}
        />
      </div>
    </div>
  );
};

export default Index;
