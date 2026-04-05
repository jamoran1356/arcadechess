type Listener = () => void;

const listeners = new Set<Listener>();

export function onLobbyUpdate(listener: Listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function emitLobbyUpdate() {
  for (const fn of listeners) fn();
}
