import { UPGRADE_DEFINITIONS, UPGRADE_ORDER } from "../domain/constants";
import { getPurchasePreview } from "../domain/upgrades";
import type { RuntimeState, UpgradeId } from "../domain/types";
import { UPGRADE_PRESENTATION } from "./upgradePresentation";

export type ShopInputState = "buyable" | "insufficientCoins" | "blockedByDefeatTransition";

export type ShopActivationBehavior = "purchase" | "showInsufficientFeedback" | "ignoreBlocked";

export type ShopRowViewModel = {
  upgradeId: UpgradeId;
  iconAssetKey: (typeof UPGRADE_PRESENTATION)[UpgradeId]["iconAssetKey"];
  inputState: ShopInputState;
  activationBehavior: ShopActivationBehavior;
  statusText: string;
  buttonText: string;
  ariaDisabled: boolean;
  describedById: string;
};

export function createShopRowViewModels(state: RuntimeState): ShopRowViewModel[] {
  return UPGRADE_ORDER.map((upgradeId) => createShopRowViewModel(state, upgradeId));
}

function createShopRowViewModel(state: RuntimeState, upgradeId: UpgradeId): ShopRowViewModel {
  const definition = UPGRADE_DEFINITIONS[upgradeId];
  const describedById = `shop-${upgradeId}-status`;

  if (state.mode === "defeatTransition") {
    return {
      upgradeId,
      iconAssetKey: UPGRADE_PRESENTATION[upgradeId].iconAssetKey,
      inputState: "blockedByDefeatTransition",
      activationBehavior: "ignoreBlocked",
      statusText: "잠시 후 구매 가능",
      buttonText: definition.name,
      ariaDisabled: true,
      describedById,
    };
  }

  if (state.mode !== "ready") {
    return {
      upgradeId,
      iconAssetKey: UPGRADE_PRESENTATION[upgradeId].iconAssetKey,
      inputState: "blockedByDefeatTransition",
      activationBehavior: "ignoreBlocked",
      statusText: "게임 준비 중",
      buttonText: definition.name,
      ariaDisabled: true,
      describedById,
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
      buttonText: definition.name,
      ariaDisabled: false,
      describedById,
    };
  }

  return {
    upgradeId,
    iconAssetKey: UPGRADE_PRESENTATION[upgradeId].iconAssetKey,
    inputState: "insufficientCoins",
    activationBehavior: "showInsufficientFeedback",
    statusText: `녹슨 동전 ${preview.missingCoins}개 부족`,
    buttonText: definition.name,
    ariaDisabled: false,
    describedById,
  };
}
