import { describe, expect, it } from "vitest";
import { ASSETS } from "../../src/assets/assetManifest";

describe("assetManifest", () => {
  it("MVP 필수 에셋 키와 파일 경로를 제공한다", () => {
    expect(Object.keys(ASSETS).sort()).toEqual(
      [
        "background",
        "coin",
        "defeatDust",
        "goblinDefeat",
        "goblinHit",
        "goblinIdle",
        "hitSpark",
        "upgradeBaitBag",
        "upgradeCatapult",
        "upgradeClub",
        "upgradeMudTrap",
      ].sort(),
    );
    expect(ASSETS.goblinIdle.src).toContain("goblin-idle.svg");
    expect(ASSETS.goblinHit.anchor).toEqual(ASSETS.goblinIdle.anchor);
    expect(ASSETS.goblinDefeat.recommendedSize).toEqual(ASSETS.goblinIdle.recommendedSize);
  });
});
