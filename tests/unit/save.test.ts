import { describe, expect, it } from "vitest";
import { CATAPULT_COOLDOWN_MS, SAVE_KEY, SAVE_VERSION } from "../../src/domain/constants";
import {
  createInitialGameState,
  deleteSave,
  loadGame,
  normalizeSaveData,
  saveGame,
  toSaveData,
  type StorageAdapter,
} from "../../src/domain/save";

function memoryStorage(initial: string | null = null): StorageAdapter & { value: string | null } {
  return {
    value: initial,
    read(key) {
      expect(key).toBe(SAVE_KEY);
      return this.value;
    },
    write(key, value) {
      expect(key).toBe(SAVE_KEY);
      this.value = value;
    },
    remove(key) {
      expect(key).toBe(SAVE_KEY);
      this.value = null;
    },
  };
}

describe("save", () => {
  it("첫 실행 저장 키 없음은 시작 상태를 만들고 즉시 저장을 시도한다", () => {
    const storage = memoryStorage();
    const result = loadGame(storage, "boot");
    expect(result.kind).toBe("created");
    if (result.kind !== "created") throw new Error("expected created");
    expect(result.saveResult).toBe("saved");
    expect(storage.value).not.toBeNull();
  });

  it("boot read 실패는 playable storage unavailable 세션으로 변환된다", () => {
    const storage: StorageAdapter = {
      read() {
        throw new Error("blocked");
      },
      write() {
        throw new Error("blocked");
      },
      remove() {
        throw new Error("blocked");
      },
    };
    const result = loadGame(storage, "boot");
    expect(result.kind).toBe("storageUnavailable");
  });

  it("retry read 실패는 readFailed loadError로 남긴다", () => {
    const storage: StorageAdapter = {
      read() {
        throw new Error("blocked");
      },
      write() {},
      remove() {},
    };
    const result = loadGame(storage, "retryFromLoadError");
    expect(result).toEqual({ kind: "loadError", reason: "readFailed" });
  });

  it("파싱 실패와 마이그레이션 실패를 구분한다", () => {
    expect(loadGame(memoryStorage("{"), "boot")).toEqual({
      kind: "loadError",
      reason: "parseFailed",
    });
    expect(loadGame(memoryStorage(JSON.stringify({ saveVersion: 99 })), "boot")).toEqual({
      kind: "loadError",
      reason: "migrationFailed",
    });
  });

  it("저장 데이터를 관대하게 canonical SaveData로 정규화한다", () => {
    const normalized = normalizeSaveData({
      saveVersion: SAVE_VERSION,
      ignored: true,
      state: {
        defeatedCount: 3,
        coins: -10,
        goblinHp: 0,
        mudTrapArmedLevel: 99,
        catapultCooldownRemainingMs: 999999,
        upgrades: {
          club: 2,
          catapult: 1,
          mudTrap: 1,
          extra: 100,
        },
      },
      savedAt: Number.NaN,
    });
    expect(normalized).toEqual({
      saveVersion: SAVE_VERSION,
      state: {
        defeatedCount: 3,
        coins: 0,
        goblinHp: 8,
        mudTrapArmedLevel: 1,
        catapultCooldownRemainingMs: CATAPULT_COOLDOWN_MS,
        upgrades: {
          club: 2,
          catapult: 1,
          baitBag: 0,
          mudTrap: 1,
        },
      },
    });
  });

  it("saveGame은 savedAt을 생성하지 않고 GameState만 저장한다", () => {
    const storage = memoryStorage();
    expect(saveGame(storage, createInitialGameState())).toBe("saved");
    const saved = JSON.parse(storage.value ?? "");
    expect(saved.savedAt).toBeUndefined();
    expect(saved).toEqual(toSaveData(createInitialGameState()));
  });

  it("deleteSave는 삭제 실패를 결과값으로 변환한다", () => {
    const storage: StorageAdapter = {
      read() {
        return null;
      },
      write() {},
      remove() {
        throw new Error("blocked");
      },
    };
    expect(deleteSave(storage)).toBe("failed");
  });
});
