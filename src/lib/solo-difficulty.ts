type SoloDifficultyBadge = {
  label: string;
  className: string;
};

export function getSoloDifficultyBadge(match: {
  isSolo?: boolean;
  title: string;
  theme?: string | null;
  stakeAmount?: string | number | null;
}): SoloDifficultyBadge | null {
  if (!match.isSolo) {
    return null;
  }

  const text = `${match.title} ${match.theme ?? ""}`.toLowerCase();
  const stakeAmount = Number(match.stakeAmount ?? 0);
  const tutorial = stakeAmount <= 0;

  if (text.includes("avanzad") || text.includes("maestro") || text.includes("pro")) {
    return {
      label: tutorial ? "Tutorial avanzado" : "Avanzado",
      className: "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-200",
    };
  }

  if (text.includes("intermedio") || text.includes("competitivo")) {
    return {
      label: tutorial ? "Tutorial intermedio" : "Intermedio",
      className: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    };
  }

  return {
    label: tutorial ? "Tutorial básico" : "Básico",
    className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  };
}