import { describe, expect, it } from "vitest";
import { AUTO_SAVE_INTERVAL_MS, CATAPULT_COOLDOWN_MS, DEFEAT_TRANSITION_MS } from "../../src/domain/constants";
import {
  applySaveEffectResult,
  processFrame,
  processPurchase,
  selectEnemyRenderState,
  type RuntimeState,
} from "../../src/domain/runtime";
import { createInitialRuntimeState } from "../../src/test/fixtures";

describe("runtime", () => {
  it("직접 공격, 투석기, 자동 저장 due를 한 프레임에 병합해 save effect를 최대 1개 만든다", () => {
    const state: RuntimeState = {
      ...createInitialRuntimeState(),
      game: {
        ...createInitialRuntimeState().game,
        goblinHp: 10,
        catapultCooldownRemainingMs: 1,
        upgrades: { ...createInitialRuntimeState().game.upgrades, catapult: 1 },
      },
      runtimeClock: { lastDirectAttackAtMs: null, lastVisibleTickAtMs: 0 },
    };
    const result = processFrame(state, {
      nowMs: CATAPULT_COOLDOWN_MS,
      visibilityState: "visible",
      directAttackRequested: true,
      autoSaveDue: true,
    });
    expect(result.effects.filter((effect) => effect.type === "save")).toHaveLength(1);
    expect(result.effects.filter((effect) => effect.type === "damageNumber")).toHaveLength(2);
  });

  it("처치 전환 중 입력과 자동 저장 due를 처리하지 않고 전환 종료만 판정한다", () => {
    const initial = createInitialRuntimeState();
    const killed = processFrame(
      { ...initial, game: { ...initial.game, goblinHp: 1 } },
      { nowMs: 100, visibilityState: "visible", directAttackRequested: true, autoSaveDue: false },
    ).state;
    expect(killed.mode).toBe("defeatTransition");
    const during = processFrame(killed, {
      nowMs: 100 + DEFEAT_TRANSITION_MS - 1,
      visibilityState: "visible",
      directAttackRequested: true,
      autoSaveDue: true,
    });
    expect(during.state.mode).toBe("defeatTransition");
    expect(during.effects).toEqual([]);
    const after = processFrame(during.state, {
      nowMs: 100 + DEFEAT_TRANSITION_MS,
      visibilityState: "visible",
      directAttackRequested: false,
      autoSaveDue: true,
    });
    expect(after.state.mode).toBe("ready");
    expect(after.effects).toEqual([]);
  });

  it("EnemyRenderState는 처치 전환 중 처치된 고블린 snapshot을 사용한다", () => {
    const initial = createInitialRuntimeState();
    const killed = processFrame(
      { ...initial, game: { ...initial.game, goblinHp: 1 } },
      { nowMs: 100, visibilityState: "visible", directAttackRequested: true, autoSaveDue: false },
    ).state;
    expect(killed.mode).toBe("defeatTransition");
    if (killed.mode !== "defeatTransition") throw new Error("expected defeatTransition");
    const render = selectEnemyRenderState(killed);
    expect(render).toMatchObject({
      enemyInstanceId: 0,
      goblinLevel: 1,
      hp: 0,
      visualState: "defeated",
    });
  });

  it("processPurchase는 ready 성공, 비용 부족, 전환 차단을 분리한다", () => {
    const ready = { ...createInitialRuntimeState(), game: { ...createInitialRuntimeState().game, coins: 3 } };
    const success = processPurchase(ready, "club");
    expect(success.effects).toEqual([
      { type: "purchaseFeedback", feedback: { type: "success", upgradeId: "club", previousLevel: 0, nextLevel: 1 } },
      { type: "save", state: success.state.mode === "ready" ? success.state.game : ready.game },
    ]);

    const insufficient = processPurchase(createInitialRuntimeState(), "club");
    expect(insufficient.effects).toEqual([
      { type: "purchaseFeedback", feedback: { type: "insufficientCoins", upgradeId: "club", missingCoins: 3 } },
    ]);

    const transition = processFrame(
      { ...createInitialRuntimeState(), game: { ...createInitialRuntimeState().game, goblinHp: 1 } },
      { nowMs: 0, visibilityState: "visible", directAttackRequested: true, autoSaveDue: false },
    ).state;
    const blocked = processPurchase(transition, "club");
    expect(blocked.effects).toEqual([
      { type: "purchaseFeedback", feedback: { type: "blockedByDefeatTransition", upgradeId: "club" } },
    ]);
  });

  it("save effect 결과만 persistence warning을 바꾼다", () => {
    const state = createInitialRuntimeState();
    expect(applySaveEffectResult(state, "failed").persistence.saveWarning).toBe("unsaved");
    expect(applySaveEffectResult(state, "saved").persistence.saveWarning).toBe("none");
    const unavailable = {
      ...state,
      persistence: { kind: "unavailable" as const, saveWarning: "storageUnavailable" as const },
    };
    expect(applySaveEffectResult(unavailable, "skippedStorageUnavailable").persistence.saveWarning).toBe(
      "storageUnavailable",
    );
  });

  it("ready 상태 자동 저장 due만 save effect를 만든다", () => {
    const result = processFrame(createInitialRuntimeState(), {
      nowMs: AUTO_SAVE_INTERVAL_MS,
      visibilityState: "visible",
      directAttackRequested: false,
      autoSaveDue: true,
    });
    expect(result.effects).toEqual([{ type: "save", state: result.state.mode === "ready" ? result.state.game : null }]);
  });
});
