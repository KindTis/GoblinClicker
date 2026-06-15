import { describe, expect, it } from "vitest";
import { CATAPULT_COOLDOWN_MS } from "../../src/domain/constants";
import { toSceneVisualEffects, selectLatestSaveEffect } from "../../src/app/effects";
import type { RuntimeEffect } from "../../src/domain/runtime";
import { createInitialRuntimeState } from "../../src/test/fixtures";

describe("app effects", () => {
  it("RuntimeEffect visual batch는 damage 순서를 유지하고 save/purchase를 제외한다", () => {
    const state = createInitialRuntimeState().game;
    const effects: RuntimeEffect[] = [
      { type: "damageNumber", enemyInstanceId: 1, source: "direct", damage: 2 },
      { type: "purchaseFeedback", feedback: { type: "insufficientCoins", upgradeId: "club", missingCoins: 1 } },
      { type: "damageNumber", enemyInstanceId: 1, source: "catapult", damage: 6 },
      { type: "defeatTransitionStarted", enemyInstanceId: 1 },
      { type: "save", state },
    ];
    expect(toSceneVisualEffects(effects)).toEqual([
      { type: "showDamage", enemyInstanceId: 1, source: "direct", damage: 2 },
      { type: "showDamage", enemyInstanceId: 1, source: "catapult", damage: 6 },
      { type: "showDefeat", enemyInstanceId: 1 },
    ]);
    expect(selectLatestSaveEffect(effects)).toEqual({ type: "save", state });
  });

  it("상수 기반 쿨다운 값을 테스트에서 참조한다", () => {
    expect(CATAPULT_COOLDOWN_MS).toBeGreaterThan(0);
  });
});
