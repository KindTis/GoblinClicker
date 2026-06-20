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
      upgrades: { ...createInitialGameState().upgrades, club: 1, mudTrap: 2 },
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
      upgrades: { ...createInitialGameState().upgrades, club: 1, catapult: 1, mudTrap: 3 },
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
      upgrades: { ...createInitialGameState().upgrades, catapult: 1 },
    };
    const result = tickCatapult(state, 180, "hidden");
    expect(result.fired).toBe(false);
    expect(result.state.catapultCooldownRemainingMs).toBe(100);
  });

  it("날 선 전투 도끼와 대장장이 계약서는 직접 피해에 최종 배율로 적용된다", () => {
    const state = {
      ...createInitialGameState(),
      goblinHp: 100,
      mudTrapArmedLevel: 2,
      upgrades: { ...createInitialGameState().upgrades, club: 1, mudTrap: 2, battleAxe: 2, blacksmithContract: 1 },
    };
    const result = applyDirectAttack(state);
    expect(result.damage).toBe(47);
    expect(result.state.goblinHp).toBe(53);
    expect(result.state.mudTrapArmedLevel).toBe(0);
  });

  it("보강 투석대와 대장장이 계약서는 자동 피해에 최종 배율로 적용된다", () => {
    const state = {
      ...createInitialGameState(),
      goblinHp: 100,
      catapultCooldownRemainingMs: 100,
      upgrades: {
        ...createInitialGameState().upgrades,
        club: 1,
        catapult: 1,
        battleAxe: 1,
        reinforcedCatapult: 2,
        blacksmithContract: 1,
      },
    };
    const result = tickCatapult(state, 180, "visible");
    expect(result.fired).toBe(true);
    expect(result.damage).toBe(47);
    expect(result.state.goblinHp).toBe(53);
  });

  it("황금 미끼 항아리 보상과 깊은 진흙 수렁 준비 레벨을 처치 시 반영한다", () => {
    const state = {
      ...createInitialGameState(),
      defeatedCount: 9,
      goblinHp: 1,
      upgrades: { ...createInitialGameState().upgrades, baitBag: 1, goldenBaitJar: 2, mudTrap: 1, deepMudBog: 2 },
    };
    const result = applyDirectAttack(state);
    expect(result.defeated).toBe(true);
    expect(result.state.coins).toBe(13);
    expect(result.state.mudTrapArmedLevel).toBe(5);
  });
});
