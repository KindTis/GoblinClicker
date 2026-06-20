import { GOBLIN_HP_GROWTH, INITIAL_GOBLIN_HP, UPGRADE_DEFINITIONS } from "./constants";
import type { UpgradeId } from "./types";

export function calculateGoblinLevel(defeatedCount: number): number {
  return defeatedCount + 1;
}

export function calculateGoblinMaxHp(goblinLevel: number): number {
  return Math.floor(INITIAL_GOBLIN_HP * GOBLIN_HP_GROWTH ** (goblinLevel - 1));
}

export function calculateBaseKillReward(goblinLevel: number): number {
  return 1 + Math.floor(goblinLevel * 0.6);
}

export function calculateKillReward(goblinLevel: number, baitBagLevel: number, goldenBaitJarLevel = 0): number {
  const baseReward = calculateBaseKillReward(goblinLevel);
  return baseReward + baitBagLevel + Math.floor(baseReward * 0.4 * goldenBaitJarLevel);
}

export function calculateUpgradeCost(upgradeId: UpgradeId, currentLevel: number): number {
  const definition = UPGRADE_DEFINITIONS[upgradeId];
  return Math.floor(definition.baseCost * definition.growthRate ** currentLevel);
}

export function calculateClickDamage(clubLevel: number, battleAxeLevel = 0): number {
  return 1 + clubLevel + 3 * battleAxeLevel;
}

export function calculateFinalDamage(baseDamage: number, blacksmithContractLevel = 0): number {
  return Math.max(1, Math.floor(baseDamage * (1 + 0.18 * blacksmithContractLevel)));
}

export function calculateMudTrapMultiplier(armedLevel: number): number {
  return 1 + 2 * armedLevel;
}

export function calculateMudTrapArmedLevel(mudTrapLevel: number, deepMudBogLevel = 0): number {
  return mudTrapLevel + 2 * deepMudBogLevel;
}

export function calculateCatapultDamage(
  clickDamage: number,
  catapultLevel: number,
  reinforcedCatapultLevel = 0,
): number {
  return clickDamage * (1 + catapultLevel) + clickDamage * 3 * reinforcedCatapultLevel;
}
