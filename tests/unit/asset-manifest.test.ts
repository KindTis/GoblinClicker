import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
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
        "upgradeBattleAxe",
        "upgradeBlacksmithContract",
        "upgradeCatapult",
        "upgradeClub",
        "upgradeDeepMudBog",
        "upgradeGoldenBaitJar",
        "upgradeMudTrap",
        "upgradeReinforcedCatapult",
      ].sort(),
    );
    expect(ASSETS.goblinIdle.src).not.toBe("");
    expect(Object.keys(ASSETS).filter((key) => key.startsWith("goblin")).sort()).toEqual(
      ["goblinDefeat", "goblinHit", "goblinIdle"].sort(),
    );
    expect(Object.keys(ASSETS)).not.toContain("attackReaction");
    expect(ASSETS.goblinHit.anchor).toEqual(ASSETS.goblinIdle.anchor);
    expect(ASSETS.goblinDefeat.recommendedSize).toEqual(ASSETS.goblinIdle.recommendedSize);
    for (const asset of Object.values(ASSETS)) {
      expect(asset.src).not.toMatch(/^\/src\//);
    }
  });

  it("피격 고블린 에셋은 아파하는 반응으로 설명된다", () => {
    const svg = readFileSync("src/assets/goblin-hit.svg", "utf-8");

    expect(svg).toContain("<title>아파하는 고블린 피격 반응</title>");
    expect(svg).toContain("<desc>공격을 받아 눈을 찡그리고 입을 일그러뜨린 고블린</desc>");
  });
});
