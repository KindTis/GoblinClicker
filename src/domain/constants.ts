import type { UpgradeDefinition, UpgradeId } from "./types";

export const SAVE_KEY = "goblin-clicker.save";
export const SAVE_VERSION = 1;
export const INITIAL_GOBLIN_HP = 5;
export const GOBLIN_HP_GROWTH = 1.18;
export const DIRECT_ATTACK_MIN_INTERVAL_MS = 80;
export const CATAPULT_COOLDOWN_MS = 5000;
export const AUTO_SAVE_INTERVAL_MS = 10000;
export const DEFEAT_TRANSITION_MS = 300;
export const DAMAGE_NUMBER_LIFETIME_MS = 600;
export const HP_GHOST_BAR_DELAY_MS = 250;

export const UPGRADE_ORDER: UpgradeId[] = ["club", "catapult", "baitBag", "mudTrap"];

export const UPGRADE_DEFINITIONS: Record<UpgradeId, UpgradeDefinition> = {
  club: {
    id: "club",
    name: "낡은 몽둥이",
    baseCost: 3,
    growthRate: 1.45,
    description: "클릭 피해량 = 1 + 레벨",
  },
  catapult: {
    id: "catapult",
    name: "삐걱대는 투석기",
    baseCost: 12,
    growthRate: 1.55,
    description: "5초마다 현재 클릭 피해량 * (1 + 레벨) 자동 피해",
  },
  baitBag: {
    id: "baitBag",
    name: "고블린 미끼 주머니",
    baseCost: 20,
    growthRate: 1.6,
    description: "처치 보상 = 기본 처치 보상 + 레벨",
  },
  mudTrap: {
    id: "mudTrap",
    name: "진흙 함정",
    baseCost: 90,
    growthRate: 1.85,
    description: "새 고블린 첫 직접 공격 배율 = 1 + 2 * 준비 레벨",
  },
};
