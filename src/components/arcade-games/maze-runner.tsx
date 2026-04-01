'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type MazeCell = { row: number; col: number; walls: { top: boolean; right: boolean; bottom: boolean; left: boolean } };

export type MazeScenario = {
  kind: 'maze';
  grid: MazeCell[][];
  rows: number;
  cols: number;
  start: { row: number; col: number };
  end: { row: number; col: number };
};

type Props = {
  scenario: MazeScenario;
  onAction: (value: string) => void;
  onComplete: () => void;
  disabled?: boolean;
};

const CELL = 40;
const WALL = 2;

export function MazeRunnerGame({ scenario, onAction, onComplete, disabled }: Props) {
  const { grid, rows, cols, start, end } = scenario;
  const [pos, setPos] = useState(start);
  const completedRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const tryMove = useCallback(
    (dir: 'up' | 'down' | 'left' | 'right') => {
      if (disabled || completedRef.current) return;

      setPos((prev) => {
        const cell = grid[prev.row]?.[prev.col];
        if (!cell) return prev;

        let next = prev;
        if (dir === 'up' && !cell.walls.top && prev.row > 0) next = { row: prev.row - 1, col: prev.col };
        if (dir === 'down' && !cell.walls.bottom && prev.row < rows - 1) next = { row: prev.row + 1, col: prev.col };
        if (dir === 'left' && !cell.walls.left && prev.col > 0) next = { row: prev.row, col: prev.col - 1 };
        if (dir === 'right' && !cell.walls.right && prev.col < cols - 1) next = { row: prev.row, col: prev.col + 1 };

        if (next !== prev) {
          onAction(`${next.row},${next.col}`);
          if (next.row === end.row && next.col === end.col && !completedRef.current) {
            completedRef.current = true;
            setTimeout(() => onComplete(), 50);
          }
        }
        return next;
      });
    },
    [cols, disabled, end.col, end.row, grid, onAction, onComplete, rows],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const map: Record<string, 'up' | 'down' | 'left' | 'right'> = {
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
        w: 'up', s: 'down', a: 'left', d: 'right',
        W: 'up', S: 'down', A: 'left', D: 'right',
      };
      const dir = map[e.key];
      if (dir) {
        e.preventDefault();
        tryMove(dir);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [tryMove]);

  // Draw maze on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = cols * CELL;
    const h = rows * CELL;
    canvas.width = w;
    canvas.height = h;

    ctx.fillStyle = '#0a1220';
    ctx.fillRect(0, 0, w, h);

    // Draw walls
    ctx.strokeStyle = 'rgba(148,163,184,0.5)';
    ctx.lineWidth = WALL;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r][c];
        const x = c * CELL;
        const y = r * CELL;
        if (cell.walls.top) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + CELL, y); ctx.stroke(); }
        if (cell.walls.right) { ctx.beginPath(); ctx.moveTo(x + CELL, y); ctx.lineTo(x + CELL, y + CELL); ctx.stroke(); }
        if (cell.walls.bottom) { ctx.beginPath(); ctx.moveTo(x, y + CELL); ctx.lineTo(x + CELL, y + CELL); ctx.stroke(); }
        if (cell.walls.left) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + CELL); ctx.stroke(); }
      }
    }

    // Draw end marker
    ctx.fillStyle = 'rgba(52,211,153,0.35)';
    ctx.fillRect(end.col * CELL + 4, end.row * CELL + 4, CELL - 8, CELL - 8);
    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FIN', end.col * CELL + CELL / 2, end.row * CELL + CELL / 2);

    // Draw start marker
    ctx.fillStyle = 'rgba(251,191,36,0.25)';
    ctx.fillRect(start.col * CELL + 4, start.row * CELL + 4, CELL - 8, CELL - 8);

    // Draw player
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(pos.col * CELL + CELL / 2, pos.row * CELL + CELL / 2, CELL / 3, 0, Math.PI * 2);
    ctx.fill();
  }, [cols, end.col, end.row, grid, pos, rows, start.col, start.row]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center overflow-auto rounded-[1.5rem] border border-white/8 bg-[#07121e] p-4">
        <canvas ref={canvasRef} style={{ maxWidth: '100%', height: 'auto' }} />
      </div>
      {/* Mobile controls */}
      <div className="grid grid-cols-3 gap-2 sm:hidden">
        <div />
        <button type="button" onPointerDown={() => tryMove('up')} className="rounded-lg border border-white/10 bg-slate-800 py-3 text-center text-lg font-bold text-white">▲</button>
        <div />
        <button type="button" onPointerDown={() => tryMove('left')} className="rounded-lg border border-white/10 bg-slate-800 py-3 text-center text-lg font-bold text-white">◀</button>
        <button type="button" onPointerDown={() => tryMove('down')} className="rounded-lg border border-white/10 bg-slate-800 py-3 text-center text-lg font-bold text-white">▼</button>
        <button type="button" onPointerDown={() => tryMove('right')} className="rounded-lg border border-white/10 bg-slate-800 py-3 text-center text-lg font-bold text-white">▶</button>
      </div>
      <p className="text-center text-xs text-slate-500 max-sm:hidden">Usa ← ↑ ↓ → o WASD</p>
    </div>
  );
}
