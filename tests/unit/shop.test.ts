import { describe, expect, it } from "vitest";
import { UPGRADE_ORDER } from "../../src/domain/constants";
import { createInitialRuntimeState } from "../../src/test/fixtures";
import { createShopRowViewModels } from "../../src/ui/shop";

describe("shop", () => {
  it("비용 부족 행은 포커스 가능 구매 실패 피드백 동작을 유지한다", () => {
    const rows = createShopRowViewModels(createInitialRuntimeState());
    expect(rows[0]).toMatchObject({
      upgradeId: "club",
      inputState: "insufficientCoins",
      activationBehavior: "showInsufficientFeedback",
      ariaDisabled: false,
    });
  });

  it("처치 전환 중에는 비용 상태보다 전환 차단이 우선한다", () => {
    const ready = createInitialRuntimeState();
    const rows = createShopRowViewModels({
      ...ready,
      mode: "defeatTransition",
      defeatedSnapshot: { enemyInstanceId: 0, hp: 0, startedAtMs: 0 },
    });
    expect(rows.every((row) => row.inputState === "blockedByDefeatTransition")).toBe(true);
    expect(rows.every((row) => row.activationBehavior === "ignoreBlocked")).toBe(true);
  });

  it("신규 고티어 아이템 5개를 기존 상점 순서 뒤에 노출한다", () => {
    const rows = createShopRowViewModels(createInitialRuntimeState());
    expect(rows.map((row) => row.upgradeId)).toEqual(UPGRADE_ORDER);
    expect(rows.slice(4).map((row) => row.upgradeId)).toEqual([
      "battleAxe",
      "reinforcedCatapult",
      "goldenBaitJar",
      "deepMudBog",
      "blacksmithContract",
    ]);
  });

  it("보강 투석대는 투석기 0레벨에서도 구매 가능 상태를 비용으로만 판단한다", () => {
    const ready = createInitialRuntimeState();
    const rows = createShopRowViewModels({
      ...ready,
      game: { ...ready.game, coins: 420 },
    });
    expect(rows.find((row) => row.upgradeId === "reinforcedCatapult")).toMatchObject({
      inputState: "buyable",
      activationBehavior: "purchase",
      ariaDisabled: false,
    });
  });
});
