import { describe, expect, it } from "vitest";
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
});
