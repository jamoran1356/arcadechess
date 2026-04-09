type DuelProgressRole = "attacker" | "defender";

type DuelProgressState = {
  actionCount: number;
  latestValue: string | null;
  updatedAt: number;
};

type DuelLiveState = Partial<Record<DuelProgressRole, DuelProgressState>>;

declare global {
  var __playchessArcadeLiveStore: Map<string, DuelLiveState> | undefined;
}

const arcadeLiveStore = globalThis.__playchessArcadeLiveStore ?? new Map<string, DuelLiveState>();
globalThis.__playchessArcadeLiveStore = arcadeLiveStore;

function cleanupArcadeLiveStore() {
  const cutoff = Date.now() - 1000 * 60 * 30;
  for (const [duelId, state] of arcadeLiveStore.entries()) {
    const attackerUpdated = state.attacker?.updatedAt ?? 0;
    const defenderUpdated = state.defender?.updatedAt ?? 0;
    if (Math.max(attackerUpdated, defenderUpdated) < cutoff) {
      arcadeLiveStore.delete(duelId);
    }
  }
}

export function getArcadeLiveState(duelId: string) {
  cleanupArcadeLiveStore();
  return arcadeLiveStore.get(duelId) ?? null;
}

export function updateArcadeLiveState(params: {
  duelId: string;
  role: DuelProgressRole;
  actionCount: number;
  latestValue?: string | null;
}) {
  cleanupArcadeLiveStore();
  const current = arcadeLiveStore.get(params.duelId) ?? {};
  arcadeLiveStore.set(params.duelId, {
    ...current,
    [params.role]: {
      actionCount: Math.max(0, Math.round(params.actionCount)),
      latestValue: params.latestValue ?? null,
      updatedAt: Date.now(),
    },
  });
}

export function clearArcadeLiveState(duelId: string) {
  arcadeLiveStore.delete(duelId);
}
