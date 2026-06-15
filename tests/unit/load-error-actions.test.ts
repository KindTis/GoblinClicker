import { describe, expect, it } from "vitest";
import { SAVE_KEY } from "../../src/domain/constants";
import { type StorageAdapter } from "../../src/domain/save";
import {
  cancelLoadError,
  retryLoadFromLoadError,
  startNewGameFromLoadError,
} from "../../src/app/loadErrorActions";
import { createLoadErrorState } from "../../src/app/loadErrorState";

describe("loadErrorActions", () => {
  it("새 게임 시작은 delete 실패 시 deleteFailed loadError를 유지한다", () => {
    const storage: StorageAdapter = {
      read() {
        return null;
      },
      write() {},
      remove(key) {
        expect(key).toBe(SAVE_KEY);
        throw new Error("blocked");
      },
    };
    const result = startNewGameFromLoadError(createLoadErrorState("parseFailed"), storage);
    expect(result.kind).toBe("stillLoadError");
    expect(result.state).toEqual(createLoadErrorState("deleteFailed"));
  });

  it("다시 시도는 저장 키 없음에서 createdInitialGame으로 복구한다", () => {
    let value: string | null = null;
    const storage: StorageAdapter = {
      read() {
        return value;
      },
      write(_key, next) {
        value = next;
      },
      remove() {
        value = null;
      },
    };
    const result = retryLoadFromLoadError(createLoadErrorState("parseFailed"), storage);
    expect(result.kind).toBe("createdInitialGame");
    expect(result.state.mode).toBe("ready");
  });

  it("취소는 기존 loadError 상태를 유지한다", () => {
    const state = createLoadErrorState("migrationFailed");
    expect(cancelLoadError(state)).toEqual({ kind: "stillLoadError", state });
  });
});
