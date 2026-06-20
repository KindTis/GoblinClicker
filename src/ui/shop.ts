import { UPGRADE_DEFINITIONS, UPGRADE_ORDER } from "../domain/constants";
import {
  calculateCatapultDamage,
  calculateClickDamage,
  calculateFinalDamage,
  calculateGoblinLevel,
  calculateKillReward,
  calculateMudTrapArmedLevel,
  calculateMudTrapMultiplier,
} from "../domain/progression";
import { getPurchasePreview } from "../domain/upgrades";
import type { GameState, RuntimeState, UpgradeId } from "../domain/types";
import { UPGRADE_PRESENTATION } from "./upgradePresentation";

export type ShopInputState = "buyable" | "insufficientCoins" | "blockedByDefeatTransition";

export type ShopActivationBehavior = "purchase" | "ignoreBlocked";

export type ShopRowViewModel = {
  upgradeId: UpgradeId;
  iconAssetKey: (typeof UPGRADE_PRESENTATION)[UpgradeId]["iconAssetKey"];
  inputState: ShopInputState;
  activationBehavior: ShopActivationBehavior;
  statusText: string;
  tooltipText: string;
  buttonText: string;
  ariaDisabled: boolean;
  describedById: string;
  tooltipId: string;
};

export function createShopRowViewModels(state: RuntimeState): ShopRowViewModel[] {
  return UPGRADE_ORDER.map((upgradeId) => createShopRowViewModel(state, upgradeId));
}

function createShopRowViewModel(state: RuntimeState, upgradeId: UpgradeId): ShopRowViewModel {
  const definition = UPGRADE_DEFINITIONS[upgradeId];
  const describedById = `shop-${upgradeId}-status`;
  const tooltipId = `shop-${upgradeId}-tooltip`;
  const tooltipText = createUpgradeTooltipText(state, upgradeId);

  if (state.mode === "defeatTransition") {
    return {
      upgradeId,
      iconAssetKey: UPGRADE_PRESENTATION[upgradeId].iconAssetKey,
      inputState: "blockedByDefeatTransition",
      activationBehavior: "ignoreBlocked",
      statusText: "잠시 후 구매 가능",
      tooltipText,
      buttonText: definition.name,
      ariaDisabled: true,
      describedById,
      tooltipId,
    };
  }

  if (state.mode !== "ready") {
    return {
      upgradeId,
      iconAssetKey: UPGRADE_PRESENTATION[upgradeId].iconAssetKey,
      inputState: "blockedByDefeatTransition",
      activationBehavior: "ignoreBlocked",
      statusText: "게임 준비 중",
      tooltipText,
      buttonText: definition.name,
      ariaDisabled: true,
      describedById,
      tooltipId,
    };
  }

  const preview = getPurchasePreview(state.game, upgradeId);
  if (preview.canAfford) {
    return {
      upgradeId,
      iconAssetKey: UPGRADE_PRESENTATION[upgradeId].iconAssetKey,
      inputState: "buyable",
      activationBehavior: "purchase",
      statusText: "구매 가능",
      tooltipText,
      buttonText: definition.name,
      ariaDisabled: false,
      describedById,
      tooltipId,
    };
  }

  return {
    upgradeId,
    iconAssetKey: UPGRADE_PRESENTATION[upgradeId].iconAssetKey,
    inputState: "insufficientCoins",
    activationBehavior: "ignoreBlocked",
    statusText: `녹슨 동전 ${preview.missingCoins}개 부족`,
    tooltipText,
    buttonText: definition.name,
    ariaDisabled: true,
    describedById,
    tooltipId,
  };
}

function createUpgradeTooltipText(state: RuntimeState, upgradeId: UpgradeId): string {
  const definition = UPGRADE_DEFINITIONS[upgradeId];
  if (state.mode !== "ready" && state.mode !== "defeatTransition") {
    return `${definition.name}: 게임 준비 후 구매 효과를 확인할 수 있습니다.`;
  }

  const game = state.game;
  const currentLevel = game.upgrades[upgradeId];
  const nextUpgrades = { ...game.upgrades, [upgradeId]: currentLevel + 1 };
  const preview = getPurchasePreview(game, upgradeId);
  const costText = preview.canAfford
    ? `비용 ${preview.cost}, 보유 ${game.coins}.`
    : `비용 ${preview.cost}, 보유 ${game.coins}, ${preview.missingCoins}개 부족.`;

  return `${definition.name} 레벨 ${currentLevel} -> ${currentLevel + 1}. ${describeUpgradeEffect(
    game,
    upgradeId,
    nextUpgrades,
  )} ${costText}`;
}

function describeUpgradeEffect(
  game: GameState,
  upgradeId: UpgradeId,
  nextUpgrades: GameState["upgrades"],
): string {
  switch (upgradeId) {
    case "club":
    case "battleAxe":
      return describeDirectDamageChange(game, nextUpgrades);
    case "catapult":
    case "reinforcedCatapult":
      return describeCatapultDamageChange(game, nextUpgrades);
    case "baitBag":
    case "goldenBaitJar":
      return describeKillRewardChange(game, nextUpgrades);
    case "mudTrap":
    case "deepMudBog":
      return describeMudTrapChange(game, nextUpgrades);
    case "blacksmithContract":
      return `${describeDirectDamageChange(game, nextUpgrades)} ${describeCatapultDamageChange(game, nextUpgrades)}`;
  }
}

function describeDirectDamageChange(game: GameState, nextUpgrades: GameState["upgrades"]): string {
  return `클릭 피해 ${calculateDisplayedClickDamage(game.upgrades)} -> ${calculateDisplayedClickDamage(nextUpgrades)}.`;
}

function describeCatapultDamageChange(game: GameState, nextUpgrades: GameState["upgrades"]): string {
  const currentDamage = calculateDisplayedCatapultDamage(game.upgrades);
  const nextDamage = calculateDisplayedCatapultDamage(nextUpgrades);
  const effectText = `투석기 자동 피해 ${currentDamage} -> ${nextDamage}.`;
  return nextUpgrades.catapult === 0 ? `${effectText} 투석기 구매 후 적용됩니다.` : effectText;
}

function describeKillRewardChange(game: GameState, nextUpgrades: GameState["upgrades"]): string {
  const goblinLevel = calculateGoblinLevel(game.defeatedCount);
  const currentReward = calculateKillReward(goblinLevel, game.upgrades.baitBag, game.upgrades.goldenBaitJar);
  const nextReward = calculateKillReward(goblinLevel, nextUpgrades.baitBag, nextUpgrades.goldenBaitJar);
  return `현재 고블린 처치 보상 ${currentReward} -> ${nextReward}.`;
}

function describeMudTrapChange(game: GameState, nextUpgrades: GameState["upgrades"]): string {
  const currentArmedLevel = calculateMudTrapArmedLevel(game.upgrades.mudTrap, game.upgrades.deepMudBog);
  const nextArmedLevel = calculateMudTrapArmedLevel(nextUpgrades.mudTrap, nextUpgrades.deepMudBog);
  return `다음 고블린 첫 직접 공격 배율 x${calculateMudTrapMultiplier(
    currentArmedLevel,
  )} -> x${calculateMudTrapMultiplier(nextArmedLevel)}. 준비 레벨 ${currentArmedLevel} -> ${nextArmedLevel}.`;
}

function calculateDisplayedClickDamage(upgrades: GameState["upgrades"]): number {
  return calculateFinalDamage(calculateClickDamage(upgrades.club, upgrades.battleAxe), upgrades.blacksmithContract);
}

function calculateDisplayedCatapultDamage(upgrades: GameState["upgrades"]): number {
  if (upgrades.catapult === 0) return 0;
  const clickDamage = calculateClickDamage(upgrades.club, upgrades.battleAxe);
  return calculateFinalDamage(
    calculateCatapultDamage(clickDamage, upgrades.catapult, upgrades.reinforcedCatapult),
    upgrades.blacksmithContract,
  );
}
