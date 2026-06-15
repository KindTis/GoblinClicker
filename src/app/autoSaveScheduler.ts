import { AUTO_SAVE_INTERVAL_MS } from "../domain/constants";

export type AutoSaveSchedulerState = {
  autoSaveBaselineAtMs: number;
};

export function createAutoSaveSchedulerState(nowMs: number): AutoSaveSchedulerState {
  return { autoSaveBaselineAtMs: nowMs };
}

export function isAutoSaveDue(state: AutoSaveSchedulerState, nowMs: number): boolean {
  return nowMs - state.autoSaveBaselineAtMs >= AUTO_SAVE_INTERVAL_MS;
}

export function recordAutoSaveBaseline(
  _state: AutoSaveSchedulerState,
  nowMs: number,
): AutoSaveSchedulerState {
  return { autoSaveBaselineAtMs: nowMs };
}
