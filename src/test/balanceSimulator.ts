import { CATAPULT_COOLDOWN_MS, DEFEAT_TRANSITION_MS, DIRECT_ATTACK_MIN_INTERVAL_MS, UPGRADE_ORDER } from "../domain/constants";
import { applyDirectAttack, tickCatapult } from "../domain/combat";
import { calculateUpgradeCost } from "../domain/progression";
import { purchaseUpgrade } from "../domain/upgrades";
import { createInitialGameState } from "./fixtures";
import type { GameState, UpgradeId } from "../domain/types";

export type BalanceSimulationResult = GameState & {
  totalPurchases: number;
  uniquePurchasedUpgradeCount: number;
  firstBattleAxePurchaseAtMs: number | null;
  firstHighTierAffordableAtMs: number | null;
  maxAffordableHighTierCount: number;
};

const HIGH_TIER_UPGRADE_IDS: UpgradeId[] = [
  "battleAxe",
  "reinforcedCatapult",
  "goldenBaitJar",
  "deepMudBog",
  "blacksmithContract",
];

export function simulateActiveBaseline(durationMs: number): BalanceSimulationResult {
  return simulate(durationMs, {
    clickIntervalMs: Math.max(DIRECT_ATTACK_MIN_INTERVAL_MS, 400),
    allowPurchases: true,
    purchaseOrder: ["club", "club", "catapult", "club", "baitBag", "club", "mudTrap"],
  });
}

export function simulateAutoOnlyBaseline(durationMs: number): BalanceSimulationResult {
  const seeded = createInitialGameState();
  return simulate(durationMs, {
    initialState: {
      ...seeded,
      coins: 0,
      upgrades: { ...seeded.upgrades, club: 1, catapult: 1 },
      catapultCooldownRemainingMs: CATAPULT_COOLDOWN_MS,
    },
    clickIntervalMs: Number.POSITIVE_INFINITY,
    allowPurchases: false,
    purchaseOrder: [],
  });
}

export function simulateHighTierTargetBaseline(durationMs: number): BalanceSimulationResult {
  return simulate(durationMs, {
    clickIntervalMs: Math.max(DIRECT_ATTACK_MIN_INTERVAL_MS, 400),
    allowPurchases: true,
    purchaseOrder: ["club", "club", "catapult", "club", "baitBag", "club", "mudTrap"],
    targetUpgradeAfterMs: { upgradeId: "battleAxe", afterMs: 5 * 60 * 1000 },
  });
}

function simulate(
  durationMs: number,
  options: {
    initialState?: GameState;
    clickIntervalMs: number;
    allowPurchases: boolean;
    purchaseOrder: UpgradeId[];
    targetUpgradeAfterMs?: { upgradeId: UpgradeId; afterMs: number };
  },
): BalanceSimulationResult {
  let state = options.initialState ?? createInitialGameState();
  let totalPurchases = 0;
  const purchasedUpgradeIds = new Set<UpgradeId>();
  let nextClickAtMs = 0;
  let transitionUntilMs = 0;
  let firstBattleAxePurchaseAtMs: number | null = null;
  let firstHighTierAffordableAtMs: number | null = null;
  let maxAffordableHighTierCount = 0;

  for (let nowMs = 0; nowMs <= durationMs; nowMs += 100) {
    if (nowMs < transitionUntilMs) {
      continue;
    }

    const affordableHighTierCount = countAffordableHighTierUpgrades(state);
    if (affordableHighTierCount > 0 && firstHighTierAffordableAtMs === null) {
      firstHighTierAffordableAtMs = nowMs;
    }
    maxAffordableHighTierCount = Math.max(maxAffordableHighTierCount, affordableHighTierCount);

    if (options.allowPurchases) {
      const purchaseCandidates =
        options.targetUpgradeAfterMs !== undefined && nowMs >= options.targetUpgradeAfterMs.afterMs
          ? [options.targetUpgradeAfterMs.upgradeId]
          : [...options.purchaseOrder, ...UPGRADE_ORDER];
      for (const upgradeId of purchaseCandidates) {
        const result = purchaseUpgrade(state, upgradeId);
        if (result.ok) {
          state = result.state;
          totalPurchases += 1;
          purchasedUpgradeIds.add(upgradeId);
          if (upgradeId === "battleAxe" && firstBattleAxePurchaseAtMs === null) {
            firstBattleAxePurchaseAtMs = nowMs;
          }
          break;
        }
      }
    }

    if (nowMs >= nextClickAtMs) {
      const result = applyDirectAttack(state);
      state = result.state;
      if (result.defeated) {
        transitionUntilMs = nowMs + DEFEAT_TRANSITION_MS;
      }
      nextClickAtMs = nowMs + options.clickIntervalMs;
    }

    const catapult = tickCatapult(state, 100, "visible");
    state = catapult.state;
    if (catapult.defeated) {
      transitionUntilMs = nowMs + DEFEAT_TRANSITION_MS;
    }
  }

  return {
    ...state,
    totalPurchases,
    uniquePurchasedUpgradeCount: purchasedUpgradeIds.size,
    firstBattleAxePurchaseAtMs,
    firstHighTierAffordableAtMs,
    maxAffordableHighTierCount,
  };
}

function countAffordableHighTierUpgrades(state: GameState): number {
  return HIGH_TIER_UPGRADE_IDS.filter((upgradeId) => {
    const cost = calculateUpgradeCost(upgradeId, state.upgrades[upgradeId]);
    return state.coins >= cost;
  }).length;
}
