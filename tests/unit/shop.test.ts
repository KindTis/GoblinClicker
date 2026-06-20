import { describe, expect, it } from "vitest";
import { UPGRADE_ORDER } from "../../src/domain/constants";
import { createInitialRuntimeState } from "../../src/test/fixtures";
import { createShopRowViewModels } from "../../src/ui/shop";

describe("shop", () => {
  it("비용 부족 행은 구매 버튼 비활성 상태로 계산한다", () => {
    const rows = createShopRowViewModels(createInitialRuntimeState());
    expect(rows[0]).toMatchObject({
      upgradeId: "club",
      inputState: "insufficientCoins",
      activationBehavior: "ignoreBlocked",
      ariaDisabled: true,
    });
  });

  it("상점 행은 현재 상태 기준 구매 효과 툴팁을 제공한다", () => {
    const ready = createInitialRuntimeState();
    const rows = createShopRowViewModels({
      ...ready,
      game: {
        ...ready.game,
        coins: 900,
        defeatedCount: 4,
        upgrades: {
          ...ready.game.upgrades,
          baitBag: 1,
        },
      },
    });

    expect(rows.find((row) => row.upgradeId === "club")?.tooltipText).toContain("클릭 피해 1 -> 2");
    expect(rows.find((row) => row.upgradeId === "goldenBaitJar")?.tooltipText).toContain(
      "현재 고블린 처치 보상 5 -> 6",
    );
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
