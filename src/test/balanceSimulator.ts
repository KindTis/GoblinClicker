import { CATAPULT_COOLDOWN_MS, DEFEAT_TRANSITION_MS, DIRECT_ATTACK_MIN_INTERVAL_MS } from "../domain/constants";
import { applyDirectAttack, tickCatapult } from "../domain/combat";
import { UPGRADE_ORDER } from "../domain/constants";
import { purchaseUpgrade } from "../domain/upgrades";
import { createInitialGameState } from "./fixtures";
import type { GameState, UpgradeId } from "../domain/types";

export type BalanceSimulationResult = GameState & {
  totalPurchases: number;
  uniquePurchasedUpgradeCount: number;
};

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
      upgrades: { club: 1, catapult: 1, baitBag: 0, mudTrap: 0 },
      catapultCooldownRemainingMs: CATAPULT_COOLDOWN_MS,
    },
    clickIntervalMs: Number.POSITIVE_INFINITY,
    allowPurchases: false,
    purchaseOrder: [],
  });
}

function simulate(
  durationMs: number,
  options: {
    initialState?: GameState;
    clickIntervalMs: number;
    allowPurchases: boolean;
    purchaseOrder: UpgradeId[];
  },
): BalanceSimulationResult {
  let state = options.initialState ?? createInitialGameState();
  let totalPurchases = 0;
  const purchasedUpgradeIds = new Set<UpgradeId>();
  let nextClickAtMs = 0;
  let transitionUntilMs = 0;

  for (let nowMs = 0; nowMs <= durationMs; nowMs += 100) {
    if (nowMs < transitionUntilMs) {
      continue;
    }

    if (options.allowPurchases) {
      const purchaseCandidates = [...options.purchaseOrder, ...UPGRADE_ORDER];
      for (const upgradeId of purchaseCandidates) {
        const result = purchaseUpgrade(state, upgradeId);
        if (result.ok) {
          state = result.state;
          totalPurchases += 1;
          purchasedUpgradeIds.add(upgradeId);
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

  return { ...state, totalPurchases, uniquePurchasedUpgradeCount: purchasedUpgradeIds.size };
}
