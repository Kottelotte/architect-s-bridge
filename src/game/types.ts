export type Role = "none" | "architect" | "anchor" | "excavator" | "vessel";

export interface NPC {
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
  stopsMoving: boolean;
  isSolid: boolean;
  countsAsDead: boolean;
}

export interface LevelDef {
  map: number[][];
  exitCol: number;
  exitRow: number;
  spawnX: number;
  spawnY: number;
  roles: Role[];
}

export type TransitionPhase =
  | "none"
  | "static1"
  | "typewriter"
  | "static2"
  | "fail_static"
  | "fail_typewriter"
  | "fail_static2"
  | "done";

export interface GameState {
  map: number[][];
  npcs: NPC[];
  spawnTimer: number;
  spawnCount: number;
  lastTime: number;
  mouseX: number;
  mouseY: number;
  hoveredNpcId: number | null;
  rescued: number;
  dead: number;
  pauseTimer: number;
  currentLevel: number;
  exitCol: number;
  exitRow: number;
  spawnX: number;
  spawnY: number;
  totalNpc: number;
  roles: Role[];
  transition: TransitionPhase;
  transitionTimer: number;
  transitionText: string;
  transitionCharIndex: number;
  inputDisabled: boolean;
  failMessage: string;
}
