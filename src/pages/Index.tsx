import { useEffect, useRef, useCallback } from "react";

// --- TYPES ---
type Role = "none" | "architect" | "anchor" | "excavator" | "vessel";

interface NPC {
  id: number;
  x: number;
  y: number;
  direction: 1 | -1;
  isAlive: boolean;
  isRescued: boolean;
  role: Role;
  roleActivated: boolean;
  isBuilding: boolean;
  glitchUntil: number;
  vy: number;
  spawnDelayTimer: number;
}


// --- CONSTANTS ---
const TILE = 24;
const COLS = 32;
const ROWS = 20;
const W = COLS * TILE;
const H = ROWS * TILE;
const NPC_W = 14;
const NPC_H = 20;
const SPEED = 1.2;
const GRAVITY = 0.5;
const MAX_FALL = 6;
const SPAWN_INTERVAL = 1000;
const TOTAL_NPC = 12;
const BRIDGE_TILES = 3;
const BRIDGE_DELAY = 80;
const GLITCH_DURATION = 250;

// --- LEVEL 1 MAP ---
function createLevel(): number[][] {
  const map: number[][] = [];
  for (let r = 0; r < ROWS; r++) {
    map[r] = [];
    for (let c = 0; c < COLS; c++) {
      map[r][c] = 0;
    }
  }

  // Floor platform left (spawn side): cols 0-11, row 15
  for (let c = 0; c < 12; c++) map[15][c] = 1;
  // Fill below floor
  for (let r = 16; r < ROWS; r++) for (let c = 0; c < 12; c++) map[r][c] = 1;

  // Gap: cols 12-14 (3 tiles wide) — the architect must bridge this




  // Floor platform right (exit side): cols 15-31, row 15
  for (let c = 15; c < COLS; c++) map[15][c] = 1;
  for (let r = 16; r < ROWS; r++) for (let c = 15; c < COLS; c++) map[r][c] = 1;

  // Walls
  for (let r = 0; r < ROWS; r++) {
    map[r][0] = 1;
    map[r][COLS - 1] = 1;
  }

  // Pit bottom so fallen NPCs die
  for (let c = 12; c < 15; c++) map[ROWS - 1][c] = 2; // 2 = kill tile

  return map;
}

// --- EXIT ---
const EXIT_COL = 28;
const EXIT_ROW = 14; // one tile above floor on right side
const SPAWN_X = 3 * TILE;
const SPAWN_Y = 14 * TILE - NPC_H;

// --- HELPERS ---
function isSolid(map: number[][], col: number, row: number): boolean {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return true;
  return map[row][col] === 1;
}

function isKill(map: number[][], col: number, row: number): boolean {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return false;
  return map[row][col] === 2;
}

// --- COMPONENT ---
const Index = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<{
    map: number[][];
    npcs: NPC[];
    spawnTimer: number;
    spawnCount: number;
    lastTime: number;
    mouseX: number;
    mouseY: number;
    hoveredNpcId: number | null;
    rescued: number;
    pauseTimer: number;
  }>({
    map: createLevel(),
    npcs: [],
    spawnTimer: 0,
    spawnCount: 0,
    lastTime: 0,
    mouseX: -1,
    mouseY: -1,
    hoveredNpcId: null,
    rescued: 0,
    pauseTimer: 0,
  });

  const getNpcAt = useCallback((x: number, y: number): NPC | null => {
    const { npcs } = stateRef.current;
    const hw = NPC_W * 2;
    const hh = NPC_H * 2;
    for (let i = npcs.length - 1; i >= 0; i--) {
      const n = npcs[i];
      if (!n.isAlive || n.isRescued) continue;
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
    const footRow = Math.floor((npc.y + NPC_H - 1) / TILE);
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
      }
      tilesPlaced++;
      setTimeout(placeNext, BRIDGE_DELAY);
    };
    setTimeout(placeNext, BRIDGE_DELAY);
  }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
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
      }
    } else {
      // Glitch
      npc.glitchUntil = performance.now() + GLITCH_DURATION;
    }
  }, [getNpcAt, activateArchitect]);

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

    const spawnNpc = (id: number): NPC => ({
      id,
      x: SPAWN_X,
      y: SPAWN_Y,
      direction: 1,
      isAlive: true,
      isRescued: false,
      role: id === 0 ? "architect" : "none",
      roleActivated: false,
      isBuilding: false,
      glitchUntil: 0,
      vy: 0,
      spawnDelayTimer: 800,
    });

    const update = (dt: number) => {
      const s = stateRef.current;

      // Spawning
      if (s.spawnCount < TOTAL_NPC) {
        s.spawnTimer += dt;
        if (s.spawnTimer >= SPAWN_INTERVAL) {
          s.spawnTimer -= SPAWN_INTERVAL;
          s.npcs.push(spawnNpc(s.spawnCount));
          s.spawnCount++;
        }
      }

      // Hover detection
      s.hoveredNpcId = getNpcAt(s.mouseX, s.mouseY)?.id ?? null;

      // Global pause
      if (s.pauseTimer > 0) {
        s.pauseTimer -= dt;
        return;
      }

      // NPC update
      for (const npc of s.npcs) {
        if (!npc.isAlive || npc.isRescued || npc.isBuilding) continue;

        // Spawn delay
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
          continue;
        }

        // Horizontal movement
        const nx = npc.x + npc.direction * SPEED;
        const headRow = Math.floor(npc.y / TILE);
        const midRow = Math.floor((npc.y + NPC_H / 2) / TILE);
        const checkCol = npc.direction === 1
          ? Math.floor((nx + NPC_W) / TILE)
          : Math.floor(nx / TILE);

        if (isSolid(s.map, checkCol, headRow) || isSolid(s.map, checkCol, midRow)) {
          npc.direction = (npc.direction * -1) as 1 | -1;
        } else {
          npc.x = nx;
        }

        // Exit check
        const npcCenterCol = Math.floor((npc.x + NPC_W / 2) / TILE);
        const npcRow = Math.floor((npc.y + NPC_H / 2) / TILE);
        if (npcCenterCol === EXIT_COL && npcRow === EXIT_ROW) {
          npc.isRescued = true;
          s.rescued++;
        }
      }
    };

    const draw = (now: number) => {
      const s = stateRef.current;
      ctx.clearRect(0, 0, W, H);

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
      ctx.fillRect(EXIT_COL * TILE + 2, EXIT_ROW * TILE + 2, TILE - 4, TILE - 4);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#00ff88";
      ctx.lineWidth = 1;
      ctx.strokeRect(EXIT_COL * TILE + 2, EXIT_ROW * TILE + 2, TILE - 4, TILE - 4);

      // NPCs
      for (const npc of s.npcs) {
        if (!npc.isAlive || npc.isRescued) continue;

        const isGlitching = now < npc.glitchUntil;

        // Hover glow
        if (s.hoveredNpcId === npc.id && !isGlitching) {
          ctx.shadowColor = npc.role === "architect" && !npc.roleActivated ? "#00ccff" : "#ffffff";
          ctx.shadowBlur = 8;
          ctx.strokeStyle = npc.role === "architect" && !npc.roleActivated ? "#00ccff" : "#aaaaaa";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(npc.x - 2, npc.y - 2, NPC_W + 4, NPC_H + 4);
          ctx.shadowBlur = 0;
        }

        if (isGlitching) {
          // Static noise effect
          for (let py = 0; py < NPC_H; py += 2) {
            for (let px = 0; px < NPC_W; px += 2) {
              const v = Math.random() * 255;
              ctx.fillStyle = `rgb(${v},${v * 0.7},${v * 0.9})`;
              ctx.fillRect(npc.x + px, npc.y + py, 2, 2);
            }
          }
        } else {
          // Body
          let bodyColor: string;
          if (npc.role === "architect" && !npc.roleActivated) {
            bodyColor = "#00ccff";
          } else if (npc.role === "architect" && npc.roleActivated) {
            bodyColor = "#006688";
          } else {
            bodyColor = "#cccccc";
          }

          // Simple humanoid shape
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

          // Direction indicator
          ctx.fillStyle = "#ffffff";
          const eyeX = npc.x + NPC_W / 2 + npc.direction * 2;
          ctx.fillRect(eyeX - 1, npc.y + 3, 2, 2);

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
      ctx.fillText(`Rescued: ${s.rescued} / ${TOTAL_NPC}`, 8, 14);
      ctx.fillText(`Spawned: ${s.npcs.length} / ${TOTAL_NPC}`, 8, 28);
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
