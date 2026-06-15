import type { AssetKey } from "../assets/assetManifest";
import type { UpgradeId } from "../domain/types";

export const UPGRADE_PRESENTATION: Record<UpgradeId, { iconAssetKey: AssetKey }> = {
  club: { iconAssetKey: "upgradeClub" },
  catapult: { iconAssetKey: "upgradeCatapult" },
  baitBag: { iconAssetKey: "upgradeBaitBag" },
  mudTrap: { iconAssetKey: "upgradeMudTrap" },
};
