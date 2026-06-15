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
    expect(UPGRADE_ORDER).toEqual(["club", "catapult", "baitBag", "mudTrap"]);
  });
});
