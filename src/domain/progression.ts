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

export function calculateKillReward(goblinLevel: number, baitBagLevel: number): number {
  return calculateBaseKillReward(goblinLevel) + baitBagLevel;
}

export function calculateUpgradeCost(upgradeId: UpgradeId, currentLevel: number): number {
  const definition = UPGRADE_DEFINITIONS[upgradeId];
  return Math.floor(definition.baseCost * definition.growthRate ** currentLevel);
}

export function calculateClickDamage(clubLevel: number): number {
  return 1 + clubLevel;
}

export function calculateMudTrapMultiplier(armedLevel: number): number {
  return 1 + 2 * armedLevel;
}

export function calculateCatapultDamage(clickDamage: number, catapultLevel: number): number {
  return clickDamage * (1 + catapultLevel);
}
