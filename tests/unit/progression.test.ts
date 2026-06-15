import { describe, expect, it } from "vitest";
import {
  calculateBaseKillReward,
  calculateCatapultDamage,
  calculateClickDamage,
  calculateGoblinLevel,
  calculateGoblinMaxHp,
  calculateKillReward,
  calculateMudTrapMultiplier,
  calculateUpgradeCost,
} from "../../src/domain/progression";

describe("progression", () => {
  it("defeatedCount에서 현재 고블린 레벨을 파생한다", () => {
    expect(calculateGoblinLevel(0)).toBe(1);
    expect(calculateGoblinLevel(9)).toBe(10);
  });

  it("스펙의 초기 체력 곡선을 계산한다", () => {
    expect(calculateGoblinMaxHp(1)).toBe(5);
    expect(calculateGoblinMaxHp(2)).toBe(5);
    expect(calculateGoblinMaxHp(3)).toBe(6);
    expect(calculateGoblinMaxHp(5)).toBe(9);
    expect(calculateGoblinMaxHp(10)).toBe(22);
  });

  it("기본 보상과 미끼 주머니 보너스를 합산한다", () => {
    expect(calculateBaseKillReward(1)).toBe(1);
    expect(calculateKillReward(1, 0)).toBe(1);
    expect(calculateKillReward(2, 0)).toBe(2);
    expect(calculateKillReward(10, 3)).toBe(10);
  });

  it("구매 전 레벨 기준 업그레이드 비용을 계산한다", () => {
    expect(calculateUpgradeCost("club", 0)).toBe(3);
    expect(calculateUpgradeCost("catapult", 0)).toBe(12);
    expect(calculateUpgradeCost("baitBag", 0)).toBe(20);
    expect(calculateUpgradeCost("mudTrap", 0)).toBe(90);
  });

  it("피해 공식을 계산한다", () => {
    expect(calculateClickDamage(0)).toBe(1);
    expect(calculateClickDamage(4)).toBe(5);
    expect(calculateMudTrapMultiplier(3)).toBe(7);
    expect(calculateCatapultDamage(5, 2)).toBe(15);
  });
});
