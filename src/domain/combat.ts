import { CATAPULT_COOLDOWN_MS } from "./constants";
import {
  calculateCatapultDamage,
  calculateClickDamage,
  calculateFinalDamage,
  calculateGoblinLevel,
  calculateGoblinMaxHp,
  calculateKillReward,
  calculateMudTrapArmedLevel,
  calculateMudTrapMultiplier,
} from "./progression";
import type { GameState } from "./types";

export type AttackSource = "direct" | "catapult";

export type AttackResult = {
  state: GameState;
  source: AttackSource;
  damage: number;
  defeated: boolean;
};

export type CatapultTickResult =
  | { state: GameState; fired: false; damage: 0; defeated: false }
  | { state: GameState; fired: true; damage: number; defeated: boolean };

export function applyDirectAttack(state: GameState): AttackResult {
  const clickDamage = calculateClickDamage(state.upgrades.club, state.upgrades.battleAxe);
  const multiplier = state.mudTrapArmedLevel > 0 ? calculateMudTrapMultiplier(state.mudTrapArmedLevel) : 1;
  const damage = calculateFinalDamage(clickDamage * multiplier, state.upgrades.blacksmithContract);
  const stateAfterHit: GameState = {
    ...state,
    goblinHp: Math.max(0, state.goblinHp - damage),
    mudTrapArmedLevel: state.mudTrapArmedLevel > 0 ? 0 : state.mudTrapArmedLevel,
  };
  if (stateAfterHit.goblinHp === 0) {
    return { state: defeatCurrentGoblin(stateAfterHit), source: "direct", damage, defeated: true };
  }
  return { state: stateAfterHit, source: "direct", damage, defeated: false };
}

export function tickCatapult(
  state: GameState,
  deltaMs: number,
  visibilityState: DocumentVisibilityState,
): CatapultTickResult {
  if (state.upgrades.catapult === 0 || visibilityState !== "visible") {
    return { state, fired: false, damage: 0, defeated: false };
  }

  const nextRemaining = state.catapultCooldownRemainingMs - deltaMs;
  if (nextRemaining > 0) {
    return {
      state: { ...state, catapultCooldownRemainingMs: nextRemaining },
      fired: false,
      damage: 0,
      defeated: false,
    };
  }

  const clickDamage = calculateClickDamage(state.upgrades.club, state.upgrades.battleAxe);
  const damage = calculateFinalDamage(
    calculateCatapultDamage(clickDamage, state.upgrades.catapult, state.upgrades.reinforcedCatapult),
    state.upgrades.blacksmithContract,
  );
  const stateAfterHit: GameState = {
    ...state,
    goblinHp: Math.max(0, state.goblinHp - damage),
    catapultCooldownRemainingMs: CATAPULT_COOLDOWN_MS,
  };

  if (stateAfterHit.goblinHp === 0) {
    return { state: defeatCurrentGoblin(stateAfterHit), fired: true, damage, defeated: true };
  }

  return { state: stateAfterHit, fired: true, damage, defeated: false };
}

export function defeatCurrentGoblin(state: GameState): GameState {
  const defeatedGoblinLevel = calculateGoblinLevel(state.defeatedCount);
  const nextDefeatedCount = state.defeatedCount + 1;
  const nextGoblinLevel = calculateGoblinLevel(nextDefeatedCount);
  const nextMaxHp = calculateGoblinMaxHp(nextGoblinLevel);
  return {
    ...state,
    defeatedCount: nextDefeatedCount,
    coins: state.coins + calculateKillReward(defeatedGoblinLevel, state.upgrades.baitBag, state.upgrades.goldenBaitJar),
    goblinHp: nextMaxHp,
    mudTrapArmedLevel: calculateMudTrapArmedLevel(state.upgrades.mudTrap, state.upgrades.deepMudBog),
    catapultCooldownRemainingMs: state.upgrades.catapult > 0 ? CATAPULT_COOLDOWN_MS : 0,
  };
}
