'use client';

import { useMemo, useState } from "react";

type MatchShareControlsProps = {
  matchId: string;
  title: string;
  className?: string;
};

export function MatchShareControls({ matchId, title, className }: MatchShareControlsProps) {
  const [copied, setCopied] = useState(false);

  const matchUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return `/match/${matchId}`;
    }
    return `${window.location.origin}/match/${matchId}`;
  }, [matchId]);

  const mailtoHref = useMemo(() => {
    const subject = encodeURIComponent(`Te invito a jugar: ${title}`);
    const body = encodeURIComponent(`Unete a mi partida en PlayChess:\n${matchUrl}`);
    return `mailto:?subject=${subject}&body=${body}`;
  }, [matchUrl, title]);

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(matchUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={className ?? "flex flex-wrap items-center gap-2"}>
      <button
        type="button"
        onClick={copyInvite}
        className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-slate-200 transition hover:border-cyan-200/50"
      >
        {copied ? "Link copiado" : "Compartir"}
      </button>
      <a
        href={mailtoHref}
        className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-slate-200 transition hover:border-emerald-200/50"
      >
        Invitar por correo
      </a>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(`Juguemos en PlayChess: ${matchUrl}`)}`}
        target="_blank"
        rel="noreferrer"
        className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-slate-200 transition hover:border-amber-200/50"
      >
        Enviar por wallet/chat
      </a>
    </div>
  );
}
