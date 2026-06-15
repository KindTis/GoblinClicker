# 고블린 클릭커 MVP 구현 문서

> **구현 에이전트 지침:** 이 문서는 작업별 체크박스(`- [ ]`)로 진행 상태를 추적한다. 구현은 `superpowers:subagent-driven-development` 또는 `superpowers:executing-plans` 흐름으로 작업 단위별 검증을 거쳐 진행한다.

**목표:** `docs/goblin-clicker-spec.md`의 MVP 범위를 TypeScript, Vite, Phaser, DOM HUD, Vitest, Playwright 기반 웹 게임으로 구현한다.

**아키텍처:** 게임 규칙은 Phaser 장면에서 분리한 순수 TypeScript 모듈에 둔다. Phaser는 스프라이트, 애니메이션, 포인터 직접 공격 영역, 렌더링 이벤트를 담당하고, DOM HUD는 상태 표시, 상점, 모달, 접근성 상태, 키보드 직접 공격 게이트를 담당한다. 저장 시스템은 `GameState`만 진행 계산에 사용하고 `SaveData` 메타데이터는 저장 포맷 판단과 디버깅에만 사용한다.

**기술 스택:** TypeScript, Vite, Phaser 4.x, HTML/CSS DOM overlay, Vitest, Playwright, `localStorage`

**게임 플레이 구현 흐름:** 플레이어 직접 공격 입력을 `RuntimeFrameInput.directAttackRequested`로 모으고, 순수 런타임이 피해, 처치, 재화 지급, 다음 고블린 생성, 저장 효과를 한 프레임 안에서 확정한다. 앱 조립부는 그 결과를 DOM HUD, Phaser 장면, 저장 시스템에 순서대로 반영한다.

---

## 1. 기준 문서

- 기준 스펙: `docs/goblin-clicker-spec.md`
- 구현 대상: MVP 완료 기준까지
- 구현 제외: MVP 이후 확장 후보, 사운드 필수 구현, 저장 시각 표시 UI, 정규화 알림 UI, 저장 진단 화면, 복구 상세 리포트, 오프라인 보상, 다중 저장 슬롯, 구매 배수, 프레스티지, 보스, 스킨 시스템

## 2. 구현 원칙

- 직접 클릭이 가장 빠른 진행 방법이어야 한다.
- 자동 피해는 보조 수단으로만 설계한다.
- `GameState`에는 저장 가능한 상태만 둔다.
- 고블린 레벨과 최대 체력은 `defeatedCount`에서 파생한다.
- UI 파생 상태는 저장하지 않는다.
- 로드 오류, 저장 실패, 저장소 접근 실패는 서로 다른 상태로 처리한다.
- 런타임 진행 모드와 저장 가능성은 서로 다른 축으로 분리한다.
- 단위 테스트는 순수 함수와 상태 전이를 먼저 검증한다.
- 브라우저 테스트는 실제 사용자 흐름과 모바일 반응형 위험만 검증한다.

## 3. 목표 파일 구조

```text
.
|-- package.json
|-- index.html
|-- vite.config.ts
|-- tsconfig.json
|-- vitest.config.ts
|-- playwright.config.ts
|-- src/
|   |-- main.ts
|   |-- styles.css
|   |-- assets/
|   |   |-- assetManifest.ts
|   |   |-- README.md
|   |   |-- goblin-idle.svg
|   |   |-- goblin-hit.svg
|   |   |-- goblin-defeat.svg
|   |   |-- hit-spark.svg
|   |   |-- defeat-dust.svg
|   |   |-- coin.svg
|   |   |-- upgrade-club.svg
|   |   |-- upgrade-catapult.svg
|   |   |-- upgrade-bait-bag.svg
|   |   |-- upgrade-mud-trap.svg
|   |   |-- background.svg
|   |-- domain/
|   |   |-- constants.ts
|   |   |-- types.ts
|   |   |-- progression.ts
|   |   |-- upgrades.ts
|   |   |-- combat.ts
|   |   |-- saveTypes.ts
|   |   |-- save.ts
|   |   |-- runtime.ts
|   |-- app/
|   |   |-- autoSaveScheduler.ts
|   |   |-- loadErrorActions.ts
|   |   |-- loadErrorState.ts
|   |-- game/
|   |   |-- GoblinScene.ts
|   |   |-- sceneEvents.ts
|   |-- ui/
|   |   |-- hud.ts
|   |   |-- shop.ts
|   |   |-- upgradePresentation.ts
|   |   |-- modal.ts
|   |   |-- focus.ts
|   |-- test/
|   |   |-- fixtures.ts
|   |   |-- balanceSimulator.ts
|   |   |-- e2eHarness.ts
|-- tests/
|   |-- unit/
|   |   |-- progression.test.ts
|   |   |-- constants.test.ts
|   |   |-- upgrades.test.ts
|   |   |-- combat.test.ts
|   |   |-- balance-simulation.test.ts
|   |   |-- save.test.ts
|   |   |-- auto-save-scheduler.test.ts
|   |   |-- app-effects.test.ts
|   |   |-- load-error-actions.test.ts
|   |   |-- load-error-state.test.ts
|   |   |-- asset-manifest.test.ts
|   |   |-- upgrade-presentation.test.ts
|   |-- e2e/
|   |   |-- smoke.spec.ts
|   |   |-- mobile-shop.spec.ts
```

### 파일 책임

| 파일 | 책임 |
| --- | --- |
| `src/main.ts` | Phaser, DOM UI, 저장 adapter, sceneReady 입력 게이트, 자동 저장 스케줄러 helper, 런타임 결과 처리 순서를 조립 |
| `src/domain/types.ts` | `UpgradeId`, `GameState`, `SaveData`, 런타임 상태 타입 정의 |
| `src/domain/constants.ts` | 밸런스 상수, 업그레이드 정의, 저장 키 |
| `src/domain/progression.ts` | 레벨, 체력, 보상, 피해량, 비용 계산 |
| `src/domain/upgrades.ts` | 구매 가능 여부, 구매 성공/실패 결과, 구매 후 상태 계산 |
| `src/domain/combat.ts` | 직접 공격, 투석기 쿨다운, 처치 처리, 전환 시작 조건 |
| `src/domain/saveTypes.ts` | 저장 로드 실패 reason과 로드 오류 화면 reason 타입. 어떤 앱/UI/domain 구현 파일도 import하지 않음 |
| `src/domain/save.ts` | 저장 직렬화, 로드 정규화, 마이그레이션 실패, 저장소 오류를 `LoadResult.reason`으로 반환 |
| `src/domain/runtime.ts` | 메모리 상태, 프레임 처리, 저장 트리거 병합, `DEFEAT_TRANSITION_MS` 전환 상태, 적 전용 렌더 selector |
| `src/app/autoSaveScheduler.ts` | `AUTO_SAVE_INTERVAL_MS` 기반 자동 저장 due 계산 기준 시각을 관리하는 앱 조립부용 순수 helper |
| `src/app/loadErrorActions.ts` | 로드 오류 모달의 다시 시도, 새 게임 시작, 취소 트랜잭션 |
| `src/app/loadErrorState.ts` | `LoadErrorReason`을 `LoadErrorRuntimeState`와 사용자 표시 메시지로 변환 |
| `src/assets/assetManifest.ts` | 시각 에셋 로드 키, 파일 경로, 용도, 권장 기준 크기, 앵커 기준 |
| `src/game/GoblinScene.ts` | Phaser 장면, `EnemyRenderState` 렌더 캐시, 고블린 스프라이트 상태, 피격/처치 연출, 피해 숫자, 포인터 직접 공격 영역 |
| `src/game/sceneEvents.ts` | Phaser와 DOM HUD 사이의 이벤트 타입 |
| `src/ui/hud.ts` | 처치 수, 재화, 고블린 레벨, HP 숫자, 즉시/잔상 체력 바, 투석기 상태, 저장 경고 표시 |
| `src/ui/shop.ts` | 상점 패널/하단 시트, 업그레이드 행, 구매 버튼 상태 |
| `src/ui/upgradePresentation.ts` | 업그레이드 ID와 UI 아이콘 에셋 키의 표현 계층 매핑 |
| `src/ui/modal.ts` | 저장 초기화 확인 모달, 로드 오류 차단 모달 |
| `src/ui/focus.ts` | 포커스 복구, playable + sceneReady 상태의 Space 키 직접 공격 게이트, Space/Enter/Escape UI 입력 정책 |
| `src/test/e2eHarness.ts` | 명시적 테스트 모드에서만 `window.__goblinTest`를 등록하는 E2E 상태 구성 하네스, 런타임 상태와 테스트 저장 데이터 불변식 검사 |
| `src/styles.css` | 반응형 레이아웃, 모바일 상점 시트, 접근성 상태 스타일 |

## 4. 핵심 타입 계약

구현자는 다음 타입 이름과 필드명을 유지한다. 테스트와 UI는 이 계약을 기준으로 작성한다.

```ts
export type UpgradeId = "club" | "catapult" | "baitBag" | "mudTrap";

export type UpgradeDefinition = {
  id: UpgradeId;
  name: string;
  baseCost: number;
  growthRate: number;
  description: string;
};

export type GameState = {
  goblinHp: number;
  mudTrapArmedLevel: number;
  catapultCooldownRemainingMs: number;
  defeatedCount: number;
  coins: number;
  upgrades: Record<UpgradeId, number>;
};

export type SaveData = {
  saveVersion: 1;
  state: GameState;
  savedAt?: number;
};

import type { LoadErrorReason } from "./saveTypes";

export type RuntimeMode =
  | "loading"
  | "ready"
  | "defeatTransition"
  | "loadError";

export type PersistenceState =
  | { kind: "available"; saveWarning: "none" | "unsaved" }
  | { kind: "unavailable"; saveWarning: "storageUnavailable" };

export type RuntimeClock = {
  lastDirectAttackAtMs: number | null;
  lastVisibleTickAtMs: number | null;
};

export type LoadingRuntimeState = {
  mode: "loading";
};

export type LoadErrorRuntimeState = {
  mode: "loadError";
  reason: LoadErrorReason;
  message: string;
};

export type ReadyRuntimeState = {
  mode: "ready";
  game: GameState;
  persistence: PersistenceState;
  runtimeClock: RuntimeClock;
};

export type DefeatTransitionRuntimeState = {
  mode: "defeatTransition";
  game: GameState;
  persistence: PersistenceState;
  runtimeClock: RuntimeClock;
  defeatedSnapshot: {
    enemyInstanceId: number;
    hp: 0;
    startedAtMs: number;
  };
};

export type PlayableRuntimeState =
  | ReadyRuntimeState
  | DefeatTransitionRuntimeState;

export type RuntimeState =
  | LoadingRuntimeState
  | LoadErrorRuntimeState
  | ReadyRuntimeState
  | DefeatTransitionRuntimeState;

export type EnemyRenderState = {
  enemyInstanceId: number;
  goblinLevel: number;
  hp: number;
  maxHp: number;
  visualState: "idle" | "defeated";
};

export type SaveEffectResult =
  | "saved"
  | "failed"
  | "skippedStorageUnavailable";

export function selectEnemyRenderState(
  state: PlayableRuntimeState
): EnemyRenderState;
```

`game`, `persistence`, `runtimeClock`은 `ReadyRuntimeState`와 `DefeatTransitionRuntimeState`에만 존재한다. `loading`과 `loadError`는 HUD 전투 화면, 구매, 저장 효과, 자동 저장, 프레임 진행의 대상이 아니다. `mode === "loadError"`는 저장소에는 접근했지만 저장 데이터를 복원할 수 없는 차단 상태이며, `reason`, 사용자 표시용 `message`, 로드 오류 복구 액션만 가진다.

`SaveData.savedAt`은 기존/테스트/미래 저장 데이터 허용을 위한 선택 메타데이터다. MVP 저장 경로는 `savedAt`을 생성하지 않으며, 저장 시각 표시 UI도 만들지 않는다.

`LoadErrorRuntimeState.reason`은 `src/domain/saveTypes.ts`가 export하는 `LoadErrorReason`을 type-only로 참조한다. 테스트와 상태 분기 로직은 `LoadErrorRuntimeState.message`가 아니라 `reason`을 기준으로 한다. `message`는 사용자 표시용이며, 문구 변경이 테스트를 깨뜨리면 안 된다. `message`는 `src/app/loadErrorState.ts`의 `formatLoadErrorMessage(reason)`에서 생성한다. `parseFailed`는 JSON 파싱 실패, `migrationFailed`는 `saveVersion` 누락 또는 지원하지 않는 버전으로 인한 복원 실패, `readFailed`는 로드 오류 모달의 `다시 시도` 중 저장소 읽기 자체가 실패한 경우처럼 기존 로드 오류 상태를 유지해야 하는 실패, `deleteFailed`는 로드 오류 모달의 `새 게임 시작`에서 `deleteSave`가 실패한 경우에만 사용한다.

`persistence.kind === "unavailable"`인 저장소 접근 실패 세션은 `LoadErrorRuntimeState`가 아니라 `ReadyRuntimeState` 또는 `DefeatTransitionRuntimeState`와 `persistence.kind === "unavailable"` 조합으로 표현한다. 저장소 접근 실패 세션은 플레이 불가 모드가 아니며, 전투와 구매 진행은 일반 세션과 같은 런타임 모드 규칙을 따른다.

`runtimeClock`은 `DIRECT_ATTACK_MIN_INTERVAL_MS` 직접 공격 제한과 투석기 visible delta 계산을 위한 비저장 런타임 상태다. `runtimeClock`, `defeatedSnapshot.startedAtMs`, `defeatedSnapshot.enemyInstanceId`는 `SaveData`에 직렬화하지 않으며, 저장 복원, 첫 실행, 새 게임 시작 시 플레이 가능한 새 세션 기준으로 `{ lastDirectAttackAtMs: null, lastVisibleTickAtMs: null }`에서 시작한다. `defeatedSnapshot`은 `DefeatTransitionRuntimeState`에만 필수로 존재한다.

`EnemyRenderState.enemyInstanceId`는 저장 필드가 아니라 렌더/런타임 식별자다. `ready` 상태의 현재 고블린 `enemyInstanceId`는 `state.game.defeatedCount`에서 파생한다. 처치 순간 `defeatedSnapshot.enemyInstanceId`에는 처치 전 `defeatedCount`를 저장해 처치된 고블린 인스턴스를 고정한다. 따라서 `defeatTransition` 중에는 `defeatedSnapshot.enemyInstanceId === state.game.defeatedCount - 1`이어야 한다. 전환 종료 후 다음 고블린은 증가된 `state.game.defeatedCount`를 새 `enemyInstanceId`로 사용한다. `defeatedSnapshot`에는 파생 가능한 `goblinLevel`과 `maxHp`를 저장하지 않는다.

`selectEnemyRenderState(state)`는 적 전용 시각 렌더의 안정 상태 selector다. `state.mode === "ready"`이면 `state.game.defeatedCount`에서 `enemyInstanceId`, 현재 고블린 레벨, 최대 체력을 파생하고 `state.game.goblinHp`, `visualState: "idle"`을 사용한다. `state.mode === "defeatTransition"`이면 `state.game`이 아니라 `state.defeatedSnapshot.enemyInstanceId`와 `hp: 0`을 사용한다. 전환 중 `goblinLevel`은 `calculateGoblinLevel(defeatedSnapshot.enemyInstanceId)`로 계산하고, `maxHp`는 그 결과 레벨을 `calculateGoblinMaxHp(defeatedGoblinLevel)`에 넘겨 계산한다. 전환 중 `state.game`은 이미 다음 고블린의 저장 가능한 진행 상태지만, 전환 종료 전 적 전용 시각 렌더에는 사용하지 않는다. `"hit"`는 `RuntimeState`에서 파생 가능한 상태가 아니므로 `EnemyRenderState`에 넣지 않는다.

## 5. 밸런스 데이터 계약

`src/domain/constants.ts`에 아래 데이터를 한 곳에 둔다.

```ts
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

export const UPGRADE_ORDER: UpgradeId[] = [
  "club",
  "catapult",
  "baitBag",
  "mudTrap",
];

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
```

현재 MVP 시간 값은 `constants.ts`가 소유한다. validator, 단위 테스트, 밸런스 시뮬레이션, E2E 하네스는 `CATAPULT_COOLDOWN_MS`, `AUTO_SAVE_INTERVAL_MS`, `DEFEAT_TRANSITION_MS`, `DIRECT_ATTACK_MIN_INTERVAL_MS`, `DAMAGE_NUMBER_LIFETIME_MS`, `HP_GHOST_BAR_DELAY_MS` 값을 직접 숫자로 복제하지 않고 import해 사용한다. 스펙 예시 값 자체를 검증하는 테스트는 `tests/unit/constants.test.ts`의 상수 정의 테스트로 제한한다.

## 6. 구현 작업

### Task 1: 프로젝트 골격 생성

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `src/main.ts`
- Create: `src/styles.css`

- [ ] **Step 1: Vite TypeScript 프로젝트 파일을 만든다**

`package.json`은 다음 스크립트를 제공한다.

```json
{
  "name": "goblin-clicker",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "dev:test": "vite --mode test --host 127.0.0.1",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "phaser": "^4.1.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.54.0",
    "typescript": "^5.8.0",
    "vite": "^7.0.0",
    "vitest": "^3.2.0"
  }
}
```

- [ ] **Step 2: 앱 진입 HTML을 만든다**

`index.html`은 Phaser 캔버스와 DOM HUD 루트를 분리한다.

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>고블린 클릭커</title>
  </head>
  <body>
    <main id="app" class="app-shell">
      <section id="game-root" class="game-root" tabindex="0" aria-label="고블린 전투 화면">
        <div id="phaser-root" class="phaser-root"></div>
        <div id="hud-root" class="hud-root"></div>
      </section>
    </main>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 3: 설정 파일을 만든다**

`tsconfig.json`은 `strict`를 켠다. `vitest.config.ts`는 `environment: "jsdom"`을 사용한다. `playwright.config.ts`는 `webServer.command = "npm run dev:test"`로 테스트 모드 로컬 서버를 띄운다. 일반 개발 서버에서는 E2E 테스트 하네스를 노출하지 않는다.

```ts
webServer: {
  command: "npm run dev:test",
  url: "http://127.0.0.1:5173",
  reuseExistingServer: !process.env.CI,
}
```

`npm run dev:test`의 실제 실행 내용은 `vite --mode test --host 127.0.0.1`이다. E2E 테스트가 필요한 테스트 하네스 노출은 이 스크립트를 통해서만 보장한다.

- [ ] **Step 4: 설치와 빈 앱 빌드를 검증한다**

Run:

```bash
npm install
npm run build
```

Expected:

```text
0 TypeScript errors
vite build completed
```

### Task 2: 도메인 타입, 상수, 진행 공식

**Files:**
- Create: `src/domain/types.ts`
- Create: `src/domain/constants.ts`
- Create: `src/domain/progression.ts`
- Create: `src/test/fixtures.ts`
- Test: `tests/unit/constants.test.ts`
- Test: `tests/unit/progression.test.ts`

- [ ] **Step 1: 진행 공식 단위 테스트를 작성한다**

`tests/unit/constants.test.ts`는 현재 MVP 상수 값이 스펙 예시와 일치하는지만 검증한다. 다른 도메인, 런타임, UI, 하네스 테스트는 시간 값을 직접 숫자로 복제하지 않고 `constants.ts`의 상수를 import한다.

```ts
import { describe, expect, it } from "vitest";
import {
  calculateClickDamage,
  calculateGoblinLevel,
  calculateGoblinMaxHp,
  calculateKillReward,
  calculateUpgradeCost,
} from "../../src/domain/progression";

describe("progression", () => {
  it("defeatedCount에서 현재 고블린 레벨을 파생한다", () => {
    expect(calculateGoblinLevel(0)).toBe(1);
    expect(calculateGoblinLevel(9)).toBe(10);
  });

  it("스펙의 초기 체력 곡선을 계산한다", () => {
    expect(calculateGoblinMaxHp(1)).toBe(5);
    expect(calculateGoblinMaxHp(2)).toBe(5);
    expect(calculateGoblinMaxHp(3)).toBe(6);
    expect(calculateGoblinMaxHp(5)).toBe(9);
    expect(calculateGoblinMaxHp(10)).toBe(22);
  });

  it("기본 보상과 미끼 주머니 보너스를 합산한다", () => {
    expect(calculateKillReward(1, 0)).toBe(1);
    expect(calculateKillReward(2, 0)).toBe(2);
    expect(calculateKillReward(10, 3)).toBe(10);
  });

  it("구매 전 레벨 기준 업그레이드 비용을 계산한다", () => {
    expect(calculateUpgradeCost("club", 0)).toBe(3);
    expect(calculateUpgradeCost("catapult", 0)).toBe(12);
    expect(calculateUpgradeCost("baitBag", 0)).toBe(20);
    expect(calculateUpgradeCost("mudTrap", 0)).toBe(90);
  });

  it("낡은 몽둥이 레벨로 클릭 피해를 계산한다", () => {
    expect(calculateClickDamage(0)).toBe(1);
    expect(calculateClickDamage(4)).toBe(5);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run:

```bash
npm test -- tests/unit/progression.test.ts
```

Expected:

```text
FAIL tests/unit/progression.test.ts
```

- [ ] **Step 3: 진행 공식을 구현한다**

필수 함수 시그니처는 다음과 같다.

```ts
export function calculateGoblinLevel(defeatedCount: number): number;
export function calculateGoblinMaxHp(goblinLevel: number): number;
export function calculateBaseKillReward(goblinLevel: number): number;
export function calculateKillReward(goblinLevel: number, baitBagLevel: number): number;
export function calculateUpgradeCost(upgradeId: UpgradeId, currentLevel: number): number;
export function calculateClickDamage(clubLevel: number): number;
export function calculateMudTrapMultiplier(armedLevel: number): number;
export function calculateCatapultDamage(clickDamage: number, catapultLevel: number): number;
```

- [ ] **Step 4: 테스트 통과를 확인한다**

Run:

```bash
npm test -- tests/unit/progression.test.ts
```

Expected:

```text
PASS tests/unit/progression.test.ts
```

### Task 3: 업그레이드 구매 규칙

**Files:**
- Create: `src/domain/upgrades.ts`
- Modify: `src/test/fixtures.ts`
- Test: `tests/unit/upgrades.test.ts`

- [ ] **Step 1: 구매 테스트를 작성한다**

검증 대상은 성공 구매, 비용 부족 실패와 부족 재화 수, 첫 투석기 구매, 투석기 추가 구매, 추천 표시 파생, 구매 가능 개수 파생이다.

```ts
import { describe, expect, it } from "vitest";
import { CATAPULT_COOLDOWN_MS } from "../../src/domain/constants";
import { createInitialGameState } from "../../src/test/fixtures";
import {
  countAffordableUpgrades,
  getPurchasePreview,
  isClubRecommended,
  purchaseUpgrade,
} from "../../src/domain/upgrades";

describe("upgrades", () => {
  it("낡은 몽둥이 첫 구매는 재화 3을 차감하고 레벨을 올린다", () => {
    const state = { ...createInitialGameState(), coins: 3 };
    const result = purchaseUpgrade(state, "club");
    expect(result.ok).toBe(true);
    expect(result.state.coins).toBe(0);
    expect(result.state.upgrades.club).toBe(1);
  });

  it("비용 부족 구매는 상태와 저장 사유를 만들지 않는다", () => {
    const state = createInitialGameState();
    const result = purchaseUpgrade(state, "catapult");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("insufficientCoins");
    expect(result.missingCoins).toBe(12);
    expect(result.state).toEqual(state);
    expect(result.shouldSave).toBe(false);
  });

  it("투석기 첫 구매는 상수 쿨다운으로 시작한다", () => {
    const state = { ...createInitialGameState(), coins: 12 };
    const result = purchaseUpgrade(state, "catapult");
    expect(result.ok).toBe(true);
    expect(result.state.catapultCooldownRemainingMs).toBe(CATAPULT_COOLDOWN_MS);
  });

  it("투석기 추가 구매는 기존 쿨다운을 리셋하지 않는다", () => {
    const state = {
      ...createInitialGameState(),
      coins: 18,
      catapultCooldownRemainingMs: 2400,
      upgrades: { club: 0, catapult: 1, baitBag: 0, mudTrap: 0 },
    };
    const result = purchaseUpgrade(state, "catapult");
    expect(result.ok).toBe(true);
    expect(result.state.catapultCooldownRemainingMs).toBe(2400);
  });

  it("낡은 몽둥이 추천은 저장 상태가 아니라 레벨에서 파생된다", () => {
    expect(isClubRecommended(createInitialGameState())).toBe(true);
    const state = {
      ...createInitialGameState(),
      upgrades: { club: 1, catapult: 0, baitBag: 0, mudTrap: 0 },
    };
    expect(isClubRecommended(state)).toBe(false);
  });

  it("구매 가능 개수는 실제 비용 감당 가능성만 센다", () => {
    const state = { ...createInitialGameState(), coins: 2 };
    expect(isClubRecommended(state)).toBe(true);
    expect(countAffordableUpgrades(state)).toBe(0);
    expect(getPurchasePreview(state, "club").missingCoins).toBe(1);
  });
});
```

- [ ] **Step 2: 구매 결과 타입을 구현한다**

```ts
export type UpgradePurchaseResult =
  | { ok: true; state: GameState; shouldSave: true }
  | {
      ok: false;
      reason: "insufficientCoins";
      state: GameState;
      shouldSave: false;
      missingCoins: number;
    };
```

- [ ] **Step 3: 구매 처리 순서를 구현한다**

구매 입력 1회는 한 레벨만 시도한다. `purchaseUpgrade(state: GameState, upgradeId: UpgradeId)`는 인자로 받은 최신 `GameState`, 비용, 업그레이드 레벨만 평가하고 내부 큐를 만들지 않는다. 이 순수 함수는 성공 또는 `insufficientCoins`만 반환하며, `inputBlocked`, `blockedByDefeatTransition`, `loadError`를 알지 않는다. `DEFEAT_TRANSITION_MS` 처치 전환, 로드 오류, 모달 같은 입력 차단은 런타임 또는 앱 조립부의 책임이다.

- [ ] **Step 4: 테스트 통과를 확인한다**

Run:

```bash
npm test -- tests/unit/upgrades.test.ts
```

Expected:

```text
PASS tests/unit/upgrades.test.ts
```

### Task 4: 전투 규칙과 처치 전환

**Files:**
- Create: `src/domain/combat.ts`
- Test: `tests/unit/combat.test.ts`

- [ ] **Step 1: 전투 테스트를 작성한다**

필수 테스트 목록:

- 직접 공격은 `DIRECT_ATTACK_MIN_INTERVAL_MS` 제한을 적용한다.
- 직접 공격 제한은 `RuntimeClock.lastDirectAttackAtMs` 기준으로 검증한다.
- 진흙 함정은 첫 직접 공격에만 적용되고 0으로 소모된다.
- 투석기 자동 공격은 진흙 함정을 소모하지 않는다.
- 같은 프레임에서 직접 공격이 투석기보다 먼저 처리된다.
- 직접 공격으로 처치되면 그 프레임의 투석기는 차감되지 않는다.
- 오버킬은 다음 고블린에게 이월되지 않는다.
- 처치 직후 저장 상태는 다음 고블린 체력으로 확정된다.
- `DEFEAT_TRANSITION_MS` 전환 상태 자체는 `GameState`에 저장되지 않는다.

- [ ] **Step 2: 전투 함수 시그니처를 구현한다**

```ts
export type AttackSource = "direct" | "catapult";

export type AttackResult = {
  state: GameState;
  damage: number;
  killed: boolean;
  shouldSave: boolean;
  startDefeatTransition: boolean;
};

export function applyDirectAttack(
  state: GameState,
  nowMs: number,
  lastDirectAttackAtMs: number | null
): AttackResult & { accepted: boolean; nextLastDirectAttackAtMs: number | null };

export function tickCatapult(
  state: GameState,
  deltaMs: number,
  visibilityState: DocumentVisibilityState
): AttackResult & { nextCooldownMs: number };
```

순수 도메인 함수는 직접 `performance.now()`를 호출하지 않는다. 브라우저 앱 조립부만 `performance.now()`를 읽고, 도메인/런타임 함수에는 호출자가 `nowMs` 또는 계산된 `deltaMs`를 전달한다.

- [ ] **Step 3: 처치 처리를 구현한다**

`resolveKill`은 다음 순서를 유지한다.

```text
1. 처치 전 레벨로 보상을 계산한다.
2. defeatedCount를 1 증가시킨다.
3. 증가한 defeatedCount로 다음 레벨과 최대 체력을 계산한다.
4. goblinHp를 다음 최대 체력으로 둔다.
5. mudTrapArmedLevel을 현재 진흙 함정 레벨로 고정한다.
6. catapultCooldownRemainingMs를 투석기 보유 여부에 따라 `CATAPULT_COOLDOWN_MS` 또는 0으로 둔다.
7. shouldSave를 true로 반환한다.
```

- [ ] **Step 4: 전투 테스트 통과를 확인한다**

Run:

```bash
npm test -- tests/unit/combat.test.ts
```

Expected:

```text
PASS tests/unit/combat.test.ts
```

### Task 5: 밸런스 시뮬레이션 검증

**Files:**
- Create: `src/test/balanceSimulator.ts`
- Test: `tests/unit/balance-simulation.test.ts`

이 Task는 런타임 시스템이 아니라 테스트 전용 회귀 안전망이다. 실제 게임 번들에 포함되어야 하는 모듈로 만들지 않는다. 시뮬레이터는 `src/domain/constants.ts`의 수치와 `progression`, `upgrades`, `combat` 순수 함수만 사용하며, 체력, 보상, 비용, 피해, 구매 규칙 공식을 별도로 복제하지 않는다.

- [ ] **Step 1: 밸런스 시뮬레이션 프로필을 작성한다**

`src/test/balanceSimulator.ts`에 테스트에서만 사용하는 시뮬레이션 헬퍼를 둔다.

필수 프로필:

```text
activeBaseline:
- 총 시뮬레이션 시간: 5분
- 직접 공격 속도: 초당 2.5회
- 처치 전환: `DEFEAT_TRANSITION_MS` 동안 직접 공격, 투석기, 구매 처리 없음
- 구매 정책: 구매 가능하면 고정 상점 순서대로 1레벨씩 구매하되, 낡은 몽둥이를 항상 우선 후보로 평가
- 사용 함수: progression, upgrades, combat의 공개 순수 함수

autoOnlyBaseline:
- 총 시뮬레이션 시간: 5분
- 직접 공격 없음
- 구매 정책은 activeBaseline과 동일하되, 직접 공격 없이 구매 가능한 상태에서만 구매
- 투석기 자동 피해만 진행에 기여
```

시뮬레이터는 밸런스를 영구 보장하는 판정기가 아니다. 밸런스 상수 변경이 스펙의 초반 진행 의도를 크게 벗어날 때 UI와 저장 구현 전에 알려주는 조기 경고 장치다.

- [ ] **Step 2: 초반 온보딩 테스트를 작성한다**

정확한 값으로 고정할 검증:

- 첫 고블린은 5회 직접 공격으로 처치된다.
- 첫 2마리 처치 후 보유 재화는 3이다.
- 두 번째 처치 직후 `낡은 몽둥이`를 구매할 수 있다.

- [ ] **Step 3: 범위형 밸런스 회귀 테스트를 작성한다**

스펙의 범위형 목표를 회귀 안전망으로 검증한다.

- `activeBaseline` 5분 결과가 처치 수 25~40마리 범위에 근접한다.
- `activeBaseline` 5분 안에 2~3종 업그레이드를 경험할 수 있다.
- `autoOnlyBaseline`이 같은 조건의 직접 클릭 중심 진행보다 빠르면 실패한다.

정확한 5분 처치 수를 단일 값으로 하드코딩하지 않는다. 밸런스 수치 변경이 필요하면 먼저 `constants.ts`의 의도와 스펙 목표를 확인하고, 테스트 범위는 스펙의 목표가 바뀔 때만 조정한다.

- [ ] **Step 4: 밸런스 시뮬레이션 테스트 통과를 확인한다**

Run:

```bash
npm test -- tests/unit/balance-simulation.test.ts
```

Expected:

```text
PASS tests/unit/balance-simulation.test.ts
```

최종 MVP 완료 기준에는 별도의 수동 10분 밸런스 검증 기록도 유지한다.

### Task 6: 저장, 복원, 정규화

**Files:**
- Create: `src/domain/saveTypes.ts`
- Create: `src/domain/save.ts`
- Test: `tests/unit/save.test.ts`

- [ ] **Step 1: 저장 reason 타입과 저장 어댑터를 정의한다**

```ts
// src/domain/saveTypes.ts
export type LoadFailureReason =
  | "parseFailed"
  | "migrationFailed"
  | "readFailed";

export type LoadErrorReason =
  | LoadFailureReason
  | "deleteFailed";

// src/domain/save.ts
import type { GameState, SaveData } from "./types";
import type { LoadFailureReason } from "./saveTypes";

export type StorageAdapter = {
  read(key: string): string | null; // may throw
  write(key: string, value: string): void; // may throw
  remove(key: string): void; // may throw
};

export type LoadContext = "boot" | "retryFromLoadError";

export type LoadResult =
  | { kind: "loaded"; save: SaveData }
  | { kind: "created"; save: SaveData; warning: "none" | "unsaved" }
  | { kind: "storageUnavailable"; state: GameState }
  | { kind: "loadError"; reason: LoadFailureReason };
```

`LoadResult.loaded`는 플레이 가능한 canonical `SaveData`만 반환한다. MVP에서는 `wasNormalized`, `normalizationWarnings`, `normalizationReport` 같은 정규화 메타 필드를 결과에 넣지 않는다. 정규화 여부는 런타임 분기, HUD 경고, 저장 트리거, 앱 상태에 영향을 주지 않는다.

- [ ] **Step 2: 저장 테스트를 작성한다**

필수 테스트 목록:

- 저장 키는 `goblin-clicker.save` 하나다.
- 저장 데이터 없음은 시작 상태 생성 후 즉시 저장을 시도한다.
- 첫 저장 실패는 게임 시작과 `unsaved` 경고를 만든다.
- `loadGame(storage, "boot")`에서 `localStorage` 읽기 자체가 실패하면 `storageUnavailable` 결과를 반환한다.
- `loadGame(storage, "retryFromLoadError")`에서 `localStorage` 읽기 자체가 실패하면 `loadError`와 `reason: "readFailed"` 결과를 반환한다.
- `StorageAdapter.read` 예외는 `loadGame`만 잡아 `boot`에서는 `storageUnavailable`, `retryFromLoadError`에서는 `readFailed`로 변환한다.
- `StorageAdapter.write` 예외는 `saveGame`만 잡아 `"failed"`로 변환한다.
- `StorageAdapter.remove` 예외는 `deleteSave`만 잡아 `"failed"`로 변환한다.
- 앱 최초 부팅에서 `localStorage` 읽기 자체가 실패한 경우는 `LoadErrorRuntimeState`가 아니라 `ReadyRuntimeState` + `persistence.kind === "unavailable"`로 시작한다.
- 파싱 실패는 `LoadContext`와 무관하게 `loadError`와 `reason: "parseFailed"`다.
- `saveVersion` 누락, 지원하지 않는 버전, 마이그레이션 실패는 `LoadContext`와 무관하게 `reason: "migrationFailed"`다.
- `loadGame`이 반환할 수 있는 `LoadResult.reason`은 `LoadFailureReason`뿐이며, `deleteFailed`는 반환하지 않는다.
- 저장소 읽기는 성공했지만 저장 키가 없는 경우는 `LoadContext`와 무관하게 시작 상태 생성과 시작 상태 저장 시도로 처리한다.
- save 단위 테스트는 사용자 표시 문자열 `message`를 검증하지 않고 `LoadResult.reason`만 검증한다.
- `normalizeSaveData(saveVersion: 1)`는 다음 의존 순서로 처리한다.
  1. raw와 `state`가 object인지 확인한다. 아니면 `migrationFailed`다.
  2. `defeatedCount`를 0 이상의 안전한 정수로 정규화한다. invalid이면 0이다.
  3. `coins`를 0 이상의 안전한 정수로 정규화한다. invalid이면 0이다.
  4. `upgrades`를 정규화한다. MVP 4종 키만 결과에 보존하고, 누락 키는 0으로 채우며, 알 수 없는 키는 무시한다. 각 레벨이 0 이상의 안전한 정수가 아니면 0이다.
  5. 정규화된 `defeatedCount`로 `currentGoblinLevel`과 `currentGoblinMaxHp`를 파생한다.
  6. `goblinHp`를 `currentGoblinMaxHp` 기준으로 정규화한다. `1..currentGoblinMaxHp`이면 사용하고, 0, invalid, missing이면 `currentGoblinMaxHp`다.
  7. 정규화된 catapult level 기준으로 `catapultCooldownRemainingMs`를 정규화한다. catapult level 0이면 0이다. catapult level 1 이상이면 유효값은 `0..CATAPULT_COOLDOWN_MS`로 clamp하고, invalid이면 `CATAPULT_COOLDOWN_MS`다.
  8. 정규화된 mudTrap level 기준으로 `mudTrapArmedLevel`을 정규화한다. 유효값은 `0..mudTrap level`로 clamp하고, invalid이면 0이다.
  9. `savedAt`이 있으면 finite number일 때만 보존한다.
  10. canonical `SaveData`를 반환한다.
- `saveVersion` 누락 또는 지원하지 않는 버전은 `migrationFailed`로 처리한다.
- `saveVersion === 1`이지만 `state`가 없거나 object가 아니면 unknown format으로 보고 `migrationFailed`로 처리한다.
- `state`나 top-level의 알 수 없는 추가 필드는 그 존재만으로 실패 처리하지 않지만, 결과 `SaveData`에는 보존하지 않는다.
- 투석기 쿨다운 정규화 테스트는 `CATAPULT_COOLDOWN_MS`를 import해 사용하고 쿨다운 상한을 숫자로 복제하지 않는다.
- `assertSaveDataForTest`는 정상 테스트 setup용 strict validator이고, `normalizeSaveData`는 실제 사용자 저장 복구용 관대한 정규화 파이프라인이라는 차이를 검증한다.
- `LoadResult.loaded`에는 `wasNormalized`, `normalizationWarnings`, `normalizationReport` 같은 정규화 메타 필드를 넣지 않고, 정규화 검증은 `normalizeSaveData` 단위 테스트에서 raw input과 canonical output을 비교해 수행한다.
- 기존 저장 데이터가 `saveVersion: 1` 정규화로 복원 가능한 경우, 정규화된 canonical `GameState`로 메모리 상태를 시작하지만 정규화 자체는 `save` effect나 즉시 storage write를 만들지 않는다.
- 로드 직후 canonical 값을 `goblin-clicker.save`에 덮어쓰지 않고, 정규화가 있었다는 이유만으로 `unsaved` 경고를 표시하지 않는다.
- 다음 전투 저장, 구매 성공 저장, 저장 초기화, 또는 `AUTO_SAVE_INTERVAL_MS` 자동 저장이 발생할 때 canonical `GameState`가 저장되는지 검증한다.
- 저장 데이터가 없는 `LoadResult.created` 경로의 시작 상태 즉시 저장은 기존 저장 정규화와 별도 규칙으로 유지한다.
- `goblinHp === 0`은 현재 최대 체력으로 복원한다.
- `savedAt`과 `Date.now()`는 진행 계산에 사용하지 않는다.
- `loadGame(storage, context)`는 `nowMs`를 인자로 받지 않으며, save 단위 테스트는 이 시그니처를 유지하는지 검증한다.
- `SaveData.savedAt`과 시스템 시각 `Date.now()`는 자동 저장 due 계산에 영향을 주지 않는다.
- `saveGame(storage, state)`는 MVP에서 `toSaveData(state)`만 사용하며, 저장한 JSON에 기본적으로 `savedAt`이 없음을 검증한다.
- `toSaveData(state, 12345)`는 `savedAt`을 포함하는 순수 변환 helper로 동작하는지 검증한다.
- `savedAt` 유무가 로드 복원, 자동 저장 due, 투석기 쿨다운에 영향을 주지 않는지 검증한다.
- `normalizeSaveData`와 `saveGame` 테스트는 JSON 객체의 의미 값과 구조만 검증하고, 객체 프로퍼티 출력 순서나 직렬화 문자열의 필드 순서를 검증하지 않는다.
- `saveGame`이 쓴 JSON은 `JSON.parse` 후 deep equality 또는 필드별 assertion으로 검증한다.
- 문서 예시의 타입/객체 필드 순서는 사람이 읽기 위한 설명이며, 런타임 계약이 아니다.
- `runtimeClock`, `defeatedSnapshot.startedAtMs`, `defeatedSnapshot.enemyInstanceId`는 `SaveData`에 직렬화하지 않는다.
- `RuntimeState` 전체를 `SaveData`로 직렬화하지 않는다. 저장은 항상 `PlayableRuntimeState.game` 또는 순수 `GameState`만 `toSaveData`에 넘긴다.
- 삭제 실패 시 새 게임을 시작하지 않는다.
- 저장소 접근 실패 세션에서는 저장, 삭제, 초기화를 실제 수행하지 않는다.
- 저장 실패 주입은 브라우저 `localStorage` monkey patch가 아니라 테스트용 `StorageAdapter` 또는 테스트 모드 앱 조립부의 storage adapter 교체로 검증한다. 테스트 adapter는 지정된 작업의 `read`, `write`, `remove` 메서드에서 throw해 실패를 주입한다.

- [ ] **Step 3: 정규화 함수를 구현한다**

필수 함수 시그니처:

```ts
export function createInitialGameState(): GameState;
export function toSaveData(state: GameState, savedAt?: number): SaveData;
export function normalizeSaveData(raw: unknown): SaveData | { error: "migrationFailed" };
export function loadGame(storage: StorageAdapter, context: LoadContext): LoadResult;
export function saveGame(storage: StorageAdapter, state: GameState): "saved" | "failed";
export function deleteSave(storage: StorageAdapter): "deleted" | "failed";
```

`src/domain/saveTypes.ts`는 `types.ts`, `save.ts`, 앱/UI 모듈, 다른 domain 구현 파일을 import하지 않는다. `src/domain/types.ts`는 `LoadErrorReason`이 필요하면 `saveTypes.ts`에서 type-only import한다. `src/domain/save.ts`는 `LoadFailureReason`을 `saveTypes.ts`에서 type-only import하고, `GameState`, `SaveData`는 `types.ts`에서 type-only import한다.

`src/domain/save.ts`는 `RuntimeState`, `LoadErrorRuntimeState`, `ReadyRuntimeState`, 사용자 표시 문자열, 모달 문구를 import하지 않는다. `loadGame`은 읽기, 파싱, 마이그레이션 실패만 `LoadResult { kind: "loadError"; reason: LoadFailureReason }`으로 반환하며, 삭제 액션 실패인 `deleteFailed`를 절대 반환하지 않는다. `loadGame`과 `save.ts`는 `performance.now()`, `Date.now()`, 자동 저장 스케줄러의 기준 시각을 알지 않는다. `saveGame(storage, state)`도 내부에서 `Date.now()`나 `performance.now()`를 호출하지 않고, MVP 저장 경로에서는 `toSaveData(state)`만 사용해 `savedAt`을 생략한다. `toSaveData(state, savedAt?)`는 순수 변환 helper로 유지한다. 미래에 저장 시각 표시가 필요해지면 앱 조립부가 wall-clock provider 또는 `Date.now()`를 읽어 `toSaveData(state, savedAt)`에 명시적으로 넘기는 방식으로 확장한다. `toSaveData`는 저장 가능한 `GameState`만 받으며, 앱 조립부에서 저장할 때도 `RuntimeState` 전체가 아니라 `state.mode === "ready" | "defeatTransition"`로 확인된 `PlayableRuntimeState.game`만 넘긴다.

canonical `SaveData`의 의미는 필드 값과 구조에 있으며, 객체 프로퍼티 출력 순서는 계약이 아니다. `normalizeSaveData`는 canonical 값의 의미를 보장하지만 필드 출력 순서를 보장하지 않는다. `saveGame`의 직렬화 테스트는 저장된 문자열을 `JSON.parse`한 뒤 deep equality 또는 필드별 assertion으로 검증하고, JSON 문자열의 프로퍼티 순서를 비교하지 않는다. `savedAt`이 있거나 없어도 필드 순서는 의미 기준이 아니다. 이 문서의 타입과 객체 예시 순서는 설명용이다.

`normalizeSaveData(raw)`는 `assertSaveDataForTest(save)`와 같은 strict exact-shape validator가 아니다. `assertSaveDataForTest`는 테스트 setup이 정상 `SaveData`만 넣도록 막는 하네스 경계이고, `normalizeSaveData`는 실제 사용자 저장 복구용 파이프라인이다. 따라서 `normalizeSaveData`는 `saveVersion === 1`과 `state` object 여부를 확인한 뒤, 알려진 필드를 스펙의 필드별 정규화 규칙으로 canonical `SaveData`에 매핑한다. top-level 또는 `state`의 알 수 없는 추가 필드와 알 수 없는 upgrade key는 실패 사유가 아니지만, 결과에는 보존하지 않는다. 정규화 순서는 `defeatedCount/coins` -> `upgrades` -> 파생 체력 기준과 `goblinHp` -> `catapultCooldownRemainingMs` -> `mudTrapArmedLevel` -> `savedAt`이다. `catapultCooldownRemainingMs`는 정규화된 catapult level에 의존하고, `mudTrapArmedLevel`은 정규화된 mudTrap level에 의존한다. `savedAt`은 finite number일 때만 결과에 보존하고 invalid이면 생략한다. 반대로 `saveVersion` 누락/미지원, `saveVersion === 1`인데 `state`가 없거나 object가 아닌 경우는 `migrationFailed`다.

`normalizeSaveData(raw)`가 canonical `SaveData`를 만들었다고 해서 로드 직후 즉시 다시 저장하지 않는다. 정규화는 읽기/복원 단계의 책임이고, 저장 side effect는 전투, 구매, 저장 초기화, `AUTO_SAVE_INTERVAL_MS` 자동 저장 같은 기존 저장 트리거에서만 발생한다. 기존 저장 정규화는 `LoadResult.loaded` 경로이며, 이 경로는 `save` effect를 만들지 않고 `goblin-clicker.save`를 즉시 덮어쓰지 않는다. 정규화가 있었다는 이유만으로 `persistence.saveWarning = "unsaved"`를 만들거나, "정규화 저장 실패" 같은 새 분기를 추가하지 않는다. 개발 모드 콘솔 로그로 정규화 사실을 남길 수는 있지만 MVP 필수는 아니다. 저장 키가 없는 `LoadResult.created` 경로에서 시작 상태를 즉시 저장하는 규칙은 별도로 유지한다.

정규화가 있었는지 여부도 `LoadResult.loaded`에 노출하지 않는다. `LoadResult.loaded`는 canonical `SaveData`만 들고, 앱 조립부는 정규화 여부를 알 필요가 없다. `wasNormalized`, `normalizationWarnings`, `normalizationReport`는 MVP에 넣지 않는다. 복구 상세 리포트나 정규화 알림 UI가 필요해지면 이후 별도 기능으로 검토한다.

`StorageAdapter`는 브라우저 저장소 접근을 감싼 얇은 raw adapter다. adapter 메서드는 `"failed"`, `"storageUnavailable"`, `"readFailed"` 같은 정책 결과를 반환하지 않고, 접근 실패를 예외로 표현한다. adapter 예외를 도메인 결과로 변환하는 위치는 `loadGame`, `saveGame`, `deleteSave`뿐이다. 앱 조립부, UI, Playwright 테스트는 브라우저 `localStorage`를 직접 호출하지 않고, 항상 `loadGame`, `saveGame`, `deleteSave` 또는 테스트 모드에서 교체된 `StorageAdapter`를 통해 접근한다.

- [ ] **Step 4: 저장 테스트 통과를 확인한다**

Run:

```bash
npm test -- tests/unit/save.test.ts
```

Expected:

```text
PASS tests/unit/save.test.ts
```

### Task 7: 런타임 상태와 저장 트리거 병합

**Files:**
- Create: `src/domain/runtime.ts`
- Test: `tests/unit/runtime.test.ts`

- [ ] **Step 1: 런타임 테스트를 작성한다**

검증 대상:

- `processFrame` 한 번에서 직접 공격과 처치가 같은 입력에서 발생하면 최종 상태만 1회 저장한다.
- 처치가 발생하면 처치된 고블린의 `enemyInstanceId`를 담은 `defeatTransitionStarted` effect를 반환하되 duration payload를 포함하지 않는다.
- 전환 종료는 `defeatedSnapshot.startedAtMs + DEFEAT_TRANSITION_MS`와 `RuntimeFrameInput.nowMs` 기준으로만 검증한다.
- 처치 직후 `state.game.goblinHp`는 다음 고블린 최대 체력이지만, `selectEnemyRenderState(state)`는 `DEFEAT_TRANSITION_MS` 동안 `hp: 0`인 `defeatedSnapshot`을 반환한다.
- `ready` 상태의 `selectEnemyRenderState`는 `state.game.defeatedCount`에서 `enemyInstanceId`, 고블린 레벨, 최대 체력을 파생하고 `state.game.goblinHp`를 반환한다.
- `ready` 상태에서 `EnemyRenderState.enemyInstanceId === state.game.defeatedCount`다.
- `selectEnemyRenderState`는 `ready`에서 `visualState: "idle"`, `defeatTransition`에서 `visualState: "defeated"`만 반환하고 `"hit"`를 반환하지 않는다.
- 처치 전환 중 `selectEnemyRenderState`는 `defeatedSnapshot.enemyInstanceId`를 반환해 처치된 고블린의 id를 유지한다.
- 처치 전환 중 `defeatedSnapshot.enemyInstanceId === state.game.defeatedCount - 1`이다.
- 처치 전환 중 `selectEnemyRenderState`는 `goblinLevel`을 `calculateGoblinLevel(defeatedSnapshot.enemyInstanceId)`로, `maxHp`를 `calculateGoblinMaxHp(defeatedGoblinLevel)`로 파생한다.
- `defeatedSnapshot`에는 `goblinLevel`과 `maxHp`를 저장하지 않는다.
- 전환 종료 후 `mode`가 `ready`로 돌아오면 `selectEnemyRenderState`는 다음 고블린의 `state.game` 값을 반환한다.
- 전환 종료 후 다음 고블린의 `enemyInstanceId`는 증가된 `state.game.defeatedCount` 기준으로 달라진다.
- damage effect는 Phaser Scene의 hit 애니메이션을 유발할 수 있지만 `RuntimeState`, `EnemyRenderState`, `SaveData`에는 hit 상태를 저장하지 않는다.
- non-lethal direct damage와 non-lethal catapult damage effect는 현재 고블린의 `enemyInstanceId`를 가진다.
- lethal direct damage와 lethal catapult damage effect는 처치된 고블린의 `enemyInstanceId`를 가진다.
- lethal direct/catapult frame에서 `defeatTransitionStarted.enemyInstanceId`는 처치된 고블린의 `enemyInstanceId`를 가진다.
- lethal frame에서 `damageNumber.enemyInstanceId`는 전환 snapshot의 `EnemyRenderState.enemyInstanceId`와 일치해 피해 숫자 표시 대상이 된다.
- `processFrame` 한 번에서 진흙 함정 소모만 발생하면 현재 전투 상태를 1회 저장한다.
- `processFrame` 한 번에서 투석기 처치와 `AUTO_SAVE_INTERVAL_MS` 자동 저장 due가 겹치면 최종 상태만 1회 저장한다.
- `DEFEAT_TRANSITION_MS` 전환 중 `processFrame`은 전환 종료 여부만 확인하고 직접 공격, 투석기, 자동 저장은 처리하지 않는다.
- 전환 종료 프레임에 `autoSaveDue: true`가 들어와도 `save` effect가 없고, 앱 조립부 자동 저장 스케줄러 관점에서 due가 소비되지 않는다.
- 전환 종료 다음 `ready` 프레임에 아직 due 상태라면 자동 저장 `save` effect가 한 번 발생한다.
- 지연된 자동 저장 due가 여러 번 누적되어도 `ready` 프레임에서 저장을 여러 번 만들지 않는다.
- `ready` 프레임에서 `autoSaveDue`와 다른 `processFrame` 저장 사유가 겹치면 save effect는 1개만 반환한다.
- `DEFEAT_TRANSITION_MS` 전환 중 `processPurchase`는 `purchaseUpgrade`를 호출하지 않고 `blockedByDefeatTransition` 구매 피드백 effect만 반환하며, 구매 성공/실패 트랜잭션과 저장 효과를 만들지 않는다.
- `ready` 상태의 비용 부족 구매는 저장 효과 없이 `insufficientCoins` 구매 피드백 effect와 `missingCoins`를 반환한다.
- `ready` 상태의 구매 성공은 갱신된 상태, 저장 효과, `success` 구매 피드백 effect를 반환한다.
- 구매 성공 feedback은 `previousLevel`과 `nextLevel`을 포함하고, MVP에서는 `nextLevel === previousLevel + 1`이다.
- 구매 성공 뒤 저장 실패가 발생해도 구매 상태를 롤백하지 않고 `success` 구매 피드백을 취소하지 않는다.
- `persistence.kind === "unavailable"` 세션에서도 구매 성공은 `success` 구매 피드백을 표시하고, 저장 효과는 `skippedStorageUnavailable`로 처리해 `storageUnavailable` 경고를 유지한다.
- 전환 종료 뒤 이전 입력은 자동 재실행되지 않는다.
- `hidden`에서 `visible` 복귀 시 투석기 catch-up을 하지 않는다.
- `persistence.kind === "unavailable"`이어도 `ready` 상태의 직접 공격, 처치, 재화 획득, 업그레이드 구매는 일반 세션과 동일하게 처리된다.
- `persistence.kind === "unavailable"`이어도 처치가 발생하면 `defeatTransition` 모드로 들어가고, 전환 중 입력 차단 규칙도 일반 세션과 동일하다.
- 저장 복원, 첫 실행, 새 게임 시작 시 `runtimeClock`이 `{ lastDirectAttackAtMs: null, lastVisibleTickAtMs: null }`로 초기화된다.
- `document.visibilityState === "hidden"` tick은 `runtimeClock.lastVisibleTickAtMs`를 `null`로 리셋하고, 다음 visible tick은 delta를 적용하지 않고 기준 시각만 새로 잡는다.
- `processFrame`, `processPurchase`, `applySaveEffectResult`는 `PlayableRuntimeState`만 받으며, 앱 조립부는 `loading`과 `loadError` 상태에서 이 함수들을 호출하지 않는다.
- `applySaveEffectResult(..., "failed")`는 `persistence.kind === "available"` 상태에서 `saveWarning: "unsaved"`를 만든다.
- `applySaveEffectResult(..., "saved")`는 `persistence.kind === "available"` 상태에서 `saveWarning: "none"`으로 저장 실패 경고를 해제한다.
- `applySaveEffectResult(..., "skippedStorageUnavailable")`는 `persistence.kind === "unavailable"`과 `saveWarning: "storageUnavailable"`을 유지한다.
- 저장소 접근 실패 세션에서 전투나 구매로 생긴 저장 효과 결과를 `skippedStorageUnavailable`로 반영해도 `storageUnavailable` 경고가 유지된다.
- `assertRuntimeStateForTest`는 먼저 top-level discriminated union shape가 정확한지 검사한다. `loading`, `loadError`, `ready`, `defeatTransition` 각각의 허용 필드가 정확히 일치해야 하며, 누락 필드, 추가 필드, 배열, `null`, class instance, 중첩 객체의 비-plain object를 거부한다. 그 다음 `loadError`에 `game`이 들어간 상태, `goblinHp: 0`인 `ready` 상태, 스냅샷 없는 전환 상태, 전환이 아닌 모드의 stale snapshot, `persistence.kind`와 `saveWarning` 불일치, 음수나 무한대 runtime clock 및 `defeatedSnapshot.startedAtMs` 값을 거부한다.

- [ ] **Step 2: 런타임 컨트롤러를 구현한다**

```ts
export type RuntimeEffect =
  | { type: "save"; state: GameState }
  | {
      type: "damageNumber";
      enemyInstanceId: number;
      source: "direct" | "catapult";
      damage: number;
    }
  | { type: "defeatTransitionStarted"; enemyInstanceId: number }
  | { type: "purchaseFeedback"; feedback: PurchaseFeedback };

export type PurchaseFeedback =
  | {
      kind: "success";
      upgradeId: UpgradeId;
      previousLevel: number;
      nextLevel: number;
    }
  | { kind: "insufficientCoins"; upgradeId: UpgradeId; missingCoins: number }
  | { kind: "blockedByDefeatTransition"; upgradeId: UpgradeId };

export type RuntimeFrameInput = {
  nowMs: number;
  visibilityState: DocumentVisibilityState;
  directAttackRequested: boolean;
  autoSaveDue: boolean;
};

export type RuntimeFrameResult = {
  state: PlayableRuntimeState;
  effects: RuntimeEffect[];
};

export type PurchaseTransactionResult = {
  state: PlayableRuntimeState;
  effects: RuntimeEffect[];
};

export function processFrame(
  state: PlayableRuntimeState,
  input: RuntimeFrameInput
): RuntimeFrameResult;

export function processPurchase(
  state: PlayableRuntimeState,
  upgradeId: UpgradeId
): PurchaseTransactionResult;

export type SaveEffectResult =
  | "saved"
  | "failed"
  | "skippedStorageUnavailable";

export function applySaveEffectResult(
  state: PlayableRuntimeState,
  result: SaveEffectResult
): PlayableRuntimeState;
```

`RuntimeFrameInput`은 정확히 `nowMs`, `visibilityState`, `directAttackRequested`, `autoSaveDue`만 가진 plain object여야 한다. 브라우저 JS에서 호출되는 `window.__goblinTest.advanceRuntimeFrame(input)`은 TypeScript 타입을 신뢰하지 않고, 누락 필드, 추가 필드, 배열, `null`, 잘못된 literal 값을 런타임에서 거부한다. `visibilityState`는 `"visible" | "hidden"`만 허용하고, `directAttackRequested`와 `autoSaveDue`는 문자열이나 truthy/falsy 값이 아니라 실제 boolean이어야 한다.

`RuntimeFrameInput.nowMs`는 0 이상의 finite number여야 한다. 입력 경계는 현재 playable runtime의 `runtimeClock.lastDirectAttackAtMs`가 `null`이 아닐 때 `input.nowMs >= lastDirectAttackAtMs`인지, `runtimeClock.lastVisibleTickAtMs`가 `null`이 아닐 때 `input.nowMs >= lastVisibleTickAtMs`인지 검증한다. `processFrame`은 잘못된 shape, 비정상 literal, 음수 delta를 보정하지 않는다. 비정상 입력은 하네스 또는 앱 입력 경계에서 막는다.

`RuntimeFrameInput.visibilityState === "hidden"`이면 `directAttackRequested`는 `false`여야 한다. hidden 상태에서는 투석기 catch-up만 막는 것이 아니라, 새 전투 입력 frame도 생성하지 않는다. `processFrame`은 `hidden + directAttackRequested` 조합을 보정하거나 처리하지 않는다. 이 조합은 앱 입력 경계와 테스트 하네스 경계에서 막는다.

`processFrame`은 전환 종료 여부를 `defeatedSnapshot.startedAtMs + DEFEAT_TRANSITION_MS <= input.nowMs` 기준으로 판단한다. `startedAtMs <= performance.now()` 또는 `input.nowMs >= defeatedSnapshot.startedAtMs` 같은 현재 시각 비교는 `setRuntimeState`나 `advanceRuntimeFrame`의 clock monotonic 검증에서 강제하지 않는다. `setRuntimeState`에는 `nowMs` 인자가 없고, 테스트가 아직 전환이 끝나지 않은 타이밍을 구성할 수 있어야 하기 때문이다.

입력 이벤트는 `processFrame` 밖에서 즉시 저장을 만들지 않는다. 직접 공격 요청은 앱 조립부에서 프레임 입력의 `directAttackRequested`로 모으고, `AUTO_SAVE_INTERVAL_MS` 자동 저장 타이머도 `autoSaveDue`로 모은다. 저장 병합은 `processFrame`이 책임진다.

`processFrame`, `processPurchase`, `applySaveEffectResult`는 `PlayableRuntimeState`만 받는다. 앱 조립부는 `RuntimeState.mode`를 확인해 `ready` 또는 `defeatTransition`일 때만 호출한다. `loading`과 `loadError`에서는 프레임 진행, 구매, 저장 효과 반영을 호출하지 않는다.

`RuntimeEffect[]`의 cross-type 배열 순서에는 의미를 두지 않는다. 앱 조립부는 effect type별로 필터링해 문서에 정의된 우선순서로 처리한다. 같은 type 내부에서는 런타임 함수가 반환한 순서를 보존할 수 있다. 이 내부 순서는 시각적 표시 순서와 약간의 위치 오프셋 계산에만 사용할 수 있으며, 게임 상태, 저장 결과, 처치 판정, 전환 종료 판정에 영향을 주면 안 된다. `save` effect 병합은 런타임 함수의 책임이며, `processFrame` 또는 `processPurchase` 한 transaction 안에서 `save` effect는 최대 1개만 반환한다.

`RuntimeEffect { type: "save" }` payload는 `{ type: "save"; state: GameState }`를 유지한다. `reason`, `source`, `autoSave`, `purchase`, `combat` 같은 저장 사유 필드를 넣지 않는다. save effect는 최종 `GameState`를 저장하라는 side effect일 뿐이며, 자동 저장 due 소비 여부는 effect payload가 아니라 앱 조립부의 트랜잭션 컨텍스트에서 판단한다. 저장 사유별 분기는 `processFrame` 또는 `processPurchase`를 호출한 문맥에서만 다루고, 도메인 effect payload로 새지 않게 한다.

로드 정규화는 `RuntimeEffect { type: "save" }`를 만들지 않는다. `normalizeSaveData(raw)`로 canonical 상태를 복원한 뒤 실제 저장은 이후 전투, 구매, 저장 초기화, 자동 저장 같은 기존 저장 트리거에서만 발생한다.

`defeatTransitionStarted` effect는 UI/Phaser 연출 시작 알림일 뿐이다. `enemyInstanceId`는 처치된 고블린의 처치 전 `defeatedCount`다. effect payload에 별도 duration을 복제하지 않는다. 전환 종료 판정의 단일 source of truth는 `processFrame`이며, `DefeatTransitionRuntimeState.defeatedSnapshot.startedAtMs + DEFEAT_TRANSITION_MS` 기준으로 ready 전환 여부를 판단한다. UI/Phaser가 연출 시간이 필요하면 `DEFEAT_TRANSITION_MS`를 import해 사용한다. 테스트는 effect duration이 아니라 runtime state와 `DEFEAT_TRANSITION_MS` 기준으로 전환 종료를 검증한다.

`selectEnemyRenderState`는 저장 가능한 진행 상태와 적 전용 렌더 상태의 의도적 차이를 숨기지 않는 selector다. `ready` 상태에서는 `state.game`을 기준으로 `enemyInstanceId: state.game.defeatedCount`, `visualState: "idle"`을 반환한다. `defeatTransition` 상태에서는 `state.game`이 이미 다음 고블린 상태여도 적 전용 렌더에는 `state.defeatedSnapshot.enemyInstanceId`와 `hp: 0`만 사용하고, 레벨과 최대 체력은 `progression` 함수로 파생해 `visualState: "defeated"`를 반환한다. 직접 공격 피격의 짧은 `"hit"` 표시는 damage effect 처리 중 Phaser Scene이 덮어쓰는 transient visual state이며, `GameState`, `RuntimeState`, `EnemyRenderState`, 저장 데이터, 처치 전환 판정을 바꾸지 않는다.

직접 공격과 투석기 자동 공격이 피해를 줄 때 `RuntimeEffect { type: "damageNumber" }`의 `enemyInstanceId`는 피해를 받은 고블린의 처치 전 `defeatedCount`다. non-lethal frame에서는 `damageNumber.enemyInstanceId === selectEnemyRenderState(nextState).enemyInstanceId`다. lethal frame에서도 `damageNumber.enemyInstanceId`는 처치된 고블린 id이고, 전환 중 `selectEnemyRenderState(nextState).enemyInstanceId`도 같은 id를 반환하므로 피해 숫자를 표시할 수 있다. `damageNumber.enemyInstanceId`는 저장 데이터에 들어가지 않는다.

Scene visual priority는 `defeated` > `hit` > `idle`이다. Scene은 `damageNumber.enemyInstanceId`가 최신 `baseEnemyRenderState?.enemyInstanceId`와 일치할 때만 피해 숫자와 damage visual effect를 처리한다. Scene은 `defeatTransitionStarted.enemyInstanceId`가 최신 `baseEnemyRenderState?.enemyInstanceId`와 일치할 때만 defeat visual effect를 처리한다. 같은 RuntimeResult 안에 유효한 `defeatTransitionStarted.enemyInstanceId`가 있으면, 그 `enemyInstanceId`의 모든 damage visual effect는 피해 숫자만 표시하고 `"hit"` transient를 적용하지 않는다. 최신 `baseEnemyRenderState?.visualState === "defeated"`이면 이후 들어오는 damage visual effect도 `"hit"`로 덮지 않는다.

- [ ] **Step 3: 프레임 처리 순서를 구현한다**

`processFrame`은 한 프레임 또는 같은 업데이트 흐름을 처리하는 단위다. 처리 순서는 고정한다.

```text
1. mode가 defeatTransition이면 전환 종료 여부만 확인하고 직접 공격, 투석기, 구매, 자동 저장은 처리하지 않는다. 이때 autoSaveDue는 저장 사유로 소비하지 않는다.
2. directAttackRequested가 true이면 `DIRECT_ATTACK_MIN_INTERVAL_MS` 제한을 적용해 최대 1회 처리한다.
3. 직접 공격으로 처치되면 즉시 다음 고블린 GameState를 확정하고 defeatTransition으로 전환한다.
4. 직접 공격으로 전환이 시작되지 않았고 visibilityState가 visible이면 투석기 delta/tick을 처리한다.
5. autoSaveDue를 저장 사유로 합친다. 단 persistence.kind가 unavailable이면 자동 저장 사유를 만들지 않는다.
6. 프레임 안에서 생긴 모든 저장 사유는 최종 GameState 기준 save 효과 1개로 병합한다.
```

같은 frame에서 같은 고블린에게 직접 공격과 투석기 피해가 모두 적용되면 `damageNumber` effect는 전투 처리 순서와 같은 직접 공격 -> 투석기 순서로 생성한다. 별도 `sequence` 필드는 MVP에서는 추가하지 않는다. 다중 적, 동시 광역 피해처럼 표시 순서가 대상별로 더 복잡해지는 확장 시점에만 sequence 필드를 재검토한다.

직접 공격은 `runtimeClock.lastDirectAttackAtMs`를 `applyDirectAttack`에 전달하고, 공격이 수락된 경우에만 반환된 `nextLastDirectAttackAtMs`로 갱신한다. 거부된 입력은 시간 기준을 갱신하지 않는다. `processFrame`은 `input.nowMs < runtimeClock.lastDirectAttackAtMs` 같은 비단조 입력을 보정하지 않는다.

투석기 tick은 `visibilityState === "visible"`이고 `runtimeClock.lastVisibleTickAtMs`가 있을 때만 `deltaMs = nowMs - lastVisibleTickAtMs`를 계산해 투석기 쿨다운에 전달한다. `lastVisibleTickAtMs`가 `null`이면 이번 frame은 기준 시각을 `nowMs`로 설정만 하고 투석기 delta를 적용하지 않는다. `visibilityState === "hidden"`이면 투석기 쿨다운을 차감하지 않고 `lastVisibleTickAtMs`를 `null`로 둔다. `processFrame`은 음수 투석기 delta를 0으로 clamp하지 않는다.

`mode === "defeatTransition"`에서는 `defeatedSnapshot.startedAtMs + DEFEAT_TRANSITION_MS`와 `input.nowMs`로 전환 종료 여부만 확인한다. 전환이 끝나지 않았으면 입력과 자동 저장을 모두 무시한다. 전환이 끝났으면 `mode`를 `"ready"`로 되돌리고, 전환 중 들어온 직접 공격이나 자동 저장 due를 소급 처리하지 않는다. 이 프레임의 `autoSaveDue: true`는 `save` effect를 만들지 않으며, 앱 조립부 자동 저장 스케줄러 관점에서도 소비된 due로 보지 않는다. 따라서 다음 `ready` 프레임에도 `autoSaveDue: true`가 다시 들어올 수 있다.

프레임 안에서 저장 사유가 여러 번 생겨도 `RuntimeEffect { type: "save" }`는 마지막 확정 `GameState` 기준으로 최대 1개만 반환한다. `persistence.kind === "unavailable"`이어도 처치나 진흙 함정 소모 같은 진행 상태 변경은 일반 세션과 동일하게 처리할 수 있지만, `autoSaveDue`만으로는 저장 효과를 만들지 않는다.

`autoSaveDue`는 정확히 `AUTO_SAVE_INTERVAL_MS`마다 실행되는 전투 타이머가 아니라, `AUTO_SAVE_INTERVAL_MS` 이상 지났으니 가능한 `ready` 프레임에서 저장하라는 저장 보조 신호다. due가 오래 밀렸어도 `ready` 프레임에서 자동 저장은 한 번만 시도하고, 밀린 횟수만큼 여러 번 저장하지 않는다. 같은 `ready` 프레임에서 전투나 처치 같은 `processFrame` 저장 사유와 `autoSaveDue`가 겹치면 런타임의 save effect 병합 규칙에 따라 최종 상태 기준 `save` effect 1개만 반환한다.

- [ ] **Step 4: 구매 입력 트랜잭션을 분리한다**

구매는 프레임 루프가 아니라 UI 입력 1회 단위의 별도 트랜잭션으로 처리한다. `processPurchase`는 구매 입력 1회를 최신 `PlayableRuntimeState` 기준으로 평가한다. `state.mode === "defeatTransition"`이면 `purchaseUpgrade`를 호출하지 않고 `RuntimeEffect { type: "purchaseFeedback", feedback: { kind: "blockedByDefeatTransition", upgradeId } }`만 반환하며, 구매 성공/실패 트랜잭션과 저장 효과를 만들지 않는다. `mode === "loadError"`에서는 앱 조립부가 `processPurchase`를 호출하지 않는다. 전환 중 입력은 큐에 쌓지 않고 전환 종료 후 자동 재실행하지 않는다.

`state.mode === "ready"`이면 `processPurchase`가 `purchaseUpgrade(state.game, upgradeId)`를 호출한다. 비용 부족이면 상태와 저장 효과를 만들지 않고 `RuntimeEffect { type: "purchaseFeedback", feedback: { kind: "insufficientCoins", upgradeId, missingCoins } }`를 반환한다. 구매 성공이면 구매 전 레벨을 `previousLevel`, 구매 후 레벨을 `nextLevel`로 담아 레벨, 재화, 관련 능력치가 갱신된 상태, 최종 `GameState` 기준 저장 효과 1개, `RuntimeEffect { type: "purchaseFeedback", feedback: { kind: "success", upgradeId, previousLevel, nextLevel } }`를 반환한다. MVP에서 `nextLevel === previousLevel + 1`이다. 성공 피드백은 버튼 눌림, 레벨 숫자 증가 강조, 접근성 상태 문구 같은 버튼/숫자 중심의 로컬 피드백으로 제한하고, 전역 모달, 토스트, 화면 전체 연출은 만들지 않는다. 재화 숫자, 다음 효과, 다음 비용은 갱신된 상태에서 상점 row와 HUD가 다시 계산해 표시한다. 저장소 접근 실패 세션은 `ReadyRuntimeState + persistence.kind === "unavailable"`이므로 구매는 메모리에서 성공할 수 있고, 실제 쓰기 생략은 저장 효과 처리 단계가 담당한다.

`PurchaseFeedback`에는 `none`을 두지 않는다. `purchaseFeedback` effect가 없다는 것은 구매 입력이 없었거나 구매 처리와 무관한 프레임이라는 뜻이지, 구매 입력의 `none` 결과가 아니다.

`success.previousLevel`은 구매 전 업그레이드 레벨이고, `success.nextLevel`은 구매 후 업그레이드 레벨이다. UI는 이 값으로 레벨 숫자 증가 강조, 버튼 성공 상태, 접근성 상태 문구를 만든다. 비용, 다음 비용, 다음 효과, 클릭 피해량, 저장 성공/실패 여부는 success payload에 넣지 않는다. 상점 row는 갱신된 `GameState`, `UPGRADE_DEFINITIONS`, `progression` 함수로 다음 비용과 효과를 다시 계산하고, 저장 경고는 `persistence.saveWarning`만 읽는다.

구매 성공 피드백은 메모리 구매 성공 기준으로 즉시 표시하며 저장 성공 여부와 독립이다. 저장 실패는 구매 성공을 롤백하지 않고, 성공 피드백을 취소하지 않으며, `persistence.saveWarning = "unsaved"`만 만든다. 저장소 접근 실패 세션에서도 구매 성공 피드백은 표시하고, 저장 효과는 실제 쓰기 없이 `skippedStorageUnavailable`로 반영해 `storageUnavailable` 경고를 유지한다.

- [ ] **Step 5: 저장 가능성 축을 런타임 모드와 분리한다**

저장소 접근 실패는 `RuntimeMode`가 아니라 `PlayableRuntimeState.persistence`로 표현한다. `persistence.kind === "unavailable"`인 상태에서도 상태 변경을 동반하는 전투와 구매 명령은 일반 세션처럼 처리하고, 필요하면 `save` 효과를 반환할 수 있다. 실제 `localStorage` 쓰기를 건너뛰고 `storageUnavailable` 경고를 유지하는 책임은 저장 효과 처리 단계에 둔다.

`autoSaveDue`는 저장 보조 트리거이므로 `persistence.kind === "unavailable"`이면 저장 사유로 반영하지 않는다. 로드 오류는 `mode === "loadError"`로 표현하며, 이 상태에서는 전투 프레임 처리와 구매 트랜잭션을 차단한다.

- [ ] **Step 6: 저장 효과 결과 반영을 구현한다**

`processFrame`과 `processPurchase`는 `localStorage`를 직접 만지지 않고 `RuntimeEffect[]`만 반환한다. 앱 조립부는 그중 `RuntimeEffect { type: "save" }`만 저장 side effect로 처리한 뒤, 저장 결과를 `applySaveEffectResult`로 런타임 상태에 반영한다.

RuntimeResult 처리 순서:

```text
1. 반환된 RuntimeState를 먼저 적용한다.
2. PlayableRuntimeState이면 selectEnemyRenderState(state)를 계산한다.
3. HUD/상점/DOM을 새 state 기준으로 렌더한다.
   - 전역 표시는 state.game 기준
   - 적 전용 표시는 EnemyRenderState 기준
4. Phaser renderGoblinVisualState에 같은 EnemyRenderState를 전달한다.
5. visual/local feedback effects를 type별로 처리한다.
   - damageNumber + defeatTransitionStarted -> Scene applyVisualEffects batch
   - purchaseFeedback -> DOM 상점 로컬 피드백
6. save effect를 처리한다.
7. saveGame 결과를 applySaveEffectResult로 RuntimeState.persistence에 반영한다.
8. 저장 경고 UI만 갱신한다.
```

visual/local feedback의 cross-type 처리 순서는 Scene visual priority와 effect 대상 id를 따른다. 앱 조립부는 같은 `RuntimeResult`의 `damageNumber`와 `defeatTransitionStarted`만 모아 `SceneVisualEffect[]`로 변환하고, `applyVisualEffects` batch 하나로 Scene에 전달한다. `purchaseFeedback`은 DOM 상점 쪽 effect이며 Scene batch에 넣지 않는다. `save` effect도 Scene batch에 넣지 않는다. 앱 조립부는 `damageNumber` effects를 필터링할 때 그 내부 순서를 유지해 Scene에 전달한다. 이 순서는 피해 숫자의 표시 순서와 위치 오프셋에만 사용한다. 앱 조립부는 `damageNumber.enemyInstanceId`를 `SceneVisualEffect { type: "showDamage" }.enemyInstanceId`로, `defeatTransitionStarted.enemyInstanceId`를 `SceneVisualEffect { type: "showDefeat" }.enemyInstanceId`로 전달한다. 앱 조립부는 먼저 `renderGoblinVisualState`로 최신 base enemy render state를 전달하고, 그 다음 `applyVisualEffects` batch를 전달한다. Scene effect handler는 batch를 받으면 먼저 최신 `baseEnemyRenderState` 기준으로 유효한 `showDefeat.enemyInstanceId` 집합을 파악한다. 그 다음 `showDamage`를 batch 내부 순서대로 처리한다. Scene은 `showDamage.enemyInstanceId !== baseEnemyRenderState?.enemyInstanceId`이면 stale damage effect로 보고 피해 숫자 표시와 `"hit"` transient를 모두 건너뛴다. Scene은 `showDefeat.enemyInstanceId !== baseEnemyRenderState?.enemyInstanceId`이면 stale defeat effect로 보고 처치 스프라이트와 파티클을 만들지 않는다. `showDamage.enemyInstanceId`가 유효한 defeat id 집합에 포함되면 피해 숫자는 표시하되 `"hit"` transient는 적용하지 않는다. 마지막으로 유효한 `showDefeat`를 처리해 defeat sprite와 particle을 적용한다. lethal direct attack 또는 lethal catapult frame처럼 `damageNumber`와 `defeatTransitionStarted`가 함께 있으면 앱 조립부는 피해 숫자와 처치 연출을 같은 batch로 전달하되, Scene은 해당 enemy의 `"hit"` transient를 전체 억제하고 `defeated` visual을 유지한다.

앱 조립부는 Scene 준비 상태를 `RuntimeState`에 넣지 않는다. `sceneReady` 수신 여부와 `renderGoblinVisualState`를 한 번 이상 보냈는지 여부는 `src/main.ts`의 비저장 orchestration gate다. 최초 playable state 렌더 시 앱 조립부는 반드시 `renderGoblinVisualState`를 먼저 보낸다. 앱 조립부는 `sceneReady`를 받았고, `renderGoblinVisualState`를 한 번 이상 보낸 뒤에만 `applyVisualEffects`를 보낼 수 있다. Scene visual effect는 상태 복구용 이벤트가 아니라 준비된 Scene에만 적용하는 일회성 표현이므로, 전송하지 못한 effect를 나중에 재생하기 위한 큐를 만들지 않는다.

`selectEnemyRenderState` 호출은 앱 조립부의 책임이다. `GoblinScene`은 `RuntimeState`를 import하거나 selector를 호출하지 않고, `renderGoblinVisualState`로 받은 `EnemyRenderState`를 `baseEnemyRenderState`로 캐시해 transient visual 복귀 기준으로만 사용한다.

```ts
export type SaveEffectResult =
  | "saved"
  | "failed"
  | "skippedStorageUnavailable";

export function applySaveEffectResult(
  state: PlayableRuntimeState,
  result: SaveEffectResult
): PlayableRuntimeState;
```

반영 규칙:

- `saved`는 `persistence.kind === "available"` 상태에서 `saveWarning: "none"`으로 갱신한다.
- `failed`는 `persistence.kind === "available"` 상태에서 `saveWarning: "unsaved"`로 갱신한다.
- `skippedStorageUnavailable`은 `persistence.kind === "unavailable"`과 `saveWarning: "storageUnavailable"`을 유지한다.
- `persistence.kind === "available"`에서 앱 조립부가 실제 `saveGame` 호출까지 보냈다면, 저장 성공 또는 실패와 관계없이 앱 조립부가 해당 트랜잭션에서 읽은 `nowMs`로 자동 저장 스케줄러의 `autoSaveBaselineAtMs`를 갱신한다.
- 자동 저장 실패는 다음 프레임 즉시 재시도를 만들지 않는다. `applySaveEffectResult(..., "failed")`로 `unsaved` 경고를 표시하고, 다음 자동 저장 due는 갱신된 `autoSaveBaselineAtMs + AUTO_SAVE_INTERVAL_MS` 이후에만 발생한다.
- 이후 전투/구매 저장 또는 다음 자동 저장이 성공하면 `applySaveEffectResult(..., "saved")`로 `unsaved` 경고를 해제한다.
- `persistence.kind === "unavailable"`에서는 자동 저장 시도 자체를 만들지 않으므로 due 소비 개념을 적용하지 않고 `storageUnavailable` 경고를 유지한다.

- [ ] **Step 7: 런타임 테스트 통과를 확인한다**

Run:

```bash
npm test -- tests/unit/runtime.test.ts
```

Expected:

```text
PASS tests/unit/runtime.test.ts
```

### Task 8: MVP 시각 에셋 계약

**Files:**
- Create: `src/assets/assetManifest.ts`
- Create: `src/assets/README.md`
- Create: `src/ui/upgradePresentation.ts`
- Create: `src/assets/goblin-idle.svg`
- Create: `src/assets/goblin-hit.svg`
- Create: `src/assets/goblin-defeat.svg`
- Create: `src/assets/hit-spark.svg`
- Create: `src/assets/defeat-dust.svg`
- Create: `src/assets/coin.svg`
- Create: `src/assets/upgrade-club.svg`
- Create: `src/assets/upgrade-catapult.svg`
- Create: `src/assets/upgrade-bait-bag.svg`
- Create: `src/assets/upgrade-mud-trap.svg`
- Create: `src/assets/background.svg`
- Test: `tests/unit/asset-manifest.test.ts`
- Test: `tests/unit/upgrade-presentation.test.ts`

필수 시각 에셋은 `src/assets/` 파일로 존재해야 한다. 최종 아트가 없어도 단순 카툰 SVG/PNG 임시 에셋은 허용하지만, 텍스트, 이모지, 단순 사각형, Phaser Scene 내부 도형만으로 고블린, 재화, 업그레이드 아이콘을 대체하는 것은 MVP 완료 기준으로 인정하지 않는다. Phaser generated texture는 보조 파티클이나 디버그 표시에는 사용할 수 있지만, 아래 필수 에셋 파일 계약을 대체할 수 없다.

- [ ] **Step 1: 에셋 manifest를 만든다**

`src/assets/assetManifest.ts`는 로드 키, 파일 경로, 용도, 기준 크기, 앵커를 한 곳에서 관리한다. Phaser Scene과 DOM UI는 파일 경로 문자열, 스케일 기준, 앵커 값을 직접 흩어 쓰지 않고 이 manifest를 참조한다.

필수 키:

```ts
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
```

manifest 항목은 최소한 다음 정보를 가진다.

```ts
export type AssetDefinition = {
  key: AssetKey;
  path: string;
  purpose: string;
  recommendedSize: { width: number; height: number };
  anchor: { x: number; y: number };
};

export const ASSETS: Record<AssetKey, AssetDefinition> = {
  // ...
};
```

`anchor`는 normalized 좌표 `0..1` 범위로 정의한다. 고블린 `goblinIdle`, `goblinHit`, `goblinDefeat`는 같은 `recommendedSize`와 같은 `anchor`를 가져야 한다. 피격/처치 상태 전환으로 스프라이트가 튀거나 클릭 영역이 이동하면 안 된다. 고블린 임시 에셋은 같은 캔버스 크기 안에서 투명 여백을 사용해 상태 차이를 만들 수 있지만, 기준 크기와 앵커는 동일하게 유지한다.

업그레이드 아이콘 4종과 `coin`은 정사각형 기준 크기와 중앙 앵커를 사용한다. `background`는 별도 기준 크기를 가질 수 있지만, Scene이 배경 스케일을 계산할 때도 manifest의 `recommendedSize`를 참조한다. `src/assets/README.md`는 사람이 읽는 교체 설명이고, 구현자가 참조하는 계약은 `src/assets/assetManifest.ts`가 소유한다.

- [ ] **Step 2: 업그레이드 표현 매핑을 만든다**

`UpgradeDefinition`은 도메인/밸런스 데이터이므로 `iconAssetKey`를 넣지 않는다. `src/domain/constants.ts`는 UI 에셋 계약을 import하지 않는다. 업그레이드 ID와 아이콘 에셋 키의 연결은 표현 계층인 `src/ui/upgradePresentation.ts`에 둔다.

```ts
import type { AssetKey } from "../assets/assetManifest";
import type { UpgradeId } from "../domain/types";

export const UPGRADE_PRESENTATION: Record<
  UpgradeId,
  { iconAssetKey: AssetKey }
> = {
  club: { iconAssetKey: "upgradeClub" },
  catapult: { iconAssetKey: "upgradeCatapult" },
  baitBag: { iconAssetKey: "upgradeBaitBag" },
  mudTrap: { iconAssetKey: "upgradeMudTrap" },
};
```

- [ ] **Step 3: 임시 카툰 에셋 파일을 만든다**

필수 파일명 계약:

```text
src/assets/goblin-idle.svg
src/assets/goblin-hit.svg
src/assets/goblin-defeat.svg
src/assets/hit-spark.svg
src/assets/defeat-dust.svg
src/assets/coin.svg
src/assets/upgrade-club.svg
src/assets/upgrade-catapult.svg
src/assets/upgrade-bait-bag.svg
src/assets/upgrade-mud-trap.svg
src/assets/background.svg
```

고블린 `idle`, `hit`, `defeat` 상태는 한눈에 구분되어야 한다. 업그레이드 4종 아이콘은 작은 크기에서도 서로 다른 실루엣을 가져야 한다. 임시 에셋을 최종 아트로 교체해도 코드 변경을 최소화할 수 있도록 파일명과 manifest 키는 유지한다.

- [ ] **Step 4: 에셋 README에 교체 기준을 문서화한다**

`src/assets/README.md`에는 모바일 가독성 우선 2D 카툰 톤, 굵은 실루엣, 제한된 색 수, 고블린 상태 구분, 아이콘 실루엣 구분, 파일명 유지 원칙을 짧게 기록한다. 기준 크기와 앵커의 실제 값은 README가 아니라 `assetManifest.ts`의 `recommendedSize`와 `anchor`를 기준으로 삼는다.

- [ ] **Step 5: 에셋과 업그레이드 표현 계약을 검증한다**

검증 항목:

- 필수 파일이 모두 존재한다.
- manifest의 모든 `path`가 실제 파일을 가리킨다.
- 모든 `AssetDefinition.recommendedSize.width`와 `height`가 양수다.
- 모든 `AssetDefinition.anchor.x`와 `anchor.y`가 `0..1` 범위다.
- 고블린 3개 상태 에셋의 `recommendedSize`와 `anchor`가 동일하다.
- 업그레이드 4종 아이콘과 `coin`은 정사각형 기준 크기와 중앙 앵커를 사용한다.
- 고블린 `idle`, `hit`, `defeat`가 같은 파일을 공유하지 않는다.
- 업그레이드 4종 아이콘이 각각 별도 파일과 별도 manifest 키를 가진다.
- `UPGRADE_ORDER`의 모든 ID가 `UPGRADE_PRESENTATION`에 있다.
- `UPGRADE_PRESENTATION`의 모든 `iconAssetKey`가 `ASSETS`에 존재한다.
- 새 `UpgradeId`가 추가됐는데 표현 매핑이 빠지면 TypeScript 타입 또는 `upgrade-presentation.test.ts`가 실패한다.

Run:

```bash
npm test -- tests/unit/asset-manifest.test.ts tests/unit/upgrade-presentation.test.ts
```

Expected:

```text
PASS tests/unit/asset-manifest.test.ts
PASS tests/unit/upgrade-presentation.test.ts
```

### Task 9: Phaser 장면과 입력 영역

**Files:**
- Create: `src/game/sceneEvents.ts`
- Create: `src/game/GoblinScene.ts`
- Modify: `src/main.ts`
- Modify: `src/styles.css`

- [ ] **Step 1: 장면 이벤트 계약을 만든다**

```ts
import type { EnemyRenderState } from "../domain/types";

export type SceneToAppEvent =
  | { type: "pointerDirectAttackRequested" }
  | { type: "sceneReady" };

export type SceneGoblinVisualState = EnemyRenderState["visualState"] | "hit";

export type SceneVisualEffect =
  | {
      type: "showDamage";
      enemyInstanceId: number;
      source: "direct" | "catapult";
      damage: number;
    }
  | { type: "showDefeat"; enemyInstanceId: number };

export type AppToSceneEvent =
  | {
      type: "renderGoblinVisualState";
      enemy: EnemyRenderState;
    }
  | { type: "applyVisualEffects"; effects: SceneVisualEffect[] }
  | { type: "setInputBlocked"; blocked: boolean };
```

```ts
class GoblinScene extends Phaser.Scene {
  private baseEnemyRenderState: EnemyRenderState | null = null;
}
```

`renderGoblinVisualState`는 HP 바 렌더링용 이벤트가 아니다. 앱 조립부는 항상 `selectEnemyRenderState(state)` 결과를 이 이벤트의 `enemy`로 전달한다. `GoblinScene`은 `renderGoblinVisualState` 이벤트를 받을 때만 `baseEnemyRenderState`를 갱신한다. 이 이벤트의 `enemy.visualState`는 `"idle"` 또는 `"defeated"` 안정 상태만 가진다. Phaser는 이 값을 기준으로 고블린 스프라이트의 기본 상태와 레벨별 외형 힌트를 갱신한다. 현재 HP 숫자, 즉시 체력 바, 잔상 체력 바는 DOM HUD가 그린다.

`GoblinScene`은 `RuntimeState`를 import하지 않고, `selectEnemyRenderState`를 호출하지 않는다. Scene은 저장 가능한 게임 상태나 런타임 모드를 소유하지 않으며, 앱 조립부가 전달한 `EnemyRenderState` 렌더 캐시만 가진다.

`applyVisualEffects`는 같은 `RuntimeResult`에서 나온 전투 시각 effect batch다. 앱 조립부는 `purchaseFeedback`과 `save` effect를 이 batch에 넣지 않는다. 앱 조립부는 먼저 `renderGoblinVisualState`로 최신 base enemy render state를 전달하고, 그 다음 `applyVisualEffects`를 전달한다. 앱 조립부는 `sceneReady` 수신 전이나 `renderGoblinVisualState` 최초 전달 전에는 `applyVisualEffects`를 보내지 않는다.

`GoblinScene`은 방어적으로 `baseEnemyRenderState === null`인 상태에서 `applyVisualEffects`를 받으면 throw 없이 no-op 처리한다. no-op된 visual effect는 재생 대기열에 넣지 않는다. 개발 모드에서는 이 경우 디버그 로그를 남길 수 있지만, MVP 필수 구현은 아니다.

`"hit"`는 `SceneGoblinVisualState`에만 존재하는 Phaser 내부 transient visual state다. `applyVisualEffects`를 받을 때 Scene은 유효한 `showDefeat.enemyInstanceId` 집합을 먼저 계산한다. 그 다음 batch 내부 순서를 유지하며 `showDamage`를 처리한다. Scene은 먼저 `showDamage.enemyInstanceId`와 `baseEnemyRenderState?.enemyInstanceId`를 비교한다. id가 다르거나 `baseEnemyRenderState`가 없으면 stale damage effect로 보고 피해 숫자 표시와 `"hit"` sprite 전환을 모두 건너뛴다. id가 같고 그 id가 유효한 defeat id 집합에 포함되면 피해 숫자는 표시하되 `"hit"` sprite 전환은 건너뛴다. id가 같고 유효한 defeat id 집합에 포함되지 않을 때만 현재 `baseEnemyRenderState.enemyInstanceId`를 캡처하고 같은 적 인스턴스에 대해서만 짧게 `"hit"` 상태를 덮어쓴다. hit 애니메이션이 진행 중이어도 직접 공격 hit area와 DOM HP 렌더 기준은 바뀌지 않는다.

Scene은 visual state를 `defeated` > `hit` > `idle` 우선순위로 적용한다. 같은 `applyVisualEffects` batch에 특정 `enemyInstanceId`의 유효한 `showDefeat`가 있거나, 최신 `baseEnemyRenderState?.visualState === "defeated"`이면 같은 `enemyInstanceId`의 `showDamage`는 피해 숫자와 타격 이펙트만 만들고 `"hit"` sprite 전환은 건너뛴다. `showDefeat`가 유효하면 `defeated`가 최상위 visual이 된다. hit 타이머가 끝날 때 Scene은 무조건 `"idle"`로 되돌리지 않고 최신 `baseEnemyRenderState`를 다시 확인한다. 최신 `baseEnemyRenderState?.enemyInstanceId`가 캡처한 값과 다르면 이전 고블린의 stale callback이므로 아무 것도 하지 않는다. 최신 id가 같으면 `baseEnemyRenderState.visualState`로 복귀한다. 최신 id가 같더라도 `baseEnemyRenderState.visualState === "defeated"`이면 defeated를 유지한다.

`showDefeat`는 `applyVisualEffects` batch 안의 처치 연출 시작 알림이다. Scene은 `showDefeat.enemyInstanceId !== baseEnemyRenderState?.enemyInstanceId`이면 stale defeat effect로 보고 처치 스프라이트와 파티클을 만들지 않는다. Phaser는 이 effect로 런타임 전환 종료를 판단하지 않으며, 연출 시간이 필요하면 `DEFEAT_TRANSITION_MS`를 import해 사용한다. 전환 종료와 다음 고블린 표시 가능 여부는 `processFrame`이 갱신한 `RuntimeState.mode`만 따른다.

`state.mode === "defeatTransition"` 동안 Phaser는 `state.game`의 다음 고블린 레벨이나 체력을 직접 읽지 않는다. 처치 연출, `renderGoblinVisualState`, 클릭 영역 기준은 `selectEnemyRenderState`가 반환한 defeated snapshot 기준을 따른다.

- [ ] **Step 2: 고정 직접 공격 영역을 구현한다**

Phaser의 보이지 않는 Rectangle 또는 Zone을 고블린 중심에 둔다. 모바일 기준 최소 크기는 `160 x 160`이고, 스프라이트의 주요 몸통보다 작아지지 않는다. 피격 애니메이션과 squash/stretch는 이 영역의 좌표와 크기를 바꾸지 않는다.

- [ ] **Step 3: 포인터 입력을 구현한다**

직접 공격 영역 안에서 시작한 `pointerdown`만 직접 공격 후보 이벤트를 보낸다. 같은 포인터 조작의 후속 `click`은 사용하지 않는다. Phaser `GoblinScene`은 키보드 직접 공격을 처리하지 않는다. Space `keydown`은 DOM 앱 조립부의 `src/ui/focus.ts` 또는 그와 연결된 입력 어댑터가 처리한다.

직접 공격 영역 안에서 `pointerdown`이 성공적으로 직접 공격 후보가 되면 DOM 전투 컨테이너에 포커스를 준다. 상점, 모달, 버튼 위 포인터 입력은 UI 입력으로만 처리하고 전투 컨테이너로 포커스를 훔치지 않는다.

`pointerDirectAttackRequested`는 즉시 피해를 적용하는 이벤트가 아니다. 앱 조립부는 `sceneReady`를 받았고 현재 상태가 playable이며 `document.visibilityState === "visible"`일 때만 이 이벤트를 다음 frame의 `RuntimeFrameInput.directAttackRequested`로 합류시킨다. `sceneReady` 전 또는 `document.visibilityState !== "visible"` 상태의 포인터 직접 공격 후보는 큐잉하지 않고 버린다. `GoblinScene`은 이 이벤트를 만들기 위해 `performance.now()`를 직접 읽지 않는다.

- [ ] **Step 4: 피해 숫자와 고블린 상태 연출을 연결한다**

피해 숫자는 최대 6개를 유지하고 `DAMAGE_NUMBER_LIFETIME_MS` 뒤 제거한다. 직접 공격과 투석기 자동 공격의 피해 숫자는 구분한다. 같은 frame에 여러 `damageNumber`가 있으면 Scene은 전달받은 내부 순서를 표시 순서와 위치 오프셋 계산에만 사용한다. 고블린 idle/defeated 안정 상태, hit transient 애니메이션, 타격/처치 이펙트는 Phaser에서 처리하되, HP 숫자와 체력 바는 Phaser 캔버스 안에 그리지 않는다.

처치 연출 중 damage number와 defeat particle/defeat sprite는 함께 보일 수 있다. 금지되는 것은 같은 RuntimeResult에서 유효한 defeat effect가 있는 enemy에 대해 hit transient를 시작하거나, hit transient가 defeat visual을 덮거나, 이전 고블린의 stale hit 타이머 완료 콜백이 새 고블린 visual을 바꾸거나, hit 타이머 완료 콜백이 defeat visual을 `"idle"`로 되돌리는 동작이다.

- [ ] **Step 5: 수동 브라우저 확인을 한다**

Run:

```bash
npm run dev
```

Expected:

```text
Local: http://127.0.0.1:5173/
```

확인 항목:

- 고블린이 중앙에 보인다.
- `goblin-idle.svg`, `goblin-hit.svg`, `goblin-defeat.svg`가 Phaser 로드 오류 없이 사용된다.
- 직접 공격 영역을 누르면 피해 숫자가 나온다.
- 직접 공격 시 고블린 피격 상태가 스프라이트 또는 프레임 변경으로 확인된다.
- 피격 상태는 Scene의 transient `SceneGoblinVisualState`로만 나타나며 `EnemyRenderState.visualState`나 저장 상태에는 `"hit"`가 들어가지 않는다.
- lethal direct attack과 lethal catapult frame에서는 피해 숫자와 처치 연출이 함께 보이되, `"hit"` transient가 `defeated` visual을 덮지 않는다.
- 같은 `applyVisualEffects` batch에 direct damage, catapult damage, `showDefeat`가 있으면 Scene은 유효한 defeat id 집합을 먼저 계산해 `"hit"` transient를 억제하고, damage 표시 순서는 direct -> catapult를 유지한다.
- Scene은 개별 `showDamage`/`showDefeat` 이벤트 emit 순서가 아니라 `applyVisualEffects` batch 단위로 damage와 defeat 경합을 처리한다.
- `baseEnemyRenderState === null`인 Scene에 `applyVisualEffects`가 들어와도 throw 없이 no-op 처리되고, no-op된 effect가 나중에 재생되지 않는다.
- stale `showDamage.enemyInstanceId`가 최신 `baseEnemyRenderState?.enemyInstanceId`와 다르면 피해 숫자와 `"hit"` transient가 모두 표시되지 않는다.
- stale `showDefeat.enemyInstanceId`가 최신 `baseEnemyRenderState?.enemyInstanceId`와 다르면 처치 스프라이트와 파티클이 표시되지 않는다.
- hit 타이머 완료 콜백은 캡처한 `enemyInstanceId`와 최신 `baseEnemyRenderState?.enemyInstanceId`를 비교하며, 서로 다르면 새 고블린 visual을 변경하지 않는다.
- hit 타이머 완료 콜백은 최신 `baseEnemyRenderState.visualState`를 다시 확인하며, 같은 `enemyInstanceId`라도 처치 전환 중에는 `"idle"`로 되돌리지 않는다.
- 피격 애니메이션으로 클릭 영역이 움직이지 않는다.
- 처치 후 `DEFEAT_TRANSITION_MS` 동안 처치 스냅샷이 보인다.
- 처치 중 고블린 처치 상태가 스프라이트 또는 프레임 변경으로 확인된다.

### Task 10: DOM HUD, 상점, 모달

**Files:**
- Create: `src/ui/hud.ts`
- Create: `src/ui/shop.ts`
- Create: `src/ui/upgradePresentation.ts`
- Create: `src/ui/modal.ts`
- Create: `src/ui/focus.ts`
- Test: `tests/unit/shop-view-model.test.ts`
- Modify: `src/main.ts`
- Modify: `src/styles.css`

- [ ] **Step 1: HUD 표시를 구현한다**

HUD는 다음 값을 표시한다.

- 처치 수
- 보유 `녹슨 동전`
- 현재 클릭 피해량
- 현재 고블린 레벨
- 현재 HP 숫자
- 즉시 체력 바
- 잔상 체력 바
- `DEFEAT_TRANSITION_MS` 처치 전환 중 적 전용 스냅샷 표시
- 투석기 레벨 1 이상일 때만 남은 시간과 다음 피해량
- 저장 경고

HUD 전투 표시는 `state.mode === "ready" | "defeatTransition"`인 `PlayableRuntimeState`에서만 렌더한다. `loading`과 `loadError`에는 `game`이 없으므로 현재 HP, 체력 바, 상점 상태, 투석기 상태를 렌더링하지 않는다. `loadError`에서는 로드 오류 차단 모달만 표시하고 임시 전투 HUD를 만들지 않는다.

DOM HUD의 고블린 레벨, HP 숫자, 즉시 체력 바, 잔상 체력 바는 `selectEnemyRenderState(state)` 기준으로 렌더한다. 처치 수, 보유 재화, 저장 경고, 상점 구매 가능 상태 같은 전역 표시는 최신 `state.game`을 즉시 반영한다. 따라서 `defeatTransition` 중에도 전역 진행은 다음 고블린 기준으로 갱신될 수 있지만, 적 전용 표시는 전환 종료 전까지 defeated snapshot 기준을 유지한다.

HUD는 저장 경고를 직접 계산하지 않고 `PlayableRuntimeState.persistence.saveWarning`만 읽는다. `saveWarning: "none"`이면 경고를 숨기고, `"unsaved"`이면 일반 저장 실패 경고를 표시하며, `"storageUnavailable"`이면 저장소 접근 실패로 인한 비저장 세션 경고를 표시한다. HUD는 `GameState`, `saveDirty`, 최근 저장 시도 여부 같은 다른 상태를 보고 저장 경고를 추론하지 않는다.

저장 실패 경고와 구매 성공 피드백은 서로 다른 UI 영역이다. 저장 경고는 HUD 저장 경고 영역에 표시하고, 구매 성공/부족/차단 피드백은 상점 행 또는 버튼 주변의 로컬 피드백으로 표시한다. 저장 경고가 버튼 성공 피드백을 덮거나, 버튼 피드백이 저장 경고를 숨기면 안 된다.

HP 숫자, 즉시 체력 바, 잔상 체력 바, 고블린 레벨 표시는 DOM HUD 소유다. 체력 바는 시각적으로 고블린 하단에 배치하되 Phaser 캔버스 내부가 아니라 DOM 오버레이 레이아웃에서 배치한다. 실제 HP 숫자와 즉시 체력 바는 같은 `EnemyRenderState.hp` 기준으로 즉시 갱신한다. 잔상 체력 바는 DOM HUD의 렌더링 상태로만 `HP_GHOST_BAR_DELAY_MS` 늦게 따라오며, 처치 판정, 저장, 다음 고블린 체력 계산에 사용하지 않는다.

`DEFEAT_TRANSITION_MS` 처치 전환 중 DOM HUD는 처치 수, 재화, 저장 경고 같은 전역 상태를 `state.game` 기준으로 즉시 갱신하고, 고블린 레벨, HP 숫자, 즉시 체력 바, 잔상 체력 바 같은 적 전용 표시는 `selectEnemyRenderState(state)`가 반환한 처치된 고블린의 스냅샷을 유지한다. 전환 종료로 `mode`가 `ready`가 되는 시점에 selector가 다음 고블린의 `state.game` 값을 반환하고, 적 전용 표시도 새 고블린 기준으로 갱신한다.

- [ ] **Step 2: 상점 행을 구현한다**

업그레이드 행 순서는 항상 `club`, `catapult`, `baitBag`, `mudTrap`이다. 비용 부족 버튼은 `disabled`가 아니라 포커스 가능한 `구매 불가` 상태로 둔다. 비용 부족 텍스트는 `녹슨 동전 N개 부족` 형식을 사용한다.

`shop.ts`는 업그레이드 아이콘 파일 경로나 `switch(upgradeId)` 분기를 직접 갖지 않는다. 이름, 비용, 효과는 `UPGRADE_DEFINITIONS`에서 읽고, 아이콘은 `UPGRADE_PRESENTATION[upgradeId].iconAssetKey`와 `ASSETS`를 통해 읽는다. 아이콘은 접근성 이름을 대체하지 않는 시각 보조 요소이며, 업그레이드 행과 버튼의 접근성 이름은 업그레이드 이름, 현재 레벨, 비용, 구매 가능/불가 상태 텍스트로 구성한다.

상점 행은 렌더링 전에 명시적 view model로 계산한다.

```ts
export type ShopInputState =
  | "buyable"
  | "insufficientCoins"
  | "blockedByDefeatTransition";

export type ShopActivationBehavior =
  | "purchase"
  | "showInsufficientFeedback"
  | "ignoreBlocked";

export type ShopRowViewModel = {
  upgradeId: UpgradeId;
  iconAssetKey: AssetKey;
  inputState: ShopInputState;
  activationBehavior: ShopActivationBehavior;
  statusText: string;
  buttonText: string;
  ariaDisabled: boolean;
  describedById: string;
};
```

상태 우선순위는 `blockedByDefeatTransition` > `insufficientCoins` > `buyable`이다. `blockedByDefeatTransition`은 구매 성공과 비용 부족 실패 트랜잭션을 모두 막으며, `activationBehavior = "ignoreBlocked"`, `ariaDisabled = true`, `statusText = "잠시 후 구매 가능"` 또는 `"처치 처리 중"`을 사용한다. 전환 중에는 비용이 부족한 행도 `blockedByDefeatTransition`으로 표시하고 비용 부족 실패 피드백을 내지 않는다.

`insufficientCoins`는 입력 차단이 아니다. 버튼은 실제 HTML `disabled`가 아니며 포커스 가능해야 한다. `activationBehavior = "showInsufficientFeedback"`, `ariaDisabled = false`, `statusText = "녹슨 동전 N개 부족"`을 사용하고, 활성화 시 재화, 업그레이드 레벨, 투석기 쿨다운, 저장 상태를 바꾸지 않은 채 버튼 단위 실패 피드백만 표시한다.

`buyable`은 `activationBehavior = "purchase"`, `ariaDisabled = false`를 사용한다. 전환 종료 후 같은 최신 `PlayableRuntimeState`에서 상점 행을 다시 계산해 `buyable` 또는 `insufficientCoins`로 돌아간다. 구매 성공 피드백은 `success.previousLevel`과 `success.nextLevel`을 사용한 버튼 눌림, 레벨 숫자 증가 강조, 접근성 상태 문구 같은 로컬 피드백으로 제한한다. 재화 숫자, 다음 효과, 다음 비용은 success payload가 아니라 갱신된 `GameState`, `UPGRADE_DEFINITIONS`, `progression` 함수로 다시 계산한 row view model에서 표시한다. 상태 문구 영역은 고정 높이로 예약하고, `statusText`는 `describedById`를 통해 버튼의 `aria-describedby`에 연결한다. 전환 중에도 실제 HTML `disabled`는 가능하면 쓰지 않고, 포커스 유지형 `aria-disabled`와 핸들러 guard를 사용한다.

상점 버튼 활성화는 `processPurchase`를 단일 런타임 진입점으로 사용한다. `activationBehavior = "purchase"`이면 반환된 상태를 먼저 적용해 HUD/상점을 새 상태로 렌더하고, `RuntimeEffect { type: "purchaseFeedback", feedback: { kind: "success", previousLevel, nextLevel, ... } }`를 버튼 단위 성공 피드백으로 즉시 표시한 뒤, 저장 효과를 처리한다. 저장 실패나 저장소 접근 실패가 발생해도 구매 성공 피드백을 취소하지 않는다. `activationBehavior = "showInsufficientFeedback"`이면 `processPurchase`가 반환한 `RuntimeEffect { type: "purchaseFeedback", feedback: { kind: "insufficientCoins", ... } }`의 `missingCoins`를 버튼 단위 실패 피드백으로 표시하고 상태와 저장 효과는 적용하지 않는다. `activationBehavior = "ignoreBlocked"`이면 `processPurchase`가 반환한 `blockedByDefeatTransition` 구매 피드백 effect만 반영하고 구매 성공/실패 피드백과 저장 효과는 만들지 않는다. `loadError` 상태에서는 앱 조립부가 상점 버튼 활성화 자체를 `processPurchase`로 보내지 않는다.

`tests/unit/shop-view-model.test.ts`는 다음을 검증한다.

- 전환 중 구매 가능 행과 비용 부족 행이 모두 `blockedByDefeatTransition`으로 표시된다.
- 전환 중 행의 활성화 동작은 `ignoreBlocked`이며 구매 성공, 비용 부족 실패, 저장 효과를 만들지 않는다.
- 비용 부족 상태는 `showInsufficientFeedback`, `ariaDisabled: false`, `녹슨 동전 N개 부족` 상태 문구를 가진다.
- 구매 성공 feedback은 `previousLevel`과 `nextLevel`을 포함하며 `nextLevel === previousLevel + 1`이다.
- UI는 success payload로 레벨 증가 피드백과 접근성 상태 문구를 표시하고, 다음 비용/효과는 갱신된 state에서 계산한다.
- 구매 성공은 `success` 구매 피드백 effect로 버튼/숫자 중심 로컬 피드백을 표시하고, 전역 모달, 토스트, 화면 전체 연출을 만들지 않는다.
- 구매 성공과 저장 실패가 함께 발생해도 성공 피드백은 유지되고 저장 실패는 HUD 저장 경고 영역에만 표시된다.
- 저장소 접근 실패 세션에서도 구매 성공 피드백은 표시되고 `storageUnavailable` 저장 경고는 유지된다.
- 비용 부족 활성화는 `processPurchase`의 `insufficientCoins` 구매 피드백 effect를 버튼 단위 실패 피드백으로 표시하고 `GameState`와 저장 효과를 바꾸지 않는다.
- 전환 종료 후 행 상태가 최신 재화 기준으로 `buyable` 또는 `insufficientCoins`로 재계산된다.

Run:

```bash
npm test -- tests/unit/shop-view-model.test.ts
```

Expected:

```text
PASS tests/unit/shop-view-model.test.ts
```

- [ ] **Step 3: 모바일 하단 시트를 구현한다**

CSS 핵심 규칙:

```css
.shop-sheet {
  max-height: min(45dvh, calc(100dvh - 160px - var(--hud-height)));
}

.shop-scroll {
  overflow-y: auto;
  padding-bottom: calc(var(--shop-toggle-height) + env(safe-area-inset-bottom) + 8px);
  scroll-padding-bottom: calc(var(--shop-toggle-height) + env(safe-area-inset-bottom) + 8px);
}
```

마지막 업그레이드 행과 마지막 포커스 가능 요소는 하단 `상점` 토글과 안전 영역에 가려지지 않아야 한다.

- [ ] **Step 4: 모바일 상점 접근성 이름을 구현한다**

닫힘:

```text
상점 열기, 구매 가능 업그레이드 N개
상점 열기, 구매 가능 업그레이드 없음
```

열림:

```text
상점 닫기, 구매 가능 업그레이드 N개
상점 닫기, 구매 가능 업그레이드 없음
```

- [ ] **Step 5: 포커스 정책을 구현한다**

- 상점 열기: 시트 컨테이너 또는 제목에 프로그램 포커스
- 상점 닫기: 하단 상점 토글로 포커스 복구
- 상점 내부에 Tab 트랩 없음
- Space `keydown`은 앱 상태가 playable이고 `sceneReady`를 받았으며 `document.visibilityState === "visible"`일 때만, `event.target`이 `#game-root`, 전투 화면 컨테이너, 또는 명시적으로 전투 포커스가 허용된 요소일 때 직접 공격 후보로 큐잉
- `document.visibilityState !== "visible"` 상태의 Space `keydown`은 전투 입력으로 큐잉하지 않으며 나중에 재생하지 않음
- `sceneReady` 전 Space `keydown`은 전투 입력으로 큐잉하지 않으며 나중에 재생하지 않음
- 구매 버튼, 상점 토글, 시트 닫기 버튼, 모달 버튼, 모달 내부 요소, 기타 포커스 가능한 UI의 Space/Enter는 UI 입력으로만 처리하고 전투 입력으로 보내지 않음
- `event.repeat === true`인 Space `keydown`과 Space `keyup`은 직접 공격으로 처리하지 않음
- 실제 전투 입력으로 받아들인 Space `keydown`에서만 `preventDefault()`를 호출해 페이지 스크롤을 막음
- Enter는 고블린 공격으로 사용하지 않고 포커스된 UI 버튼 활성화에만 사용
- Escape는 상점 닫기에 사용하지 않음
- 저장 초기화 확인 모달에서 Escape는 취소
- 로드 오류 차단 모달에서 Escape는 무시

- [ ] **Step 6: 모달을 구현한다**

저장 초기화 확인 모달:

```text
정말 새 게임으로 시작할까요?
```

로드 오류 차단 모달:

```text
저장 데이터를 불러올 수 없습니다. 새 게임으로 시작하면 기존 저장은 삭제됩니다.
```

로드 오류 모달 버튼은 `다시 시도`, `새 게임 시작`, `취소`다. `취소`는 기존 저장을 삭제하지 않고 로드 오류 상태에 머문다.

버튼별 동작:

- `새 게임 시작`: 현재 `LoadErrorRuntimeState`와 `StorageAdapter`로 `startNewGameFromLoadError` 트랜잭션을 실행한다. 삭제 실패 시 `createLoadErrorState("deleteFailed")`로 만든 `stillLoadError` 상태와 `다시 시도`/`취소` 선택지를 유지하고 새 게임을 시작하지 않는다. 삭제 성공 후 시작 상태 저장이 실패하면 새 게임은 시작하되 `저장되지 않음` 경고를 표시한다.
- `다시 시도`: 현재 `LoadErrorRuntimeState`와 `StorageAdapter`로 `retryLoadFromLoadError`를 실행한다. 내부에서는 반드시 `loadGame(storage, "retryFromLoadError")`를 호출해 현재 저장소 값을 다시 읽고 전체 로드 파이프라인을 처음부터 실행한다. 기존 저장 복원에 성공하면 `loadedExistingSave`, 저장 키 없음에 따른 시작 상태 생성이면 `createdInitialGame`, 실패하면 기존 저장 삭제 없이 `stillLoadError`를 반환한다.
- `취소`: `cancelLoadError`를 실행한다. 저장 삭제, 새 게임 시작, 임시 플레이 시작을 모두 하지 않고 기존 `LoadErrorRuntimeState`를 유지한다.

로드 오류 모달이 열린 동안 배경 전투 입력, 구매 입력, `AUTO_SAVE_INTERVAL_MS` 자동 저장, 저장 효과 처리는 모두 차단한다.

- [ ] **Step 7: 저장 경고 렌더링 경계를 검증한다**

HUD 렌더링 테스트나 DOM 검증에서 `saveWarning: "none"`, `"unsaved"`, `"storageUnavailable"` 세 값만으로 저장 경고 표시가 결정되는지 확인한다. HUD는 `persistence.saveWarning` 외의 상태를 보고 저장 경고를 추론하지 않는다.

### Task 11: 저장 연동과 앱 조립

**Files:**
- Create: `src/app/autoSaveScheduler.ts`
- Create: `src/app/loadErrorActions.ts`
- Create: `src/app/loadErrorState.ts`
- Modify: `src/main.ts`
- Modify: `src/domain/runtime.ts`
- Modify: `src/domain/save.ts`
- Modify: `src/ui/hud.ts`
- Modify: `src/ui/shop.ts`
- Modify: `src/ui/modal.ts`
- Create: `tests/unit/auto-save-scheduler.test.ts`
- Create: `tests/unit/load-error-actions.test.ts`
- Create: `tests/unit/load-error-state.test.ts`
- Create: `tests/unit/app-effects.test.ts`

- [ ] **Step 1: 앱 부팅 순서를 구현한다**

```text
1. loadGame(storage, "boot")로 localStorage 읽기를 시도한다.
2. 읽기 실패면 시작 상태로 `mode: "ready"`를 시작하되 `persistence.kind: "unavailable"`로 둔다.
3. 저장 데이터가 없으면 시작 상태를 생성하고 즉시 저장을 시도한다.
4. 저장 데이터가 있으면 saveVersion을 먼저 확인한다.
5. 로드 성공이면 canonical `GameState`로 `mode: "ready"`와 `persistence.kind: "available"`를 시작하되, 기존 저장 정규화만으로 즉시 저장하지 않는다.
6. 로드 실패면 `loadGame(...).reason`을 `createLoadErrorState(reason)`으로 변환해 `LoadErrorRuntimeState`로 전환하고 loadError 모달을 표시한 뒤 전투 입력을 차단한다.
```

`loadError`는 저장소에는 접근했지만 저장 데이터를 복원할 수 없는 상태다. `LoadErrorRuntimeState`에는 `game`, `persistence`, `runtimeClock`이 없으며, `persistence.kind === "unavailable"`과 섞지 않는다. `loadError`에서는 고블린 공격, 업그레이드 구매, HUD 전투 상태 렌더링, 자동 저장, 저장 효과 처리를 모두 실행하지 않는다. 앱 최초 부팅은 반드시 `loadGame(storage, "boot")`를 호출한다. 이 맥락에서 `localStorage` 읽기 자체가 실패한 경우는 `LoadErrorRuntimeState`가 아니라 `ReadyRuntimeState` + `persistence.kind === "unavailable"`로 시작한다.

첫 실행, 저장 복원 성공, 저장소 접근 실패 세션 시작, 새 게임 시작은 모두 `ReadyRuntimeState`로 시작하고 `runtimeClock: { lastDirectAttackAtMs: null, lastVisibleTickAtMs: null }`를 가진다. 처치 전환 스냅샷의 `startedAtMs`도 새 세션 런타임 값이며 저장 복원 대상이 아니다.

```ts
type AppOrchestrationState = {
  runtime: RuntimeState;
  autoSaveScheduler: AutoSaveSchedulerState | null;
};
```

`autoSaveScheduler`는 앱 조립부 상태이며 `RuntimeState`에 넣지 않는다. `AutoSaveSchedulerState`는 `persistence.kind === "available"`인 playable 세션에서만 생성한다. 기존 저장 복원 성공, 저장 데이터 없음으로 초기 상태 생성 성공/실패, 새 게임 시작 성공처럼 `ReadyRuntimeState + persistence.kind === "available"`로 들어가는 경로에서만 scheduler를 만든다. boot read failure로 `ReadyRuntimeState + persistence.kind === "unavailable"`가 되면 `autoSaveScheduler = null`이다.

앱 조립부는 boot, 로드 오류 재시도, 새 게임 시작, 저장 초기화 같은 앱 액션을 처리할 때 액션 시작 또는 `ready` 전환 시점의 `performance.now()`를 한 번 읽고, `persistence.kind === "available"` 경로에서만 그 값을 자동 저장 스케줄러 생성이나 갱신에 사용한다. 이 `nowMs`는 `loadGame`이나 `save.ts`로 넘기지 않는다. `LoadResult.created`를 받으면 시작 상태 저장 시도가 있었던 결과이므로 앱 조립부는 해당 load 액션의 `nowMs`를 `autoSaveBaselineAtMs`로 기록한다. `LoadResult.loaded`를 받으면 정규화 여부와 관계없이 실제 저장 시도는 없고, 로드 직후 즉시 자동 저장하면 안 되므로 `autoSaveBaselineAtMs`를 `ready` 진입 시각으로 초기화한다.

- [ ] **Step 2: 로드 오류 상태 생성을 구현한다**

`src/app/loadErrorState.ts`는 저장 실패 원인인 `LoadErrorReason`을 앱 런타임 상태와 사용자 표시 메시지로 변환한다. 이 파일은 앱 계층이며, `src/domain/save.ts`에서 import하지 않는다.

```ts
import type { LoadErrorReason } from "../domain/saveTypes";
import type { LoadErrorRuntimeState } from "../domain/types";

export function createLoadErrorState(
  reason: LoadErrorReason
): LoadErrorRuntimeState;

export function formatLoadErrorMessage(
  reason: LoadErrorReason
): string;
```

`createLoadErrorState(reason)`과 `formatLoadErrorMessage(reason)`은 `LoadErrorReason` 전체를 받는다. `formatLoadErrorMessage`는 UI 표시와 `createLoadErrorState` 내부에서만 사용한다. 테스트의 분기 검증은 `message`가 아니라 `reason`을 기준으로 한다. `tests/unit/load-error-state.test.ts`는 각 `LoadErrorReason`이 비어 있지 않은 표시 메시지를 만들고, `createLoadErrorState(reason)`이 `{ mode: "loadError", reason, message }`를 생성하며, `message === formatLoadErrorMessage(reason)`을 만족하는지 검증한다.

- [ ] **Step 3: 로드 오류 복구 트랜잭션을 구현한다**

`src/app/loadErrorActions.ts`는 `StorageAdapter`를 주입받아 로드 오류 모달 버튼의 저장 side effect와 `LoadErrorRuntimeState`에서 `ReadyRuntimeState`로의 복구 전환을 조립한다. `src/domain/save.ts`에는 이 함수를 두지 않는다. `LoadErrorRuntimeState`, `ReadyRuntimeState`는 `types.ts`에서 type-only import하고, reason 타입이 필요하면 `saveTypes.ts`에서 type-only import한다. `retryLoadFromLoadError`와 `startNewGameFromLoadError`는 `loadGame`, `deleteSave`, `saveGame` 결과의 `reason`을 직접 메시지 문자열로 만들지 않고 `createLoadErrorState(reason)`으로 변환한다.

```ts
export type LoadErrorActionResult =
  | { kind: "startedNewGame"; state: ReadyRuntimeState }
  | { kind: "loadedExistingSave"; state: ReadyRuntimeState }
  | { kind: "createdInitialGame"; state: ReadyRuntimeState }
  | { kind: "stillLoadError"; state: LoadErrorRuntimeState };

export function startNewGameFromLoadError(
  state: LoadErrorRuntimeState,
  storage: StorageAdapter
): LoadErrorActionResult;
export function retryLoadFromLoadError(
  state: LoadErrorRuntimeState,
  storage: StorageAdapter
): LoadErrorActionResult;
export function cancelLoadError(
  state: LoadErrorRuntimeState
): LoadErrorRuntimeState;
```

로드 오류 모달 핸들러는 일반 `RuntimeState`를 받더라도 `state.mode === "loadError"`일 때만 이 함수들을 호출한다. 이 함수들의 시그니처도 `LoadErrorRuntimeState`를 요구하므로, 잘못된 상태에서의 호출은 타입으로도 막는다.

`LoadErrorActionResult.kind`는 사용자 액션과 저장 복구 결과를 섞지 않는다. `startedNewGame`은 사용자가 `새 게임 시작`을 눌렀고 `deleteSave`가 성공한 뒤 시작 상태를 만든 파괴적 선택에만 사용한다. `loadedExistingSave`는 `다시 시도`에서 기존 저장 데이터를 복원한 경우에만 사용한다. `createdInitialGame`은 `다시 시도`에서 저장소 읽기는 성공했지만 저장 키가 없어 시작 상태를 만든 비파괴적 결과에만 사용한다. `createdInitialGame`의 시작 상태 저장 성공 또는 실패는 결과 이름이 아니라 `ReadyRuntimeState.persistence.saveWarning`으로 표현하며, 저장 실패면 `saveWarning: "unsaved"`다.

`새 게임 시작` 순서:

```text
1. 현재 mode가 loadError인지 확인한다.
2. deleteSave(storage)를 호출한다.
3. 삭제 실패면 기존 저장이 유지된 것으로 간주하고 loadError에 머문다.
4. 삭제 성공이면 createInitialGameState()로 시작 상태를 만든다.
5. 시작 상태 saveGame(storage, initialState)를 시도한다.
6. 저장 성공이면 mode = ready, persistence = available/none으로 시작한다.
7. 저장 실패면 mode = ready, persistence = available/unsaved로 시작한다.
```

삭제 실패 시 기존 `LoadErrorRuntimeState`를 유지하되, `createLoadErrorState("deleteFailed")`로 만든 `{ kind: "stillLoadError"; state }`를 반환한다. `deleteFailed`는 이 `deleteSave` 실패 경로에서만 생성한다. 삭제 성공 후 시작 상태 저장 실패는 이미 파괴적 동작이 확정된 뒤이므로 이전 저장을 복구하려 하지 않고 새 게임을 진행하되 `unsaved` 경고를 표시한다.

삭제 성공 후 시작 상태 `saveGame`은 실제 저장 시도다. 저장 성공/실패와 관계없이 앱 조립부는 이 액션을 처리할 때 읽은 `nowMs`로 자동 저장 스케줄러의 `autoSaveBaselineAtMs`를 갱신한다. 이 시각은 `saveGame`이나 `save.ts`가 생성하지 않는다.

`다시 시도` 순서:

```text
1. loadGame(storage, "retryFromLoadError")로 현재 localStorage 값을 다시 읽는다.
2. 파싱, saveVersion 확인, 마이그레이션, 필드 정규화 전체 로드 파이프라인을 처음부터 실행한다.
3. 저장 키가 없으면 시작 상태 생성과 시작 상태 저장 시도로 처리하고 `createdInitialGame`을 반환한다.
4. 성공하면 mode = ready로 전환한다.
5. 읽기 실패면 `reason: "readFailed"`로 loadError에 머문다.
6. 파싱 실패면 `reason: "parseFailed"`로 loadError에 머문다.
7. 마이그레이션 실패면 `reason: "migrationFailed"`로 loadError에 머문다.
8. 실패 시 기존 저장을 삭제하지 않는다.
```

`취소` 순서:

```text
1. 저장 삭제를 하지 않는다.
2. 새 게임을 시작하지 않는다.
3. mode = loadError를 유지한다.
```

검증 항목:

- `startNewGameFromLoadError`는 `LoadErrorRuntimeState`만 받으며, 삭제 실패 시 `saveGame`을 호출하지 않고 `createLoadErrorState("deleteFailed")`로 만든 `stillLoadError` 상태를 반환한다.
- load error action 테스트는 삭제 실패 경로만 `deleteFailed` 상태를 만드는지 검증한다.
- 삭제 성공과 시작 상태 저장 성공은 `startedNewGame`과 `saveWarning: "none"`을 만든다.
- 삭제 성공과 시작 상태 저장 실패는 `startedNewGame`과 `saveWarning: "unsaved"`를 만든다.
- 삭제 성공 후 시작 상태 저장 성공/실패는 모두 앱 조립부에 주입한 액션 `nowMs`로 자동 저장 스케줄러의 `autoSaveBaselineAtMs`를 갱신한다.
- `retryLoadFromLoadError`는 `LoadErrorRuntimeState`만 받으며 `loadGame(storage, "retryFromLoadError")`를 호출한다.
- `retryLoadFromLoadError`는 복원 성공이면 `loadedExistingSave`를 반환하고, 저장 키 없음으로 시작 상태를 만든 경우는 `createdInitialGame`을 반환한다.
- `createdInitialGame`은 `loadedExistingSave`나 `startedNewGame`으로 반환하지 않는다.
- `createdInitialGame`에서 시작 상태 저장이 실패하면 `ReadyRuntimeState.persistence.saveWarning === "unsaved"`다.
- `retryLoadFromLoadError`가 파싱, 마이그레이션, 읽기 실패 등으로 실패하면 저장 삭제 없이 `createLoadErrorState(reason)`으로 만든 `parseFailed`, `migrationFailed`, `readFailed` reason의 `stillLoadError` 상태를 반환한다.
- `cancelLoadError`는 저장 삭제, 시작 상태 생성, 저장 시도 없이 `LoadErrorRuntimeState`를 그대로 반환하거나 메시지만 유지한다.
- `formatLoadErrorMessage(reason)` 문구 변경은 action 단위 테스트의 상태 분기 검증을 깨뜨리지 않는다. action 테스트는 `message`가 아니라 `reason`과 결과 `kind`를 검증한다.
- `loadError` 상태에는 `game`이 없으며, 전투 입력, 구매 입력, `AUTO_SAVE_INTERVAL_MS` 자동 저장, 저장 효과 처리를 모두 차단한다.

- [ ] **Step 4: 저장 효과를 연결한다**

`processFrame` 또는 `processPurchase`가 반환한 `RuntimeEffect { type: "save" }`만 저장 시스템으로 연결한다. 앱 조립부는 직접 공격 이벤트, 투석기 tick, 자동 저장 타이머에서 `saveGame`을 직접 호출하지 않는다. 저장 효과 처리는 `PlayableRuntimeState`에서만 수행한다.

앱 조립부는 `RuntimeEffect[]`의 cross-type 배열 순서에 의존하지 않는다. 반환된 `RuntimeState`를 먼저 적용해 HUD/상점/DOM을 렌더한 뒤, effect를 type별로 필터링한다. `damageNumber`와 `defeatTransitionStarted`는 같은 `RuntimeResult` 단위의 `SceneVisualEffect[]`로 변환해 `applyVisualEffects` batch로 전달하고, `purchaseFeedback`은 DOM 상점 로컬 피드백으로 처리한다. 마지막에 `save` effect를 처리한다. 저장 결과는 `applySaveEffectResult`로 `RuntimeState.persistence`에 반영하고 저장 경고 UI만 갱신한다. 같은 type 내부에서는 런타임 함수가 반환한 순서를 보존할 수 있다. `damageNumber` 내부 순서는 `applyVisualEffects` batch 안에서도 유지하며 피해 숫자 표시 순서와 위치 오프셋에만 사용한다. 이 순서는 게임 상태와 저장 결과에 영향을 주지 않는다.

- `persistence.kind === "available"`이면 `saveGame`으로 연결한다. `saveGame` 결과가 `"saved"`면 `applySaveEffectResult(state, "saved")`, `"failed"`면 `applySaveEffectResult(state, "failed")`로 런타임 상태를 갱신한다.
- `persistence.kind === "unavailable"`이면 실제 `localStorage` 쓰기를 시도하지 않고 `applySaveEffectResult(state, "skippedStorageUnavailable")`로 처리해 `storageUnavailable` 경고를 유지한다.
- 앱 조립부와 UI는 `localStorage`를 직접 호출하지 않는다. 저장 접근은 `loadGame`, `saveGame`, `deleteSave` 또는 테스트 모드에서 교체된 `StorageAdapter`를 통해서만 수행한다.
- 저장소 접근 실패 세션에서도 런타임 전투, 처치, 재화 획득, 업그레이드 구매는 일반 세션과 동일하게 메모리 상태에서 처리한다.
- 저장 실패 후 이후 어떤 저장 효과든 성공하면 `applySaveEffectResult(..., "saved")`를 통해 `unsaved` 경고를 즉시 해제한다.
- 어떤 경로든 `persistence.kind === "available"` 상태에서 실제 `saveGame` 호출까지 갔다면, 저장 성공/실패와 관계없이 앱 조립부가 해당 트랜잭션에서 읽은 `nowMs`로 `autoSaveBaselineAtMs`를 갱신한다.
- 자동 저장 실패는 `unsaved` 경고만 만들고, 다음 프레임마다 즉시 재시도하지 않는다.
- 같은 ready 프레임에서 전투 저장 사유와 pending autoSaveDue가 병합된 저장 시도가 실패해도 due는 소비된 것으로 본다.
- 같은 브라우저 update turn에서 구매 성공 저장 효과가 pending autoSaveDue를 만족시킨 저장으로 처리된 경우도, 저장 성공/실패와 관계없이 due는 소비된 것으로 본다.
- `persistence.kind === "unavailable"`이면 실제 `saveGame` 호출이 없으므로 자동 저장 due 소비 판단과 `autoSaveBaselineAtMs` 갱신에서 제외한다. 이 세션에서는 자동 저장 시도 자체를 만들지 않고 `storageUnavailable` 경고를 유지한다.

검증 항목:

- 저장 실패 후 `applySaveEffectResult(..., "failed")`가 `unsaved` 경고를 만든다.
- 이후 저장 성공 결과가 `unsaved`를 `none`으로 해제한다.
- 자동 저장 실패 후 `unsaved`가 표시되고 다음 프레임에 즉시 재시도하지 않는지 검증한다.
- 실패한 자동 저장 후 다음 due가 `AUTO_SAVE_INTERVAL_MS` 뒤로 잡히는지 검증한다.
- `tests/unit/auto-save-scheduler.test.ts`는 생성 직후 `AUTO_SAVE_INTERVAL_MS` 전에는 due가 false이고, `AUTO_SAVE_INTERVAL_MS` 이상 지나면 due가 true인지 검증한다.
- `recordAutoSaveBaseline` 호출 후 due 기준이 새 시각으로 이동하는지 검증한다.
- 앱 조립부 테스트는 `readyEntryWithoutSaveAttempt_initializesAutoSaveBaseline`처럼 기존 저장 복원 후 즉시 자동 저장을 막기 위한 baseline 기록 사유를 테스트명에 드러낸다.
- 앱 조립부 테스트는 `actualSaveAttempt_movesAutoSaveBaselineEvenWhenSaveFails`처럼 실제 저장 시도 후 성공/실패와 관계없이 baseline이 이동하는 사유를 테스트명에 드러낸다.
- `readyEntryWithoutSaveAttempt`와 `actualSaveAttempt`는 테스트명/문서 주석/구현 주석용 용어이며, `recordAutoSaveBaseline` 함수 인자, 런타임 타입, `RuntimeEffect` payload에 추가하지 않는다.
- `src/app/autoSaveScheduler.ts`가 `RuntimeState`, `GameState`, `SaveData`, `StorageAdapter`를 import하지 않고 `AUTO_SAVE_INTERVAL_MS`에만 의존하는지 구조적으로 확인한다.
- `processFrame`은 `AutoSaveSchedulerState`를 받거나 수정하지 않고 `autoSaveDue: boolean`만 받는지 검증한다.
- `getRuntimeSnapshot`과 `setRuntimeState` 같은 테스트 하네스 `RuntimeState` snapshot에 자동 저장 스케줄러 상태가 포함되지 않는지 검증한다.
- `getRuntimeSnapshot()`이 반환한 객체를 테스트에서 변이해도 실제 하네스 runtime이 바뀌지 않는지 검증한다.
- `setRuntimeState(input)` 호출 후 원본 `input` 객체를 변이해도 하네스 runtime이 바뀌지 않는지 검증한다.
- `setRuntimeState`가 mode별 top-level 추가 필드와 누락 필드를 거부하고 runtime과 scheduler를 바꾸지 않는지 검증한다.
- `setRuntimeState`가 `game`, `persistence`, `runtimeClock`, `defeatedSnapshot`, `upgrades` 같은 중첩 객체의 추가 필드, 누락 필드, `null`, 배열을 거부하는지 검증한다.
- boot read failure로 시작한 `storageUnavailable` 세션에서 `AppOrchestrationState.autoSaveScheduler === null`인지 검증한다.
- `autoSaveScheduler === null`이면 `isAutoSaveDue`를 호출하지 않고 `RuntimeFrameInput.autoSaveDue`가 항상 `false`로 전달되는지 검증한다.
- storage-unavailable 세션에서도 전투와 구매는 메모리 상태에서 정상 동작하지만 자동 저장 저장 시도는 발생하지 않는지 검증한다.
- 테스트 하네스 `setRuntimeState(availablePlayableState)`는 `assertRuntimeStateForTest` 통과 후 `createAutoSaveSchedulerState(performance.now())`로 scheduler를 재동기화하고, 직후 자동 저장 due가 즉시 발생하지 않는지 검증한다.
- 테스트 하네스 `setRuntimeState(storageUnavailablePlayableState | loading | loadError)`는 scheduler를 `null`로 재동기화하고, 이후 자동 저장 due가 생성되지 않는지 검증한다.
- `setRuntimeState`에 불가능한 상태를 넘기면 runtime과 scheduler를 모두 기존 상태로 유지한 채 throw하는지 검증한다.
- `setRuntimeState`에 `structuredClone` 불가능한 값이 포함된 `RuntimeState`를 넘기면 테스트 오류를 내고 runtime과 scheduler를 모두 기존 상태로 유지하는지 검증한다.
- `defeatedSnapshot.startedAtMs`가 `NaN`, `Infinity`, 음수이면 `assertRuntimeStateForTest`가 실패하는지 검증한다.
- `startedAtMs`가 현재 시각보다 미래처럼 보이는 값이어도 `setRuntimeState` 단계에서는 허용하고, `processFrame`의 `input.nowMs` 기준으로 전환 종료 여부만 판단하는지 검증한다.
- `advanceRuntimeFrame` 호출 후 하네스 runtime이 반환된 `RuntimeFrameResult.state`로 교체되는지 검증한다.
- `advanceRuntimeFrame`은 `input`이 정확한 plain object가 아니면 `processFrame`을 호출하지 않고 throw하는지 검증한다.
- `advanceRuntimeFrame`은 배열, `null`, 누락 필드, 추가 필드가 있는 input을 모두 거부하고 runtime과 scheduler를 바꾸지 않는지 검증한다.
- `advanceRuntimeFrame`은 잘못된 `visibilityState`, 문자열 boolean 같은 비정상 literal을 거부하고 runtime과 scheduler를 바꾸지 않는지 검증한다.
- 올바른 exact `RuntimeFrameInput` object만 `processFrame`까지 전달되는지 검증한다.
- `advanceRuntimeFrame`의 `input.nowMs`가 `NaN`, `Infinity`, 음수이면 throw하고 runtime과 scheduler를 바꾸지 않는지 검증한다.
- `input.nowMs < runtimeClock.lastDirectAttackAtMs`이면 `advanceRuntimeFrame`이 throw하고 runtime과 scheduler를 바꾸지 않는지 검증한다.
- `input.nowMs < runtimeClock.lastVisibleTickAtMs`이면 `advanceRuntimeFrame`이 throw하고 runtime과 scheduler를 바꾸지 않는지 검증한다.
- `input.nowMs < defeatedSnapshot.startedAtMs`는 `advanceRuntimeFrame`의 clock monotonic 검증만으로 막지 않고, 전환 미완료 상태로 처리할 수 있는지 검증한다.
- hidden 상태에서 포인터 직접 공격 후보와 Space 직접 공격 후보가 `directAttackRequested`로 큐잉되지 않는지 검증한다.
- `advanceRuntimeFrame({ visibilityState: "hidden", directAttackRequested: true, ... })`이 throw하고 runtime과 scheduler를 바꾸지 않는지 검증한다.
- `processFrame`이 직접 공격 제한이나 투석기 tick에서 음수 delta를 0으로 보정하지 않는 책임 경계를 문서와 테스트에서 확인한다.
- `advanceRuntimeFrame` 반환 `result.state`를 변이해도 이후 `getRuntimeSnapshot()` 결과가 바뀌지 않는지 검증한다.
- `advanceRuntimeFrame` 반환 `result.effects`를 변이해도 이후 하네스 상태가 바뀌지 않는지 검증한다.
- `advanceRuntimeFrame` 결과에 `structuredClone` 불가능한 값이 있으면 runtime과 scheduler를 기존 상태로 유지한 채 throw하는지 검증한다.
- `advanceRuntimeFrame`이 반환한 `save` effect가 있어도 storage adapter `write`, `saveGame`, `applySaveEffectResult`, `autoSaveScheduler` 갱신이 자동 실행되지 않는지 검증한다.
- `advanceRuntimeFrame`이 반환한 `damageNumber`, `defeatTransitionStarted`, `purchaseFeedback` effect가 있어도 Scene/DOM handler가 자동 실행되지 않는지 검증한다.
- `advanceRuntimeFrame` 호출 시 현재 runtime이 `loading` 또는 `loadError`이면 명확한 테스트 오류를 내고 runtime과 scheduler를 바꾸지 않는지 검증한다.
- hidden 상태에서는 투석기 쿨다운이 감소하지 않고, visible 복귀 시 hidden 동안의 경과 시간 catch-up이 발생하지 않는지 기존 visibility 테스트와 연결한다.
- 전투/구매 저장 성공이 기존 `unsaved`를 해제하는지 검증한다.
- `setSaveData`가 추가 top-level 필드, 추가 `GameState` 필드, `state` 또는 `upgrades`의 `null`/배열 값을 거부하고 storage를 변경하지 않는지 검증한다.
- `setSaveData`가 알 수 없는 upgrade key와 누락 upgrade key를 모두 거부하는지 검증한다.
- `SaveData.savedAt`만 optional 필드로 허용하고, 없거나 finite number일 때만 통과하는지 검증한다.
- invalid, future, legacy save format은 `setSaveData`가 아니라 `setRawSave(raw)`로만 구성하는지 검증한다.
- pending autoSaveDue와 다른 `processFrame` 저장 사유가 병합된 저장 시도가 실패해도 due는 소비되는지 검증한다.
- 구매 성공 저장이 발생하면 자동 저장 기준 시각 `autoSaveBaselineAtMs`가 갱신되고 다음 자동 저장 due가 `AUTO_SAVE_INTERVAL_MS` 뒤로 밀리는지 검증한다.
- 저장 실패도 `autoSaveBaselineAtMs`를 갱신해 다음 프레임 즉시 재시도하지 않는지 검증한다.
- 기존 저장을 `loadedExistingSave` 또는 boot loaded save로 복원해 `ready`에 진입하면 앱 조립부에 주입한 ready 진입 `nowMs`가 자동 저장 기준 시각으로 기록되어 즉시 자동 저장이 발생하지 않는지 검증한다.
- v1 저장 데이터가 정규화되어 복원되어도 load 직후 storage write가 발생하지 않고, `persistence.saveWarning`이 `unsaved`가 아닌지 검증한다.
- 정규화 복원 이후 구매, 전투, 또는 자동 저장이 발생하면 canonical `GameState`가 저장되는지 검증한다.
- `loadGame(...).created`, `createdInitialGame`, `startedNewGame`, 저장 초기화 후 시작 상태 저장처럼 실제 시작 상태 `saveGame`이 있는 경로는 성공/실패와 관계없이 앱 조립부에 주입한 액션 `nowMs`를 `autoSaveBaselineAtMs`로 기록하는지 검증한다.
- `SaveData.savedAt` 값이 자동 저장 due 계산에 영향을 주지 않는지 검증한다.
- `saveGame(storage, state)`가 저장한 JSON에는 기본적으로 `savedAt`이 없고, `saveGame` 내부에서 `Date.now()`나 `performance.now()`를 호출하지 않는지 검증한다.
- 저장소 접근 실패 세션에서 저장 효과가 처리되어도 `saveGame` 또는 storage adapter의 `write`가 호출되지 않고 `storageUnavailable`이 유지된다.
- `tests/unit/app-effects.test.ts`는 effect 배열 순서를 바꿔도 앱 조립부가 type별 우선순서로 같은 상태 적용, visual/local feedback, 저장 결과를 만드는지 검증한다.
- `GoblinScene`은 `RuntimeState`를 import하지 않고 `selectEnemyRenderState`를 호출하지 않는지 구조적으로 확인한다.
- `GoblinScene`은 `renderGoblinVisualState` 수신 시에만 `baseEnemyRenderState`를 갱신하는지 확인한다.
- `processFrame` 또는 `processPurchase` 한 transaction에서 `save` effect가 최대 1개인지 검증한다.
- `RuntimeEffect { type: "save" }` payload가 `{ type: "save"; state: GameState }`이고 `reason`, `source`, `autoSave`, `purchase`, `combat` 같은 저장 사유 필드를 갖지 않는 타입 계약을 검증한다.
- 전환 종료 프레임에 `autoSaveDue: true`가 들어와도 save effect가 없고 due가 소비되지 않는지 검증한다.
- 전환 종료 다음 `ready` 프레임에서 자동 저장 save effect가 한 번 발생하는지 검증한다.
- 지연된 due가 여러 번 누적되어도 `ready` 프레임에서 저장을 여러 번 만들지 않는지 검증한다.
- `autoSaveDue`와 다른 `processFrame` 저장 사유가 같은 `ready` 프레임에 겹치면 save effect가 1개만 나오고 due가 갱신 가능한 상태가 되는지 검증한다.
- 자동 저장 due가 pending인 같은 브라우저 update turn에서 구매 성공 `save` effect가 발생하면, 앱 조립부가 추가 자동 저장을 만들지 않고 due를 처리된 것으로 갱신하는지 검증한다.
- 자동 저장 due가 pending이어도 비용 부족 구매나 전환 차단 구매처럼 `save` effect가 없는 트랜잭션은 due를 소비하지 않는지 검증한다.
- `persistence.kind === "unavailable"`에서 저장 효과가 `skippedStorageUnavailable`로 처리되어도 실제 `saveGame` 호출이 없으므로 자동 저장 due 소비 판단에서 제외되는지 검증한다.
- `skippedStorageUnavailable`은 실제 `saveGame` 호출이 아니므로 `autoSaveBaselineAtMs`를 갱신하지 않는지 검증한다.
- 같은 type 내부의 visual/local feedback effect 순서는 보존되지만 게임 상태나 저장 결과를 바꾸지 않는지 검증한다.
- 같은 frame에서 direct와 catapult damage가 모두 발생하면 `damageNumber`가 direct -> catapult 순서로 `applyVisualEffects` batch에 들어가는지 검증한다.
- `damageNumber` 내부 순서를 바꿔도 `GameState`와 `SaveData`는 변하지 않는지 검증한다.
- cross-type 처리 순서는 앱 조립부 type 우선순위가 결정하고, `damageNumber` 내부 순서만 `applyVisualEffects` 표시 순서로 보존되는지 검증한다.
- 앱 조립부는 같은 `RuntimeResult`의 `damageNumber`와 `defeatTransitionStarted`만 `SceneVisualEffect[]` batch로 변환하고, `purchaseFeedback`과 `save`를 Scene batch에 넣지 않는지 검증한다.
- 앱 조립부는 `renderGoblinVisualState`를 먼저 전달한 뒤 `applyVisualEffects` batch를 전달하는지 검증한다.
- 최초 playable state에서 앱 조립부가 `renderGoblinVisualState`를 `applyVisualEffects`보다 먼저 전달하는지 검증한다.
- 앱 조립부가 `sceneReady` 수신 전에는 포인터 직접 공격 후보와 Space 직접 공격 후보를 `directAttackRequested`로 전달하지 않는지 검증한다.
- 앱 조립부가 `renderGoblinVisualState`를 한 번 이상 보낸 뒤에만 `applyVisualEffects`를 보낼 수 있는지 검증한다.
- 같은 batch에 direct damage, catapult damage, `showDefeat`가 있으면 Scene이 유효한 defeat id 집합을 먼저 계산해 `"hit"` transient를 억제하는지 검증한다.
- Scene이 개별 이벤트 emit 순서가 아니라 `applyVisualEffects` batch 단위로 `showDamage`와 `showDefeat` 경합을 처리하는지 검증한다.
- lethal direct attack frame에서 `damageNumber`와 `defeatTransitionStarted`가 함께 처리되어도 Scene visual은 `defeated`를 유지한다.
- lethal catapult frame에서도 `damageNumber`와 `defeatTransitionStarted`가 함께 처리되어도 Scene visual은 `defeated`를 유지한다.
- lethal direct/catapult frame에서 `defeatTransitionStarted.enemyInstanceId`가 처치된 고블린 id를 가진다.
- non-lethal direct/catapult damage effect가 현재 고블린 `enemyInstanceId`를 가진다.
- lethal direct/catapult damage effect가 처치된 고블린 `enemyInstanceId`를 가진다.
- lethal frame에서 `damageNumber.enemyInstanceId`가 전환 snapshot의 `EnemyRenderState.enemyInstanceId`와 일치해 피해 숫자가 표시된다.
- stale damage effect는 새 고블린에 피해 숫자나 `"hit"` transient를 만들지 않는다.
- stale defeat effect는 새 고블린에 처치 스프라이트나 파티클을 만들지 않는다.
- damage, hit, defeat stale 판단이 모두 `enemyInstanceId` 규칙을 사용한다.
- direct non-lethal damage와 catapult lethal damage가 같은 frame에 발생하면 `damageNumber`는 direct -> catapult 순서로 둘 다 표시되고, 같은 `enemyInstanceId`의 `"hit"` transient는 적용되지 않으며, defeat visual이 적용된다.
- 같은 frame에 유효한 defeat effect가 없는 non-lethal direct + catapult damage는 `"hit"` transient를 허용한다.
- lethal frame에서는 같은 `enemyInstanceId`의 hit timer가 생성되지 않는다.
- hit 타이머 완료 콜백은 캡처한 `enemyInstanceId`와 최신 `baseEnemyRenderState?.enemyInstanceId`가 다르면 새 고블린 visual을 변경하지 않는다.
- hit 타이머 완료 콜백은 최신 `baseEnemyRenderState.visualState`를 다시 확인하며, id가 같으면 최신 base visual로 복귀하고 처치 전환 중 defeat visual을 `"idle"`로 되돌리지 않는다.
- non-lethal damage에서는 `"hit"` transient가 정상 적용된 뒤 최신 base visual로 돌아간다.
- 구매 성공과 저장 실패가 같은 트랜잭션에서 발생하면 레벨과 재화는 갱신되고 `success` 구매 피드백은 표시되며, 저장 실패는 `unsaved` 경고로만 표시된다.
- 저장소 접근 실패 세션에서 구매가 성공하면 `success` 구매 피드백은 표시되고, 저장 효과는 실제 쓰기 없이 `skippedStorageUnavailable`로 처리되어 `storageUnavailable` 경고가 유지된다.
- 저장 실패는 구매 상태를 롤백하지 않는다.
- `mode === "loadError"`이면 `game`이 없으므로 저장 효과 처리 대상이 아니며, 남아 있는 저장 효과가 있더라도 처리하지 않는다.

- [ ] **Step 5: 브라우저 프레임 입력을 구성한다**

실제 브라우저 앱 조립부만 `performance.now()`를 호출한다. 앱 조립부는 `performance.now()` 기반 단조 증가 시간을 `RuntimeFrameInput.nowMs`로 사용한다. 앱 조립부는 현재 상태가 `ready` 또는 `defeatTransition`인 `PlayableRuntimeState`일 때만 매 animation/update frame마다 `RuntimeFrameInput`을 만들어 `processFrame`에 전달한다. `loading`과 `loadError`에서는 프레임 입력을 만들지 않는다. 도메인/런타임 함수 내부에서 직접 `performance.now()`를 호출하지 않는다.

앱 조립부는 `sceneReady` 수신 전에는 포인터 또는 키보드 직접 공격 후보를 `RuntimeFrameInput.directAttackRequested`로 큐잉하지 않는다. `document.visibilityState !== "visible"`일 때도 포인터 또는 키보드 직접 공격 후보를 큐잉하지 않고 나중에 재생하지 않는다. 포인터 직접 공격 후보는 Phaser `GoblinScene`의 hit area에서 오고, 키보드 직접 공격 후보는 DOM 포커스 게이트에서 온다. 둘 다 앱이 playable + sceneReady + visible 상태일 때만 다음 frame의 `directAttackRequested` 플래그로 합류하며, 즉시 런타임 저장이나 전투 상태 변경을 만들지 않는다. 같은 frame 안에 포인터와 키보드 입력이 모두 들어와도 `processFrame`은 `DIRECT_ATTACK_MIN_INTERVAL_MS` 제한을 적용해 최대 1회만 처리한다. `AUTO_SAVE_INTERVAL_MS` 자동 저장 타이머는 별도 런타임 명령이 아니라 다음 frame의 `autoSaveDue`로 전달한다.

hidden 상태에서도 자동 저장 due는 앱 조립부 정책에 따라 `ready`, `persistence.kind === "available"`, scheduler 기준을 만족하면 저장 보조 신호로 처리할 수 있다. 다만 hidden 중 브라우저 타이머가 지연되었다고 자동 저장을 여러 번 몰아서 실행하지 않는다. hidden 상태에서 금지되는 것은 새 전투 입력 생성이며, 투석기 쿨다운은 기존 visibility 규칙에 따라 멈추고 `lastVisibleTickAtMs`는 catch-up이 생기지 않도록 리셋/갱신한다.

구매 버튼 입력은 `processFrame`으로 보내지 않고, 현재 상태가 `PlayableRuntimeState`일 때만 `processPurchase`를 호출한다.

- [ ] **Step 6: 자동 저장 스케줄러를 연결한다**

`AUTO_SAVE_INTERVAL_MS` 자동 저장 타이머는 현재 상태가 `PlayableRuntimeState`이고 `persistence.kind === "available"`이며 `autoSaveScheduler !== null`인 세션에서만 `autoSaveDue`를 만들 수 있다. `loading`, `loadError`, `persistence.kind === "unavailable"`, `autoSaveScheduler === null`이면 자동 저장 시도를 만들지 않는다. `autoSaveDue`는 정확히 `AUTO_SAVE_INTERVAL_MS`마다 실행되는 전투 타이머가 아니라, 자동 저장 기준 시각 이후 `AUTO_SAVE_INTERVAL_MS` 이상 지났으니 가능한 `ready` 프레임에서 저장하라는 저장 보조 신호다.

```ts
export type AutoSaveSchedulerState = {
  autoSaveBaselineAtMs: number;
};

export function createAutoSaveSchedulerState(
  nowMs: number
): AutoSaveSchedulerState;

export function isAutoSaveDue(
  state: AutoSaveSchedulerState,
  nowMs: number
): boolean;

export function recordAutoSaveBaseline(
  state: AutoSaveSchedulerState,
  nowMs: number
): AutoSaveSchedulerState;
```

`src/app/autoSaveScheduler.ts`는 앱 조립부용 순수 helper다. 이 파일은 `AUTO_SAVE_INTERVAL_MS`만 import하고, `RuntimeState`, `GameState`, `SaveData`, `StorageAdapter`를 import하지 않는다. `autoSaveBaselineAtMs`의 의미는 "다음 자동 저장 due 계산 기준 시각"이다. 이 값은 `RuntimeState`, `GameState`, `SaveData`에 넣지 않는다. `createAutoSaveSchedulerState(nowMs)`는 초기 기준 시각을 만든다. `isAutoSaveDue(state, nowMs)`는 `nowMs - state.autoSaveBaselineAtMs >= AUTO_SAVE_INTERVAL_MS` 기준으로 due 여부만 계산한다. `recordAutoSaveBaseline(state, nowMs)`는 due 계산 기준 시각을 새 `nowMs`로 옮긴다.

`recordAutoSaveBaseline`은 reason 인자를 받지 않는다. 호출 사유는 런타임 타입, `RuntimeEffect`, helper API에 넣지 않고 앱 조립부 테스트명, 문서 주석, 필요한 구현 주석에서만 다음 용어로 설명한다.

- `readyEntryWithoutSaveAttempt`: 기존 저장 복원처럼 실제 저장 시도는 없었지만, `ready` 진입 직후 자동 저장이 즉시 발생하면 안 되는 경우다. 이때 `ready` 진입 시각으로 baseline을 기록한다.
- `actualSaveAttempt`: 실제 `saveGame` 호출이 있었고, 성공/실패와 관계없이 다음 자동 저장 due를 뒤로 미뤄야 하는 경우다. 이때 저장 시도 시각으로 baseline을 기록한다.

모든 실제 `saveGame` 호출은 `actualSaveAttempt` 사유이며, 성공/실패와 관계없이 앱 조립부가 해당 트랜잭션에서 읽은 `nowMs`로 `autoSaveBaselineAtMs`를 갱신한다. 자동 저장, 전투/처치 저장, 구매 성공 저장, 시작 상태 저장, 저장 초기화 후 시작 상태 저장이 모두 실제 `saveGame` 호출이면 기준 시각을 갱신한다. 기존 저장 로드처럼 저장 시도는 없었지만 자동 저장을 즉시 발생시키면 안 되는 경우에는 `readyEntryWithoutSaveAttempt` 사유로 `recordAutoSaveBaseline`을 호출한다. `autoSaveBaselineAtMs`는 저장 실패 경고 문구나 "마지막 저장 시도 시각" 표시용으로 사용하지 않는다. 나중에 실제 저장 시도 시각이 필요하면 별도 `lastActualSaveAttemptAtMs`를 추가하고, MVP에서는 만들지 않는다. `SaveData.savedAt`과 시스템 시각 `Date.now()`는 자동 저장 due 계산에 사용하지 않는다.

`src/main.ts`는 이 helper로 due를 계산하고 `processFrame`에는 `RuntimeFrameInput.autoSaveDue: boolean`만 넘긴다. `processFrame`은 `AutoSaveSchedulerState`를 모르고, scheduler state를 수정하지 않는다. 테스트 하네스의 `RuntimeState` snapshot에도 scheduler state를 넣지 않는다. 자동 저장 스케줄러는 `tests/unit/auto-save-scheduler.test.ts`와 앱 조립부 테스트에서 직접 검증하고, E2E는 실제 저장 호출 결과, 저장 경고, `localStorage` 결과로 간접 검증한다. `advanceRuntimeFrame`은 raw `processFrame` 보조 API이므로 자동 저장 scheduler 생성/null 조건, due 계산, due 소비 검증에는 사용하지 않는다.

`isAutoSaveDue`는 `autoSaveScheduler !== null`일 때만 호출한다. `autoSaveScheduler === null`이면 앱 조립부는 `RuntimeFrameInput.autoSaveDue`를 항상 `false`로 전달한다. storage-unavailable 세션에서는 전투와 구매는 메모리 상태에서 정상 동작하지만 자동 저장 due는 생성되지 않는다. MVP에는 저장소 접근 복구 UI가 없으므로 unavailable -> available 전환을 구현하지 않는다. MVP 이후 복구 UI를 추가한다면, persistence가 `available`로 전환되는 시점에 `createAutoSaveSchedulerState(nowMs)`로 새 baseline을 만든다.

저장 성공/실패는 due 소비 기준이 아니다. `RuntimeEffect.save`에는 저장 사유 필드가 없으므로, 앱 조립부는 `processFrame` 호출에 사용한 `RuntimeFrameInput.autoSaveDue` 값과 반환된 save effect, 실제 `saveGame` 호출 여부를 함께 보고 due 소비를 판단한다. `mode === "defeatTransition"` 프레임에 `autoSaveDue: true`를 전달했더라도 `processFrame`이 자동 저장 `save` effect를 만들지 않았다면 due는 소비된 것으로 보지 않는다. 전환 종료만 처리된 프레임에서도 due를 소비하지 않으므로, 다음 `ready` 프레임에도 `autoSaveDue: true`가 다시 들어올 수 있다.

지연된 due가 오래 밀렸어도 누적 저장을 여러 번 실행하지 않고, 가능한 `ready` 프레임에 `autoSaveDue: true` 한 번만 전달한다. 같은 `ready` 프레임에서 전투나 처치 같은 `processFrame` 저장 사유와 `autoSaveDue`가 겹치면 런타임의 save effect 병합 규칙에 따라 최종 상태 저장 1회로 처리한다. 이 저장 시도가 실제 `saveGame` 호출까지 갔다면 성공/실패와 관계없이 스케줄러는 `autoSaveBaselineAtMs`를 갱신하고 due가 처리된 것으로 본다. 실패한 자동 저장을 다음 프레임마다 즉시 재시도하지 않는다.

구매는 `processFrame`이 아니라 `processPurchase`의 별도 UI 입력 트랜잭션이다. 앱 조립부는 `processPurchase` 처리 중 자동 저장 스케줄러의 pending due 상태를 알고 있다. 자동 저장 due가 pending인 같은 브라우저 update turn에서 `processPurchase`가 구매 성공 `save` effect를 반환하면, 앱 조립부는 그 저장 시도를 pending due를 만족시킨 저장으로 간주한다. 이 저장 시도가 실제 `saveGame` 호출까지 갔다면 성공/실패와 관계없이 `autoSaveBaselineAtMs`를 갱신하고, 직후 frame에서 autoSaveDue만을 이유로 추가 저장을 만들지 않는다. 구매가 실패해 `save` effect가 없거나 전환 차단 구매처럼 저장 시도가 없으면 due는 소비하지 않고 다음 가능한 `ready` 프레임까지 유지한다.

전투/구매 저장이 자주 발생하면 `autoSaveBaselineAtMs`가 계속 갱신되므로 자동 저장 due는 계속 뒤로 밀린다. 기존 저장을 성공적으로 로드해 `ready`로 진입했지만 아직 저장 시도가 없었다면, 앱 조립부는 `autoSaveBaselineAtMs`를 ready 진입 시각으로 초기화한다. 그래야 로드 직후 즉시 자동 저장하지 않는다.

앱 부팅 또는 로드 오류 복구에서 앱 조립부는 load 액션 시작 또는 `ready` 전환 시점의 `performance.now()`를 읽는다. `loadGame` 결과가 `loaded`라면 정규화 여부와 관계없이 실제 저장 시도가 없지만 로드 직후 자동 저장을 미뤄야 하므로 `autoSaveBaselineAtMs`를 `ready` 진입 기준 시각으로 초기화한다. `loadGame` 결과가 `created`라면 시작 상태 저장을 실제로 시도한 경로이므로, 저장 성공/실패와 관계없이 앱 조립부가 해당 load 액션에서 읽은 `nowMs`를 `autoSaveBaselineAtMs`로 기록한다. `loadGame`에는 `nowMs`를 넘기지 않는다. `startNewGameFromLoadError`의 삭제 성공 후 시작 상태 `saveGame`, 저장 초기화 후 시작 상태 `saveGame`도 앱 조립부가 직접 저장을 호출하는 실제 저장 시도이므로 호출 직전 또는 직후에 읽은 앱 조립부 `nowMs`로 `autoSaveBaselineAtMs`를 갱신한다.

`persistence.kind === "unavailable"`인 세션에서 전투나 구매로 생긴 저장 효과가 앱 조립부에 도착해도 실제 저장소 쓰기는 건너뛰고 `skippedStorageUnavailable`로 처리한다. 이 경우 실제 `saveGame` 호출이 아니므로 `autoSaveBaselineAtMs`를 갱신하지 않는다.

- [ ] **Step 7: 저장 초기화를 연결한다**

삭제 성공 후 시작 상태 저장이 실패하면 새 게임은 계속 진행하고 `저장되지 않음`을 표시한다. 삭제 성공 후 시작 상태 `saveGame`은 실제 저장 시도이므로 성공/실패와 관계없이 앱 조립부가 해당 초기화 액션에서 읽은 `nowMs`로 자동 저장 스케줄러의 `autoSaveBaselineAtMs`를 갱신한다. 삭제 실패면 기존 저장을 유지하고 새 게임을 시작하지 않으며 `saveGame`을 호출하지 않으므로 `autoSaveBaselineAtMs`도 갱신하지 않는다. `persistence.kind === "unavailable"`이면 저장 초기화는 상태를 바꾸지 않고 `저장소에 접근할 수 없어 초기화할 수 없습니다` 수준의 경고만 표시한다.

### Task 12: 핵심 브라우저 스모크 테스트

**Files:**
- Create: `src/test/e2eHarness.ts`
- Modify: `src/main.ts`
- Modify: `src/domain/save.ts`
- Create: `tests/e2e/smoke.spec.ts`
- Create: `tests/e2e/mobile-shop.spec.ts`

- [ ] **Step 1: 테스트 모드 전용 E2E 하네스를 만든다**

`src/test/e2eHarness.ts`는 일반 유저 UI에 노출하지 않는다. 프로덕션 비노출이 최상위 규칙이며, `window.__goblinTest` 등록 조건은 아래 식으로 고정한다.

```ts
const enableTestHarness =
  !import.meta.env.PROD &&
  (import.meta.env.MODE === "test" ||
    import.meta.env.VITE_ENABLE_TEST_HARNESS === "true");
```

프로덕션 빌드에서는 `window.__goblinTest`가 `undefined`여야 한다. 프로덕션에서는 no-op 객체도 만들지 않으며, 전역 자체가 없어야 한다. `vite build --mode test`처럼 실수로 test mode build를 하더라도 `import.meta.env.PROD === true`이면 하네스를 등록하지 않는다.

테스트 하네스가 필요한 E2E는 반드시 `npm run dev:test`로 뜬 서버를 사용한다. 일반 `npm run dev`는 테스트 하네스 노출을 보장하지 않는다. 프로덕션 빌드 검증은 `npm run build`로 수행하며, 이 빌드에서는 `window.__goblinTest`가 없어야 한다.

하네스 내부 함수 계약:

```ts
export function assertRuntimeStateForTest(state: RuntimeState): void;
export function assertSaveDataForTest(save: SaveData): void;

export type TestStorageController = {
  setSaveData(save: SaveData): void;
  setRawSave(raw: string): void;
  clearSave(): void;
  setFailureMode(mode: "none" | "read" | "write" | "delete"): void;
  createAppStorageAdapter(): StorageAdapter;
};
```

전역 타입 계약:

```ts
declare global {
  interface Window {
    __goblinTest?: {
      setSaveData(save: SaveData): void;
      setRawSave(raw: string): void;
      clearSave(): void;
      setStorageFailureMode(
        mode: "none" | "read" | "write" | "delete"
      ): void;
      getRuntimeSnapshot(): RuntimeState;
      setRuntimeState(state: RuntimeState): void;
      advanceRuntimeFrame(input: RuntimeFrameInput): RuntimeFrameResult;
    };
  }
}
```

`window.__goblinTest.setRuntimeState(state)`는 API를 `setRuntimeState(state: RuntimeState)`로 유지하며 `nowMs` 인자를 추가하지 않는다. 내부에서는 반드시 `assertRuntimeStateForTest(state)`를 먼저 호출한다. 검사가 실패하면 runtime과 `autoSaveScheduler`를 바꾸지 않고 throw한다. 검증을 통과하면 deep clone을 만든 뒤, clone 성공 시 그 cloned state를 runtime으로 주입하고 앱 조립부 불변식에 맞게 scheduler를 재동기화한다. 주입한 state가 `ReadyRuntimeState` 또는 `DefeatTransitionRuntimeState`이고 `persistence.kind === "available"`이면 테스트 하네스는 `createAutoSaveSchedulerState(performance.now())`로 새 scheduler를 만든다. 주입한 state가 `loading`, `loadError`, 또는 playable이지만 `persistence.kind === "unavailable"`이면 scheduler를 `null`로 둔다.

이 scheduler 재동기화는 테스트 하네스 전용 동작이다. 일반 런타임 게임 로직은 `setRuntimeState`를 호출하지 않는다. `setRuntimeState` 직후에는 자동 저장 due가 즉시 발생하지 않아야 한다. E2E에서 정밀한 due timing을 만들려고 `setRuntimeState`를 사용하지 않는다. 정밀 due 검증은 `tests/unit/auto-save-scheduler.test.ts`와 앱 조립부 테스트에서 수행한다.

`getRuntimeSnapshot`과 `setRuntimeState`는 live reference API가 아니라 snapshot API다. `getRuntimeSnapshot()`은 현재 runtime의 deep clone을 반환한다. `setRuntimeState(state)`는 `assertRuntimeStateForTest(state)`를 통과한 뒤에도 입력 객체를 그대로 보관하지 않고 deep clone한 값을 runtime으로 주입한다. clone 방식은 MVP에서 `structuredClone`을 우선 사용한다. `structuredClone` 실패는 테스트 오류로 throw하며, clone 실패 시 기존 runtime과 `autoSaveScheduler`는 변경하지 않는다.

`setRuntimeState`는 편리한 만능 우회로가 아니라, 불변식 검사를 통과한 plain-data 상태와 그에 맞는 앱 조립부 상태만 주입하는 테스트 전용 도구다. 일반 앱 런타임에는 snapshot mutation API를 만들지 않는다.

`window.__goblinTest.advanceRuntimeFrame(input)`은 앱 조립부 프레임을 흉내 내는 API가 아니다. 현재 주입된 playable runtime state에 대해 `processFrame`을 직접 호출하는 raw runtime 테스트 보조 API다. 현재 상태가 `ready` 또는 `defeatTransition`일 때만 프레임을 진행하고, 현재 상태가 `loading` 또는 `loadError`이면 상태를 바꾸지 않고 throw한다.

`advanceRuntimeFrame(input)`은 `processFrame` 호출 전에 입력 shape를 런타임에서 검증한다. `input`은 정확히 `nowMs`, `visibilityState`, `directAttackRequested`, `autoSaveDue` 필드만 가진 plain object여야 하며, 누락 필드와 알 수 없는 추가 필드는 허용하지 않는다. 배열과 `null`도 허용하지 않는다. `input.nowMs`는 0 이상의 finite number여야 한다. `input.visibilityState`는 `"visible" | "hidden"`만 허용한다. `directAttackRequested`와 `autoSaveDue`는 실제 boolean이어야 하며, `"true"` 같은 문자열 boolean은 허용하지 않는다.

shape 검증을 통과한 뒤에도 현재 runtime의 `runtimeClock.lastDirectAttackAtMs`가 `null`이 아니면 `input.nowMs >= lastDirectAttackAtMs`, `runtimeClock.lastVisibleTickAtMs`가 `null`이 아니면 `input.nowMs >= lastVisibleTickAtMs`인지 검증한다. 또한 `input.visibilityState === "hidden" && input.directAttackRequested === true` 조합을 테스트 오류로 보고 거부한다. 검증 실패 시 `processFrame`을 호출하지 않고 runtime과 `autoSaveScheduler`를 바꾸지 않은 채 throw한다.

`advanceRuntimeFrame(input)`은 `processFrame` 호출 후 결과 전체가 deep clone 가능한지 먼저 확인한다. clone 실패 시 기존 runtime과 `autoSaveScheduler`를 변경하지 않고 throw한다. clone 성공 시 내부 runtime에는 cloned result state를 저장한다. 호출자에게 반환하는 `RuntimeFrameResult`도 deep clone snapshot이다. 반환된 `result.state` 또는 `result.effects`를 테스트가 변이해도 하네스 내부 runtime은 바뀌지 않아야 한다.

`advanceRuntimeFrame`은 반환된 `RuntimeEffect[]`를 자동 처리하지 않는다. `save` effect가 있어도 `saveGame`, `applySaveEffectResult`, `autoSaveScheduler` 갱신을 호출하지 않는다. `damageNumber`, `defeatTransitionStarted`, `purchaseFeedback`도 Scene 또는 DOM handler에 자동 전달하지 않는다.

`advanceRuntimeFrame`은 `autoSaveScheduler`를 검증하지 않는다. `RuntimeFrameInput.autoSaveDue`를 직접 넣을 수 있지만, 이것은 런타임의 `save` effect 병합, 전환 상태 처리, `processFrame` 입력 처리 규칙을 검증하기 위한 입력이다. 자동 저장 scheduler 생성/null 조건, due 계산, due 소비는 `tests/unit/auto-save-scheduler.test.ts`와 앱 조립부 테스트에서 검증한다. 저장 결과, 구매 피드백, Scene/DOM effect 처리, `autoSaveScheduler` 갱신까지 검증하려면 실제 앱 흐름 또는 앱 조립부 테스트를 사용한다. E2E는 `advanceRuntimeFrame`으로 정밀 due나 scheduler-null 정책을 만들지 않는다. storage-unavailable 세션에서 자동 저장이 생기지 않는지는 실제 앱 조립부 흐름 또는 app-level 테스트로 검증한다. MVP에서는 별도 `advanceAppFrame(...)` 하네스 API를 추가하지 않는다.

최소 불변식:

- `assertRuntimeStateForTest`는 `mode`별 top-level union shape를 먼저 검증한다. `loading`은 `mode`만, `loadError`는 `mode`, `reason`, `message`만, `ready`는 `mode`, `game`, `persistence`, `runtimeClock`만, `defeatTransition`은 `mode`, `game`, `persistence`, `runtimeClock`, `defeatedSnapshot`만 허용한다.
- `assertRuntimeStateForTest`는 top-level과 모든 중첩 객체에서 배열, `null`, class instance를 거부하고 plain object만 허용한다. 알 수 없는 추가 필드와 필수 필드 누락도 실패다.
- `game`, `persistence`, `runtimeClock`, `defeatedSnapshot`, `upgrades`도 exact shape를 검증한다. `defeatedSnapshot`은 `defeatTransition`에서만 허용하고, `persistence`, `runtimeClock`, `game`은 playable state에서만 허용한다.
- `defeatedCount`와 `coins`는 0 이상의 안전한 정수다.
- `upgrades`는 MVP 4종 키를 모두 가지고, 알 수 없는 키가 있으면 실패한다.
- 각 업그레이드 레벨은 0 이상의 안전한 정수다.
- `currentGoblinLevel`과 `currentGoblinMaxHp`는 `defeatedCount`에서 파생된 `calculateGoblinLevel`, `calculateGoblinMaxHp` 결과와 일치한다.
- `ready` 상태에서 `selectEnemyRenderState(state).enemyInstanceId === state.game.defeatedCount`다.
- `loading`과 `loadError` 상태에는 `game`, `persistence`, `runtimeClock`, `defeatedSnapshot`이 있으면 실패한다.
- `loadError` 상태에는 유효한 `reason`과 비어 있지 않은 `message`가 있어야 한다.
- `loadError.message`가 `src/app/loadErrorState.ts`의 `formatLoadErrorMessage(loadError.reason)`와 일치하는지 검사한다.
- `ready`와 `defeatTransition` 상태에만 `game`, `persistence`, `runtimeClock`이 있어야 한다.
- `PlayableRuntimeState.game.goblinHp`는 `1..currentGoblinMaxHp` 범위다. `goblinHp === 0`은 `defeatedSnapshot`에서만 허용한다.
- `mode === "defeatTransition"`이면 `defeatedSnapshot`이 반드시 있고, `defeatedSnapshot.hp === 0`이어야 한다.
- `mode === "defeatTransition"`이면 `defeatedSnapshot.enemyInstanceId`는 0 이상의 안전한 정수이며 `state.game.defeatedCount - 1`과 일치한다.
- `mode === "defeatTransition"`이어도 `defeatedSnapshot`에 파생 가능한 `goblinLevel`이나 `maxHp` 필드가 있으면 실패한다.
- `mode !== "defeatTransition"`이면 stale snapshot 방지를 위해 `defeatedSnapshot`이 없어야 한다.
- `persistence.kind === "available"`이면 `saveWarning`은 `"none" | "unsaved"`만 가능하다.
- `persistence.kind === "unavailable"`이면 `saveWarning`은 반드시 `"storageUnavailable"`이다.
- `runtimeClock.lastDirectAttackAtMs`와 `runtimeClock.lastVisibleTickAtMs`는 `null` 또는 0 이상의 finite number다.
- `defeatedSnapshot.startedAtMs`는 snapshot이 있을 때 필수이며, `null`이 아니라 0 이상의 finite number여야 한다.
- `RuntimeState`를 `SaveData`로 직렬화하지 않는다. 저장은 항상 `PlayableRuntimeState.game`만 `toSaveData`에 넘긴다.
- `RuntimeState`, `GameState`, `SaveData`, `RuntimeEffect`는 `structuredClone` 가능한 plain data여야 하며 함수, class instance, DOM 객체, Phaser 객체를 포함하면 실패한다.

`setSaveData(save)`는 내부에서 반드시 `assertSaveDataForTest(save)`를 호출한다. 검증 실패 시 저장소를 변경하지 않고 throw한다. 검증을 통과한 정상 MVP `SaveData`만 `JSON.stringify(save)`로 저장한다.

`assertSaveDataForTest(save)`의 strict exact-shape 검증은 테스트 setup API 전용이다. 실제 로드 파이프라인의 `normalizeSaveData(raw)`는 이 validator를 재사용하지 않고, `saveVersion: 1` 사용자 저장 데이터에 대해 필드별 정규화와 unknown field 제거를 수행한다. 누락 upgrade key, 알 수 없는 upgrade key, invalid 숫자 필드 같은 복구/정규화 시나리오는 `setSaveData(save)`가 아니라 `setRawSave(raw)`로 구성한다.

`assertSaveDataForTest(save)` 최소 불변식:

- top-level `SaveData`는 `saveVersion`, `state`, 선택 필드 `savedAt`만 허용하는 exact plain object여야 한다. `state`와 `state.upgrades`도 exact plain object여야 하며, 배열, `null`, class instance, 추가 필드, 필수 필드 누락은 실패다.
- `save.state`는 `goblinHp`, `mudTrapArmedLevel`, `catapultCooldownRemainingMs`, `defeatedCount`, `coins`, `upgrades`만 허용한다.
- `save.saveVersion === 1`이어야 한다.
- `save.state.defeatedCount`와 `save.state.coins`는 0 이상의 안전한 정수다.
- `save.state.upgrades`는 MVP 4종 키만 가지고, 누락 키와 알 수 없는 추가 키가 있으면 실패한다.
- 각 업그레이드 레벨은 0 이상의 안전한 정수다.
- `currentGoblinMaxHp`를 `defeatedCount`에서 파생했을 때 `goblinHp`는 `1..currentGoblinMaxHp` 범위다.
- `catapultCooldownRemainingMs`는 투석기 레벨 0이면 0, 레벨 1 이상이면 `0..CATAPULT_COOLDOWN_MS` 범위다.
- `mudTrapArmedLevel`은 `0..현재 진흙 함정 레벨` 범위다.
- `savedAt`이 있으면 finite number여야 하며, 없어도 정상이다.
- invalid, future, legacy save format을 테스트하려면 `setSaveData(save)`가 아니라 `setRawSave(raw)`를 사용한다.

하네스 사용 규칙:

- 하네스는 테스트 상태 구성과 프레임 진행 보조용이다.
- `TestStorageController`는 테스트 모드 하네스 내부 경계이며 프로덕션 코드 경로가 아니다.
- Playwright는 `window.__goblinTest.setSaveData`, `setRawSave`, `clearSave`, `setStorageFailureMode`만 호출하고 브라우저 `localStorage`를 직접 만지지 않는다.
- `setSaveData`, `setRawSave`, `clearSave`는 테스트 준비용 privileged setup API다.
- setup API는 현재 failure mode의 영향을 받지 않는다. read/write/delete 실패를 켜기 전에 저장 데이터를 구성하거나 정리할 수 있어야 한다.
- `setSaveData(save)`는 정상 저장 데이터 setup 전용이다. invalid JSON, `saveVersion` 누락, 미지원 버전, v1 필드 정규화/복구, 마이그레이션 실패 테스트는 `setSaveData`가 아니라 반드시 `setRawSave(raw)`로 구성한다.
- `setRawSave(raw)`는 검증하지 않고 원문 문자열을 그대로 저장한다. `setRawSave(raw)`를 쓰는 E2E 테스트는 테스트명 또는 주석에서 `parseFailed`, `migrationFailed`, `unsupported version` 같은 목적을 드러낸다.
- 실제 앱 런타임은 `createAppStorageAdapter()`가 만든 adapter만 사용한다.
- 저장 실패 주입은 브라우저 `localStorage`를 직접 monkey patch하지 않고, 앱의 `StorageAdapter`를 테스트 모드에서 교체하는 방식으로 처리한다. `setStorageFailureMode`는 앱 런타임 adapter의 `read`, `write`, `remove`가 지정된 작업에서 throw하도록 구성한다.
- E2E teardown은 `setStorageFailureMode("none")` 후 `clearSave()` 순서로 정리한다.
- E2E에서는 가능하면 `setSaveData`, `setRawSave`, `clearSave`, `setStorageFailureMode`, `advanceRuntimeFrame` 같은 더 좁은 API를 먼저 사용한다.
- `setRuntimeState`는 전환 중 포커스, 저장 경고, 모바일 상점처럼 UI 상태 구성이 지나치게 긴 경우에만 사용하며 런타임 게임 로직에서 호출하지 않는다.
- `setRuntimeState`는 runtime 주입 후 scheduler를 위 규칙으로 재동기화한다. E2E는 `setRuntimeState` 직후 자동 저장이 즉시 발생하지 않는지, storage-unavailable state 주입 후 scheduler가 `null`이라 자동 저장이 생기지 않는지 수준만 확인한다.
- 정밀한 자동 저장 due timing은 `setRuntimeState`로 만들지 않고 `autoSaveScheduler` 단위 테스트와 앱 조립부 테스트에서 검증한다.
- `advanceRuntimeFrame`은 raw runtime 보조 API이며 앱 조립부 프레임을 흉내 내지 않는다. `RuntimeFrameInput.autoSaveDue`를 직접 넣을 수 있지만, 이 입력은 `processFrame`의 병합/전환 규칙 검증용이다. 하네스는 입력이 정확히 `nowMs`, `visibilityState`, `directAttackRequested`, `autoSaveDue`만 가진 plain object인지, 각 필드가 올바른 literal/type인지 검증한 뒤에만 `processFrame`을 호출한다. `RuntimeFrameInput.nowMs`는 하네스 경계에서 0 이상의 finite number이며 현재 runtime의 non-null `runtimeClock` 시간값보다 작지 않은지 검증한다. `input.visibilityState === "hidden" && input.directAttackRequested === true` 조합은 하네스 경계에서 throw한다. 호출에 성공하면 반환된 state를 하네스 runtime에 적용하되, 반환된 effects는 자동 처리하지 않는다. 자동 저장 scheduler 생성/null 조건, due 계산, due 소비 검증에는 사용하지 않는다.
- 테스트는 하네스로 상태를 만들 수 있지만, 최종 검증은 실제 UI 텍스트, 버튼 상태, 접근성 속성, `localStorage` 결과, 캔버스/DOM 렌더 상태를 기준으로 한다.

- [ ] **Step 2: 데스크톱 스모크 테스트를 작성한다**

검증 흐름:

```text
1. 첫 고블린을 5번 클릭한다.
2. 고블린이 텍스트가 아닌 시각 에셋으로 보이고, 피격/처치 상태가 스프라이트 또는 프레임 변경으로 확인되는지 확인한다.
3. 처치 수가 1이고 재화가 증가했는지 확인한다.
4. 체력 바가 화면에 한 번만 표시되고 DOM HUD 요소로 존재하는지 확인한다.
5. 실제 HP 숫자와 즉시 체력 바가 같은 `EnemyRenderState.hp` 기준으로 즉시 갱신되는지 확인한다.
6. 잔상 체력 바가 DOM HUD 렌더링 상태로만 `HP_GHOST_BAR_DELAY_MS` 늦게 따라오는지 확인한다.
7. 재화가 텍스트만이 아니라 `coin` 시각 요소로 식별되는지 확인한다.
8. 두 번째 고블린을 처치한다.
9. `DEFEAT_TRANSITION_MS` 전환 중 전역 상태는 최신 `state.game` 기준으로 즉시 갱신되지만, DOM HUD의 적 전용 표시와 Phaser 고블린 렌더가 같은 `EnemyRenderState` defeated snapshot 기준을 유지하는지 확인한다.
10. `DEFEAT_TRANSITION_MS` 전환 중 구매 가능 행과 비용 부족 행이 모두 `잠시 후 구매 가능` 또는 `처치 처리 중` 상태 문구와 `aria-disabled="true"`를 가지는지 확인한다.
11. `DEFEAT_TRANSITION_MS` 전환 중 구매 버튼을 활성화해도 구매 성공, 비용 부족 실패 피드백, 저장 효과가 발생하지 않는지 확인한다.
12. 전환 종료 후 상점 행이 최신 재화 기준의 구매 가능 또는 비용 부족 상태로 재계산되는지 확인한다.
13. 낡은 몽둥이 추천과 구매 가능 상태를 확인한다.
14. 비용 부족 버튼은 포커스 가능하고 `aria-disabled="false"`이며, 활성화 시 버튼 단위 실패 피드백만 표시되는지 확인한다.
15. 업그레이드 4종이 텍스트만이 아니라 서로 다른 아이콘 시각 요소로 식별되는지 확인한다.
16. 낡은 몽둥이를 구매한다.
17. 추천 표시가 사라지고 클릭 피해량이 증가했는지 확인한다.
18. 전투 컨테이너에 포커스를 두고 Space `keydown`을 보내면 직접 공격이 1회 처리되는지 확인한다.
19. 같은 Space 입력의 `keyup`과 `event.repeat === true`인 Space `keydown`은 직접 공격으로 처리되지 않는지 확인한다.
20. 구매 버튼, 상점 토글, 모달 버튼에 포커스가 있을 때 Space/Enter가 전투 입력으로 새지 않는지 확인한다.
21. Enter는 고블린 공격으로 처리되지 않고 포커스된 UI 버튼 활성화에만 사용되는지 확인한다.
22. `sceneReady` 전 포인터 입력이 `directAttackRequested`로 전달되지 않는지 확인한다.
23. `sceneReady` 전 Space 입력도 전투 입력으로 전달되지 않는지 확인한다.
24. hidden 상태에서 포인터 입력과 Space 입력이 `directAttackRequested`로 전달되지 않는지 확인한다.
25. 최초 playable state에서 `renderGoblinVisualState`가 `applyVisualEffects`보다 먼저 전달되는지 확인한다.
26. 새로고침 뒤 처치 수와 재화가 복원되는지 확인한다.
27. Phaser 에셋 로드 실패 콘솔 오류가 없는지 확인한다.
```

- [ ] **Step 3: 모바일 상점 테스트를 작성한다**

검증 흐름:

```text
1. 모바일 viewport를 설정한다.
2. 상점은 기본 접힘 상태인지 확인한다.
3. 구매 가능 업그레이드가 생기면 하단 상점 버튼 배지가 나타나는지 확인한다.
4. 상점을 연다.
5. aria-expanded와 접근성 이름을 확인한다.
6. 시트 제목 포커스에서 Enter/Space가 구매나 닫기를 실행하지 않는지 확인한다.
7. 시트 내부 구매 버튼과 닫기 버튼 포커스 상태의 Space/Enter가 고블린 공격으로 새지 않는지 확인한다.
8. 마지막 업그레이드 행과 마지막 포커스 가능 요소가 하단 토글에 가려지지 않는지 확인한다.
9. 작은 화면에서도 직접 공격 영역 160px과 DOM HUD 체력 바가 보이는지 확인한다.
```

- [ ] **Step 4: 오류 상태와 하네스 노출 회귀 테스트를 작성한다**

검증 흐름:

```text
1. `npm run dev:test`로 뜬 테스트 모드 서버에서 window.__goblinTest가 존재하는지 확인한다.
2. setStorageFailureMode("write")로 저장 실패를 주입하고 실제 UI에 저장 실패 경고가 표시되는지 확인한다.
3. setStorageFailureMode("write") 상태에서 구매를 성공시키면 레벨/재화가 갱신되고 `success` 구매 피드백과 `unsaved` 저장 경고가 동시에 표시되며 구매 상태가 롤백되지 않는지 확인한다.
4. setStorageFailureMode("read")로 저장소 접근 실패 세션을 만들고 전투/구매는 동작하지만 저장소 쓰기는 호출되지 않는지 확인한다.
5. 저장소 접근 실패 세션에서 구매를 성공시키면 `success` 구매 피드백이 표시되고 `storageUnavailable` 저장 경고가 유지되는지 확인한다.
6. setStorageFailureMode("write") 상태에서도 setSaveData, setRawSave, clearSave가 테스트 준비용 setup API로 동작하며 failure mode의 영향을 받지 않는지 확인한다.
7. setSaveData에 불가능한 SaveData, 추가 필드가 있는 SaveData, 누락/추가 upgrade key가 있는 SaveData를 넘기면 저장소를 변경하지 않고 throw하는지 확인한다.
8. 정상 SaveData는 setSaveData로 넣고 새로고침해 복원되는지 확인한다.
9. 깨진 JSON 문자열은 테스트명이나 주석에 parseFailed 목적을 드러내고 setRawSave로 넣은 뒤 새로고침해 로드 오류 모달이 표시되는지 확인한다.
10. 미지원 saveVersion 또는 마이그레이션 실패 데이터는 테스트명이나 주석에 migrationFailed 또는 unsupported version 목적을 드러내고 setRawSave로 넣은 뒤 새로고침해 로드 오류 모달이 표시되는지 확인한다.
11. 로드 오류 모달이 열린 동안 배경 고블린 공격, 구매 입력, `AUTO_SAVE_INTERVAL_MS` 자동 저장이 처리되지 않는지 확인한다.
12. 로드 오류 모달의 새 게임 시작에서 delete 실패를 주입하면 `저장 데이터를 삭제할 수 없습니다.` 메시지가 표시되고 새 게임이 시작되지 않는지 확인한다.
13. 로드 오류 모달의 새 게임 시작에서 delete 성공, write 실패를 주입하면 새 게임은 시작되고 `저장되지 않음` 경고가 표시되는지 확인한다.
14. 로드 오류 모달의 다시 시도는 `loadGame(storage, "retryFromLoadError")` 경로로 현재 저장소 값을 다시 읽어 성공 시 복원된 게임으로 전환하고 `loadedExistingSave`를 반환한다.
15. 재시도 중 read 실패는 기존 저장을 삭제하지 않고 `reason: "readFailed"` 로드 오류 상태를 유지하는지 확인한다.
16. 재시도 중 저장 키가 없으면 복원 실패가 아니라 `createdInitialGame` 흐름으로 처리되며, 이 결과가 `loadedExistingSave`나 `startedNewGame`으로 반환되지 않는지 확인한다.
17. 각 E2E는 teardown에서 setStorageFailureMode("none") 후 clearSave() 순서로 정리한다.
18. 로드 오류 모달의 취소는 저장 삭제와 새 게임 시작 없이 로드 오류 상태를 유지하는지 확인한다.
19. setRuntimeState로 `DEFEAT_TRANSITION_MS` 전환, 저장 경고, 모바일 상점 상태를 구성한 뒤 최종 검증은 실제 UI와 접근성 속성으로 확인한다.
20. setRuntimeState로 available playable state를 주입한 직후 자동 저장이 즉시 발생하지 않는지 확인한다.
21. setRuntimeState로 storage-unavailable playable state를 주입하면 자동 저장이 생기지 않고 전투/구매만 메모리 상태에서 동작하는지 확인한다.
22. setRuntimeState에 불가능한 RuntimeState, mode별 추가/누락 필드가 있는 RuntimeState, `null` 또는 배열 중첩 객체가 있는 RuntimeState를 넘기면 runtime과 scheduler를 바꾸지 않고 throw하는지 확인한다.
23. 프로덕션 빌드 또는 비테스트 모드에서는 window.__goblinTest가 존재하지 않는지 확인한다.
24. VITE_ENABLE_TEST_HARNESS=true 또는 vite build --mode test 조건에서도 프로덕션 빌드 산출물에는 window.__goblinTest가 노출되지 않는지 확인한다.
```

- [ ] **Step 5: 브라우저 테스트를 실행한다**

Run:

```bash
npm run test:e2e
```

Expected:

```text
0 failed
```

### Task 13: MVP 완료 검증

**Files:**
- Modify: `docs/goblin-clicker-spec.md` only when 스펙 자체가 실제 구현과 충돌하는 것이 확인된 경우
- Modify: `docs/goblin-clicker-implementation.md` only when 구현 중 계획 오류가 확인된 경우

- [ ] **Step 1: 전체 단위 테스트를 실행한다**

Run:

```bash
npm test
```

Expected:

```text
0 failed
```

- [ ] **Step 2: 빌드를 실행한다**

Run:

```bash
npm run build
```

Expected:

```text
0 TypeScript errors
vite build completed
```

- [ ] **Step 3: 브라우저 스모크 테스트를 실행한다**

Run:

```bash
npm run test:e2e
```

Expected:

```text
0 failed
```

- [ ] **Step 4: 10분 밸런스 검증을 기록한다**

검증 기록 형식:

```text
플레이 시간: 10분
처치 수:
구매한 업그레이드:
가장 빠른 진행 방법:
진흙 함정 도달 여부:
관찰:
```

합격 기준:

- 첫 처치는 5회 클릭이다.
- 두 번째 처치 직후 `낡은 몽둥이`를 구매할 수 있다.
- 5분 안에 25~40마리 처치 범위에 근접한다.
- 5분 안에 2~3종 업그레이드를 경험한다.
- 첫 10분 동안 직접 클릭이 가장 빠른 진행 방법으로 남는다.

## 7. 구현 순서 요약

1. 프로젝트 골격과 테스트 러너를 만든다.
2. 진행 공식과 업그레이드 계산을 단위 테스트로 고정한다.
3. 전투, 처치, 투석기, 진흙 함정 규칙을 순수 함수로 구현한다.
4. 테스트 전용 밸런스 시뮬레이션으로 초반 진행 의도를 조기 검증한다.
5. 저장, 복원, 정규화, 오류 상태를 구현한다.
6. 런타임 상태와 저장 트리거 병합을 구현한다.
7. MVP 시각 에셋 파일과 manifest 계약을 준비한다.
8. Phaser 장면과 입력 영역을 연결한다.
9. DOM HUD, 상점, 모달, 접근성 정책을 연결한다.
10. Playwright 스모크 테스트로 사용자 흐름을 검증한다.
11. 빌드와 10분 밸런스 검증으로 MVP 완료 기준을 확인한다.

## 8. 완료 기준 체크리스트

- [ ] `npm test`가 실패 없이 통과한다.
- [ ] `npm run build`가 실패 없이 통과한다.
- [ ] `npm run test:e2e`가 실패 없이 통과한다.
- [ ] Playwright `webServer.command`는 `npm run dev:test`를 사용하고, 테스트 하네스가 필요한 E2E는 일반 `npm run dev` 서버에 의존하지 않는다.
- [ ] `tests/unit/constants.test.ts`만 현재 MVP 시간 상수의 정확한 예시 값을 검증하고, validator, 단위 테스트, 밸런스 시뮬레이션, E2E 하네스는 시간 값을 직접 숫자로 복제하지 않고 `constants.ts` 상수를 참조한다.
- [ ] `tests/unit/balance-simulation.test.ts`가 공식 복제 없이 초반 밸런스 회귀를 검증한다.
- [ ] `tests/unit/auto-save-scheduler.test.ts`가 `autoSaveBaselineAtMs` 기준 due 계산과 `recordAutoSaveBaseline` 기준 이동을 검증한다.
- [ ] `tests/unit/asset-manifest.test.ts`가 모든 에셋의 기준 크기, 앵커 범위, 고블린 상태별 기준 일치, 아이콘 정사각형 기준을 검증한다.
- [ ] `tests/unit/upgrade-presentation.test.ts`가 모든 업그레이드 ID의 아이콘 표현 매핑과 `ASSETS` 참조를 검증한다.
- [ ] `processFrame`이 직접 공격, 투석기 tick, 자동 저장 due를 한 프레임 순서로 처리하고 최종 상태 기준 저장 효과를 최대 1개만 반환한다.
- [ ] `RuntimeEffect.save` payload는 `{ type: "save"; state: GameState }`만 가지며 저장 사유 필드를 추가하지 않는다.
- [ ] `defeatTransition` 프레임의 `autoSaveDue`는 save effect를 만들지 않고 due를 소비하지 않으며, 다음 `ready` 프레임에서 자동 저장이 한 번만 처리된다.
- [ ] 지연된 자동 저장 due가 여러 번 누적되어도 가능한 `ready` 프레임에서 저장은 한 번만 시도된다.
- [ ] `autoSaveDue`와 전투/처치 저장 사유가 같은 `ready` 프레임에 겹치면 최종 상태 기준 save effect 1개로 병합되고 자동 저장 due는 처리된 것으로 갱신된다.
- [ ] 자동 저장 due가 pending인 같은 브라우저 update turn에서 구매 성공 저장 effect가 발생하면 추가 자동 저장을 만들지 않고 due를 처리된 것으로 갱신하며, 비용 부족/전환 차단 구매처럼 save effect가 없으면 due를 소비하지 않는다.
- [ ] 비용 부족 구매, 전환 차단 구매, `persistence.kind === "unavailable"`의 `skippedStorageUnavailable` 저장 효과 처리는 실제 `saveGame` 호출이 없으므로 자동 저장 due를 소비하지 않는다.
- [ ] 자동 저장 시도가 실패해도 due는 소비되고 다음 due는 `AUTO_SAVE_INTERVAL_MS` 뒤로 잡히며, 실패 직후 다음 프레임마다 즉시 재시도하지 않는다.
- [ ] 자동 저장 실패로 생긴 `unsaved` 경고는 이후 전투/구매 저장 또는 다음 자동 저장 성공으로 해제된다.
- [ ] 자동 저장 due는 `nowMs - autoSaveBaselineAtMs >= AUTO_SAVE_INTERVAL_MS` 기준으로 계산되며, 모든 실제 `saveGame` 호출은 성공/실패와 관계없이 앱 조립부가 해당 트랜잭션에서 읽은 `nowMs`로 `autoSaveBaselineAtMs`를 갱신한다.
- [ ] hidden 상태에서도 자동 저장 due는 ready/available/scheduler 정책에 따라 저장 보조 신호로 처리할 수 있지만, hidden 중 지연된 자동 저장을 여러 번 몰아서 실행하지 않는다.
- [ ] `src/app/autoSaveScheduler.ts`는 `AUTO_SAVE_INTERVAL_MS`만 import하고, `RuntimeState`, `GameState`, `SaveData`, `StorageAdapter`를 import하지 않는다.
- [ ] `src/main.ts`는 `autoSaveScheduler` helper로 due를 계산하고 `processFrame`에는 `autoSaveDue: boolean`만 넘기며, `processFrame`은 scheduler state를 모르고 수정하지 않는다.
- [ ] 앱 조립부 상태는 `autoSaveScheduler: AutoSaveSchedulerState | null`을 가지며, scheduler는 `persistence.kind === "available"`인 playable 세션에서만 생성된다.
- [ ] boot read failure로 시작한 `storageUnavailable` 세션에서는 `autoSaveScheduler === null`이고, `RuntimeFrameInput.autoSaveDue`가 항상 `false`로 전달되며 자동 저장 저장 시도가 발생하지 않는다.
- [ ] `advanceRuntimeFrame`은 raw `processFrame` 보조 API로만 사용하며, 자동 저장 scheduler 생성/null 조건, due 계산, due 소비 검증에는 사용하지 않는다.
- [ ] 앱 조립부 테스트는 `readyEntryWithoutSaveAttempt`와 `actualSaveAttempt` 두 호출 사유가 모두 `recordAutoSaveBaseline` 호출로 이어지는지 검증하되, 이 사유를 helper API, 런타임 타입, `RuntimeEffect` payload에 넣지 않는다.
- [ ] 기존 저장 복원으로 `ready`에 진입했지만 저장 시도가 없었다면 `autoSaveBaselineAtMs`는 ready 진입 기준 시각으로 초기화되어 로드 직후 즉시 자동 저장하지 않는다.
- [ ] v1 기존 저장이 정규화되어 canonical `GameState`로 복원되어도 로드 직후 `goblin-clicker.save`를 즉시 덮어쓰지 않고, 정규화 자체만으로 `unsaved` 경고나 정규화 저장 실패 분기를 만들지 않는다.
- [ ] 정규화 복원 이후 다음 전투 저장, 구매 성공 저장, 저장 초기화, 또는 자동 저장 트리거가 발생할 때 canonical `GameState`가 저장된다.
- [ ] `loadGame(...).created`, `createdInitialGame`, `startedNewGame`, 저장 초기화 후 시작 상태 저장은 실제 `saveGame` 호출이면 성공/실패와 관계없이 앱 조립부에 주입한 액션 `nowMs`를 `autoSaveBaselineAtMs`로 기록한다.
- [ ] 자동 저장 스케줄러 구현과 테스트에는 이전의 부정확한 "마지막 저장 시도" 기준 이름이 남지 않는다.
- [ ] E2E 테스트 하네스의 `RuntimeState` snapshot에는 자동 저장 스케줄러 상태가 포함되지 않고, E2E는 실제 저장 호출 결과, 저장 경고, `localStorage` 결과로 자동 저장을 간접 검증한다.
- [ ] `loadGame(storage, context)`는 `nowMs`를 받지 않고, `SaveData.savedAt`과 `Date.now()`는 자동 저장 due 계산에 영향을 주지 않는다.
- [ ] `saveGame(storage, state)`는 MVP에서 `toSaveData(state)`만 사용하고 `Date.now()`나 `performance.now()`를 호출하지 않으며, 기본 저장 JSON에는 `savedAt`이 없다.
- [ ] `toSaveData(state, savedAt?)`는 순수 변환 helper이며 `savedAt`이 있으면 포함하고 없으면 생략한다. MVP에는 저장 시각 표시 UI가 없다.
- [ ] 저장 직렬화 테스트는 JSON 문자열의 프로퍼티 순서를 검증하지 않고, `JSON.parse` 후 deep equality 또는 필드별 assertion으로 canonical `SaveData` 의미 값만 검증한다.
- [ ] 문서 예시의 타입/객체 필드 순서는 설명용이며, `savedAt` 유무와 관계없이 필드 출력 순서는 런타임 계약이 아니다.
- [ ] `RuntimeEffect[]`의 cross-type 배열 순서에는 의미가 없고, 앱 조립부는 반환 state 적용, HUD/상점/DOM 렌더, `renderGoblinVisualState`, visual/local feedback effects 처리, save effect 처리, 저장 경고 갱신 순서로 type별 처리한다.
- [ ] 앱 조립부는 같은 `RuntimeResult`의 `damageNumber`와 `defeatTransitionStarted`만 `SceneVisualEffect[]`로 변환해 `applyVisualEffects` batch로 전달하고, `purchaseFeedback`과 `save`는 Scene batch에 넣지 않는다.
- [ ] 앱 조립부는 `renderGoblinVisualState`를 먼저 전달한 뒤 `applyVisualEffects` batch를 전달한다.
- [ ] 최초 playable state에서 `renderGoblinVisualState`가 `applyVisualEffects`보다 먼저 전달되며, `renderGoblinVisualState`를 한 번 이상 보내기 전에는 `applyVisualEffects`를 보내지 않는다.
- [ ] `sceneReady` 전 포인터 입력과 Space 입력은 `directAttackRequested`로 큐잉되지 않고 나중에 재생되지 않는다.
- [ ] 같은 type 내부에서는 런타임 함수가 반환한 순서를 보존하며, 같은 frame의 direct와 catapult `damageNumber`는 direct -> catapult 순서로 `applyVisualEffects` batch에 들어간다.
- [ ] `damageNumber` 내부 순서는 피해 숫자 표시와 위치 오프셋에만 쓰이고, 게임 상태, 저장, 처치 판정, 전환 종료 판정에 영향을 주지 않는다.
- [ ] `tests/unit/app-effects.test.ts`가 effect 배열 순서를 바꿔도 조립부 처리 결과가 같고, save 실패가 `purchaseFeedback`이나 `damageNumber` 처리를 취소하지 않는지 검증한다.
- [ ] `GoblinScene`은 `RuntimeState`를 import하지 않고 `selectEnemyRenderState`를 호출하지 않으며, `renderGoblinVisualState`로 받은 `EnemyRenderState`만 `baseEnemyRenderState`에 캐시한다.
- [ ] `damageNumber` effect는 피해를 받은 고블린의 처치 전 `defeatedCount`를 `enemyInstanceId`로 담고, 이 값은 저장 데이터에 들어가지 않는다.
- [ ] `defeatTransitionStarted`와 `showDefeat`는 처치된 고블린의 `enemyInstanceId`를 담고, 이 값은 저장 데이터에 들어가지 않는다.
- [ ] lethal direct attack과 lethal catapult frame에서 damage number는 표시되지만 hit transient가 defeat visual을 덮지 않고, hit 타이머 완료가 defeat visual을 idle로 되돌리지 않는다.
- [ ] 같은 `applyVisualEffects` batch에 direct damage, catapult damage, `showDefeat`가 있으면 Scene은 유효한 defeat id 집합을 먼저 계산해 hit를 억제하고, damage 표시 순서는 direct -> catapult를 유지한다.
- [ ] Scene은 개별 이벤트 emit 순서에 의존하지 않고 `applyVisualEffects` batch 단위로 damage와 defeat 경합을 처리한다.
- [ ] `baseEnemyRenderState === null`인 Scene에 `applyVisualEffects`가 들어와도 throw 없이 no-op 처리되고, no-op된 visual effect는 나중에 재생되지 않는다.
- [ ] direct non-lethal + catapult lethal이 같은 frame에 발생하면 damage number는 두 개 모두 direct -> catapult 순서로 표시되고, hit transient는 생성되지 않으며, defeat visual과 particle이 적용된다.
- [ ] 같은 frame에 유효한 defeat effect가 없는 non-lethal direct + catapult damage는 hit transient를 허용한다.
- [ ] lethal frame에서는 같은 `enemyInstanceId`의 hit timer가 생성되지 않는다.
- [ ] stale `damageNumber.enemyInstanceId` 또는 `showDamage.enemyInstanceId`는 새 고블린에 피해 숫자나 hit transient를 만들지 않는다.
- [ ] stale `defeatTransitionStarted.enemyInstanceId` 또는 `showDefeat.enemyInstanceId`는 새 고블린에 처치 스프라이트나 파티클을 만들지 않는다.
- [ ] `EnemyRenderState.enemyInstanceId`는 ready에서 `defeatedCount`와 같고, 처치 전환 중에는 처치된 고블린 id를 유지하며, 전환 종료 후 다음 고블린 id로 바뀐다.
- [ ] `defeatedSnapshot`은 `enemyInstanceId`, `hp: 0`, `startedAtMs`만 보관하고, 전환 중 `EnemyRenderState.goblinLevel`과 `maxHp`는 `enemyInstanceId`에서 `progression` 함수로 파생한다.
- [ ] 이전 고블린의 stale hit timer는 캡처한 id와 최신 `baseEnemyRenderState?.enemyInstanceId`가 다르면 새 고블린 visual을 변경하지 않는다.
- [ ] 저장 side effect 결과는 `applySaveEffectResult`로만 `persistence.saveWarning`에 반영된다.
- [ ] E2E 테스트 하네스는 `!import.meta.env.PROD && (MODE === "test" || VITE_ENABLE_TEST_HARNESS === "true")` 조건에서만 `window.__goblinTest`로 노출된다.
- [ ] 프로덕션 빌드에서는 `VITE_ENABLE_TEST_HARNESS=true` 또는 `vite build --mode test` 조건이어도 `window.__goblinTest` 전역과 no-op 객체가 존재하지 않는다.
- [ ] 저장 실패/저장소 접근 실패 E2E 주입은 `localStorage` monkey patch가 아니라 테스트 모드 `StorageAdapter` 교체로 처리된다.
- [ ] `StorageAdapter`는 정책 결과를 반환하지 않고 `read`, `write`, `remove` 실패를 throw로 표현하며, `loadGame`, `saveGame`, `deleteSave`만 이를 결과값으로 변환한다.
- [ ] 앱 조립부, UI, Playwright 테스트는 브라우저 `localStorage`를 직접 호출하지 않고 저장 함수 또는 테스트 모드 `StorageAdapter` 교체를 통해 접근한다.
- [ ] `setSaveData`, `setRawSave`, `clearSave`는 failure mode의 영향을 받지 않는 privileged setup API이며, 실제 앱 런타임은 `createAppStorageAdapter()`가 만든 adapter만 사용한다.
- [ ] `setSaveData(save)`는 `assertSaveDataForTest(save)`를 통과한 정상 MVP `SaveData`만 저장하고, 실패 시 저장소를 변경하지 않은 채 throw한다.
- [ ] `assertSaveDataForTest`는 top-level `SaveData`, `state`, `upgrades`의 exact plain object shape를 검증하고, optional `savedAt` 외의 추가 필드, 필수 필드 누락, 알 수 없는 upgrade key, 누락 upgrade key를 거부한다.
- [ ] 로드 오류 E2E는 깨진 JSON, 미지원 버전, 마이그레이션 실패 데이터를 `setRawSave(raw)`로만 구성하고, 테스트명이나 주석에 `parseFailed`, `migrationFailed`, `unsupported version` 목적을 드러내며, Playwright가 `localStorage`를 직접 만지지 않는다.
- [ ] E2E teardown은 `setStorageFailureMode("none")` 후 `clearSave()` 순서로 정리한다.
- [ ] `setRuntimeState`는 `assertRuntimeStateForTest`를 통과한 상태만 주입하고, 실패 시 기존 runtime과 scheduler를 유지한 채 throw한다.
- [ ] `assertRuntimeStateForTest`는 `loading`, `loadError`, `ready`, `defeatTransition` 각각의 top-level exact union shape와 중첩 객체 exact shape를 검증하고, mode별 허용 필드 밖의 `game`, `persistence`, `runtimeClock`, `defeatedSnapshot`을 추가 필드로 거부한다.
- [ ] `getRuntimeSnapshot()`은 현재 runtime의 deep clone을 반환하며, 반환 객체를 변이해도 하네스 runtime이 바뀌지 않는다.
- [ ] `setRuntimeState(state)`는 검증 통과 후 입력 객체를 deep clone해 주입하며, 호출 후 원본 객체를 변이해도 하네스 runtime이 바뀌지 않는다.
- [ ] 테스트 하네스는 MVP에서 `structuredClone`을 우선 사용하고, clone 실패 또는 clone 불가능한 값이 있는 `RuntimeState` 주입 시 기존 runtime과 scheduler를 유지한 채 throw한다.
- [ ] `RuntimeState`, `GameState`, `SaveData`, `RuntimeEffect`에는 함수, class instance, DOM 객체, Phaser 객체를 넣지 않는 plain-data 불변식을 유지한다.
- [ ] `assertRuntimeStateForTest`는 `runtimeClock.lastDirectAttackAtMs`, `runtimeClock.lastVisibleTickAtMs`, `defeatedSnapshot.startedAtMs`의 시간값이 `null` 또는 0 이상의 finite number 규칙을 따르는지 검증하며, `startedAtMs`는 snapshot이 있을 때 `null`을 허용하지 않는다.
- [ ] `setRuntimeState`는 `defeatedSnapshot.startedAtMs <= performance.now()` 같은 현재 시각 비교를 강제하지 않고, 전환 종료 여부는 `processFrame`의 `RuntimeFrameInput.nowMs` 기준으로만 판단된다.
- [ ] `setRuntimeState`는 available playable state 주입 시 `createAutoSaveSchedulerState(performance.now())`로 scheduler를 재동기화하고, storage-unavailable playable state, `loading`, `loadError` 주입 시 scheduler를 `null`로 둔다.
- [ ] `setRuntimeState` 직후 자동 저장 due가 즉시 발생하지 않으며, E2E는 정밀 due timing을 `setRuntimeState`로 만들지 않는다.
- [ ] `window.__goblinTest`에는 `advanceRuntimeFrame(input: RuntimeFrameInput): RuntimeFrameResult`만 노출되며, 이 API는 앱 조립부 프레임을 흉내 내지 않는다고 문서화되어 있다.
- [ ] `advanceRuntimeFrame`은 입력이 정확히 `nowMs`, `visibilityState`, `directAttackRequested`, `autoSaveDue`만 가진 plain object인지 런타임에서 검증하며, 배열, `null`, 누락 필드, 추가 필드, 잘못된 literal/type을 받으면 `processFrame`을 호출하지 않고 기존 runtime과 scheduler를 유지한 채 throw한다.
- [ ] `RuntimeFrameInput.nowMs`는 0 이상의 finite number여야 하며, `advanceRuntimeFrame`은 잘못된 `input.nowMs`를 받으면 기존 runtime과 scheduler를 유지한 채 throw한다.
- [ ] `RuntimeFrameInput.visibilityState === "hidden"`이면 `directAttackRequested`는 `false`여야 하며, `advanceRuntimeFrame`은 hidden + direct attack 조합을 받으면 기존 runtime과 scheduler를 유지한 채 throw한다.
- [ ] `advanceRuntimeFrame`은 `input.nowMs`가 현재 runtime의 non-null `runtimeClock.lastDirectAttackAtMs` 또는 `runtimeClock.lastVisibleTickAtMs`보다 작으면 기존 runtime과 scheduler를 유지한 채 throw한다.
- [ ] `advanceRuntimeFrame`은 `input.nowMs < defeatedSnapshot.startedAtMs`를 clock monotonic 검증만으로 막지 않으며, 이런 입력은 전환 미완료 상태를 구성할 수 있다.
- [ ] 실제 앱 조립부는 `performance.now()` 기반 단조 증가 시간을 `RuntimeFrameInput.nowMs`로 사용한다.
- [ ] `processFrame`은 비단조 시간 입력이나 음수 투석기 delta를 0으로 보정하지 않고, 이런 입력은 하네스/앱 입력 경계에서 막는다.
- [ ] `advanceRuntimeFrame`은 `processFrame` 결과를 deep clone 가능한지 확인한 뒤 cloned state를 하네스 runtime으로 교체하고, 호출자에게도 deep clone된 `RuntimeFrameResult` snapshot을 반환한다.
- [ ] `advanceRuntimeFrame` 반환 `result.state` 또는 `result.effects`를 변이해도 하네스 내부 runtime이 바뀌지 않으며, clone 실패 시 기존 runtime과 scheduler를 유지한 채 throw한다.
- [ ] `advanceRuntimeFrame`은 `save`, visual, local feedback effect를 자동 처리하지 않는다.
- [ ] `advanceRuntimeFrame`이 반환한 `save` effect는 storage write, `saveGame`, `applySaveEffectResult`, `autoSaveScheduler` 갱신을 자동 실행하지 않는다.
- [ ] `advanceRuntimeFrame`이 반환한 `damageNumber`, `defeatTransitionStarted`, `purchaseFeedback` effect는 Scene/DOM handler를 자동 실행하지 않는다.
- [ ] 저장 직렬화는 `RuntimeState` 전체가 아니라 `PlayableRuntimeState.game` 또는 순수 `GameState`만 대상으로 한다.
- [ ] `src/domain/saveTypes.ts`는 `types.ts`, `save.ts`, 앱/UI 모듈, 다른 domain 구현 파일을 import하지 않는다.
- [ ] `src/domain/types.ts`, `src/domain/save.ts`, `src/app/loadErrorState.ts`, `src/app/loadErrorActions.ts`는 저장 reason 타입이 필요하면 `saveTypes.ts`에서 type-only import한다.
- [ ] `src/domain/save.ts`는 `RuntimeState`, `LoadErrorRuntimeState`, 사용자 표시 문자열, 모달 문구, `createLoadErrorState`, `formatLoadErrorMessage`를 import하지 않는다.
- [ ] `loadGame`은 로드 실패 시 `LoadFailureReason`만 반환하고 `deleteFailed`를 반환하지 않으며, 앱 부팅부와 `loadErrorActions.ts`가 `createLoadErrorState(reason)`으로 `LoadErrorRuntimeState`를 만든다.
- [ ] save 단위 테스트는 `LoadResult.reason`이 `LoadFailureReason`뿐임을 검증하고, `load-error-state.test.ts`가 메시지 생성과 `message === formatLoadErrorMessage(reason)`을 검증한다.
- [ ] load error action 테스트는 `deleteSave` 실패 경로만 `createLoadErrorState("deleteFailed")` 상태를 만드는지 검증한다.
- [ ] `normalizeSaveData`는 `saveVersion: 1`의 `state` object를 필드별로 정규화하고, 누락 upgrade key는 0으로 채우며, 알 수 없는 upgrade key와 top-level/state 추가 필드는 결과에 보존하지 않고 무시한다.
- [ ] `normalizeSaveData`는 `saveVersion` 누락/미지원, `saveVersion === 1`인데 `state`가 없거나 object가 아닌 경우를 `migrationFailed`로 처리한다.
- [ ] `normalizeSaveData`는 invalid `defeatedCount`와 `coins`를 0으로, invalid 또는 0인 `goblinHp`를 정규화된 `currentGoblinMaxHp`로, invalid `savedAt`을 생략으로 정규화한다.
- [ ] `normalizeSaveData`는 투석기 레벨이 0이면 `catapultCooldownRemainingMs`를 0으로, 레벨이 1 이상이면 유효값을 `0..CATAPULT_COOLDOWN_MS`로 clamp하고 invalid 값을 `CATAPULT_COOLDOWN_MS`로 정규화한다.
- [ ] raw catapult level이 invalid라 0으로 정규화되면 raw cooldown 값과 관계없이 `catapultCooldownRemainingMs`도 0이 된다.
- [ ] raw catapult level이 유효하고 cooldown이 과도하면 `CATAPULT_COOLDOWN_MS`로 clamp된다.
- [ ] raw mudTrap level이 invalid라 0으로 정규화되면 raw `mudTrapArmedLevel` 값과 관계없이 `mudTrapArmedLevel`도 0이 된다.
- [ ] raw mudTrap level이 유효하고 armed level이 과도하면 정규화된 mudTrap level로 clamp된다.
- [ ] 저장 정규화 테스트와 `assertSaveDataForTest` 테스트는 `CATAPULT_COOLDOWN_MS`를 import해 사용하고, 쿨다운 상한을 직접 숫자로 복제하지 않는다.
- [ ] `normalizeSaveData`가 canonical `SaveData`를 만들더라도 save effect나 storage write를 만들지 않으며, 저장 키 없음에 따른 `LoadResult.created`의 시작 상태 즉시 저장과 혼동하지 않는다.
- [ ] `LoadResult.loaded`는 canonical `SaveData`만 반환하며, `wasNormalized`, `normalizationWarnings`, `normalizationReport` 같은 정규화 메타 필드를 갖지 않는다.
- [ ] `assertSaveDataForTest`는 strict setup validator이고 `normalizeSaveData`는 사용자 저장 복구용 관대한 정규화 파이프라인이라는 차이를 테스트와 문서가 모두 드러낸다.
- [ ] 앱 최초 부팅은 `loadGame(storage, "boot")`를 호출하며, read 실패 시 playable storage-unavailable 세션으로 시작한다.
- [ ] 로드 오류 재시도는 `loadGame(storage, "retryFromLoadError")`를 호출하며, read 실패 시 기존 저장을 삭제하지 않고 `reason: "readFailed"` 로드 오류 상태를 유지한다.
- [ ] 파싱 실패와 마이그레이션 실패는 `LoadContext`와 무관하게 각각 `parseFailed`, `migrationFailed` 로드 오류로 처리된다.
- [ ] 저장 키 없음은 boot와 retry 모두 시작 상태 생성 흐름으로 처리되고, loadError 재시도에서는 `createdInitialGame`으로 반환된다.
- [ ] `createdInitialGame`은 `loadedExistingSave`나 `startedNewGame`으로 반환되지 않으며, 시작 상태 저장 실패는 `saveWarning: "unsaved"`로 표현된다.
- [ ] 첫 고블린은 5회 직접 공격으로 처치된다.
- [ ] 두 번째 고블린 처치 직후 `낡은 몽둥이`를 구매할 수 있다.
- [ ] MVP 업그레이드 4종이 고정 순서로 표시된다.
- [ ] `purchaseUpgrade`는 순수 `GameState` 구매 규칙만 다루며 `inputBlocked`, `blockedByDefeatTransition`, `loadError`를 반환하거나 참조하지 않는다.
- [ ] `PurchaseFeedback`에는 `none`이 없으며, 구매 성공은 `success`, 비용 부족은 `insufficientCoins`, 전환 차단은 `blockedByDefeatTransition` 구매 피드백 effect로 표현된다.
- [ ] `processPurchase`는 `ready` 상태에서만 `purchaseUpgrade`를 호출하고, 구매 성공 시 갱신된 상태, 저장 효과, `previousLevel`과 `nextLevel`을 포함한 `success` 구매 피드백 effect를 반환한다.
- [ ] 성공 구매 피드백의 `previousLevel`은 구매 전 레벨, `nextLevel`은 구매 후 레벨이며 MVP에서는 `nextLevel === previousLevel + 1`이다.
- [ ] 성공 구매 피드백 payload에는 비용, 다음 비용, 다음 효과, 클릭 피해량, 저장 성공/실패 여부를 넣지 않는다.
- [ ] UI는 success payload로 레벨 증가 피드백과 접근성 상태 문구를 표시하고, 다음 비용/효과는 갱신된 `GameState`, `UPGRADE_DEFINITIONS`, `progression` 함수로 계산한다.
- [ ] 비용 부족 시 `processPurchase`는 `missingCoins`가 포함된 `insufficientCoins` 구매 피드백 effect와 빈 저장 효과를 반환한다.
- [ ] `processPurchase`는 `defeatTransition` 상태에서 `purchaseUpgrade`를 호출하지 않고 `blockedByDefeatTransition` 구매 피드백 effect만 반환한다.
- [ ] 성공 구매 피드백은 버튼/숫자 중심의 로컬 피드백으로 제한하고, 전역 모달, 토스트, 화면 전체 연출을 만들지 않는다.
- [ ] 구매 성공 뒤 저장 실패가 발생해도 레벨/재화 변경과 `success` 구매 피드백은 유지되고, 저장 실패는 `unsaved` HUD 경고로만 표시된다.
- [ ] 저장소 접근 실패 세션에서도 구매 성공 피드백은 표시되며, 저장 효과는 실제 쓰기 없이 `skippedStorageUnavailable`로 처리되어 `storageUnavailable` 경고가 유지된다.
- [ ] 저장 실패 경고와 구매 성공 피드백은 서로 다른 UI 영역에 표시되고 서로 덮거나 숨기지 않는다.
- [ ] 비용 부족 버튼은 포커스 가능하고 `aria-disabled="false"`이며, 활성화 시 버튼 단위 실패 피드백만 표시하고 `GameState`와 저장 효과를 바꾸지 않는다.
- [ ] `DEFEAT_TRANSITION_MS` 처치 전환 중 구매 가능 행과 비용 부족 행은 모두 `blockedByDefeatTransition`으로 표시되고, 활성화 시 구매 성공/실패 트랜잭션과 저장 효과를 만들지 않는다.
- [ ] `DEFEAT_TRANSITION_MS` 처치 전환 종료 후 상점 행은 최신 재화 기준의 `buyable` 또는 `insufficientCoins` 상태로 재계산된다.
- [ ] 투석기는 직접 클릭을 대체하지 않는 보조 피해로 동작한다.
- [ ] 진흙 함정은 새 고블린 첫 직접 공격에만 적용된다.
- [ ] `DEFEAT_TRANSITION_MS` 처치 전환 중 입력이 다음 고블린에게 새지 않는다.
- [ ] `defeatTransitionStarted`와 `showDefeat`는 대상 `enemyInstanceId`를 가진 연출 시작 알림일 뿐이며 duration payload를 갖지 않고, 전환 종료 판정은 `processFrame`과 `DEFEAT_TRANSITION_MS` 기준으로만 수행된다.
- [ ] 처치 전환 종료 판정은 `defeatedSnapshot.startedAtMs + DEFEAT_TRANSITION_MS <= RuntimeFrameInput.nowMs` 기준만 사용한다.
- [ ] Phaser는 포인터 직접 공격 영역만 소유하고, Space 키 직접 공격은 DOM 포커스 게이트에서만 playable + sceneReady 상태의 `directAttackRequested`로 합류한다.
- [ ] `document.visibilityState !== "visible"` 상태의 포인터 입력과 Space 입력은 `directAttackRequested`로 큐잉되지 않고 나중에 재생되지 않는다.
- [ ] `sceneReady` 전 포인터 입력과 Space 입력은 전투 입력으로 큐잉되지 않고 나중에 재생되지 않는다.
- [ ] 전투 컨테이너 포커스 상태의 Space `keydown`만 키보드 직접 공격이 되며, UI 버튼/상점/모달 포커스 상태의 Space/Enter는 전투 입력으로 새지 않는다.
- [ ] 저장 실패와 저장소 접근 실패가 서로 다른 HUD 상태로 표시된다.
- [ ] 로드 오류 차단 모달은 임시 플레이를 시작하지 않고, 새 게임 시작은 delete 성공 후에만 ready로 전환한다.
- [ ] 로드 오류 모달의 다시 시도와 취소는 기존 저장을 삭제하지 않으며, 실패 또는 취소 시 `loadError` 상태를 유지한다.
- [ ] 모바일 상점 마지막 행과 마지막 포커스 요소가 하단 토글에 가려지지 않는다.
- [ ] 모바일 직접 공격 영역은 최소 `160px x 160px`를 유지한다.
- [ ] 체력 바는 화면에 한 번만 표시되고 DOM HUD가 소유한다.
- [ ] HP 숫자와 즉시 체력 바는 같은 `EnemyRenderState.hp` 기준으로 즉시 갱신된다.
- [ ] 잔상 체력 바는 DOM HUD 렌더링 상태로만 `HP_GHOST_BAR_DELAY_MS` 늦게 따라오며 처치 판정, 저장, 다음 고블린 체력 계산에 쓰이지 않는다.
- [ ] `DEFEAT_TRANSITION_MS` 처치 전환 중 전역 상태는 최신 `state.game` 기준으로 갱신되고, DOM HUD와 Phaser `renderGoblinVisualState`는 같은 `EnemyRenderState` defeated snapshot 기준을 유지한다.
- [ ] 고블린, 재화, 업그레이드 4종이 텍스트만이 아니라 시각 에셋으로 식별된다.
- [ ] 고블린 피격/처치 상태가 스프라이트 또는 프레임 변경으로 확인된다.
- [ ] Phaser 에셋 로드 실패 콘솔 오류가 없다.
- [ ] 첫 10분 밸런스 기록이 문서화되어 있다.

## 9. 실행 핸드오프

Plan complete and saved to `docs/goblin-clicker-implementation.md`. Two execution options:

**1. Subagent-Driven (recommended)** - fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - execute tasks in this session using executing-plans, batch execution with checkpoints
