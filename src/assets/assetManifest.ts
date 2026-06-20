export type AssetKey =
  | "goblinIdle"
  | "goblinHit"
  | "goblinDefeat"
  | "hitSpark"
  | "defeatDust"
  | "coin"
  | "upgradeClub"
  | "upgradeCatapult"
  | "upgradeBaitBag"
  | "upgradeMudTrap"
  | "upgradeBattleAxe"
  | "upgradeReinforcedCatapult"
  | "upgradeGoldenBaitJar"
  | "upgradeDeepMudBog"
  | "upgradeBlacksmithContract"
  | "background";

export type AssetDefinition = {
  key: AssetKey;
  src: string;
  purpose: string;
  recommendedSize: { width: number; height: number };
  anchor: { x: number; y: number };
};

const goblinSize = { width: 320, height: 320 };
const centerAnchor = { x: 0.5, y: 0.5 };

export const ASSETS: Record<AssetKey, AssetDefinition> = {
  goblinIdle: {
    key: "goblinIdle",
    src: new URL("./goblin-idle.svg", import.meta.url).href,
    purpose: "기본 고블린 스프라이트",
    recommendedSize: goblinSize,
    anchor: centerAnchor,
  },
  goblinHit: {
    key: "goblinHit",
    src: new URL("./goblin-hit.svg", import.meta.url).href,
    purpose: "피격 고블린 스프라이트",
    recommendedSize: goblinSize,
    anchor: centerAnchor,
  },
  goblinDefeat: {
    key: "goblinDefeat",
    src: new URL("./goblin-defeat.svg", import.meta.url).href,
    purpose: "처치 고블린 스프라이트",
    recommendedSize: goblinSize,
    anchor: centerAnchor,
  },
  hitSpark: {
    key: "hitSpark",
    src: new URL("./hit-spark.svg", import.meta.url).href,
    purpose: "피격 파티클",
    recommendedSize: { width: 96, height: 96 },
    anchor: centerAnchor,
  },
  defeatDust: {
    key: "defeatDust",
    src: new URL("./defeat-dust.svg", import.meta.url).href,
    purpose: "처치 먼지 파티클",
    recommendedSize: { width: 128, height: 128 },
    anchor: centerAnchor,
  },
  coin: {
    key: "coin",
    src: new URL("./coin.svg", import.meta.url).href,
    purpose: "녹슨 동전 아이콘",
    recommendedSize: { width: 64, height: 64 },
    anchor: centerAnchor,
  },
  upgradeClub: {
    key: "upgradeClub",
    src: new URL("./upgrade-club.svg", import.meta.url).href,
    purpose: "낡은 몽둥이 아이콘",
    recommendedSize: { width: 64, height: 64 },
    anchor: centerAnchor,
  },
  upgradeCatapult: {
    key: "upgradeCatapult",
    src: new URL("./upgrade-catapult.svg", import.meta.url).href,
    purpose: "삐걱대는 투석기 아이콘",
    recommendedSize: { width: 64, height: 64 },
    anchor: centerAnchor,
  },
  upgradeBaitBag: {
    key: "upgradeBaitBag",
    src: new URL("./upgrade-bait-bag.svg", import.meta.url).href,
    purpose: "고블린 미끼 주머니 아이콘",
    recommendedSize: { width: 64, height: 64 },
    anchor: centerAnchor,
  },
  upgradeMudTrap: {
    key: "upgradeMudTrap",
    src: new URL("./upgrade-mud-trap.svg", import.meta.url).href,
    purpose: "진흙 함정 아이콘",
    recommendedSize: { width: 64, height: 64 },
    anchor: centerAnchor,
  },
  upgradeBattleAxe: {
    key: "upgradeBattleAxe",
    src: new URL("./upgrade-battle-axe.svg", import.meta.url).href,
    purpose: "날 선 전투 도끼 아이콘",
    recommendedSize: { width: 64, height: 64 },
    anchor: centerAnchor,
  },
  upgradeReinforcedCatapult: {
    key: "upgradeReinforcedCatapult",
    src: new URL("./upgrade-reinforced-catapult.svg", import.meta.url).href,
    purpose: "보강 투석대 아이콘",
    recommendedSize: { width: 64, height: 64 },
    anchor: centerAnchor,
  },
  upgradeGoldenBaitJar: {
    key: "upgradeGoldenBaitJar",
    src: new URL("./upgrade-golden-bait-jar.svg", import.meta.url).href,
    purpose: "황금 미끼 항아리 아이콘",
    recommendedSize: { width: 64, height: 64 },
    anchor: centerAnchor,
  },
  upgradeDeepMudBog: {
    key: "upgradeDeepMudBog",
    src: new URL("./upgrade-deep-mud-bog.svg", import.meta.url).href,
    purpose: "깊은 진흙 수렁 아이콘",
    recommendedSize: { width: 64, height: 64 },
    anchor: centerAnchor,
  },
  upgradeBlacksmithContract: {
    key: "upgradeBlacksmithContract",
    src: new URL("./upgrade-blacksmith-contract.svg", import.meta.url).href,
    purpose: "대장장이 계약서 아이콘",
    recommendedSize: { width: 64, height: 64 },
    anchor: centerAnchor,
  },
  background: {
    key: "background",
    src: new URL("./background.svg", import.meta.url).href,
    purpose: "전투 배경",
    recommendedSize: { width: 1280, height: 720 },
    anchor: centerAnchor,
  },
};
