import { describe, expect, it } from "vitest";
import { simulateActiveBaseline, simulateAutoOnlyBaseline } from "../../src/test/balanceSimulator";

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
  });

  it("auto-only baseline은 active baseline보다 느리다", () => {
    const active = simulateActiveBaseline(10 * 60 * 1000);
    const autoOnly = simulateAutoOnlyBaseline(10 * 60 * 1000);
    expect(autoOnly.defeatedCount).toBeLessThan(active.defeatedCount);
  });
});
