'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import { useDict } from "@/components/locale-provider";

type ChatMsg = {
  id: number;
  userId: string;
  userName: string;
  text: string;
  ts: number;
};

export function MatchChat({ matchId, currentUserId }: { matchId: string; currentUserId?: string }) {
  const t = useDict().chat;
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const seqRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(true);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/matches/${matchId}/chat?after=${seqRef.current}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.messages?.length) {
        setMessages((prev) => [...prev, ...data.messages]);
        seqRef.current = data.seq;
      }
    } catch { /* silent */ }
  }, [matchId]);

  useEffect(() => {
    void poll();
    const id = window.setInterval(poll, 3000);
    return () => window.clearInterval(id);
  }, [poll]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");
    try {
      const res = await fetch(`/api/matches/${matchId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
        seqRef.current = data.seq;
      }
    } catch { /* silent */ }
    setSending(false);
  }

  if (!currentUserId) return null;

  return (
    <div className="panel rounded-[2rem] p-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between"
      >
        <p className="eyebrow">{t.title}</p>
        <svg
          className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="mt-4">
          <div className="flex h-64 flex-col gap-2 overflow-y-auto rounded-xl border border-white/10 bg-slate-950/60 p-3">
            {messages.length === 0 && (
              <p className="text-center text-xs text-slate-500">{t.empty}</p>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`flex flex-col ${m.userId === currentUserId ? "items-end" : "items-start"}`}>
                <span className="mb-0.5 text-[10px] text-slate-500">{m.userName}</span>
                <span
                  className={`inline-block max-w-[85%] rounded-2xl px-3 py-1.5 text-sm break-words ${
                    m.userId === currentUserId
                      ? "bg-cyan-600/30 text-cyan-100"
                      : "bg-white/8 text-slate-200"
                  }`}
                >
                  {m.text}
                </span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); void send(); }}
            className="mt-3 flex gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t.placeholder}
              maxLength={200}
              className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/50 focus:outline-none"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="rounded-full bg-cyan-600/40 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-600/60 disabled:opacity-40"
            >
              {t.send}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
