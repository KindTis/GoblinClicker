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
    src: "/src/assets/goblin-idle.svg",
    purpose: "기본 고블린 스프라이트",
    recommendedSize: goblinSize,
    anchor: centerAnchor,
  },
  goblinHit: {
    key: "goblinHit",
    src: "/src/assets/goblin-hit.svg",
    purpose: "피격 고블린 스프라이트",
    recommendedSize: goblinSize,
    anchor: centerAnchor,
  },
  goblinDefeat: {
    key: "goblinDefeat",
    src: "/src/assets/goblin-defeat.svg",
    purpose: "처치 고블린 스프라이트",
    recommendedSize: goblinSize,
    anchor: centerAnchor,
  },
  hitSpark: {
    key: "hitSpark",
    src: "/src/assets/hit-spark.svg",
    purpose: "피격 파티클",
    recommendedSize: { width: 96, height: 96 },
    anchor: centerAnchor,
  },
  defeatDust: {
    key: "defeatDust",
    src: "/src/assets/defeat-dust.svg",
    purpose: "처치 먼지 파티클",
    recommendedSize: { width: 128, height: 128 },
    anchor: centerAnchor,
  },
  coin: {
    key: "coin",
    src: "/src/assets/coin.svg",
    purpose: "녹슨 동전 아이콘",
    recommendedSize: { width: 64, height: 64 },
    anchor: centerAnchor,
  },
  upgradeClub: {
    key: "upgradeClub",
    src: "/src/assets/upgrade-club.svg",
    purpose: "낡은 몽둥이 아이콘",
    recommendedSize: { width: 64, height: 64 },
    anchor: centerAnchor,
  },
  upgradeCatapult: {
    key: "upgradeCatapult",
    src: "/src/assets/upgrade-catapult.svg",
    purpose: "삐걱대는 투석기 아이콘",
    recommendedSize: { width: 64, height: 64 },
    anchor: centerAnchor,
  },
  upgradeBaitBag: {
    key: "upgradeBaitBag",
    src: "/src/assets/upgrade-bait-bag.svg",
    purpose: "고블린 미끼 주머니 아이콘",
    recommendedSize: { width: 64, height: 64 },
    anchor: centerAnchor,
  },
  upgradeMudTrap: {
    key: "upgradeMudTrap",
    src: "/src/assets/upgrade-mud-trap.svg",
    purpose: "진흙 함정 아이콘",
    recommendedSize: { width: 64, height: 64 },
    anchor: centerAnchor,
  },
  background: {
    key: "background",
    src: "/src/assets/background.svg",
    purpose: "전투 배경",
    recommendedSize: { width: 1280, height: 720 },
    anchor: centerAnchor,
  },
};
