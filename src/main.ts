import Phaser from "phaser";
import "./styles.css";
import { GoblinScene } from "./game/GoblinScene";
import { setSceneEventHandler } from "./game/sceneEvents";
import type { AppToSceneEvent } from "./game/sceneEvents";
import { createInitialGameState, deleteSave, loadGame, saveGame, type StorageAdapter } from "./domain/save";
import { applySaveEffectResult, processFrame, processPurchase, selectEnemyRenderState, type RuntimeEffect } from "./domain/runtime";
import type { PlayableRuntimeState, RuntimeState, UpgradeId } from "./domain/types";
import { createLoadErrorState } from "./app/loadErrorState";
import { cancelLoadError, retryLoadFromLoadError, startNewGameFromLoadError } from "./app/loadErrorActions";
import {
  createAutoSaveSchedulerState,
  isAutoSaveDue,
  recordAutoSaveBaseline,
  type AutoSaveSchedulerState,
} from "./app/autoSaveScheduler";
import { selectLatestSaveEffect, toSceneVisualEffects } from "./app/effects";
import { renderHud } from "./ui/hud";
import { clearModal, renderLoadErrorModal, renderResetModal } from "./ui/modal";
import { shouldRouteSpaceToCombat } from "./ui/focus";
import { installGoblinTestApi, type TestStorageController } from "./test/e2eHarness";
import type { PurchaseFeedback } from "./domain/runtime";

const gameRoot = requiredElement("game-root");
const phaserRoot = requiredElement("phaser-root");
const hudRoot = requiredElement("hud-root");
const modalRoot = document.createElement("section");
modalRoot.id = "modal-root";
document.body.append(modalRoot);

let runtime: RuntimeState = { mode: "loading" };
let autoSaveScheduler: AutoSaveSchedulerState | null = null;
let sceneReady = false;
let directAttackRequested = false;
let shopOpen = false;
let resetModalOpen = false;
let storage: StorageAdapter;
let purchaseFeedback: PurchaseFeedback | null = null;
let pendingFocus: "shopTitle" | "shopToggle" | null = null;

const isHarnessEnabled =
  !import.meta.env.PROD &&
  (import.meta.env.MODE === "test" || import.meta.env.VITE_ENABLE_TEST_HARNESS === "true");

let testStorageController: TestStorageController | null = null;
if (isHarnessEnabled) {
  testStorageController = installGoblinTestApi(
    window,
    window.localStorage,
    () => runtime,
    (nextRuntime, options = { syncAutoSaveScheduler: true }) => {
      runtime = nextRuntime;
      if (options.syncAutoSaveScheduler) {
        autoSaveScheduler = createSchedulerForRuntime(runtime, performance.now());
      }
      renderAll();
    },
  );
}

storage = testStorageController?.createAppStorageAdapter() ?? createLocalStorageAdapter(window.localStorage);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: phaserRoot,
  backgroundColor: "#18281c",
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: phaserRoot.clientWidth || 800,
    height: phaserRoot.clientHeight || 560,
  },
  scene: [GoblinScene],
});

setSceneEventHandler((event) => {
  if (event.type === "sceneReady") {
    sceneReady = true;
    renderAll();
    return;
  }
  if (event.type === "directAttackRequested" && canQueueCombatInput()) {
    directAttackRequested = true;
  }
});

gameRoot.addEventListener("keydown", (event) => {
  if (shouldRouteSpaceToCombat(event, gameRoot) && canQueueCombatInput()) {
    event.preventDefault();
    directAttackRequested = true;
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && resetModalOpen) {
    event.preventDefault();
    cancelReset();
  }
});

boot();
requestAnimationFrame(frame);

function boot(): void {
  const result = loadGame(storage, "boot");
  const nowMs = performance.now();
  switch (result.kind) {
    case "loaded":
      runtime = readyState(result.save.state, { kind: "available", saveWarning: "none" });
      autoSaveScheduler = createAutoSaveSchedulerState(nowMs);
      break;
    case "created":
      runtime = readyState(result.save.state, {
        kind: "available",
        saveWarning: result.saveResult === "saved" ? "none" : "unsaved",
      });
      autoSaveScheduler = createAutoSaveSchedulerState(nowMs);
      break;
    case "storageUnavailable":
      runtime = readyState(createInitialGameState(), {
        kind: "unavailable",
        saveWarning: "storageUnavailable",
      });
      autoSaveScheduler = null;
      break;
    case "loadError":
      runtime = createLoadErrorState(result.reason);
      autoSaveScheduler = null;
      break;
  }
  renderAll();
}

function frame(nowMs: number): void {
  const autoSaveDue =
    runtime.mode === "ready" &&
    runtime.persistence.kind === "available" &&
    autoSaveScheduler !== null &&
    isAutoSaveDue(autoSaveScheduler, nowMs);

  const result = processFrame(runtime, {
    nowMs,
    visibilityState: document.visibilityState,
    directAttackRequested,
    autoSaveDue,
  });
  directAttackRequested = false;
  if (result.state !== runtime || result.effects.length > 0) {
    handleRuntimeResult(result.state, result.effects, nowMs);
  }
  requestAnimationFrame(frame);
}

function handlePurchase(upgradeId: UpgradeId): void {
  const result = processPurchase(runtime, upgradeId);
  handleRuntimeResult(result.state, result.effects, performance.now());
}

function handleRuntimeResult(nextRuntime: RuntimeState, effects: RuntimeEffect[], nowMs: number): void {
  runtime = nextRuntime;
  renderAll();

  const visualEffects = toSceneVisualEffects(effects);
  for (const effect of effects) {
    if (effect.type === "purchaseFeedback") {
      purchaseFeedback = effect.feedback;
    }
  }

  if (visualEffects.length > 0) {
    dispatchToScene({ type: "applyVisualEffects", effects: visualEffects });
  }

  const saveEffect = selectLatestSaveEffect(effects);
  if (saveEffect && isPlayable(runtime)) {
    const result = persistSaveEffect(saveEffect, runtime, nowMs);
    runtime = applySaveEffectResult(runtime, result);
    renderAll();
  }
}

function persistSaveEffect(
  effect: Extract<RuntimeEffect, { type: "save" }>,
  state: PlayableRuntimeState,
  nowMs: number,
): "saved" | "failed" | "skippedStorageUnavailable" {
  if (state.persistence.kind === "unavailable") {
    return "skippedStorageUnavailable";
  }
  const result = saveGame(storage, effect.state);
  autoSaveScheduler = recordAutoSaveBaseline(autoSaveScheduler ?? createAutoSaveSchedulerState(nowMs), nowMs);
  return result;
}

function renderAll(): void {
  const enemy = isPlayable(runtime) ? selectEnemyRenderState(runtime) : null;
  renderHud(
    hudRoot,
    { runtime, enemy, shopOpen, purchaseFeedback },
    {
      onPurchase: handlePurchase,
      onOpenResetModal: () => {
        resetModalOpen = true;
        renderAll();
      },
      onToggleShop: (open) => {
        shopOpen = open;
        pendingFocus = open ? "shopTitle" : "shopToggle";
        renderAll();
      },
    },
  );

  if (runtime.mode === "loadError") {
    renderLoadErrorModal(modalRoot, runtime, {
      onRetryLoad: retryLoad,
      onStartNewFromError: startNewFromLoadError,
      onCancelLoadError: cancelLoadErrorModal,
      onConfirmReset: confirmReset,
      onCancelReset: cancelReset,
    });
  } else if (resetModalOpen) {
    renderResetModal(modalRoot, {
      onRetryLoad: retryLoad,
      onStartNewFromError: startNewFromLoadError,
      onCancelLoadError: cancelLoadErrorModal,
      onConfirmReset: confirmReset,
      onCancelReset: cancelReset,
    });
  } else {
    clearModal(modalRoot);
  }

  if (enemy) {
    dispatchToScene({ type: "renderGoblinVisualState", state: enemy });
  }
  dispatchToScene({ type: "setInputBlocked", blocked: !canQueueCombatInput() });
  applyPendingFocus();
}

function retryLoad(): void {
  if (runtime.mode !== "loadError") return;
  const result = retryLoadFromLoadError(runtime, storage);
  applyLoadErrorActionResult(result);
}

function startNewFromLoadError(): void {
  if (runtime.mode !== "loadError") return;
  const result = startNewGameFromLoadError(runtime, storage);
  applyLoadErrorActionResult(result);
}

function cancelLoadErrorModal(): void {
  if (runtime.mode !== "loadError") return;
  const result = cancelLoadError(runtime);
  applyLoadErrorActionResult(result);
}

function applyLoadErrorActionResult(result: ReturnType<typeof retryLoadFromLoadError>): void {
  const nowMs = performance.now();
  runtime = result.state;
  autoSaveScheduler =
    result.state.mode === "ready" && result.state.persistence.kind === "available"
      ? createAutoSaveSchedulerState(nowMs)
      : null;
  renderAll();
}

function confirmReset(): void {
  resetModalOpen = false;
  if (!isPlayable(runtime)) {
    renderAll();
    return;
  }
  if (runtime.persistence.kind === "unavailable") {
    runtime = {
      ...runtime,
      persistence: { kind: "unavailable", saveWarning: "storageUnavailable" },
    };
    renderAll();
    return;
  }
  if (deleteSave(storage) === "failed") {
    runtime = createLoadErrorState("deleteFailed");
    autoSaveScheduler = null;
    renderAll();
    return;
  }
  const gameState = createInitialGameState();
  const saveResult = saveGame(storage, gameState);
  runtime = readyState(gameState, {
    kind: "available",
    saveWarning: saveResult === "saved" ? "none" : "unsaved",
  });
  autoSaveScheduler = createAutoSaveSchedulerState(performance.now());
  renderAll();
}

function cancelReset(): void {
  resetModalOpen = false;
  pendingFocus = "shopToggle";
  renderAll();
}

function applyPendingFocus(): void {
  if (pendingFocus === null) return;
  const target =
    pendingFocus === "shopTitle"
      ? document.querySelector<HTMLElement>("#shop-sheet h2")
      : document.querySelector<HTMLElement>("#shop-toggle");
  pendingFocus = null;
  window.setTimeout(() => target?.focus(), 0);
}

function dispatchToScene(event: AppToSceneEvent): void {
  const scene = game.scene.getScene("GoblinScene");
  if (scene instanceof GoblinScene) {
    scene.dispatch(event);
  }
}

function canQueueCombatInput(): boolean {
  return runtime.mode === "ready" && sceneReady && document.visibilityState === "visible" && !resetModalOpen;
}

function isPlayable(state: RuntimeState): state is PlayableRuntimeState {
  return state.mode === "ready" || state.mode === "defeatTransition";
}

function readyState(
  gameState: PlayableRuntimeState["game"],
  persistence: PlayableRuntimeState["persistence"],
): PlayableRuntimeState {
  return {
    mode: "ready",
    game: gameState,
    persistence,
    runtimeClock: { lastDirectAttackAtMs: null, lastVisibleTickAtMs: null },
  };
}

function createSchedulerForRuntime(state: RuntimeState, nowMs: number): AutoSaveSchedulerState | null {
  return isPlayable(state) && state.persistence.kind === "available" ? createAutoSaveSchedulerState(nowMs) : null;
}

function createLocalStorageAdapter(localStorage: Storage): StorageAdapter {
  return {
    read(key) {
      return localStorage.getItem(key);
    },
    write(key, value) {
      localStorage.setItem(key, value);
    },
    remove(key) {
      localStorage.removeItem(key);
    },
  };
}

function requiredElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing #${id}`);
  }
  return element;
}
