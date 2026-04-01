'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type PingPongScenario = {
  kind: 'pong';
  ballSpeed: number;   // px per tick
  paddleH: number;     // paddle height ratio 0–1
  winScore: number;     // score to reach
};

type Props = {
  scenario: PingPongScenario;
  onAction: (value: string) => void;
  onComplete: () => void;
  disabled?: boolean;
};

const W = 480;
const H = 300;
const PADDLE_W = 10;
const BALL_R = 6;
const TICK = 16; // ~60fps

export function PingPongGame({ scenario, onAction, onComplete, disabled }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    playerY: H / 2,
    cpuY: H / 2,
    ballX: W / 2,
    ballY: H / 2,
    dx: scenario.ballSpeed,
    dy: scenario.ballSpeed * 0.6,
    playerScore: 0,
    cpuScore: 0,
    over: false,
  });
  const inputRef = useRef<'up' | 'down' | null>(null);
  const [scores, setScores] = useState({ player: 0, cpu: 0 });
  const completedRef = useRef(false);

  const paddleH = Math.round(H * scenario.paddleH);

  const reset = useCallback(() => {
    const s = stateRef.current;
    s.ballX = W / 2;
    s.ballY = H / 2;
    s.dx = scenario.ballSpeed * (s.dx > 0 ? -1 : 1);
    s.dy = scenario.ballSpeed * 0.6 * (Math.random() > 0.5 ? 1 : -1);
  }, [scenario.ballSpeed]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') inputRef.current = 'up';
      else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') inputRef.current = 'down';
    };
    const up = () => { inputRef.current = null; };
    window.addEventListener('keydown', handler);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', handler); window.removeEventListener('keyup', up); };
  }, []);

  useEffect(() => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const interval = setInterval(() => {
      const s = stateRef.current;
      if (s.over) return;

      // Move player paddle
      const speed = 5;
      if (inputRef.current === 'up') s.playerY = Math.max(paddleH / 2, s.playerY - speed);
      if (inputRef.current === 'down') s.playerY = Math.min(H - paddleH / 2, s.playerY + speed);

      // CPU AI: follow ball with slight lag
      const cpuSpeed = 3.2;
      if (s.ballY < s.cpuY - 4) s.cpuY = Math.max(paddleH / 2, s.cpuY - cpuSpeed);
      else if (s.ballY > s.cpuY + 4) s.cpuY = Math.min(H - paddleH / 2, s.cpuY + cpuSpeed);

      // Move ball
      s.ballX += s.dx;
      s.ballY += s.dy;

      // Bounce top/bottom
      if (s.ballY <= BALL_R || s.ballY >= H - BALL_R) s.dy = -s.dy;

      // Player paddle (left)
      if (s.ballX - BALL_R <= PADDLE_W + 12 && s.ballX - BALL_R > PADDLE_W + 4 &&
          s.ballY >= s.playerY - paddleH / 2 && s.ballY <= s.playerY + paddleH / 2) {
        s.dx = Math.abs(s.dx);
        const offset = (s.ballY - s.playerY) / (paddleH / 2);
        s.dy = offset * scenario.ballSpeed;
        onAction('hit');
      }

      // CPU paddle (right)
      if (s.ballX + BALL_R >= W - PADDLE_W - 12 && s.ballX + BALL_R < W - PADDLE_W - 4 &&
          s.ballY >= s.cpuY - paddleH / 2 && s.ballY <= s.cpuY + paddleH / 2) {
        s.dx = -Math.abs(s.dx);
        const offset = (s.ballY - s.cpuY) / (paddleH / 2);
        s.dy = offset * scenario.ballSpeed;
      }

      // Score
      if (s.ballX < 0) {
        s.cpuScore++;
        setScores({ player: s.playerScore, cpu: s.cpuScore });
        onAction(`cpu-score:${s.cpuScore}`);
        reset();
      } else if (s.ballX > W) {
        s.playerScore++;
        setScores({ player: s.playerScore, cpu: s.cpuScore });
        onAction(`player-score:${s.playerScore}`);
        reset();
      }

      // Win check
      if ((s.playerScore >= scenario.winScore || s.cpuScore >= scenario.winScore) && !completedRef.current) {
        s.over = true;
        completedRef.current = true;
        onAction(`final:${s.playerScore}-${s.cpuScore}`);
        setTimeout(() => onComplete(), 100);
      }

      // Draw
      ctx.fillStyle = '#0a1220';
      ctx.fillRect(0, 0, W, H);

      // Center line
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.beginPath();
      ctx.moveTo(W / 2, 0);
      ctx.lineTo(W / 2, H);
      ctx.stroke();
      ctx.setLineDash([]);

      // Paddles
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(12, s.playerY - paddleH / 2, PADDLE_W, paddleH);
      ctx.fillStyle = '#f87171';
      ctx.fillRect(W - 12 - PADDLE_W, s.cpuY - paddleH / 2, PADDLE_W, paddleH);

      // Ball
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(s.ballX, s.ballY, BALL_R, 0, Math.PI * 2);
      ctx.fill();

      // Scores
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${s.playerScore}`, W / 4, 36);
      ctx.fillText(`${s.cpuScore}`, (3 * W) / 4, 36);
    }, TICK);

    return () => clearInterval(interval);
  }, [disabled, onAction, onComplete, paddleH, reset, scenario.ballSpeed, scenario.winScore]);

  // Touch controls
  const handleTouch = useCallback((e: React.TouchEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const y = e.touches[0].clientY - rect.top;
    const ratio = y / rect.height;
    stateRef.current.playerY = Math.max(paddleH / 2, Math.min(H - paddleH / 2, ratio * H));
  }, [paddleH]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center overflow-hidden rounded-[1.5rem] border border-white/8 bg-[#07121e]">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          style={{ maxWidth: '100%', height: 'auto' }}
          onTouchMove={handleTouch}
          onTouchStart={handleTouch}
        />
      </div>
      <div className="flex justify-between px-4 text-sm">
        <span className="text-amber-300 font-semibold">Tu: {scores.player}</span>
        <span className="text-slate-400">Primero a {scenario.winScore}</span>
        <span className="text-rose-400 font-semibold">CPU: {scores.cpu}</span>
      </div>
      <p className="text-center text-xs text-slate-500 max-sm:hidden">Usa ↑ ↓ o W/S para mover la paleta</p>
    </div>
  );
}
