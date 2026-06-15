import { createInitialGameState } from "../domain/save";
import type { ReadyRuntimeState } from "../domain/types";

export { createInitialGameState };

export function createInitialRuntimeState(): ReadyRuntimeState {
  return {
    mode: "ready",
    game: createInitialGameState(),
    persistence: { kind: "available", saveWarning: "none" },
    runtimeClock: {
      lastDirectAttackAtMs: null,
      lastVisibleTickAtMs: null,
    },
  };
}
