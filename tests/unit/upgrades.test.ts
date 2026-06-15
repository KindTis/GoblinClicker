import { describe, expect, it } from "vitest";
import { CATAPULT_COOLDOWN_MS } from "../../src/domain/constants";
import { createInitialGameState } from "../../src/test/fixtures";
import {
  countAffordableUpgrades,
  getPurchasePreview,
  isClubRecommended,
  purchaseUpgrade,
} from "../../src/domain/upgrades";

describe("upgrades", () => {
  it("낡은 몽둥이 첫 구매는 재화 3을 차감하고 레벨을 올린다", () => {
    const state = { ...createInitialGameState(), coins: 3 };
    const result = purchaseUpgrade(state, "club");
    expect(result.ok).toBe(true);
    expect(result.state.coins).toBe(0);
    expect(result.state.upgrades.club).toBe(1);
    expect(result.shouldSave).toBe(true);
  });

  it("비용 부족 구매는 상태와 저장 사유를 만들지 않는다", () => {
    const state = createInitialGameState();
    const result = purchaseUpgrade(state, "catapult");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected insufficient coins");
    expect(result.reason).toBe("insufficientCoins");
    expect(result.missingCoins).toBe(12);
    expect(result.state).toEqual(state);
    expect(result.shouldSave).toBe(false);
  });

  it("투석기 첫 구매는 상수 쿨다운으로 시작한다", () => {
    const state = { ...createInitialGameState(), coins: 12 };
    const result = purchaseUpgrade(state, "catapult");
    expect(result.ok).toBe(true);
    expect(result.state.catapultCooldownRemainingMs).toBe(CATAPULT_COOLDOWN_MS);
  });

  it("투석기 추가 구매는 기존 쿨다운을 리셋하지 않는다", () => {
    const state = {
      ...createInitialGameState(),
      coins: 18,
      catapultCooldownRemainingMs: 2400,
      upgrades: { club: 0, catapult: 1, baitBag: 0, mudTrap: 0 },
    };
    const result = purchaseUpgrade(state, "catapult");
    expect(result.ok).toBe(true);
    expect(result.state.catapultCooldownRemainingMs).toBe(2400);
  });

  it("낡은 몽둥이 추천은 저장 상태가 아니라 레벨에서 파생된다", () => {
    expect(isClubRecommended(createInitialGameState())).toBe(true);
    const state = {
      ...createInitialGameState(),
      upgrades: { club: 1, catapult: 0, baitBag: 0, mudTrap: 0 },
    };
    expect(isClubRecommended(state)).toBe(false);
  });

  it("구매 가능 개수는 실제 비용 감당 가능성만 센다", () => {
    const state = { ...createInitialGameState(), coins: 2 };
    expect(isClubRecommended(state)).toBe(true);
    expect(countAffordableUpgrades(state)).toBe(0);
    expect(getPurchasePreview(state, "club").missingCoins).toBe(1);
  });
});
