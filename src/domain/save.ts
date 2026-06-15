import { CATAPULT_COOLDOWN_MS, SAVE_KEY, SAVE_VERSION, UPGRADE_ORDER } from "./constants";
import { calculateGoblinLevel, calculateGoblinMaxHp } from "./progression";
import type { LoadFailureReason } from "./saveTypes";
import type { GameState, SaveData, UpgradeId } from "./types";

export type StorageAdapter = {
  read(key: string): string | null;
  write(key: string, value: string): void;
  remove(key: string): void;
};

export type LoadContext = "boot" | "retryFromLoadError";

export type LoadResult =
  | { kind: "loaded"; save: SaveData }
  | { kind: "created"; save: SaveData; saveResult: "saved" | "failed" }
  | { kind: "storageUnavailable" }
  | { kind: "loadError"; reason: LoadFailureReason };

export function createInitialGameState(): GameState {
  return {
    goblinHp: 5,
    mudTrapArmedLevel: 0,
    catapultCooldownRemainingMs: 0,
    defeatedCount: 0,
    coins: 0,
    upgrades: {
      club: 0,
      catapult: 0,
      baitBag: 0,
      mudTrap: 0,
    },
  };
}

export function toSaveData(state: GameState, savedAt?: number): SaveData {
  return savedAt === undefined ? { saveVersion: SAVE_VERSION, state } : { saveVersion: SAVE_VERSION, state, savedAt };
}

export function normalizeSaveData(raw: unknown): SaveData | { error: "migrationFailed" } {
  if (!isPlainObject(raw) || raw.saveVersion !== SAVE_VERSION || !isPlainObject(raw.state)) {
    return { error: "migrationFailed" };
  }

  const rawState = raw.state;
  const defeatedCount = safeNonNegativeInteger(rawState.defeatedCount) ? rawState.defeatedCount : 0;
  const coins = safeNonNegativeInteger(rawState.coins) ? rawState.coins : 0;
  const rawUpgrades = isPlainObject(rawState.upgrades) ? rawState.upgrades : {};
  const upgrades = UPGRADE_ORDER.reduce(
    (accumulator, upgradeId) => {
      const value = rawUpgrades[upgradeId];
      accumulator[upgradeId] = safeNonNegativeInteger(value) ? value : 0;
      return accumulator;
    },
    {} as Record<UpgradeId, number>,
  );

  const maxHp = calculateGoblinMaxHp(calculateGoblinLevel(defeatedCount));
  const goblinHp =
    safeNonNegativeInteger(rawState.goblinHp) && rawState.goblinHp > 0
      ? Math.min(rawState.goblinHp, maxHp)
      : maxHp;
  const catapultCooldownRemainingMs =
    upgrades.catapult === 0
      ? 0
      : safeNonNegativeInteger(rawState.catapultCooldownRemainingMs)
        ? Math.min(rawState.catapultCooldownRemainingMs, CATAPULT_COOLDOWN_MS)
        : CATAPULT_COOLDOWN_MS;
  const mudTrapArmedLevel =
    upgrades.mudTrap === 0
      ? 0
      : safeNonNegativeInteger(rawState.mudTrapArmedLevel)
        ? Math.min(rawState.mudTrapArmedLevel, upgrades.mudTrap)
        : 0;

  const save: SaveData = {
    saveVersion: SAVE_VERSION,
    state: {
      defeatedCount,
      coins,
      goblinHp,
      mudTrapArmedLevel,
      catapultCooldownRemainingMs,
      upgrades,
    },
  };

  if (typeof raw.savedAt === "number" && Number.isFinite(raw.savedAt)) {
    save.savedAt = raw.savedAt;
  }

  return save;
}

export function loadGame(storage: StorageAdapter, context: LoadContext): LoadResult {
  let raw: string | null;
  try {
    raw = storage.read(SAVE_KEY);
  } catch {
    return context === "boot" ? { kind: "storageUnavailable" } : { kind: "loadError", reason: "readFailed" };
  }

  if (raw === null) {
    const save = toSaveData(createInitialGameState());
    return { kind: "created", save, saveResult: writeSave(storage, save) };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: "loadError", reason: "parseFailed" };
  }

  const normalized = normalizeSaveData(parsed);
  if ("error" in normalized) {
    return { kind: "loadError", reason: normalized.error };
  }

  return { kind: "loaded", save: normalized };
}

export function saveGame(storage: StorageAdapter, state: GameState): "saved" | "failed" {
  return writeSave(storage, toSaveData(state));
}

export function deleteSave(storage: StorageAdapter): "deleted" | "failed" {
  try {
    storage.remove(SAVE_KEY);
    return "deleted";
  } catch {
    return "failed";
  }
}

function writeSave(storage: StorageAdapter, save: SaveData): "saved" | "failed" {
  try {
    storage.write(SAVE_KEY, JSON.stringify(save));
    return "saved";
  } catch {
    return "failed";
  }
}

function safeNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;
}
