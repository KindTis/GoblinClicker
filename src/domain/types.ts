import type { LoadErrorReason } from "./saveTypes";

export type UpgradeId =
  | "club"
  | "catapult"
  | "baitBag"
  | "mudTrap"
  | "battleAxe"
  | "reinforcedCatapult"
  | "goldenBaitJar"
  | "deepMudBog"
  | "blacksmithContract";

export type UpgradeDefinition = {
  id: UpgradeId;
  name: string;
  baseCost: number;
  growthRate: number;
  description: string;
};

export type GameState = {
  goblinHp: number;
  mudTrapArmedLevel: number;
  catapultCooldownRemainingMs: number;
  defeatedCount: number;
  coins: number;
  upgrades: Record<UpgradeId, number>;
};

export type SaveData = {
  saveVersion: 1;
  state: GameState;
  savedAt?: number;
};

export type RuntimeMode = "loading" | "ready" | "defeatTransition" | "loadError";

export type PersistenceState =
  | { kind: "available"; saveWarning: "none" | "unsaved" }
  | { kind: "unavailable"; saveWarning: "storageUnavailable" };

export type RuntimeClock = {
  lastDirectAttackAtMs: number | null;
  lastVisibleTickAtMs: number | null;
};

export type LoadingRuntimeState = {
  mode: "loading";
};

export type LoadErrorRuntimeState = {
  mode: "loadError";
  reason: LoadErrorReason;
  message: string;
};

export type ReadyRuntimeState = {
  mode: "ready";
  game: GameState;
  persistence: PersistenceState;
  runtimeClock: RuntimeClock;
};

export type DefeatTransitionRuntimeState = {
  mode: "defeatTransition";
  game: GameState;
  persistence: PersistenceState;
  runtimeClock: RuntimeClock;
  defeatedSnapshot: {
    enemyInstanceId: number;
    hp: 0;
    startedAtMs: number;
  };
};

export type PlayableRuntimeState = ReadyRuntimeState | DefeatTransitionRuntimeState;

export type RuntimeState =
  | LoadingRuntimeState
  | LoadErrorRuntimeState
  | ReadyRuntimeState
  | DefeatTransitionRuntimeState;

export type EnemyRenderState = {
  enemyInstanceId: number;
  goblinLevel: number;
  hp: number;
  maxHp: number;
  visualState: "idle" | "defeated";
};

export type SaveEffectResult = "saved" | "failed" | "skippedStorageUnavailable";
