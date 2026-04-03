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
  /** When provided the game runs in real-time multiplayer mode. */
  multiplayer?: {
    duelId: string;
    role: 'attacker' | 'defender';
  };
};

const W = 480;
const H = 300;
const PADDLE_W = 10;
const BALL_R = 6;
const TICK = 16; // ~60fps
const SYNC_MS = 80; // network sync interval

export function PingPongGame({ scenario, onAction, onComplete, disabled, multiplayer }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const isMultiplayer = !!multiplayer;
  // "host" runs the authoritative physics. In singleplayer the local player is always host.
  const isHost = !multiplayer || multiplayer.role === 'attacker';

  /* ---- shared game state ---- */
  const stateRef = useRef({
    leftY: H / 2,       // attacker / singleplayer paddle
    rightY: H / 2,      // defender / CPU paddle
    ballX: W / 2,
    ballY: H / 2,
    dx: scenario.ballSpeed,
    dy: scenario.ballSpeed * 0.6,
    leftScore: 0,
    rightScore: 0,
    over: false,
  });

  const inputRef = useRef<'up' | 'down' | null>(null);
  const [scores, setScores] = useState({ left: 0, right: 0 });
  const completedRef = useRef(false);
  const remotePaddleRef = useRef(H / 2);
  const defenderReadyRef = useRef(false);
  const [waiting, setWaiting] = useState(isMultiplayer && isHost);

  const paddleH = Math.round(H * scenario.paddleH);

  /* ---- reset ball after a point ---- */
  const resetBall = useCallback(() => {
    const s = stateRef.current;
    s.ballX = W / 2;
    s.ballY = H / 2;
    s.dx = scenario.ballSpeed * (s.dx > 0 ? -1 : 1);
    s.dy = scenario.ballSpeed * 0.6 * (Math.random() > 0.5 ? 1 : -1);
  }, [scenario.ballSpeed]);

  /* ---- keyboard input ---- */
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') inputRef.current = 'up';
      else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') inputRef.current = 'down';
    };
    const up = () => { inputRef.current = null; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  /* ---- multiplayer network sync ---- */
  useEffect(() => {
    if (!isMultiplayer || disabled) return;
    let active = true;

    const sync = async () => {
      while (active) {
        const s = stateRef.current;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const body: Record<string, any> = {
          role: multiplayer.role,
          paddleY: isHost ? s.leftY : s.rightY,
        };

        if (isHost) {
          body.state = {
            ball: { x: s.ballX, y: s.ballY },
            attackerScore: s.leftScore,
            defenderScore: s.rightScore,
            over: s.over,
          };
        }

        try {
          const res = await fetch(`/api/duels/${multiplayer.duelId}/pong-sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });

          if (!res.ok) { await delay(SYNC_MS); continue; }

          const data = await res.json();

          if (isHost) {
            remotePaddleRef.current = data.defenderPaddleY;
            if (data.defenderConnected && !defenderReadyRef.current) {
              defenderReadyRef.current = true;
              setWaiting(false);
            }
          } else {
            // Defender: consume authoritative state
            remotePaddleRef.current = data.attackerPaddleY;
            defenderReadyRef.current = true;

            s.ballX = data.ball.x;
            s.ballY = data.ball.y;
            s.leftY = data.attackerPaddleY;

            // Detect score changes → fire onAction from defender's perspective
            // defender's "player" score = rightScore, "cpu" score = leftScore
            if (data.defenderScore !== s.rightScore) {
              s.rightScore = data.defenderScore;
              onAction(`player-score:${s.rightScore}`);
            }
            if (data.attackerScore !== s.leftScore) {
              s.leftScore = data.attackerScore;
              onAction(`cpu-score:${s.leftScore}`);
            }
            setScores({ left: s.leftScore, right: s.rightScore });

            if (data.over && !s.over && !completedRef.current) {
              s.over = true;
              completedRef.current = true;
              onAction(`final:${s.rightScore}-${s.leftScore}`);
              setTimeout(() => onComplete(), 100);
            }
          }
        } catch { /* network hiccup, retry */ }

        await delay(SYNC_MS);
      }
    };

    void sync();
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMultiplayer, disabled, multiplayer?.duelId, multiplayer?.role]);

  /* ---- main game loop (physics + render) ---- */
  useEffect(() => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const interval = setInterval(() => {
      const s = stateRef.current;

      // ---------- PHYSICS (only when host) ----------
      if (!s.over && isHost) {
        // Move my paddle (left)
        const speed = 5;
        if (inputRef.current === 'up') s.leftY = Math.max(paddleH / 2, s.leftY - speed);
        if (inputRef.current === 'down') s.leftY = Math.min(H - paddleH / 2, s.leftY + speed);

        if (isMultiplayer) {
          // Right paddle from network
          s.rightY = remotePaddleRef.current;
        } else {
          // CPU AI: follow ball with slight lag
          const cpuSpeed = 3.2;
          if (s.ballY < s.rightY - 4) s.rightY = Math.max(paddleH / 2, s.rightY - cpuSpeed);
          else if (s.ballY > s.rightY + 4) s.rightY = Math.min(H - paddleH / 2, s.rightY + cpuSpeed);
        }

        // Ball only moves when opponent is ready (or singleplayer)
        const canPlay = !isMultiplayer || defenderReadyRef.current;
        if (canPlay) {
          s.ballX += s.dx;
          s.ballY += s.dy;

          // Bounce top/bottom
          if (s.ballY <= BALL_R || s.ballY >= H - BALL_R) s.dy = -s.dy;

          // Left paddle collision
          if (s.ballX - BALL_R <= PADDLE_W + 12 && s.ballX - BALL_R > PADDLE_W + 4 &&
              s.ballY >= s.leftY - paddleH / 2 && s.ballY <= s.leftY + paddleH / 2) {
            s.dx = Math.abs(s.dx);
            s.dy = ((s.ballY - s.leftY) / (paddleH / 2)) * scenario.ballSpeed;
            onAction('hit');
          }

          // Right paddle collision
          if (s.ballX + BALL_R >= W - PADDLE_W - 12 && s.ballX + BALL_R < W - PADDLE_W - 4 &&
              s.ballY >= s.rightY - paddleH / 2 && s.ballY <= s.rightY + paddleH / 2) {
            s.dx = -Math.abs(s.dx);
            s.dy = ((s.ballY - s.rightY) / (paddleH / 2)) * scenario.ballSpeed;
          }

          // Scoring
          if (s.ballX < 0) {
            s.rightScore++;
            setScores({ left: s.leftScore, right: s.rightScore });
            onAction(`cpu-score:${s.rightScore}`);
            resetBall();
          } else if (s.ballX > W) {
            s.leftScore++;
            setScores({ left: s.leftScore, right: s.rightScore });
            onAction(`player-score:${s.leftScore}`);
            resetBall();
          }

          // Win check
          if ((s.leftScore >= scenario.winScore || s.rightScore >= scenario.winScore) && !completedRef.current) {
            s.over = true;
            completedRef.current = true;
            onAction(`final:${s.leftScore}-${s.rightScore}`);
            setTimeout(() => onComplete(), 100);
          }
        }
      }

      // ---------- DEFENDER: update own paddle locally ----------
      if (!s.over && !isHost) {
        const speed = 5;
        if (inputRef.current === 'up') s.rightY = Math.max(paddleH / 2, s.rightY - speed);
        if (inputRef.current === 'down') s.rightY = Math.min(H - paddleH / 2, s.rightY + speed);
      }

      // ---------- RENDER ----------
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
      ctx.fillRect(12, s.leftY - paddleH / 2, PADDLE_W, paddleH);
      ctx.fillStyle = '#f87171';
      ctx.fillRect(W - 12 - PADDLE_W, s.rightY - paddleH / 2, PADDLE_W, paddleH);

      // Ball
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(s.ballX, s.ballY, BALL_R, 0, Math.PI * 2);
      ctx.fill();

      // Scores
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${s.leftScore}`, W / 4, 36);
      ctx.fillText(`${s.rightScore}`, (3 * W) / 4, 36);

      // Waiting overlay
      if (waiting) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#67e8f9';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Esperando al rival...', W / 2, H / 2);
      }
    }, TICK);

    return () => clearInterval(interval);
  }, [disabled, isHost, isMultiplayer, onAction, onComplete, paddleH, resetBall, scenario.ballSpeed, scenario.winScore, waiting]);

  /* ---- touch controls ---- */
  const handleTouch = useCallback((e: React.TouchEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const y = e.touches[0].clientY - rect.top;
    const ratio = y / rect.height;
    const clamped = Math.max(paddleH / 2, Math.min(H - paddleH / 2, ratio * H));
    if (isHost) {
      stateRef.current.leftY = clamped;
    } else {
      stateRef.current.rightY = clamped;
    }
  }, [paddleH, isHost]);

  /* ---- derive "my" vs "rival" scores ---- */
  const myScore = isHost ? scores.left : scores.right;
  const rivalScore = isHost ? scores.right : scores.left;
  const rivalLabel = isMultiplayer ? 'Rival' : 'CPU';

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
        <span className="text-amber-300 font-semibold">Tú: {myScore}</span>
        <span className="text-slate-400">Primero a {scenario.winScore}</span>
        <span className="text-rose-400 font-semibold">{rivalLabel}: {rivalScore}</span>
      </div>
      <p className="text-center text-xs text-slate-500 max-sm:hidden">Usa ↑ ↓ o W/S para mover la paleta</p>
    </div>
  );
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
