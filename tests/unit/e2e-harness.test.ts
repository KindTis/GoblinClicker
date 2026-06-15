import { describe, expect, it } from "vitest";
import { createInitialRuntimeState } from "../../src/test/fixtures";
import {
  assertRuntimeFrameInputForTest,
  assertRuntimeStateForTest,
  createHarnessRuntimeController,
  installGoblinTestApi,
} from "../../src/test/e2eHarness";
import type { RuntimeState } from "../../src/domain/types";

describe("e2eHarness validators", () => {
  it("RuntimeState exact union shape를 검증한다", () => {
    expect(() => assertRuntimeStateForTest(createInitialRuntimeState())).not.toThrow();
    expect(() =>
      assertRuntimeStateForTest({
        ...createInitialRuntimeState(),
        extra: true,
      } as unknown as ReturnType<typeof createInitialRuntimeState>),
    ).toThrow();
  });

  it("hidden direct attack과 추가 RuntimeFrameInput 필드를 거부한다", () => {
    expect(() =>
      assertRuntimeFrameInputForTest({
        nowMs: 0,
        visibilityState: "hidden",
        directAttackRequested: true,
        autoSaveDue: false,
      }),
    ).toThrow();
    expect(() =>
      assertRuntimeFrameInputForTest({
        nowMs: 0,
        visibilityState: "visible",
        directAttackRequested: false,
        autoSaveDue: false,
        extra: true,
      } as never),
    ).toThrow();
  });

  it("snapshot과 주입 상태를 deep clone으로 격리한다", () => {
    const controller = createHarnessRuntimeController(createInitialRuntimeState());
    const snapshot = controller.getRuntimeSnapshot();
    if (snapshot.mode !== "ready") throw new Error("expected ready");
    snapshot.game.coins = 99;
    const nextSnapshot = controller.getRuntimeSnapshot();
    if (nextSnapshot.mode !== "ready") throw new Error("expected ready");
    expect(nextSnapshot.game.coins).toBe(0);
  });

  it("installGoblinTestApi는 setRuntimeState와 advanceRuntimeFrame의 scheduler 동기화 의도를 분리한다", () => {
    const calls: Array<boolean | undefined> = [];
    const storage = window.localStorage;
    let runtime: RuntimeState = createInitialRuntimeState();
    installGoblinTestApi(
      window,
      storage,
      () => runtime,
      (nextRuntime, options) => {
        runtime = nextRuntime;
        calls.push(options?.syncAutoSaveScheduler);
      },
    );
    window.__goblinTest?.setRuntimeState(createInitialRuntimeState());
    window.__goblinTest?.advanceRuntimeFrame({
      nowMs: 0,
      visibilityState: "visible",
      directAttackRequested: false,
      autoSaveDue: false,
    });
    expect(calls).toEqual([true, false]);
    delete window.__goblinTest;
  });
});
