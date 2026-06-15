import { deleteSave, loadGame, saveGame, createInitialGameState, type StorageAdapter } from "../domain/save";
import type { LoadErrorRuntimeState, ReadyRuntimeState } from "../domain/types";
import { createLoadErrorState } from "./loadErrorState";

export type LoadErrorActionResult =
  | { kind: "startedNewGame"; state: ReadyRuntimeState; saveResult: "saved" | "failed" }
  | { kind: "loadedExistingSave"; state: ReadyRuntimeState }
  | { kind: "createdInitialGame"; state: ReadyRuntimeState; saveResult: "saved" | "failed" }
  | { kind: "stillLoadError"; state: LoadErrorRuntimeState };

export function startNewGameFromLoadError(
  _state: LoadErrorRuntimeState,
  storage: StorageAdapter,
): LoadErrorActionResult {
  if (deleteSave(storage) === "failed") {
    return { kind: "stillLoadError", state: createLoadErrorState("deleteFailed") };
  }
  const game = createInitialGameState();
  const saveResult = saveGame(storage, game);
  return {
    kind: "startedNewGame",
    state: readyState(game, saveResult),
    saveResult,
  };
}

export function retryLoadFromLoadError(
  state: LoadErrorRuntimeState,
  storage: StorageAdapter,
): LoadErrorActionResult {
  const result = loadGame(storage, "retryFromLoadError");
  if (result.kind === "loaded") {
    return { kind: "loadedExistingSave", state: readyState(result.save.state, "saved") };
  }
  if (result.kind === "created") {
    return { kind: "createdInitialGame", state: readyState(result.save.state, result.saveResult), saveResult: result.saveResult };
  }
  if (result.kind === "loadError") {
    return { kind: "stillLoadError", state: createLoadErrorState(result.reason) };
  }
  return { kind: "stillLoadError", state };
}

export function cancelLoadError(state: LoadErrorRuntimeState): LoadErrorActionResult {
  return { kind: "stillLoadError", state };
}

function readyState(game: ReadyRuntimeState["game"], saveResult: "saved" | "failed"): ReadyRuntimeState {
  return {
    mode: "ready",
    game,
    persistence: { kind: "available", saveWarning: saveResult === "saved" ? "none" : "unsaved" },
    runtimeClock: { lastDirectAttackAtMs: null, lastVisibleTickAtMs: null },
  };
}
