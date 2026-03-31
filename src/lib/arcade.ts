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

export type ArcadeScenario = TargetRushScenario | MemoryGridScenario | KeyClashScenario;

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

export function getArcadeDefinition(gameType: ArcadeGameType) {
  return arcadeLibrary.find((game) => game.id === gameType)!;
}

export function buildArcadeScenario(gameType: ArcadeGameType, seed: string): ArcadeScenario {
  switch (gameType) {
    case ArcadeGameType.MEMORY_GRID:
      return buildMemoryGrid(seed);
    case ArcadeGameType.KEY_CLASH:
      return buildKeyClash(seed);
    case ArcadeGameType.TARGET_RUSH:
    default:
      return buildTargetRush(seed);
  }
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

    if (received.length !== expected.length || correct !== expected.length) {
      return { valid: false, score: correct * 100, reason: "Objetivos incompletos o fuera de orden." };
    }

    return { valid: true, score: 10000 - duration };
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
