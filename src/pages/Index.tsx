import { useEffect, useRef, useCallback } from "react";
import type { NPC, GameState, TransitionPhase } from "../game/types";
import {
  TILE, COLS, ROWS, W, H, NPC_W, NPC_H, SPEED, GRAVITY, MAX_FALL,
  SPAWN_INTERVAL, BRIDGE_TILES, BRIDGE_DELAY, GLITCH_DURATION,
  ANCHOR_PUSH, TYPEWRITER_SPEED, STATIC_DURATION, TRANSITION_TEXT,
  TOTAL_NPCS,
} from "../game/constants";
import { LEVELS, cloneLevelMap } from "../game/levels";
import { playBuildTick, playAnchorClick, startTransitionHum, stopTransitionHum } from "../game/audio";

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
  };
}

// --- COMPONENT ---
const Index = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(initState(0));

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

  const activateArchitect = useCallback((npc: NPC) => {
    const s = stateRef.current;
    s.pauseTimer = 400;
    npc.isBuilding = true;
    npc.vy = 0;

    const dir = npc.direction;
    const footRow = Math.floor((npc.y + NPC_H) / TILE);
    const startCol = Math.floor((npc.x + NPC_W / 2) / TILE);

    let tilesPlaced = 0;
    const placeNext = () => {
      if (tilesPlaced >= BRIDGE_TILES) {
        npc.roleActivated = true;
        npc.isBuilding = false;
        return;
      }
      const col = startCol + dir * (tilesPlaced + 1);
      const row = footRow;
      if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
        s.map[row][col] = 1;
        playBuildTick();
      }
      tilesPlaced++;
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
  }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
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

    if (!npc.roleActivated && npc.role !== "none") {
      if (npc.role === "architect") {
        activateArchitect(npc);
      } else if (npc.role === "anchor") {
        activateAnchor(npc);
      }
    } else {
      npc.glitchUntil = performance.now() + GLITCH_DURATION;
    }
  }, [getNpcAt, activateArchitect, activateAnchor]);

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
        direction: 1,
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

    const startTransition = (s: GameState) => {
      s.transition = "static1";
      s.transitionTimer = STATIC_DURATION;
      s.transitionText = "";
      s.transitionCharIndex = 0;
      s.inputDisabled = true;
    };

    const updateTransition = (dt: number, s: GameState) => {
      s.transitionTimer -= dt;
      if (s.transition === "static1" && s.transitionTimer <= 0) {
        s.transition = "typewriter";
        s.transitionTimer = TYPEWRITER_SPEED;
        s.transitionCharIndex = 0;
        s.transitionText = "";
      } else if (s.transition === "typewriter") {
        if (s.transitionTimer <= 0 && s.transitionCharIndex < TRANSITION_TEXT.length) {
          s.transitionText += TRANSITION_TEXT[s.transitionCharIndex];
          s.transitionCharIndex++;
          s.transitionTimer = TYPEWRITER_SPEED;
        } else if (s.transitionCharIndex >= TRANSITION_TEXT.length) {
          // Brief pause then static2
          s.transitionTimer -= dt;
          if (s.transitionTimer <= -400) {
            s.transition = "static2";
            s.transitionTimer = STATIC_DURATION;
          }
        }
      } else if (s.transition === "static2" && s.transitionTimer <= 0) {
        // Load next level
        const nextLevel = s.currentLevel + 1;
        if (nextLevel < LEVELS.length) {
          const ns = initState(nextLevel);
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
      const hoverPause = hoveredNpc != null &&
        (hoveredNpc.role === "architect" || hoveredNpc.role === "anchor") &&
        !hoveredNpc.roleActivated;

      if (s.pauseTimer > 0) {
        s.pauseTimer -= dt;
        return;
      }
      if (hoverPause) return;

      // Check level complete
      if (s.spawnCount >= s.totalNpc) {
        const allResolved = s.npcs.every(
          (n) => n.isRescued || !n.isAlive || n.countsAsDead
        );
        if (allResolved && s.transition === "none") {
          startTransition(s);
          return;
        }
      }

      // NPC update
      for (const npc of s.npcs) {
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

        // Kill tile check
        const killRow = Math.floor((npc.y + NPC_H) / TILE);
        if (isKill(s.map, footCol1, killRow) || isKill(s.map, footCol2, killRow)) {
          npc.isAlive = false;
          s.dead++;
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
      if (s.transition === "static1" || s.transition === "static2") {
        drawStatic(ctx);
        return;
      }
      if (s.transition === "typewriter") {
        ctx.fillStyle = "#0a0a12";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#00ff88";
        ctx.font = "14px monospace";
        ctx.fillText(s.transitionText + (Math.floor(now / 300) % 2 === 0 ? "█" : ""), W / 2 - 160, H / 2);
        return;
      }

      // Background
      ctx.fillStyle = "#0a0a12";
      ctx.fillRect(0, 0, W, H);

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

      // Exit
      ctx.fillStyle = "#00ff88";
      ctx.globalAlpha = 0.3 + 0.15 * Math.sin(now / 300);
      ctx.fillRect(s.exitCol * TILE + 2, s.exitRow * TILE + 2, TILE - 4, TILE - 4);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#00ff88";
      ctx.lineWidth = 1;
      ctx.strokeRect(s.exitCol * TILE + 2, s.exitRow * TILE + 2, TILE - 4, TILE - 4);

      // NPCs
      for (const npc of s.npcs) {
        if (!npc.isAlive && !npc.countsAsDead) continue;
        if (npc.isRescued) continue;
        if (!npc.isAlive && !npc.isSolid) continue;

        const isGlitching = now < npc.glitchUntil;

        // Hover glow
        if (s.hoveredNpcId === npc.id && !isGlitching) {
          const isRoleReady = !npc.roleActivated && npc.role !== "none";
          const isArchitectReady = npc.role === "architect" && !npc.roleActivated;
          const isAnchorReady = npc.role === "anchor" && !npc.roleActivated;
          ctx.shadowColor = isArchitectReady ? "#00ccff" : isAnchorReady ? "#ff6600" : "#ffffff";
          ctx.shadowBlur = isRoleReady ? 20 : 12;
          ctx.strokeStyle = isArchitectReady ? "#00ccff" : isAnchorReady ? "#ff6600" : "#aaaaaa";
          ctx.lineWidth = isRoleReady ? 2.5 : 2;
          ctx.strokeRect(npc.x - 3, npc.y - 3, NPC_W + 6, NPC_H + 6);
          if (isRoleReady) {
            ctx.strokeRect(npc.x - 5, npc.y - 5, NPC_W + 10, NPC_H + 10);
          }
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
          if (npc.role === "architect" && !npc.roleActivated) {
            bodyColor = "#00ccff";
          } else if (npc.role === "architect" && npc.roleActivated) {
            bodyColor = "#006688";
          } else if (npc.role === "anchor" && !npc.roleActivated) {
            bodyColor = "#ff6600";
          } else if (npc.role === "anchor" && npc.roleActivated) {
            // Anchored: darker, stationary look
            bodyColor = "#884400";
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
      }

      // HUD
      ctx.fillStyle = "#aaaaaa";
      ctx.font = "12px monospace";
      ctx.fillText(`Rescued: ${s.rescued} / ${s.totalNpc}`, 8, 14);
      const levelLabel = s.currentLevel === 0 ? "TUTORIAL" : `LEVEL ${s.currentLevel}`;
      ctx.fillText(levelLabel, W - 120, 14);
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
  }, [getNpcAt]);

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
