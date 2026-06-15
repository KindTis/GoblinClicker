import { describe, expect, it } from "vitest";
import { CATAPULT_COOLDOWN_MS } from "../../src/domain/constants";
import { applyDirectAttack, tickCatapult } from "../../src/domain/combat";
import { createInitialGameState } from "../../src/test/fixtures";

describe("combat", () => {
  it("첫 고블린은 5회의 기본 직접 공격으로 처치된다", () => {
    let state = createInitialGameState();
    for (let i = 0; i < 4; i += 1) {
      const result = applyDirectAttack(state);
      expect(result.defeated).toBe(false);
      state = result.state;
    }
    const result = applyDirectAttack(state);
    expect(result.defeated).toBe(true);
    expect(result.state.defeatedCount).toBe(1);
    expect(result.state.coins).toBe(1);
    expect(result.state.goblinHp).toBe(5);
  });

  it("진흙 함정은 직접 공격 한 번에만 적용되고 소모된다", () => {
    const state = {
      ...createInitialGameState(),
      goblinHp: 20,
      mudTrapArmedLevel: 2,
      upgrades: { club: 1, catapult: 0, baitBag: 0, mudTrap: 2 },
    };
    const result = applyDirectAttack(state);
    expect(result.damage).toBe(10);
    expect(result.state.goblinHp).toBe(10);
    expect(result.state.mudTrapArmedLevel).toBe(0);
  });

  it("투석기는 visible delta로 한 번만 발사하고 진흙 함정을 소모하지 않는다", () => {
    const state = {
      ...createInitialGameState(),
      goblinHp: 20,
      catapultCooldownRemainingMs: 100,
      mudTrapArmedLevel: 3,
      upgrades: { club: 1, catapult: 1, baitBag: 0, mudTrap: 3 },
    };
    const result = tickCatapult(state, 180, "visible");
    expect(result.fired).toBe(true);
    expect(result.damage).toBe(4);
    expect(result.state.goblinHp).toBe(16);
    expect(result.state.catapultCooldownRemainingMs).toBe(CATAPULT_COOLDOWN_MS);
    expect(result.state.mudTrapArmedLevel).toBe(3);
  });

  it("hidden 상태에서는 투석기 쿨다운을 차감하지 않는다", () => {
    const state = {
      ...createInitialGameState(),
      catapultCooldownRemainingMs: 100,
      upgrades: { club: 0, catapult: 1, baitBag: 0, mudTrap: 0 },
    };
    const result = tickCatapult(state, 180, "hidden");
    expect(result.fired).toBe(false);
    expect(result.state.catapultCooldownRemainingMs).toBe(100);
  });
});
