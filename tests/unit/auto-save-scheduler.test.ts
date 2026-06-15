import { describe, expect, it } from "vitest";
import { AUTO_SAVE_INTERVAL_MS } from "../../src/domain/constants";
import {
  createAutoSaveSchedulerState,
  isAutoSaveDue,
  recordAutoSaveBaseline,
} from "../../src/app/autoSaveScheduler";

describe("autoSaveScheduler", () => {
  it("기준 시각에서 자동 저장 due를 계산한다", () => {
    const state = createAutoSaveSchedulerState(1000);
    expect(isAutoSaveDue(state, 1000 + AUTO_SAVE_INTERVAL_MS - 1)).toBe(false);
    expect(isAutoSaveDue(state, 1000 + AUTO_SAVE_INTERVAL_MS)).toBe(true);
  });

  it("실제 저장 시도 후 기준 시각을 갱신한다", () => {
    const state = recordAutoSaveBaseline(createAutoSaveSchedulerState(0), 5000);
    expect(state.autoSaveBaselineAtMs).toBe(5000);
    expect(isAutoSaveDue(state, 5000 + AUTO_SAVE_INTERVAL_MS - 1)).toBe(false);
  });
});
