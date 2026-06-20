# High-Tier Shop Items Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `docs/high-tier-shop-items-spec.md`의 상위 상점 아이템 5종을 도메인 규칙, 저장, 상점 UI, 에셋 매핑, 밸런스 검증까지 구현한다.

**Architecture:** 기존 구조를 유지한다. 업그레이드 정의와 순서는 `src/domain/constants.ts`, 계산 공식은 `src/domain/progression.ts`, 전투 적용은 `src/domain/combat.ts`, 구매 트랜잭션은 기존 `src/domain/upgrades.ts`의 범용 로직을 사용한다. UI는 기존 `UPGRADE_ORDER` 기반 렌더링을 확장하고, 저장 호환성은 누락된 신규 업그레이드 키를 0으로 정규화하는 방식으로 처리한다.

**Tech Stack:** TypeScript, Vite, Vitest, Playwright, Phaser, DOM HUD.

---

## Scope Check

이 작업은 여러 파일을 건드리지만 하나의 기능이다. 신규 재화, 잠금 해제 조건, 구매 배수, 되팔기, 튜토리얼 팝업은 구현하지 않는다.

현재 작업 트리에 사용자 변경이 있을 수 있다. 구현 중 `src/assets/assetManifest.ts`, `src/game/GoblinScene.ts`, `src/styles.css`, `src/ui/hud.ts`, 테스트 파일 등에 이미 존재하는 변경을 되돌리지 않는다. 충돌이 나면 현재 파일 내용을 기준으로 작은 패치를 적용한다.

## File Structure

- Modify: `src/domain/types.ts`
  - `UpgradeId` union에 신규 5종을 추가한다.
- Modify: `src/domain/constants.ts`
  - `UPGRADE_ORDER`와 `UPGRADE_DEFINITIONS`에 신규 5종을 추가한다.
- Modify: `src/domain/progression.ts`
  - 클릭 피해, 투석기 피해, 보상, 진흙 함정 준비 레벨, 최종 피해 배율 계산을 확장한다.
- Modify: `src/domain/combat.ts`
  - 신규 계산 공식을 실제 직접 공격, 자동 공격, 처치 보상, 다음 고블린 준비 상태에 적용한다.
- Modify: `src/domain/save.ts`
  - 초기 상태와 저장 정규화가 신규 업그레이드 키와 확장된 `mudTrapArmedLevel` 상한을 다룬다.
- Modify: `src/domain/upgrades.ts`
  - 기존 범용 구매 로직이 신규 업그레이드에서도 의도대로 동작하는지 테스트로 고정한다. 코드 변경은 필요하지 않을 수 있다.
- Modify: `src/ui/upgradePresentation.ts`
  - 신규 업그레이드 ID와 아이콘 에셋 키를 매핑한다.
- Modify: `src/ui/hud.ts`
  - HUD의 클릭 피해와 투석기 피해 표시가 신규 계산 공식을 사용한다.
- Modify: `src/assets/assetManifest.ts`
  - 신규 업그레이드 아이콘 에셋 키 5종을 추가한다.
- Create: `src/assets/upgrade-battle-axe.svg`
- Create: `src/assets/upgrade-reinforced-catapult.svg`
- Create: `src/assets/upgrade-golden-bait-jar.svg`
- Create: `src/assets/upgrade-deep-mud-bog.svg`
- Create: `src/assets/upgrade-blacksmith-contract.svg`
- Modify: `src/test/balanceSimulator.ts`
  - 신규 업그레이드와 구매 가능 상태를 밸런스 검증에 노출한다.
- Modify: `src/test/e2eHarness.ts`
  - 테스트 하네스의 업그레이드 키 검증을 신규 5종까지 확장한다.
- Modify: `tests/unit/constants.test.ts`
- Modify: `tests/unit/progression.test.ts`
- Modify: `tests/unit/combat.test.ts`
- Modify: `tests/unit/save.test.ts`
- Modify: `tests/unit/upgrades.test.ts`
- Modify: `tests/unit/runtime.test.ts`
- Modify: `tests/unit/shop.test.ts`
- Modify: `tests/unit/upgrade-presentation.test.ts`
- Modify: `tests/unit/asset-manifest.test.ts`
- Modify: `tests/unit/balance-simulation.test.ts`
- Modify: `tests/e2e/smoke.spec.ts`
  - 상점 행 증가와 저장 복원 흐름을 브라우저에서 확인한다.

## Known Balance Gate

스펙은 `battleAxe` 기본 비용을 180으로 정의하면서도 첫 상위 아이템 구매 시점을 12~18분으로 요구한다. 이 둘은 시뮬레이터 전략에 따라 충돌할 수 있다.

구현자는 먼저 스펙 수치 180을 그대로 반영한다. 밸런스 게이트가 실패하면 `docs/high-tier-shop-items-spec.md`나 `src/domain/constants.ts`의 비용 수치를 바로 수정하지 않는다. 구현을 멈추고 실패 시간, 보유 코인, 최초 상위 아이템 구매 가능 시각, 최초 `battleAxe` 구매 시각을 기록한 뒤, 아래 `스펙 확인 필요 항목`에 비용 튜닝 필요 여부를 남긴다. 상수 변경은 별도로 승인된 밸런스 튜닝 작업에서만 수행한다.

## 스펙 확인 필요 항목

현재 확정된 스펙 확인 필요 항목은 없다.

초기 구현 중 `stopAfterPurchaseOrder`가 같은 구매 우선순위를 반복해 `battleAxe` 목표 전략을 표현하지 못하는 문제가 있었다. 최종 구현은 5분 동안 기존 active 성장 우선순위를 사용한 뒤 `battleAxe`만 목표로 저축하는 `targetUpgradeAfterMs` 전략으로 조정한다. 이 전략은 `battleAxe` 비용 180을 그대로 유지하면서 첫 구매 시점을 12~18분 범위에 넣기 위한 시뮬레이터 전략 조정이며, 상수 튜닝은 아니다.

Task 7 밸런스 게이트가 실패하면 이 섹션에 항목을 추가하고 구현을 중단한다. 항목에는 실패한 테스트 이름, 10분 active baseline 최초 상위 아이템 구매 가능 시각, 10분 active baseline 최대 상위 아이템 구매 가능 개수, 상위 목표 baseline 최초 `battleAxe` 구매 시각, 해당 시점 보유 재화, 필요한 결정을 실제 측정값으로 기록한다. 빈 값이나 추정값을 남기지 않는다.

---

### Task 1: Domain IDs, Constants, And Pure Progression

**Files:**
- Modify: `tests/unit/constants.test.ts`
- Modify: `tests/unit/progression.test.ts`
- Modify: `src/domain/types.ts`
- Modify: `src/domain/constants.ts`
- Modify: `src/domain/progression.ts`

- [ ] **Step 1: Write failing constants tests**

Update `tests/unit/constants.test.ts` imports:

```ts
import {
  AUTO_SAVE_INTERVAL_MS,
  CATAPULT_COOLDOWN_MS,
  DAMAGE_NUMBER_LIFETIME_MS,
  DEFEAT_TRANSITION_MS,
  DIRECT_ATTACK_MIN_INTERVAL_MS,
  GOBLIN_HP_GROWTH,
  HP_GHOST_BAR_DELAY_MS,
  INITIAL_GOBLIN_HP,
  SAVE_KEY,
  SAVE_VERSION,
  UPGRADE_DEFINITIONS,
  UPGRADE_ORDER,
} from "../../src/domain/constants";
```

Replace the shop order test with:

```ts
it("상점 표시 순서를 고정한다", () => {
  expect(UPGRADE_ORDER).toEqual([
    "club",
    "catapult",
    "baitBag",
    "mudTrap",
    "battleAxe",
    "reinforcedCatapult",
    "goldenBaitJar",
    "deepMudBog",
    "blacksmithContract",
  ]);
});

it("상위 상점 아이템 5종의 기본 비용과 성장률을 제공한다", () => {
  expect(UPGRADE_DEFINITIONS.battleAxe).toMatchObject({
    name: "날 선 전투 도끼",
    baseCost: 180,
    growthRate: 1.9,
  });
  expect(UPGRADE_DEFINITIONS.reinforcedCatapult).toMatchObject({
    name: "보강 투석대",
    baseCost: 420,
    growthRate: 1.95,
  });
  expect(UPGRADE_DEFINITIONS.goldenBaitJar).toMatchObject({
    name: "황금 미끼 항아리",
    baseCost: 900,
    growthRate: 2,
  });
  expect(UPGRADE_DEFINITIONS.deepMudBog).toMatchObject({
    name: "깊은 진흙 수렁",
    baseCost: 1800,
    growthRate: 2.08,
  });
  expect(UPGRADE_DEFINITIONS.blacksmithContract).toMatchObject({
    name: "대장장이 계약서",
    baseCost: 4200,
    growthRate: 2.2,
  });
});
```

- [ ] **Step 2: Write failing progression tests**

Update `tests/unit/progression.test.ts` imports:

```ts
import {
  calculateBaseKillReward,
  calculateCatapultDamage,
  calculateClickDamage,
  calculateFinalDamage,
  calculateGoblinLevel,
  calculateGoblinMaxHp,
  calculateKillReward,
  calculateMudTrapArmedLevel,
  calculateMudTrapMultiplier,
  calculateUpgradeCost,
} from "../../src/domain/progression";
```

Append these cases:

```ts
it("상위 업그레이드 비용을 구매 전 레벨 기준으로 계산한다", () => {
  expect(calculateUpgradeCost("battleAxe", 0)).toBe(180);
  expect(calculateUpgradeCost("battleAxe", 1)).toBe(342);
  expect(calculateUpgradeCost("reinforcedCatapult", 0)).toBe(420);
  expect(calculateUpgradeCost("goldenBaitJar", 0)).toBe(900);
  expect(calculateUpgradeCost("deepMudBog", 0)).toBe(1800);
  expect(calculateUpgradeCost("blacksmithContract", 0)).toBe(4200);
});

it("상위 업그레이드를 포함한 순수 계산 공식을 제공한다", () => {
  expect(calculateClickDamage(2, 3)).toBe(12);
  expect(calculateCatapultDamage(12, 2, 1)).toBe(72);
  expect(calculateKillReward(10, 3, 2)).toBe(15);
  expect(calculateMudTrapArmedLevel(2, 3)).toBe(8);
  expect(calculateFinalDamage(72, 2)).toBe(97);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```powershell
npm.cmd test -- tests/unit/constants.test.ts tests/unit/progression.test.ts
```

Expected: FAIL with TypeScript errors for missing upgrade IDs or missing progression exports.

- [ ] **Step 4: Extend domain types**

Replace `UpgradeId` in `src/domain/types.ts` with:

```ts
export type UpgradeId =
  | "club"
  | "catapult"
  | "baitBag"
  | "mudTrap"
  | "battleAxe"
  | "reinforcedCatapult"
  | "goldenBaitJar"
  | "deepMudBog"
  | "blacksmithContract";
```

- [ ] **Step 5: Extend constants**

Replace `UPGRADE_ORDER` and append definitions in `src/domain/constants.ts`:

```ts
export const UPGRADE_ORDER: UpgradeId[] = [
  "club",
  "catapult",
  "baitBag",
  "mudTrap",
  "battleAxe",
  "reinforcedCatapult",
  "goldenBaitJar",
  "deepMudBog",
  "blacksmithContract",
];
```

Add these entries to `UPGRADE_DEFINITIONS` after `mudTrap`:

```ts
  battleAxe: {
    id: "battleAxe",
    name: "날 선 전투 도끼",
    baseCost: 180,
    growthRate: 1.9,
    description: "클릭 피해 +3",
  },
  reinforcedCatapult: {
    id: "reinforcedCatapult",
    name: "보강 투석대",
    baseCost: 420,
    growthRate: 1.95,
    description: "투석기 보유 시 자동 피해 증가",
  },
  goldenBaitJar: {
    id: "goldenBaitJar",
    name: "황금 미끼 항아리",
    baseCost: 900,
    growthRate: 2,
    description: "처치 보상 비례 증가",
  },
  deepMudBog: {
    id: "deepMudBog",
    name: "깊은 진흙 수렁",
    baseCost: 1800,
    growthRate: 2.08,
    description: "다음 고블린 첫 타격 강화",
  },
  blacksmithContract: {
    id: "blacksmithContract",
    name: "대장장이 계약서",
    baseCost: 4200,
    growthRate: 2.2,
    description: "모든 피해 최종 배율 증가",
  },
```

- [ ] **Step 6: Extend pure progression functions**

Update these functions in `src/domain/progression.ts`:

```ts
export function calculateKillReward(goblinLevel: number, baitBagLevel: number, goldenBaitJarLevel = 0): number {
  const baseReward = calculateBaseKillReward(goblinLevel);
  return baseReward + baitBagLevel + Math.floor(baseReward * 0.4 * goldenBaitJarLevel);
}

export function calculateClickDamage(clubLevel: number, battleAxeLevel = 0): number {
  return 1 + clubLevel + 3 * battleAxeLevel;
}

export function calculateMudTrapArmedLevel(mudTrapLevel: number, deepMudBogLevel = 0): number {
  return mudTrapLevel + 2 * deepMudBogLevel;
}

export function calculateMudTrapMultiplier(armedLevel: number): number {
  return 1 + 2 * armedLevel;
}

export function calculateCatapultDamage(
  clickDamage: number,
  catapultLevel: number,
  reinforcedCatapultLevel = 0,
): number {
  return clickDamage * (1 + catapultLevel) + clickDamage * 3 * reinforcedCatapultLevel;
}

export function calculateFinalDamage(calculatedDamage: number, blacksmithContractLevel = 0): number {
  return Math.max(1, Math.floor(calculatedDamage * (1 + 0.18 * blacksmithContractLevel)));
}
```

- [ ] **Step 7: Run tests to verify Task 1 passes**

Run:

```powershell
npm.cmd test -- tests/unit/constants.test.ts tests/unit/progression.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Task 1**

Run:

```powershell
git add src/domain/types.ts src/domain/constants.ts src/domain/progression.ts tests/unit/constants.test.ts tests/unit/progression.test.ts
git commit -m "feat: define high-tier upgrade formulas"
```

---

### Task 2: Save Compatibility And Initial State

**Files:**
- Modify: `tests/unit/save.test.ts`
- Modify: `tests/unit/runtime.test.ts`
- Modify: `src/domain/save.ts`
- Modify: `src/test/e2eHarness.ts`

- [ ] **Step 1: Write failing save tests**

In `tests/unit/save.test.ts`, update the expected normalized upgrades in the existing canonical save test:

```ts
        upgrades: {
          club: 2,
          catapult: 1,
          baitBag: 0,
          mudTrap: 1,
          battleAxe: 0,
          reinforcedCatapult: 0,
          goldenBaitJar: 0,
          deepMudBog: 0,
          blacksmithContract: 0,
        },
```

Append this test:

```ts
  it("상위 업그레이드와 확장된 진흙 함정 준비 레벨을 정규화한다", () => {
    const normalized = normalizeSaveData({
      saveVersion: SAVE_VERSION,
      state: {
        defeatedCount: 3,
        coins: 7,
        goblinHp: 4,
        mudTrapArmedLevel: 99,
        catapultCooldownRemainingMs: 999999,
        upgrades: {
          club: 1,
          catapult: 1,
          baitBag: 1,
          mudTrap: 2,
          battleAxe: 3,
          reinforcedCatapult: 4,
          goldenBaitJar: 5,
          deepMudBog: 3,
          blacksmithContract: 1,
        },
      },
    });
    if ("error" in normalized) throw new Error("expected normalized save");
    expect(normalized.state.upgrades.deepMudBog).toBe(3);
    expect(normalized.state.mudTrapArmedLevel).toBe(8);
    expect(normalized.state.catapultCooldownRemainingMs).toBe(CATAPULT_COOLDOWN_MS);
  });
```

- [ ] **Step 2: Run save test to verify it fails**

Run:

```powershell
npm.cmd test -- tests/unit/save.test.ts
```

Expected: FAIL because initial state and normalized save output do not include the new keys, and `mudTrapArmedLevel` is capped by `mudTrap` only.

- [ ] **Step 3: Update initial state and mud trap normalization**

In `src/domain/save.ts`, update imports:

```ts
import { calculateGoblinLevel, calculateGoblinMaxHp, calculateMudTrapArmedLevel } from "./progression";
```

Update `createInitialGameState()` upgrades:

```ts
    upgrades: {
      club: 0,
      catapult: 0,
      baitBag: 0,
      mudTrap: 0,
      battleAxe: 0,
      reinforcedCatapult: 0,
      goldenBaitJar: 0,
      deepMudBog: 0,
      blacksmithContract: 0,
    },
```

Replace `mudTrapArmedLevel` normalization with:

```ts
  const maxMudTrapArmedLevel = calculateMudTrapArmedLevel(upgrades.mudTrap, upgrades.deepMudBog);
  const mudTrapArmedLevel =
    maxMudTrapArmedLevel === 0
      ? 0
      : safeNonNegativeInteger(rawState.mudTrapArmedLevel)
        ? Math.min(rawState.mudTrapArmedLevel, maxMudTrapArmedLevel)
        : 0;
```

- [ ] **Step 4: Update test harness upgrade key validation**

In `src/test/e2eHarness.ts`, replace the exact upgrade key assertion with:

```ts
  assertExactKeys(
    state.upgrades,
    [
      "baitBag",
      "battleAxe",
      "blacksmithContract",
      "catapult",
      "club",
      "deepMudBog",
      "goldenBaitJar",
      "mudTrap",
      "reinforcedCatapult",
    ],
    "upgrades",
  );
```

- [ ] **Step 5: Update existing runtime test literals**

In `tests/unit/runtime.test.ts`, any test-local `upgrades` object must include all 9 keys. Replace the literal in the first test with:

```ts
        upgrades: {
          club: 0,
          catapult: 1,
          baitBag: 0,
          mudTrap: 0,
          battleAxe: 0,
          reinforcedCatapult: 0,
          goldenBaitJar: 0,
          deepMudBog: 0,
          blacksmithContract: 0,
        },
```

If later implementation reveals additional explicit `upgrades` literals in tests, expand them the same way instead of weakening `GameState`.

- [ ] **Step 6: Run save and runtime tests to verify they pass**

Run:

```powershell
npm.cmd test -- tests/unit/save.test.ts tests/unit/runtime.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

Run:

```powershell
git add src/domain/save.ts src/test/e2eHarness.ts tests/unit/save.test.ts tests/unit/runtime.test.ts
git commit -m "feat: normalize high-tier upgrade saves"
```

---

### Task 3: Purchase Behavior For New Upgrade IDs

**Files:**
- Modify: `tests/unit/upgrades.test.ts`
- Modify: `src/domain/upgrades.ts` only if the tests expose a real defect.

- [ ] **Step 1: Write failing or confirming purchase tests**

Append to `tests/unit/upgrades.test.ts`:

```ts
  it("상위 업그레이드는 기존 구매 트랜잭션으로 1레벨씩 구매된다", () => {
    const state = { ...createInitialGameState(), coins: 180 };
    const result = purchaseUpgrade(state, "battleAxe");
    expect(result.ok).toBe(true);
    expect(result.state.coins).toBe(0);
    expect(result.state.upgrades.battleAxe).toBe(1);
    expect(result.shouldSave).toBe(true);
  });

  it("보강 투석대 선구매는 투석기 쿨다운을 시작하지 않는다", () => {
    const state = { ...createInitialGameState(), coins: 420 };
    const result = purchaseUpgrade(state, "reinforcedCatapult");
    expect(result.ok).toBe(true);
    expect(result.state.upgrades.reinforcedCatapult).toBe(1);
    expect(result.state.upgrades.catapult).toBe(0);
    expect(result.state.catapultCooldownRemainingMs).toBe(0);
  });

  it("구매 가능 개수는 신규 업그레이드를 포함하되 실제 비용만 센다", () => {
    const state = { ...createInitialGameState(), coins: 180 };
    expect(countAffordableUpgrades(state)).toBe(5);
    expect(getPurchasePreview(state, "reinforcedCatapult").missingCoins).toBe(240);
  });
```

- [ ] **Step 2: Run purchase tests**

Run:

```powershell
npm.cmd test -- tests/unit/upgrades.test.ts
```

Expected: PASS if Task 1 and Task 2 are complete. If it fails because `purchaseUpgrade` assumes only old IDs, update only the failing branch.

- [ ] **Step 3: Keep `purchaseUpgrade` generic**

If implementation is required, keep the existing shape and only preserve the special catapult first-purchase rule:

```ts
  const firstCatapultPurchase = upgradeId === "catapult" && previousLevel === 0;
```

Do not add special cases for `battleAxe`, `goldenBaitJar`, `deepMudBog`, or `blacksmithContract`.

- [ ] **Step 4: Commit Task 3**

Run:

```powershell
git add src/domain/upgrades.ts tests/unit/upgrades.test.ts
git commit -m "test: cover high-tier upgrade purchases"
```

---

### Task 4: Combat Formula Integration

**Files:**
- Modify: `tests/unit/combat.test.ts`
- Modify: `src/domain/combat.ts`

- [ ] **Step 1: Write failing direct attack and catapult tests**

Append to `tests/unit/combat.test.ts`:

```ts
  it("직접 공격은 전투 도끼와 대장장이 최종 배율을 적용한다", () => {
    const state = {
      ...createInitialGameState(),
      goblinHp: 100,
      mudTrapArmedLevel: 2,
      upgrades: {
        club: 1,
        catapult: 0,
        baitBag: 0,
        mudTrap: 2,
        battleAxe: 2,
        reinforcedCatapult: 0,
        goldenBaitJar: 0,
        deepMudBog: 0,
        blacksmithContract: 1,
      },
    };
    const result = applyDirectAttack(state);
    expect(result.damage).toBe(47);
    expect(result.state.goblinHp).toBe(53);
    expect(result.state.mudTrapArmedLevel).toBe(0);
  });

  it("보강 투석대는 투석기 보유 시 자동 피해에 반영된다", () => {
    const state = {
      ...createInitialGameState(),
      goblinHp: 100,
      catapultCooldownRemainingMs: 100,
      upgrades: {
        club: 1,
        catapult: 1,
        baitBag: 0,
        mudTrap: 0,
        battleAxe: 1,
        reinforcedCatapult: 2,
        goldenBaitJar: 0,
        deepMudBog: 0,
        blacksmithContract: 1,
      },
    };
    const result = tickCatapult(state, 180, "visible");
    expect(result.fired).toBe(true);
    expect(result.damage).toBe(47);
    expect(result.state.goblinHp).toBe(53);
  });

  it("보강 투석대만 보유하면 자동 공격은 새로 발생하지 않는다", () => {
    const state = {
      ...createInitialGameState(),
      catapultCooldownRemainingMs: 0,
      upgrades: {
        club: 0,
        catapult: 0,
        baitBag: 0,
        mudTrap: 0,
        battleAxe: 0,
        reinforcedCatapult: 1,
        goldenBaitJar: 0,
        deepMudBog: 0,
        blacksmithContract: 0,
      },
    };
    const result = tickCatapult(state, 5000, "visible");
    expect(result.fired).toBe(false);
    expect(result.damage).toBe(0);
  });

  it("처치 시 황금 미끼와 깊은 진흙 수렁을 다음 상태에 반영한다", () => {
    const state = {
      ...createInitialGameState(),
      goblinHp: 1,
      upgrades: {
        club: 0,
        catapult: 0,
        baitBag: 1,
        mudTrap: 2,
        battleAxe: 0,
        reinforcedCatapult: 0,
        goldenBaitJar: 2,
        deepMudBog: 3,
        blacksmithContract: 0,
      },
    };
    const result = applyDirectAttack(state);
    expect(result.defeated).toBe(true);
    expect(result.state.coins).toBe(2);
    expect(result.state.mudTrapArmedLevel).toBe(8);
  });
```

- [ ] **Step 2: Run combat tests to verify they fail**

Run:

```powershell
npm.cmd test -- tests/unit/combat.test.ts
```

Expected: FAIL because combat still calls old two-argument formulas and old reward/mud trap logic.

- [ ] **Step 3: Update combat imports**

In `src/domain/combat.ts`, import the new helpers:

```ts
import {
  calculateCatapultDamage,
  calculateClickDamage,
  calculateFinalDamage,
  calculateGoblinLevel,
  calculateGoblinMaxHp,
  calculateKillReward,
  calculateMudTrapArmedLevel,
  calculateMudTrapMultiplier,
} from "./progression";
```

- [ ] **Step 4: Apply direct attack formula**

Replace direct attack damage calculation:

```ts
  const clickDamage = calculateClickDamage(state.upgrades.club, state.upgrades.battleAxe);
  const multiplier = state.mudTrapArmedLevel > 0 ? calculateMudTrapMultiplier(state.mudTrapArmedLevel) : 1;
  const damage = calculateFinalDamage(clickDamage * multiplier, state.upgrades.blacksmithContract);
```

- [ ] **Step 5: Apply catapult formula**

Replace catapult damage calculation:

```ts
  const clickDamage = calculateClickDamage(state.upgrades.club, state.upgrades.battleAxe);
  const damage = calculateFinalDamage(
    calculateCatapultDamage(clickDamage, state.upgrades.catapult, state.upgrades.reinforcedCatapult),
    state.upgrades.blacksmithContract,
  );
```

- [ ] **Step 6: Apply reward and mud trap formula**

Replace the affected fields in `defeatCurrentGoblin`:

```ts
    coins:
      state.coins +
      calculateKillReward(defeatedGoblinLevel, state.upgrades.baitBag, state.upgrades.goldenBaitJar),
    goblinHp: nextMaxHp,
    mudTrapArmedLevel: calculateMudTrapArmedLevel(state.upgrades.mudTrap, state.upgrades.deepMudBog),
```

- [ ] **Step 7: Run combat tests to verify they pass**

Run:

```powershell
npm.cmd test -- tests/unit/combat.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Task 4**

Run:

```powershell
git add src/domain/combat.ts tests/unit/combat.test.ts
git commit -m "feat: apply high-tier combat effects"
```

---

### Task 5: UI Presentation And Asset Manifest

**Files:**
- Create: `src/assets/upgrade-battle-axe.svg`
- Create: `src/assets/upgrade-reinforced-catapult.svg`
- Create: `src/assets/upgrade-golden-bait-jar.svg`
- Create: `src/assets/upgrade-deep-mud-bog.svg`
- Create: `src/assets/upgrade-blacksmith-contract.svg`
- Modify: `src/assets/assetManifest.ts`
- Modify: `src/ui/upgradePresentation.ts`
- Modify: `tests/unit/asset-manifest.test.ts`
- Modify: `tests/unit/upgrade-presentation.test.ts`

- [ ] **Step 1: Write failing asset and presentation tests**

Update expected asset keys in `tests/unit/asset-manifest.test.ts`:

```ts
        "upgradeBattleAxe",
        "upgradeReinforcedCatapult",
        "upgradeGoldenBaitJar",
        "upgradeDeepMudBog",
        "upgradeBlacksmithContract",
```

Update expected presentation mapping in `tests/unit/upgrade-presentation.test.ts`:

```ts
    expect(UPGRADE_ORDER.map((id) => UPGRADE_PRESENTATION[id].iconAssetKey)).toEqual([
      "upgradeClub",
      "upgradeCatapult",
      "upgradeBaitBag",
      "upgradeMudTrap",
      "upgradeBattleAxe",
      "upgradeReinforcedCatapult",
      "upgradeGoldenBaitJar",
      "upgradeDeepMudBog",
      "upgradeBlacksmithContract",
    ]);
```

- [ ] **Step 2: Run UI mapping tests to verify they fail**

Run:

```powershell
npm.cmd test -- tests/unit/asset-manifest.test.ts tests/unit/upgrade-presentation.test.ts
```

Expected: FAIL because the new asset keys and presentation mappings do not exist.

- [ ] **Step 3: Create five SVG files**

Create `src/assets/upgrade-battle-axe.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="날 선 전투 도끼">
  <rect width="64" height="64" rx="8" fill="#2f3a34"/>
  <path d="M34 10h6v44h-6z" fill="#b58b4a"/>
  <path d="M25 14c-9 3-13 11-11 22 9-1 17-6 22-15-2-4-5-6-11-7z" fill="#c7d0d4"/>
  <path d="M40 14c9 3 13 11 11 22-9-1-17-6-22-15 2-4 5-6 11-7z" fill="#e4ecef"/>
</svg>
```

Create `src/assets/upgrade-reinforced-catapult.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="보강 투석대">
  <rect width="64" height="64" rx="8" fill="#283340"/>
  <path d="M13 45h38v6H13z" fill="#8d5c35"/>
  <path d="M20 45l12-24 12 24" fill="none" stroke="#b9824d" stroke-width="5" stroke-linecap="round"/>
  <path d="M29 18h21v5H29z" fill="#c49a5a"/>
  <circle cx="50" cy="21" r="6" fill="#59646f"/>
</svg>
```

Create `src/assets/upgrade-golden-bait-jar.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="황금 미끼 항아리">
  <rect width="64" height="64" rx="8" fill="#3b3226"/>
  <path d="M23 18h18l4 8-3 24H22l-3-24z" fill="#d6a642"/>
  <path d="M24 15h16v7H24z" fill="#f0ce6a"/>
  <path d="M27 35c4-4 8-4 12 0-1 6-11 6-12 0z" fill="#7a4b2a"/>
</svg>
```

Create `src/assets/upgrade-deep-mud-bog.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="깊은 진흙 수렁">
  <rect width="64" height="64" rx="8" fill="#263a35"/>
  <path d="M10 42c9-8 16 4 24-2s13-5 20 2v10H10z" fill="#5a4a32"/>
  <path d="M16 32c6-4 12 3 18 0s10-3 14 2" fill="none" stroke="#8b6f45" stroke-width="5" stroke-linecap="round"/>
  <circle cx="26" cy="45" r="3" fill="#2d2419"/>
  <circle cx="42" cy="47" r="2" fill="#2d2419"/>
</svg>
```

Create `src/assets/upgrade-blacksmith-contract.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="대장장이 계약서">
  <rect width="64" height="64" rx="8" fill="#2d2d35"/>
  <path d="M19 12h26v40H19z" fill="#e0d2b0"/>
  <path d="M24 22h16M24 29h16M24 36h10" stroke="#6d5840" stroke-width="3" stroke-linecap="round"/>
  <path d="M40 43l8 8" stroke="#b4553c" stroke-width="4" stroke-linecap="round"/>
  <circle cx="39" cy="42" r="4" fill="#b4553c"/>
</svg>
```

- [ ] **Step 4: Extend asset manifest**

In `src/assets/assetManifest.ts`, extend `AssetKey`:

```ts
  | "upgradeBattleAxe"
  | "upgradeReinforcedCatapult"
  | "upgradeGoldenBaitJar"
  | "upgradeDeepMudBog"
  | "upgradeBlacksmithContract"
```

Add definitions after `upgradeMudTrap`:

```ts
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
```

- [ ] **Step 5: Extend upgrade presentation mapping**

In `src/ui/upgradePresentation.ts`, update the map:

```ts
export const UPGRADE_PRESENTATION: Record<UpgradeId, { iconAssetKey: AssetKey }> = {
  club: { iconAssetKey: "upgradeClub" },
  catapult: { iconAssetKey: "upgradeCatapult" },
  baitBag: { iconAssetKey: "upgradeBaitBag" },
  mudTrap: { iconAssetKey: "upgradeMudTrap" },
  battleAxe: { iconAssetKey: "upgradeBattleAxe" },
  reinforcedCatapult: { iconAssetKey: "upgradeReinforcedCatapult" },
  goldenBaitJar: { iconAssetKey: "upgradeGoldenBaitJar" },
  deepMudBog: { iconAssetKey: "upgradeDeepMudBog" },
  blacksmithContract: { iconAssetKey: "upgradeBlacksmithContract" },
};
```

- [ ] **Step 6: Run UI mapping tests to verify they pass**

Run:

```powershell
npm.cmd test -- tests/unit/asset-manifest.test.ts tests/unit/upgrade-presentation.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 5**

Run:

```powershell
git add src/assets/assetManifest.ts src/assets/upgrade-battle-axe.svg src/assets/upgrade-reinforced-catapult.svg src/assets/upgrade-golden-bait-jar.svg src/assets/upgrade-deep-mud-bog.svg src/assets/upgrade-blacksmith-contract.svg src/ui/upgradePresentation.ts tests/unit/asset-manifest.test.ts tests/unit/upgrade-presentation.test.ts
git commit -m "feat: add high-tier upgrade presentation assets"
```

---

### Task 6: Shop And HUD Rendering

**Files:**
- Modify: `tests/unit/shop.test.ts`
- Modify: `src/ui/hud.ts`
- Modify: `src/ui/shop.ts` only if the tests expose a real defect.

- [ ] **Step 1: Write shop row tests**

Append to `tests/unit/shop.test.ts`:

```ts
  it("상위 업그레이드 5종을 기존 4종 뒤에 표시한다", () => {
    const rows = createShopRowViewModels(createInitialRuntimeState());
    expect(rows.map((row) => row.upgradeId)).toEqual([
      "club",
      "catapult",
      "baitBag",
      "mudTrap",
      "battleAxe",
      "reinforcedCatapult",
      "goldenBaitJar",
      "deepMudBog",
      "blacksmithContract",
    ]);
  });

  it("보강 투석대는 투석기 0레벨에서도 구매 가능 상태를 비용으로만 판단한다", () => {
    const ready = createInitialRuntimeState();
    const rows = createShopRowViewModels({
      ...ready,
      game: { ...ready.game, coins: 420 },
    });
    expect(rows.find((row) => row.upgradeId === "reinforcedCatapult")).toMatchObject({
      inputState: "buyable",
      activationBehavior: "purchase",
      ariaDisabled: false,
    });
  });
```

- [ ] **Step 2: Run shop tests**

Run:

```powershell
npm.cmd test -- tests/unit/shop.test.ts
```

Expected: PASS after Tasks 1, 2, and 5. If it fails, keep fixes inside `src/ui/shop.ts` and preserve existing accessibility behavior.

- [ ] **Step 3: Update HUD formulas**

In `src/ui/hud.ts`, update imports:

```ts
import {
  calculateCatapultDamage,
  calculateClickDamage,
  calculateFinalDamage,
  calculateGoblinLevel,
  calculateGoblinMaxHp,
  calculateUpgradeCost,
} from "../domain/progression";
```

Replace the status panel damage calculation with separate base and final direct damage values:

```ts
  const baseClickDamage = calculateClickDamage(game.upgrades.club, game.upgrades.battleAxe);
  const clickDamage = calculateFinalDamage(baseClickDamage, game.upgrades.blacksmithContract);
  const catapultDamage =
    game.upgrades.catapult > 0
      ? calculateFinalDamage(
          calculateCatapultDamage(baseClickDamage, game.upgrades.catapult, game.upgrades.reinforcedCatapult),
          game.upgrades.blacksmithContract,
        )
      : 0;
```

The HUD displays final direct click damage in `클릭 피해 ${clickDamage}`. Catapult damage must use `baseClickDamage` as its input and apply `calculateFinalDamage` exactly once, so `blacksmithContract` is not double-counted.

- [ ] **Step 4: Run focused unit tests and build**

Run:

```powershell
npm.cmd test -- tests/unit/shop.test.ts tests/unit/upgrade-presentation.test.ts
npm.cmd run build
```

Expected: both commands PASS.

- [ ] **Step 5: Commit Task 6**

Run:

```powershell
git add src/ui/hud.ts src/ui/shop.ts tests/unit/shop.test.ts
git commit -m "feat: render high-tier shop rows"
```

---

### Task 7: Balance Simulation And Verification Gates

**Files:**
- Modify: `src/test/balanceSimulator.ts`
- Modify: `tests/unit/balance-simulation.test.ts`

- [ ] **Step 1: Write balance tests for 10-minute protection**

Update imports in `tests/unit/balance-simulation.test.ts`:

```ts
import { calculateUpgradeCost } from "../../src/domain/progression";
import {
  simulateActiveBaseline,
  simulateAutoOnlyBaseline,
  simulateHighTierTargetBaseline,
} from "../../src/test/balanceSimulator";
```

Append:

```ts
  it("10분 active baseline은 상위 업그레이드를 구매 가능 상태로 열지 않는다", () => {
    const result = simulateActiveBaseline(10 * 60 * 1000);
    expect(result.upgrades.battleAxe).toBe(0);
    expect(result.upgrades.reinforcedCatapult).toBe(0);
    expect(result.upgrades.goldenBaitJar).toBe(0);
    expect(result.upgrades.deepMudBog).toBe(0);
    expect(result.upgrades.blacksmithContract).toBe(0);
    expect(result.coins).toBeLessThan(calculateUpgradeCost("battleAxe", 0));
    expect(result.firstHighTierAffordableAtMs).toBeNull();
    expect(result.maxAffordableHighTierCount).toBe(0);
  });

  it("상위 목표 baseline은 첫 전투 도끼 구매 시점을 기록한다", () => {
    const result = simulateHighTierTargetBaseline(18 * 60 * 1000);
    expect(result.firstBattleAxePurchaseAtMs).not.toBeNull();
    expect(result.firstBattleAxePurchaseAtMs).toBeGreaterThanOrEqual(12 * 60 * 1000);
    expect(result.firstBattleAxePurchaseAtMs).toBeLessThanOrEqual(18 * 60 * 1000);
  });
```

- [ ] **Step 2: Run balance tests to verify current gap**

Run:

```powershell
npm.cmd test -- tests/unit/balance-simulation.test.ts
```

Expected: FAIL because `simulateHighTierTargetBaseline` does not exist. After it exists, this task may also fail if the current `battleAxe` cost 180 cannot satisfy the 12~18 minute gate under the chosen target strategy. That failure is a spec-tuning signal, not a reason to silently change unrelated systems.

- [ ] **Step 3: Extend balance result type**

In `src/test/balanceSimulator.ts`, update imports:

```ts
import { calculateUpgradeCost } from "../domain/progression";
```

Then update the result type:

```ts
export type BalanceSimulationResult = GameState & {
  totalPurchases: number;
  uniquePurchasedUpgradeCount: number;
  firstBattleAxePurchaseAtMs: number | null;
  firstHighTierAffordableAtMs: number | null;
  maxAffordableHighTierCount: number;
};
```

- [ ] **Step 4: Add high-tier target simulation**

Add:

```ts
export function simulateHighTierTargetBaseline(durationMs: number): BalanceSimulationResult {
  return simulate(durationMs, {
    clickIntervalMs: Math.max(DIRECT_ATTACK_MIN_INTERVAL_MS, 400),
    allowPurchases: true,
    purchaseOrder: ["club", "club", "catapult", "club", "baitBag", "club", "mudTrap"],
    targetUpgradeAfterMs: { upgradeId: "battleAxe", afterMs: 5 * 60 * 1000 },
  });
}
```

Update the `simulate` options type:

```ts
    targetUpgradeAfterMs?: { upgradeId: UpgradeId; afterMs: number };
```

Track first purchase:

```ts
  let firstBattleAxePurchaseAtMs: number | null = null;
  let firstHighTierAffordableAtMs: number | null = null;
  let maxAffordableHighTierCount = 0;
```

Add a high-tier ID list near `simulate`:

```ts
const HIGH_TIER_UPGRADE_IDS: UpgradeId[] = [
  "battleAxe",
  "reinforcedCatapult",
  "goldenBaitJar",
  "deepMudBog",
  "blacksmithContract",
];
```

At the start of each non-transition simulation tick, before purchases are attempted, record high-tier affordability:

```ts
    const affordableHighTierCount = HIGH_TIER_UPGRADE_IDS.filter(
      (upgradeId) => state.coins >= calculateUpgradeCost(upgradeId, state.upgrades[upgradeId]),
    ).length;
    maxAffordableHighTierCount = Math.max(maxAffordableHighTierCount, affordableHighTierCount);
    if (affordableHighTierCount > 0 && firstHighTierAffordableAtMs === null) {
      firstHighTierAffordableAtMs = nowMs;
    }
```

Replace purchase candidate selection:

```ts
      const purchaseCandidates =
        options.targetUpgradeAfterMs !== undefined && nowMs >= options.targetUpgradeAfterMs.afterMs
          ? [options.targetUpgradeAfterMs.upgradeId]
          : [...options.purchaseOrder, ...UPGRADE_ORDER];
```

Inside successful purchase:

```ts
          if (upgradeId === "battleAxe" && firstBattleAxePurchaseAtMs === null) {
            firstBattleAxePurchaseAtMs = nowMs;
          }
```

Return:

```ts
  return {
    ...state,
    totalPurchases,
    uniquePurchasedUpgradeCount: purchasedUpgradeIds.size,
    firstBattleAxePurchaseAtMs,
    firstHighTierAffordableAtMs,
    maxAffordableHighTierCount,
  };
```

- [ ] **Step 5: Run balance tests and handle the balance gate**

Run:

```powershell
npm.cmd test -- tests/unit/balance-simulation.test.ts
```

Expected: one of these outcomes:

- PASS: continue.
- FAIL because `firstBattleAxePurchaseAtMs` is earlier than 12 minutes or later than 18 minutes: stop feature implementation, report the exact first purchase time, add a `스펙 확인 필요 항목` entry in this plan, and ask for a separate balance-tuning decision.
- FAIL because `firstHighTierAffordableAtMs` is not `null` or `maxAffordableHighTierCount` is greater than 0 in the 10-minute active baseline: stop feature implementation, report the first affordability timestamp, add a `스펙 확인 필요 항목` entry in this plan, and ask for a separate balance-tuning decision.

- [ ] **Step 6: Commit Task 7 only after the gate passes**

Run:

```powershell
git add src/test/balanceSimulator.ts tests/unit/balance-simulation.test.ts
git commit -m "test: gate high-tier shop balance timing"
```

---

### Task 8: Browser Smoke Coverage

**Files:**
- Modify: `tests/e2e/smoke.spec.ts`

- [ ] **Step 1: Add E2E coverage for 9 shop rows and save restore**

Append to `tests/e2e/smoke.spec.ts`:

```ts
test("상점은 상위 업그레이드 5종을 표시하고 저장 복원한다", async ({ page }) => {
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => window.__goblinTest?.getRuntimeSnapshot().mode)).toBe("ready");

  await page.evaluate(() => {
    const harness = window.__goblinTest;
    const state = harness?.getRuntimeSnapshot();
    if (!harness || state?.mode !== "ready") {
      throw new Error("test harness ready state is required");
    }
    harness.setRuntimeState({
      ...state,
      game: {
        ...state.game,
        coins: 9999,
        upgrades: {
          ...state.game.upgrades,
          battleAxe: 0,
          reinforcedCatapult: 0,
          goldenBaitJar: 0,
          deepMudBog: 0,
          blacksmithContract: 0,
        },
      },
    });
  });

  const shopToggle = page.getByRole("button", { name: /상점 열기/ });
  if (await shopToggle.isVisible()) {
    await shopToggle.click();
  }

  await expect(page.getByRole("button", { name: "날 선 전투 도끼" })).toBeVisible();
  await expect(page.getByRole("button", { name: "보강 투석대" })).toBeVisible();
  await expect(page.getByRole("button", { name: "황금 미끼 항아리" })).toBeVisible();
  await expect(page.getByRole("button", { name: "깊은 진흙 수렁" })).toBeVisible();
  await expect(page.getByRole("button", { name: "대장장이 계약서" })).toBeVisible();

  await page.getByRole("button", { name: "날 선 전투 도끼" }).click();
  await expect(page.getByText("레벨 1 · 비용 342")).toBeVisible();

  await page.reload();
  const shopToggleAfterReload = page.getByRole("button", { name: /상점 열기/ });
  if (await shopToggleAfterReload.isVisible()) {
    await shopToggleAfterReload.click();
  }
  await expect(page.getByText("레벨 1 · 비용 342")).toBeVisible();
});
```

- [ ] **Step 2: Run E2E smoke test**

Run:

```powershell
npm.cmd run build
npm.cmd run test:e2e -- tests/e2e/smoke.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Commit Task 8**

Run:

```powershell
git add tests/e2e/smoke.spec.ts
git commit -m "test: cover high-tier shop smoke flow"
```

---

### Task 9: Final Verification And Graph Update

**Files:**
- No source edits unless verification exposes a defect.
- Generated graph files may change under `graphify-out/`.

- [ ] **Step 1: Run full unit test suite**

Run:

```powershell
npm.cmd test
```

Expected: PASS.

- [ ] **Step 2: Run production build**

Run:

```powershell
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 3: Run Playwright E2E**

Run:

```powershell
npm.cmd run test:e2e
```

Expected: PASS.

- [ ] **Step 4: Update graphify graph after code changes**

Run:

```powershell
graphify update .
```

Expected: command completes and refreshes `graphify-out/`.

- [ ] **Step 5: Review final diff**

Run:

```powershell
git status --short
git diff -- src tests docs/superpowers/plans/2026-06-18-high-tier-shop-items-implementation-plan.md
```

Expected: only files directly related to high-tier shop items and expected graph output are changed. Existing unrelated user changes remain unreverted.

- [ ] **Step 6: Final commit**

Run:

```powershell
git add src tests docs/superpowers/plans/2026-06-18-high-tier-shop-items-implementation-plan.md graphify-out
git commit -m "feat: implement high-tier shop items"
```

## Self-Review

Spec coverage:

- 신규 업그레이드 ID, 이름, 비용, 성장률: Task 1.
- 피해, 보상, 진흙 함정, 최종 피해 공식: Task 1 and Task 4.
- 저장 데이터와 누락 키 정규화: Task 2.
- 상점 순서, 구매 가능 개수, 추천 표시 제외: Task 3 and Task 6.
- 아이콘 에셋과 UI 매핑: Task 5.
- 10분 baseline 보호와 상위 목표 도달 시점: Task 7. 10분 보호는 최종 코인만 보지 않고 구간 내 `firstHighTierAffordableAtMs`와 `maxAffordableHighTierCount`로 검증한다.
- 브라우저 표시와 저장 복원: Task 8.
- 전체 검증과 graphify 갱신: Task 9.

Placeholder scan:

- 이 계획은 실행자가 채워 넣을 빈 섹션 없이 구체적인 파일, 테스트, 명령, 기대 결과를 제공한다.

Type consistency:

- 신규 업그레이드 키는 `battleAxe`, `reinforcedCatapult`, `goldenBaitJar`, `deepMudBog`, `blacksmithContract`로 통일한다.
- 신규 에셋 키는 `upgradeBattleAxe`, `upgradeReinforcedCatapult`, `upgradeGoldenBaitJar`, `upgradeDeepMudBog`, `upgradeBlacksmithContract`로 통일한다.
