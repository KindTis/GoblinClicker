import { describe, expect, it } from "vitest";
import { calculateUpgradeCost } from "../../src/domain/progression";
import {
  simulateActiveBaseline,
  simulateAutoOnlyBaseline,
  simulateHighTierTargetBaseline,
} from "../../src/test/balanceSimulator";

describe("balance simulation", () => {
  it("5분 active baseline은 처치 전환을 포함해 25~40마리와 2종 이상 업그레이드를 경험한다", () => {
    const result = simulateActiveBaseline(5 * 60 * 1000);
    expect(result.defeatedCount).toBeGreaterThanOrEqual(25);
    expect(result.defeatedCount).toBeLessThanOrEqual(40);
    expect(result.uniquePurchasedUpgradeCount).toBeGreaterThanOrEqual(2);
  });

  it("초반 active baseline은 10분 안에 성장과 구매가 발생한다", () => {
    const result = simulateActiveBaseline(10 * 60 * 1000);
    expect(result.defeatedCount).toBeGreaterThanOrEqual(20);
    expect(result.upgrades.club).toBeGreaterThan(0);
    expect(result.totalPurchases).toBeGreaterThanOrEqual(3);
    expect(result.upgrades.battleAxe).toBe(0);
    expect(result.upgrades.reinforcedCatapult).toBe(0);
    expect(result.upgrades.goldenBaitJar).toBe(0);
    expect(result.upgrades.deepMudBog).toBe(0);
    expect(result.upgrades.blacksmithContract).toBe(0);
    expect(result.coins).toBeLessThan(calculateUpgradeCost("battleAxe", 0));
    expect(result.firstHighTierAffordableAtMs).toBeNull();
    expect(result.maxAffordableHighTierCount).toBe(0);
  });

  it("auto-only baseline은 active baseline보다 느리다", () => {
    const active = simulateActiveBaseline(10 * 60 * 1000);
    const autoOnly = simulateAutoOnlyBaseline(10 * 60 * 1000);
    expect(autoOnly.defeatedCount).toBeLessThan(active.defeatedCount);
  });

  it("상위 목표 baseline은 첫 전투 도끼 구매 시점을 기록한다", () => {
    const result = simulateHighTierTargetBaseline(18 * 60 * 1000);
    expect(result.firstBattleAxePurchaseAtMs).not.toBeNull();
    if (result.firstBattleAxePurchaseAtMs === null) throw new Error("expected first battleAxe purchase");
    expect(result.firstBattleAxePurchaseAtMs).toBeGreaterThanOrEqual(12 * 60 * 1000);
    expect(result.firstBattleAxePurchaseAtMs).toBeLessThanOrEqual(18 * 60 * 1000);
  });
});
