import { ArcadeGameType } from "@prisma/client";
import { Chess } from "chess.js";
import type { Color } from "chess.js";

type Target = {
  id: string;
  x: number;
  y: number;
  size: number;
};

type ArcadeAction = {
  at: number;
  value: string;
};

export type ArcadeAttempt = {
  startedAt: number;
  finishedAt: number;
  actions: ArcadeAction[];
};

type TargetRushScenario = {
  kind: "targets";
  targets: Target[];
};

type MemoryGridScenario = {
  kind: "memory";
  sequence: string[];
};

type KeyClashScenario = {
  kind: "keys";
  sequence: string[];
};

type MazeCell = { row: number; col: number; walls: { top: boolean; right: boolean; bottom: boolean; left: boolean } };

type MazeScenario = {
  kind: "maze";
  grid: MazeCell[][];
  rows: number;
  cols: number;
  start: { row: number; col: number };
  end: { row: number; col: number };
};

type PongScenario = {
  kind: "pong";
  ballSpeed: number;
  paddleH: number;
  winScore: number;
};

type ReactionScenario = {
  kind: "reaction";
  rounds: number;
  delays: number[];
};

export type ArcadeScenario = TargetRushScenario | MemoryGridScenario | KeyClashScenario | MazeScenario | PongScenario | ReactionScenario;

export type ArcadeLibraryItem = {
  id: ArcadeGameType;
  slug: string;
  name: string;
  blurb: string;
  timeLimitMs: number;
  antiCheat: string;
};

const keyPool = ["A", "S", "D", "J", "K", "L"];
const cellPool = ["A1", "A2", "A3", "B1", "B2", "B3", "C1", "C2", "C3"];

export const arcadeLibrary: ArcadeLibraryItem[] = [
  {
    id: ArcadeGameType.TARGET_RUSH,
    slug: "target-rush",
    name: "Target Rush",
    blurb: "Haz clic en objetivos numerados con seed compartida y limite exacto.",
    timeLimitMs: 18000,
    antiCheat: "Servidor valida orden, ventana total y coherencia temporal.",
  },
  {
    id: ArcadeGameType.MEMORY_GRID,
    slug: "memory-grid",
    name: "Memory Grid",
    blurb: "Memoriza y repite la misma secuencia que ve tu rival.",
    timeLimitMs: 20000,
    antiCheat: "La secuencia se deriva del seed y se verifica en backend.",
  },
  {
    id: ArcadeGameType.KEY_CLASH,
    slug: "key-clash",
    name: "Key Clash",
    blurb: "Teclea la cadena de comandos antes que tu oponente.",
    timeLimitMs: 16000,
    antiCheat: "Inputs invalidados si exceden tiempo o rompen el patron generado.",
  },
  {
    id: ArcadeGameType.MAZE_RUNNER,
    slug: "maze-runner",
    name: "Maze Runner",
    blurb: "Navega el laberinto desde el inicio hasta la meta antes que tu rival.",
    timeLimitMs: 25000,
    antiCheat: "El laberinto se genera del seed. Se valida ruta sin atravesar paredes.",
  },
  {
    id: ArcadeGameType.PING_PONG,
    slug: "ping-pong",
    name: "Ping Pong",
    blurb: "Enfrenta a tu rival en un duelo de ping pong en tiempo real.",
    timeLimitMs: 30000,
    antiCheat: "Score y golpes registrados con timestamps. Se valida secuencia.",
  },
  {
    id: ArcadeGameType.REACTION_DUEL,
    slug: "reaction-duel",
    name: "Reaction Duel",
    blurb: "Reacciona rapido a la señal en multiples rondas. El mas rapido gana.",
    timeLimitMs: 20000,
    antiCheat: "Delays generados del seed. Reacciones tempranas se penalizan.",
  },
];

function hashSeed(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return hash || 1;
}

function createRng(seed: string) {
  let value = hashSeed(seed);
  return () => {
    value ^= value << 13;
    value ^= value >> 17;
    value ^= value << 5;
    return ((value >>> 0) % 1000) / 1000;
  };
}

function buildTargetRush(seed: string): TargetRushScenario {
  const rand = createRng(`${seed}:targets`);
  const targets = Array.from({ length: 10 }, (_, index) => ({
    id: String(index + 1),
    x: Math.round(rand() * 78 + 6),
    y: Math.round(rand() * 72 + 10),
    size: Math.round(rand() * 12 + 10),
  }));

  return { kind: "targets", targets };
}

function buildMemoryGrid(seed: string): MemoryGridScenario {
  const rand = createRng(`${seed}:memory`);
  return {
    kind: "memory",
    sequence: Array.from({ length: 6 }, () => cellPool[Math.floor(rand() * cellPool.length)]),
  };
}

function buildKeyClash(seed: string): KeyClashScenario {
  const rand = createRng(`${seed}:keys`);
  return {
    kind: "keys",
    sequence: Array.from({ length: 12 }, () => keyPool[Math.floor(rand() * keyPool.length)]),
  };
}

function buildMaze(seed: string): MazeScenario {
  const rand = createRng(`${seed}:maze`);
  const rows = 8;
  const cols = 10;

  // Initialize grid with all walls
  const grid: MazeCell[][] = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({
      row: r,
      col: c,
      walls: { top: true, right: true, bottom: true, left: true },
    })),
  );

  // Randomized DFS to carve passages
  const visited: boolean[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => false));
  const stack: Array<{ row: number; col: number }> = [{ row: 0, col: 0 }];
  visited[0][0] = true;

  const dirs: Array<[number, number, 'top' | 'right' | 'bottom' | 'left', 'top' | 'right' | 'bottom' | 'left']> = [
    [-1, 0, 'top', 'bottom'],
    [0, 1, 'right', 'left'],
    [1, 0, 'bottom', 'top'],
    [0, -1, 'left', 'right'],
  ];

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const neighbors = dirs
      .map(([dr, dc, wall, opposite]) => {
        const nr = current.row + dr;
        const nc = current.col + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited[nr][nc]) {
          return { row: nr, col: nc, wall, opposite };
        }
        return null;
      })
      .filter(Boolean) as Array<{ row: number; col: number; wall: 'top' | 'right' | 'bottom' | 'left'; opposite: 'top' | 'right' | 'bottom' | 'left' }>;

    if (neighbors.length === 0) {
      stack.pop();
      continue;
    }

    const next = neighbors[Math.floor(rand() * neighbors.length)];
    grid[current.row][current.col].walls[next.wall] = false;
    grid[next.row][next.col].walls[next.opposite] = false;
    visited[next.row][next.col] = true;
    stack.push({ row: next.row, col: next.col });
  }

  return {
    kind: 'maze',
    grid,
    rows,
    cols,
    start: { row: 0, col: 0 },
    end: { row: rows - 1, col: cols - 1 },
  };
}

function buildPong(seed: string): PongScenario {
  const rand = createRng(`${seed}:pong`);
  return {
    kind: 'pong',
    ballSpeed: 2.5 + rand() * 1.5,          // 2.5–4.0
    paddleH: 0.18 + rand() * 0.08,           // 18–26% of height
    winScore: 3,
  };
}

function buildReaction(seed: string): ReactionScenario {
  const rand = createRng(`${seed}:reaction`);
  const rounds = 5;
  const delays = Array.from({ length: rounds }, () => Math.round(1500 + rand() * 3000)); // 1.5–4.5s
  return {
    kind: 'reaction',
    rounds,
    delays,
  };
}

export function getArcadeDefinition(gameType: ArcadeGameType) {
  return arcadeLibrary.find((game) => game.id === gameType)!;
}

export function buildArcadeScenario(gameType: ArcadeGameType, seed: string): ArcadeScenario {
  switch (gameType) {
    case ArcadeGameType.MEMORY_GRID:
      return buildMemoryGrid(seed);
    case ArcadeGameType.KEY_CLASH:
      return buildKeyClash(seed);
    case ArcadeGameType.MAZE_RUNNER:
      return buildMaze(seed);
    case ArcadeGameType.PING_PONG:
      return buildPong(seed);
    case ArcadeGameType.REACTION_DUEL:
      return buildReaction(seed);
    case ArcadeGameType.TARGET_RUSH:
    default:
      return buildTargetRush(seed);
  }
}

export function getArcadeScenarioSeed(params: {
  gameType: ArcadeGameType;
  duelSeed: string;
  viewerId?: string | null;
  attackerId: string;
  defenderId: string;
}) {
  if (params.gameType === ArcadeGameType.MAZE_RUNNER) {
    return params.duelSeed;
  }

  if (params.viewerId === params.attackerId) {
    return `${params.duelSeed}:attacker`;
  }

  if (params.viewerId === params.defenderId) {
    return `${params.duelSeed}:defender`;
  }

  return `${params.duelSeed}:attacker`;
}

export function getArcadeAttemptSeed(gameType: ArcadeGameType, duelSeed: string, role: "attacker" | "defender") {
  if (gameType === ArcadeGameType.MAZE_RUNNER) {
    return duelSeed;
  }

  return `${duelSeed}:${role}`;
}

function squareToCoords(square: string) {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  if (Number.isNaN(rank) || file < 0 || file > 7 || rank < 0 || rank > 7) {
    return null;
  }
  return { file, rank };
}

function findKingSquare(fen: string, color: Color): string | null {
  try {
    const chess = new Chess(fen);
    const board = chess.board();
    for (let rank = 0; rank < board.length; rank += 1) {
      for (let file = 0; file < board[rank].length; file += 1) {
        const piece = board[rank][file];
        if (piece?.type === "k" && piece.color === color) {
          const fileChar = String.fromCharCode(97 + file);
          const rankChar = String(8 - rank);
          return `${fileChar}${rankChar}`;
        }
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function getSoloArcadeTimeLimitMs(params: {
  fen: string;
  targetSquare: string;
  attackerTurn: "w" | "b";
}) {
  const defenderColor: Color = params.attackerTurn === "w" ? "b" : "w";
  const kingSquare = findKingSquare(params.fen, defenderColor);
  const target = squareToCoords(params.targetSquare);
  const king = kingSquare ? squareToCoords(kingSquare) : null;

  // Default for solo duels: 10 seconds
  if (!target || !king) {
    return 10_000;
  }

  const manhattan = Math.abs(target.file - king.file) + Math.abs(target.rank - king.rank);
  const derivedSeconds = Math.max(3, Math.min(10, manhattan + 2));
  return derivedSeconds * 1000;
}

export function evaluateArcadeAttempt(
  gameType: ArcadeGameType,
  seed: string,
  attempt: ArcadeAttempt,
  options?: { timeLimitMs?: number },
) {
  const definition = getArcadeDefinition(gameType);
  const timeLimitMs = options?.timeLimitMs ?? definition.timeLimitMs;
  const duration = attempt.finishedAt - attempt.startedAt;

  if (duration <= 0 || duration > timeLimitMs + 1200) {
    return { valid: false, score: 0, reason: "Tiempo fuera de rango." };
  }

  if (attempt.actions.some((action, index) => index > 0 && action.at < attempt.actions[index - 1].at)) {
    return { valid: false, score: 0, reason: "Secuencia temporal invalida." };
  }

  const scenario = buildArcadeScenario(gameType, seed);

  if (scenario.kind === "targets") {
    const expected = scenario.targets.map((target) => target.id);
    const received = attempt.actions.map((action) => action.value);
    const correct = expected.filter((value, index) => received[index] === value).length;
    const basePoints = correct * 500;

    if (received.length !== expected.length || correct !== expected.length) {
      return { valid: false, score: basePoints, reason: "Objetivos incompletos o fuera de orden." };
    }

    const timeBonus = Math.max(0, Math.round(5000 * (1 - duration / timeLimitMs)));
    return { valid: true, score: basePoints + timeBonus };
  }

  if (scenario.kind === "memory") {
    const correct = scenario.sequence.filter((value, index) => attempt.actions[index]?.value === value).length;
    if (attempt.actions.length !== scenario.sequence.length) {
      return { valid: false, score: correct * 500, reason: "La secuencia no esta completa." };
    }

    return {
      valid: correct === scenario.sequence.length,
      score: correct * 1000 - duration / 4,
      reason: correct === scenario.sequence.length ? undefined : "La secuencia no coincide.",
    };
  }

  if (scenario.kind === "keys") {
    const correct = scenario.sequence.filter((value, index) => attempt.actions[index]?.value.toUpperCase() === value).length;
    if (attempt.actions.length !== scenario.sequence.length) {
      return { valid: false, score: correct * 300, reason: "Comandos incompletos." };
    }

    return {
      valid: correct === scenario.sequence.length,
      score: correct * 800 - duration / 3,
      reason: correct === scenario.sequence.length ? undefined : "Comando fuera de orden.",
    };
  }

  if (scenario.kind === "maze") {
    const actions = attempt.actions.map((a) => a.value);
    if (actions.length === 0) {
      return { valid: false, score: 0, reason: "No se movió en el laberinto." };
    }
    const last = actions[actions.length - 1];
    const [lr, lc] = (last ?? "").split(",").map(Number);
    const reachedEnd = lr === scenario.end.row && lc === scenario.end.col;
    if (!reachedEnd) {
      return { valid: false, score: Math.min(actions.length * 50, 3000), reason: "No llegó a la meta." };
    }
    // Fewer steps + faster = better; score relative to time limit
    const timeScore = Math.round(8000 * (1 - duration / timeLimitMs));
    const stepPenalty = actions.length * 5;
    return { valid: true, score: Math.max(100, timeScore + 2000 - stepPenalty) };
  }

  if (scenario.kind === "pong") {
    const finalAction = attempt.actions.find((a) => a.value.startsWith("final:"));
    let playerScore: number;
    let cpuScore: number;

    if (finalAction) {
      const [pStr, cStr] = finalAction.value.replace("final:", "").split("-");
      playerScore = Number(pStr);
      cpuScore = Number(cStr);
    } else {
      // Timer expired before winScore — compute from individual score events
      playerScore = attempt.actions.filter((a) => a.value.startsWith("player-score:")).length;
      cpuScore = attempt.actions.filter((a) => a.value.startsWith("cpu-score:")).length;
    }

    const hits = attempt.actions.filter((a) => a.value === "hit").length;
    if (playerScore >= scenario.winScore) {
      return { valid: true, score: 5000 + hits * 200 + Math.max(0, 5000 - duration) };
    }
    return { valid: true, score: Math.max(0, playerScore * 800 + hits * 100 - cpuScore * 400) };
  }

  if (scenario.kind === "reaction") {
    const reacts = attempt.actions.filter((a) => a.value.startsWith("react:"));
    const earlyCount = attempt.actions.filter((a) => a.value.startsWith("early:")).length;
    if (reacts.length + earlyCount === 0) {
      return { valid: false, score: 0, reason: "No reaccionó." };
    }
    const times = reacts.map((a) => Number(a.value.replace("react:", "").replace("ms", "")));
    const avg = times.length > 0 ? times.reduce((s, t) => s + t, 0) / times.length : 9999;
    // Faster average = higher score, early clicks penalize heavily
    const baseScore = Math.max(0, 10000 - avg * 10);
    return { valid: true, score: Math.round(baseScore - earlyCount * 2000) };
  }

  return { valid: false, score: 0, reason: "Tipo de juego desconocido." };
}
