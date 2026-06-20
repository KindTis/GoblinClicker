## 구현 항목 매핑표

| ID | 구현 계획서 항목 | 구현 의도 / 수용 기준 | 구현 대상 | 구현 방향 | 구현 상태 | 검증 방법 | 검증 결과 |
|---|---|---|---|---|---|---|---|
| IMPL-001 | Task 1: Domain IDs, Constants, And Pure Progression | 신규 업그레이드 5종 ID, 상점 순서, 비용/성장률, 순수 계산 공식을 제공한다. | `src/domain/types.ts`, `src/domain/constants.ts`, `src/domain/progression.ts`, `tests/unit/constants.test.ts`, `tests/unit/progression.test.ts` | 기존 `UpgradeId`, `UPGRADE_ORDER`, `UPGRADE_DEFINITIONS`, progression 함수에 신규 키와 기본 인자를 추가한다. | 구현 | `npm.cmd test` | 통과 |
| IMPL-002 | Task 2: Save Compatibility And Initial State | 초기 상태와 저장 정규화가 신규 업그레이드 키와 확장된 진흙 함정 준비 레벨을 보존한다. | `src/domain/save.ts`, `src/test/e2eHarness.ts`, `tests/unit/save.test.ts`, `tests/unit/runtime.test.ts` | `UPGRADE_ORDER` 기반 정규화와 `calculateMudTrapArmedLevel` 상한을 사용한다. | 구현 | `npm.cmd test` | 통과 |
| IMPL-003 | Task 3: Purchase Behavior For New Upgrade IDs | 신규 업그레이드가 기존 구매 트랜잭션으로 구매되고 투석기 특수 규칙이 신규 업그레이드에 번지지 않는다. | `src/domain/upgrades.ts`, `tests/unit/upgrades.test.ts` | 구매 로직은 범용 유지, 첫 투석기 구매 쿨다운만 특수 처리한다. | 구현 | `npm.cmd test` | 통과 |
| IMPL-004 | Task 4: Combat Formula Integration | 직접 공격, 자동 공격, 처치 보상, 다음 고블린 준비 상태에 신규 공식을 적용한다. | `src/domain/combat.ts`, `tests/unit/combat.test.ts` | `calculateClickDamage`, `calculateCatapultDamage`, `calculateKillReward`, `calculateMudTrapArmedLevel`, `calculateFinalDamage`를 전투 흐름에 연결한다. | 구현 | `npm.cmd test` | 통과 |
| IMPL-005 | Task 5: UI Presentation And Asset Manifest | 신규 업그레이드 아이콘 에셋과 UI 표시 매핑을 제공한다. | `src/assets/assetManifest.ts`, `src/assets/upgrade-*.svg`, `src/ui/upgradePresentation.ts`, `tests/unit/asset-manifest.test.ts`, `tests/unit/upgrade-presentation.test.ts` | 에셋 키 5종과 SVG 파일을 추가하고 `UPGRADE_PRESENTATION`을 확장한다. | 구현 | `npm.cmd test` | 통과 |
| IMPL-006 | Task 6: Shop And HUD Rendering | 상점에 9개 업그레이드를 표시하고 HUD 피해 표시가 신규 피해 공식을 사용한다. | `src/ui/shop.ts`, `src/ui/hud.ts`, `tests/unit/shop.test.ts`, `tests/unit/hud.test.ts` | `UPGRADE_ORDER` 기반 렌더링을 유지하고 HUD에서 최종 피해 배율을 한 번만 적용한다. | 구현 | `npm.cmd test` | 통과 |
| IMPL-007 | Task 7: Balance Simulation And Verification Gates | 10분 baseline 보호와 12~18분 전투 도끼 목표 구매 시점을 테스트로 고정한다. | `src/test/balanceSimulator.ts`, `tests/unit/balance-simulation.test.ts` | high-tier 구매 가능 기록과 `simulateHighTierTargetBaseline`을 추가한다. | 구현 | `npm.cmd test` | 통과 |
| IMPL-008 | Task 8: Browser Smoke Coverage | 브라우저에서 상위 업그레이드 표시와 구매 후 저장 복원을 확인한다. | `tests/e2e/smoke.spec.ts` | 테스트 하네스로 코인을 부여하고 신규 업그레이드 표시/구매/새로고침 복원을 검증한다. | 구현 | `npm.cmd run build`, `npm.cmd run test:e2e -- tests/e2e/smoke.spec.ts` | 통과 |
| IMPL-009 | Task 9: Final Verification And Graph Update | 전체 단위 테스트, 프로덕션 빌드, E2E, graphify 갱신을 완료한다. | `package.json` scripts, `graphify-out/` | 계획서의 최종 검증 명령을 실행하고 그래프를 갱신한다. | 구현 | `npm.cmd test`, `npm.cmd run build`, `npm.cmd run test:e2e`, `graphify update .`, `graphify export html` | 통과 |

## 구현 가정

- 현재 작업 트리에 이미 존재하는 high-tier shop item 관련 변경은 사용자가 요청한 남은 구현의 일부로 간주하고 되돌리지 않는다.
- 계획서의 태스크별 커밋 단계는 현재 작업 트리가 이미 dirty 상태이므로 수행하지 않는다. 최종 커밋도 사용자가 별도로 요청할 때만 수행한다.
- `battleAxe` 기본 비용 180은 계획서의 Known Balance Gate에 따라 그대로 유지한다.

## 보류 항목

- 없음.

## 남은 리스크

- `graphify update .`는 Windows multiprocessing 경고를 출력했으나 종료 코드 0으로 끝났다. 이후 `graphify.extract.extract(..., parallel=False)` 기반 수동 AST 갱신과 `graphify export html`로 `graphify-out/graph.json`, `GRAPH_REPORT.md`, `graph.html`을 갱신했다.
