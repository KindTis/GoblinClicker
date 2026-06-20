import { describe, expect, it } from "vitest";
import {
  AUTO_SAVE_INTERVAL_MS,
  CATAPULT_COOLDOWN_MS,
  DAMAGE_NUMBER_LIFETIME_MS,
  DEFEAT_TRANSITION_MS,
  DIRECT_ATTACK_MIN_INTERVAL_MS,
  GOBLIN_HP_GROWTH,
  HP_GHOST_BAR_DELAY_MS,
  INITIAL_GOBLIN_HP,
  SAVE_KEY,
  SAVE_VERSION,
  UPGRADE_DEFINITIONS,
  UPGRADE_ORDER,
} from "../../src/domain/constants";

describe("constants", () => {
  it("MVP 시간과 저장 상수 값을 한 곳에서 제공한다", () => {
    expect(SAVE_KEY).toBe("goblin-clicker.save");
    expect(SAVE_VERSION).toBe(1);
    expect(INITIAL_GOBLIN_HP).toBe(5);
    expect(GOBLIN_HP_GROWTH).toBe(1.18);
    expect(DIRECT_ATTACK_MIN_INTERVAL_MS).toBe(80);
    expect(CATAPULT_COOLDOWN_MS).toBe(5000);
    expect(AUTO_SAVE_INTERVAL_MS).toBe(10000);
    expect(DEFEAT_TRANSITION_MS).toBe(300);
    expect(DAMAGE_NUMBER_LIFETIME_MS).toBe(600);
    expect(HP_GHOST_BAR_DELAY_MS).toBe(250);
  });

  it("상점 표시 순서를 고정한다", () => {
    expect(UPGRADE_ORDER).toEqual([
      "club",
      "catapult",
      "baitBag",
      "mudTrap",
      "battleAxe",
      "reinforcedCatapult",
      "goldenBaitJar",
      "deepMudBog",
      "blacksmithContract",
    ]);
  });

  it("고티어 업그레이드 비용과 성장률을 스펙 값으로 제공한다", () => {
    expect(UPGRADE_DEFINITIONS.battleAxe).toMatchObject({ name: "날 선 전투 도끼", baseCost: 180, growthRate: 1.9 });
    expect(UPGRADE_DEFINITIONS.reinforcedCatapult).toMatchObject({ name: "보강 투석대", baseCost: 420, growthRate: 1.95 });
    expect(UPGRADE_DEFINITIONS.goldenBaitJar).toMatchObject({ name: "황금 미끼 항아리", baseCost: 900, growthRate: 2 });
    expect(UPGRADE_DEFINITIONS.deepMudBog).toMatchObject({ name: "깊은 진흙 수렁", baseCost: 1800, growthRate: 2.08 });
    expect(UPGRADE_DEFINITIONS.blacksmithContract).toMatchObject({ name: "대장장이 계약서", baseCost: 4200, growthRate: 2.2 });
  });
});
