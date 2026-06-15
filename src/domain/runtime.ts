import { DEFEAT_TRANSITION_MS, DIRECT_ATTACK_MIN_INTERVAL_MS } from "./constants";
import { applyDirectAttack, tickCatapult } from "./combat";
import { calculateGoblinLevel, calculateGoblinMaxHp } from "./progression";
import { purchaseUpgrade } from "./upgrades";
import type {
  EnemyRenderState,
  GameState,
  PlayableRuntimeState,
  ReadyRuntimeState,
  RuntimeState,
  SaveEffectResult,
  UpgradeId,
} from "./types";

export type { PlayableRuntimeState, RuntimeState } from "./types";

export type RuntimeEffect =
  | { type: "save"; state: GameState }
  | { type: "damageNumber"; enemyInstanceId: number; source: "direct" | "catapult"; damage: number }
  | { type: "defeatTransitionStarted"; enemyInstanceId: number }
  | { type: "purchaseFeedback"; feedback: PurchaseFeedback };

export type PurchaseFeedback =
  | { type: "success"; upgradeId: UpgradeId; previousLevel: number; nextLevel: number }
  | { type: "insufficientCoins"; upgradeId: UpgradeId; missingCoins: number }
  | { type: "blockedByDefeatTransition"; upgradeId: UpgradeId };

export type RuntimeFrameInput = {
  nowMs: number;
  visibilityState: DocumentVisibilityState;
  directAttackRequested: boolean;
  autoSaveDue: boolean;
};

export type RuntimeFrameResult = {
  state: RuntimeState;
  effects: RuntimeEffect[];
};

export type PurchaseTransactionResult = {
  state: RuntimeState;
  effects: RuntimeEffect[];
};

export function selectEnemyRenderState(state: PlayableRuntimeState): EnemyRenderState {
  if (state.mode === "defeatTransition") {
    const goblinLevel = calculateGoblinLevel(state.defeatedSnapshot.enemyInstanceId);
    return {
      enemyInstanceId: state.defeatedSnapshot.enemyInstanceId,
      goblinLevel,
      hp: 0,
      maxHp: calculateGoblinMaxHp(goblinLevel),
      visualState: "defeated",
    };
  }

  const goblinLevel = calculateGoblinLevel(state.game.defeatedCount);
  return {
    enemyInstanceId: state.game.defeatedCount,
    goblinLevel,
    hp: state.game.goblinHp,
    maxHp: calculateGoblinMaxHp(goblinLevel),
    visualState: "idle",
  };
}

export function processFrame(state: RuntimeState, input: RuntimeFrameInput): RuntimeFrameResult {
  if (state.mode === "loading" || state.mode === "loadError") {
    return { state, effects: [] };
  }

  if (state.mode === "defeatTransition") {
    if (state.defeatedSnapshot.startedAtMs + DEFEAT_TRANSITION_MS <= input.nowMs) {
      return {
        state: {
          mode: "ready",
          game: state.game,
          persistence: state.persistence,
          runtimeClock: state.runtimeClock,
        },
        effects: [],
      };
    }
    return { state, effects: [] };
  }

  let nextState: ReadyRuntimeState = state;
  const effects: RuntimeEffect[] = [];
  let shouldSave = false;
  let defeated = false;

  if (input.directAttackRequested && canDirectAttack(nextState, input.nowMs)) {
    const enemyInstanceId = nextState.game.defeatedCount;
    const attack = applyDirectAttack(nextState.game);
    nextState = {
      ...nextState,
      game: attack.state,
      runtimeClock: { ...nextState.runtimeClock, lastDirectAttackAtMs: input.nowMs },
    };
    effects.push({ type: "damageNumber", enemyInstanceId, source: "direct", damage: attack.damage });
    shouldSave = true;
    if (attack.defeated) {
      defeated = true;
      return startDefeatTransition(nextState, effects, shouldSave, enemyInstanceId, input.nowMs);
    }
  }

  if (!defeated && nextState.game.upgrades.catapult > 0) {
    const delta = nextState.runtimeClock.lastVisibleTickAtMs === null ? 0 : input.nowMs - nextState.runtimeClock.lastVisibleTickAtMs;
    const nextClock =
      input.visibilityState === "visible"
        ? { ...nextState.runtimeClock, lastVisibleTickAtMs: input.nowMs }
        : { ...nextState.runtimeClock, lastVisibleTickAtMs: null };
    const enemyInstanceId = nextState.game.defeatedCount;
    const catapult = tickCatapult(nextState.game, delta, input.visibilityState);
    nextState = { ...nextState, game: catapult.state, runtimeClock: nextClock };
    if (catapult.fired) {
      effects.push({ type: "damageNumber", enemyInstanceId, source: "catapult", damage: catapult.damage });
      shouldSave = true;
      if (catapult.defeated) {
        return startDefeatTransition(nextState, effects, shouldSave, enemyInstanceId, input.nowMs);
      }
    }
  }

  if (input.autoSaveDue && nextState.persistence.kind === "available") {
    shouldSave = true;
  }

  if (shouldSave) {
    effects.push({ type: "save", state: nextState.game });
  }

  return { state: nextState, effects };
}

export function processPurchase(state: RuntimeState, upgradeId: UpgradeId): PurchaseTransactionResult {
  if (state.mode === "defeatTransition") {
    return {
      state,
      effects: [{ type: "purchaseFeedback", feedback: { type: "blockedByDefeatTransition", upgradeId } }],
    };
  }

  if (state.mode !== "ready") {
    return { state, effects: [] };
  }

  const previousLevel = state.game.upgrades[upgradeId];
  const purchase = purchaseUpgrade(state.game, upgradeId);
  if (!purchase.ok) {
    return {
      state,
      effects: [
        {
          type: "purchaseFeedback",
          feedback: { type: "insufficientCoins", upgradeId, missingCoins: purchase.missingCoins },
        },
      ],
    };
  }

  const nextState: ReadyRuntimeState = { ...state, game: purchase.state };
  return {
    state: nextState,
    effects: [
      {
        type: "purchaseFeedback",
        feedback: { type: "success", upgradeId, previousLevel, nextLevel: previousLevel + 1 },
      },
      { type: "save", state: nextState.game },
    ],
  };
}

export function applySaveEffectResult<T extends PlayableRuntimeState>(state: T, result: SaveEffectResult): T {
  if (state.persistence.kind === "unavailable" || result === "skippedStorageUnavailable") {
    return {
      ...state,
      persistence: { kind: "unavailable", saveWarning: "storageUnavailable" },
    };
  }

  return {
    ...state,
    persistence: { kind: "available", saveWarning: result === "saved" ? "none" : "unsaved" },
  };
}

function canDirectAttack(state: ReadyRuntimeState, nowMs: number): boolean {
  return (
    state.runtimeClock.lastDirectAttackAtMs === null ||
    nowMs - state.runtimeClock.lastDirectAttackAtMs >= DIRECT_ATTACK_MIN_INTERVAL_MS
  );
}

function startDefeatTransition(
  state: ReadyRuntimeState,
  effects: RuntimeEffect[],
  shouldSave: boolean,
  enemyInstanceId: number,
  nowMs: number,
): RuntimeFrameResult {
  const transitionState: RuntimeState = {
    mode: "defeatTransition",
    game: state.game,
    persistence: state.persistence,
    runtimeClock: state.runtimeClock,
    defeatedSnapshot: {
      enemyInstanceId,
      hp: 0,
      startedAtMs: nowMs,
    },
  };
  effects.push({ type: "defeatTransitionStarted", enemyInstanceId });
  if (shouldSave) {
    effects.push({ type: "save", state: state.game });
  }
  return { state: transitionState, effects };
}
