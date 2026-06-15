import { describe, expect, it } from "vitest";
import { UPGRADE_ORDER } from "../../src/domain/constants";
import { UPGRADE_PRESENTATION } from "../../src/ui/upgradePresentation";

describe("upgradePresentation", () => {
  it("도메인 업그레이드 ID를 UI 에셋 키로 매핑한다", () => {
    expect(UPGRADE_ORDER.map((id) => UPGRADE_PRESENTATION[id].iconAssetKey)).toEqual([
      "upgradeClub",
      "upgradeCatapult",
      "upgradeBaitBag",
      "upgradeMudTrap",
    ]);
  });
});
