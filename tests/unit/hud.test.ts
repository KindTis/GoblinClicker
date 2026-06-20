// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { calculateCatapultDamage, calculateClickDamage, calculateFinalDamage } from "../../src/domain/progression";
import { selectEnemyRenderState } from "../../src/domain/runtime";
import { createInitialRuntimeState } from "../../src/test/fixtures";
import { renderHud } from "../../src/ui/hud";

const handlers = {
  onPurchase: vi.fn(),
  onOpenResetModal: vi.fn(),
  onToggleShop: vi.fn(),
};

describe("hud", () => {
  it("고티어 피해 공식을 클릭 피해와 투석기 피해 표시값에 반영한다", () => {
    const runtime = {
      ...createInitialRuntimeState(),
      game: {
        ...createInitialRuntimeState().game,
        goblinHp: 100,
        mudTrapArmedLevel: 2,
        catapultCooldownRemainingMs: 1000,
        upgrades: {
          ...createInitialRuntimeState().game.upgrades,
          club: 1,
          catapult: 1,
          battleAxe: 2,
          reinforcedCatapult: 2,
          blacksmithContract: 1,
        },
      },
    };
    const baseClickDamage = calculateClickDamage(1, 2);
    const expectedClickDamage = calculateFinalDamage(baseClickDamage, 1);
    const expectedCatapultDamage = calculateFinalDamage(calculateCatapultDamage(baseClickDamage, 1, 2), 1);
    const root = document.createElement("div");

    renderHud(root, { runtime, enemy: selectEnemyRenderState(runtime), shopOpen: true, purchaseFeedback: null }, handlers);

    expect(root.textContent).toContain(`클릭 피해 ${expectedClickDamage}`);
    expect(root.textContent).toContain(`후 ${expectedCatapultDamage} 피해`);
  });

  it("추천 배지는 기존 첫 몽둥이에만 표시하고 신규 상위 아이템에는 붙이지 않는다", () => {
    const root = document.createElement("div");
    const runtime = { ...createInitialRuntimeState(), game: { ...createInitialRuntimeState().game, coins: 1000 } };

    renderHud(root, { runtime, enemy: selectEnemyRenderState(runtime), shopOpen: true, purchaseFeedback: null }, handlers);

    expect(root.querySelectorAll(".recommend")).toHaveLength(1);
    expect(root.querySelector(".recommend")?.parentElement?.textContent).toContain("낡은 몽둥이");
  });
});
