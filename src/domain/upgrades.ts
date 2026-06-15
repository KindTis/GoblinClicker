import { CATAPULT_COOLDOWN_MS, UPGRADE_ORDER } from "./constants";
import { calculateUpgradeCost } from "./progression";
import type { GameState, UpgradeId } from "./types";

export type UpgradePurchaseResult =
  | { ok: true; state: GameState; shouldSave: true }
  | {
      ok: false;
      reason: "insufficientCoins";
      state: GameState;
      shouldSave: false;
      missingCoins: number;
    };

export type PurchasePreview = {
  cost: number;
  canAfford: boolean;
  missingCoins: number;
};

export function getPurchasePreview(state: GameState, upgradeId: UpgradeId): PurchasePreview {
  const cost = calculateUpgradeCost(upgradeId, state.upgrades[upgradeId]);
  return {
    cost,
    canAfford: state.coins >= cost,
    missingCoins: Math.max(0, cost - state.coins),
  };
}

export function purchaseUpgrade(state: GameState, upgradeId: UpgradeId): UpgradePurchaseResult {
  const preview = getPurchasePreview(state, upgradeId);
  if (!preview.canAfford) {
    return {
      ok: false,
      reason: "insufficientCoins",
      state,
      shouldSave: false,
      missingCoins: preview.missingCoins,
    };
  }

  const previousLevel = state.upgrades[upgradeId];
  const nextUpgrades = { ...state.upgrades, [upgradeId]: previousLevel + 1 };
  const firstCatapultPurchase = upgradeId === "catapult" && previousLevel === 0;
  return {
    ok: true,
    shouldSave: true,
    state: {
      ...state,
      coins: state.coins - preview.cost,
      upgrades: nextUpgrades,
      catapultCooldownRemainingMs: firstCatapultPurchase
        ? CATAPULT_COOLDOWN_MS
        : state.catapultCooldownRemainingMs,
    },
  };
}

export function isClubRecommended(state: GameState): boolean {
  return state.upgrades.club === 0;
}

export function countAffordableUpgrades(state: GameState): number {
  return UPGRADE_ORDER.filter((upgradeId) => getPurchasePreview(state, upgradeId).canAfford).length;
}
