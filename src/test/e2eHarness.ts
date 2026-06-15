import { SAVE_KEY } from "../domain/constants";
import { processFrame, type RuntimeFrameInput, type RuntimeFrameResult } from "../domain/runtime";
import { saveGame, toSaveData, type StorageAdapter } from "../domain/save";
import type { RuntimeState, SaveData } from "../domain/types";

export type StorageFailureMode = "none" | "read" | "write" | "remove" | "all";

export type TestStorageController = {
  setSaveData(save: SaveData): void;
  setRawSave(raw: string): void;
  clearSave(): void;
  setStorageFailureMode(mode: StorageFailureMode): void;
  createAppStorageAdapter(): StorageAdapter;
};

export type GoblinTestApi = TestStorageController & {
  getRuntimeSnapshot(): RuntimeState;
  setRuntimeState(state: RuntimeState): void;
  advanceRuntimeFrame(input: RuntimeFrameInput): RuntimeFrameResult;
};

export function createTestStorageController(storage: Storage): TestStorageController {
  let failureMode: StorageFailureMode = "none";
  return {
    setSaveData(save) {
      assertSaveDataForTest(save);
      storage.setItem(SAVE_KEY, JSON.stringify(save));
    },
    setRawSave(raw) {
      storage.setItem(SAVE_KEY, raw);
    },
    clearSave() {
      storage.removeItem(SAVE_KEY);
    },
    setStorageFailureMode(mode) {
      failureMode = mode;
    },
    createAppStorageAdapter() {
      return {
        read(key) {
          throwIfFailed(failureMode, "read");
          return storage.getItem(key);
        },
        write(key, value) {
          throwIfFailed(failureMode, "write");
          storage.setItem(key, value);
        },
        remove(key) {
          throwIfFailed(failureMode, "remove");
          storage.removeItem(key);
        },
      };
    },
  };
}

export function createHarnessRuntimeController(initialState: RuntimeState): Pick<
  GoblinTestApi,
  "getRuntimeSnapshot" | "setRuntimeState" | "advanceRuntimeFrame"
> {
  let runtime = clonePlain(initialState);
  return {
    getRuntimeSnapshot() {
      return clonePlain(runtime);
    },
    setRuntimeState(state) {
      assertRuntimeStateForTest(state);
      runtime = clonePlain(state);
    },
    advanceRuntimeFrame(input) {
      assertRuntimeFrameInputForTest(input, runtime);
      const result = processFrame(runtime, input);
      const cloned = clonePlain(result);
      runtime = cloned.state;
      return clonePlain(cloned);
    },
  };
}

export function assertRuntimeStateForTest(state: RuntimeState): void {
  assertPlainObject(state, "RuntimeState");
  switch (state.mode) {
    case "loading":
      assertExactKeys(state, ["mode"], "loading");
      return;
    case "loadError":
      assertExactKeys(state, ["message", "mode", "reason"], "loadError");
      if (!["parseFailed", "migrationFailed", "readFailed", "deleteFailed"].includes(state.reason)) {
        throw new Error("invalid loadError reason");
      }
      return;
    case "ready":
      assertExactKeys(state, ["game", "mode", "persistence", "runtimeClock"], "ready");
      assertGameStateForTest(state.game);
      assertPersistenceForTest(state.persistence);
      assertRuntimeClockForTest(state.runtimeClock);
      return;
    case "defeatTransition":
      assertExactKeys(state, ["defeatedSnapshot", "game", "mode", "persistence", "runtimeClock"], "defeatTransition");
      assertGameStateForTest(state.game);
      assertPersistenceForTest(state.persistence);
      assertRuntimeClockForTest(state.runtimeClock);
      assertExactKeys(state.defeatedSnapshot, ["enemyInstanceId", "hp", "startedAtMs"], "defeatedSnapshot");
      if (state.defeatedSnapshot.hp !== 0) throw new Error("defeatedSnapshot hp must be 0");
      assertNonNegativeFinite(state.defeatedSnapshot.startedAtMs, "startedAtMs");
      assertNonNegativeInteger(state.defeatedSnapshot.enemyInstanceId, "enemyInstanceId");
      return;
  }
}

export function assertSaveDataForTest(save: SaveData): void {
  assertPlainObject(save, "SaveData");
  const expected = save.savedAt === undefined ? ["saveVersion", "state"] : ["saveVersion", "savedAt", "state"];
  assertExactKeys(save, expected, "SaveData");
  if (save.saveVersion !== 1) throw new Error("invalid saveVersion");
  if (save.savedAt !== undefined) assertNonNegativeFinite(save.savedAt, "savedAt");
  assertGameStateForTest(save.state);
}

export function assertRuntimeFrameInputForTest(input: RuntimeFrameInput, state?: RuntimeState): void {
  assertPlainObject(input, "RuntimeFrameInput");
  assertExactKeys(input, ["autoSaveDue", "directAttackRequested", "nowMs", "visibilityState"], "RuntimeFrameInput");
  assertNonNegativeFinite(input.nowMs, "nowMs");
  if (input.visibilityState !== "visible" && input.visibilityState !== "hidden") {
    throw new Error("invalid visibilityState");
  }
  if (typeof input.directAttackRequested !== "boolean" || typeof input.autoSaveDue !== "boolean") {
    throw new Error("invalid frame booleans");
  }
  if (input.visibilityState === "hidden" && input.directAttackRequested) {
    throw new Error("hidden direct attack is invalid");
  }
  if (state?.mode === "ready" || state?.mode === "defeatTransition") {
    const clockValues = [state.runtimeClock.lastDirectAttackAtMs, state.runtimeClock.lastVisibleTickAtMs].filter(
      (value): value is number => value !== null,
    );
    if (clockValues.some((value) => input.nowMs < value)) {
      throw new Error("nowMs must be monotonic");
    }
  }
}

export function installGoblinTestApi(
  target: Window,
  storage: Storage,
  getRuntime: () => RuntimeState,
  setRuntime: (state: RuntimeState, options?: { syncAutoSaveScheduler: boolean }) => void,
): TestStorageController {
  const storageController = createTestStorageController(storage);
  target.__goblinTest = {
    ...storageController,
    getRuntimeSnapshot: () => clonePlain(getRuntime()),
    setRuntimeState: (state) => {
      assertRuntimeStateForTest(state);
      setRuntime(clonePlain(state), { syncAutoSaveScheduler: true });
    },
    advanceRuntimeFrame: (input) => {
      const runtimeController = createHarnessRuntimeController(getRuntime());
      const result = runtimeController.advanceRuntimeFrame(input);
      setRuntime(result.state, { syncAutoSaveScheduler: false });
      return result;
    },
  };
  return storageController;
}

function assertGameStateForTest(state: unknown): void {
  assertPlainObject(state, "GameState");
  assertExactKeys(state, ["catapultCooldownRemainingMs", "coins", "defeatedCount", "goblinHp", "mudTrapArmedLevel", "upgrades"], "GameState");
  assertNonNegativeInteger(state.goblinHp, "goblinHp");
  assertNonNegativeInteger(state.mudTrapArmedLevel, "mudTrapArmedLevel");
  assertNonNegativeInteger(state.catapultCooldownRemainingMs, "catapultCooldownRemainingMs");
  assertNonNegativeInteger(state.defeatedCount, "defeatedCount");
  assertNonNegativeInteger(state.coins, "coins");
  assertPlainObject(state.upgrades, "upgrades");
  assertExactKeys(state.upgrades, ["baitBag", "catapult", "club", "mudTrap"], "upgrades");
  for (const level of Object.values(state.upgrades)) {
    assertNonNegativeInteger(level, "upgrade level");
  }
}

function assertPersistenceForTest(value: unknown): void {
  assertPlainObject(value, "persistence");
  assertExactKeys(value, ["kind", "saveWarning"], "persistence");
  if (value.kind === "available") {
    if (value.saveWarning !== "none" && value.saveWarning !== "unsaved") throw new Error("invalid saveWarning");
    return;
  }
  if (value.kind === "unavailable" && value.saveWarning === "storageUnavailable") return;
  throw new Error("invalid persistence");
}

function assertRuntimeClockForTest(value: unknown): void {
  assertPlainObject(value, "runtimeClock");
  assertExactKeys(value, ["lastDirectAttackAtMs", "lastVisibleTickAtMs"], "runtimeClock");
  for (const key of ["lastDirectAttackAtMs", "lastVisibleTickAtMs"] as const) {
    const time = value[key];
    if (time !== null) assertNonNegativeFinite(time, key);
  }
}

function assertPlainObject(value: unknown, label: string): asserts value is Record<string, any> {
  if (typeof value !== "object" || value === null || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error(`${label} must be a plain object`);
  }
}

function assertExactKeys(value: Record<string, unknown>, keys: string[], label: string): void {
  expectNoMissingOrExtraKeys(Object.keys(value), keys, label);
}

function expectNoMissingOrExtraKeys(actual: string[], expected: string[], label: string): void {
  const sortedActual = [...actual].sort();
  const sortedExpected = [...expected].sort();
  if (sortedActual.length !== sortedExpected.length || sortedActual.some((key, index) => key !== sortedExpected[index])) {
    throw new Error(`${label} has invalid keys`);
  }
}

function assertNonNegativeInteger(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
}

function assertNonNegativeFinite(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative finite number`);
  }
}

function clonePlain<T>(value: T): T {
  return structuredClone(value);
}

function throwIfFailed(mode: StorageFailureMode, operation: "read" | "write" | "remove"): void {
  if (mode === "all" || mode === operation) {
    throw new Error(`test storage ${operation} failure`);
  }
}

declare global {
  interface Window {
    __goblinTest?: GoblinTestApi;
  }
}
