# 고블린 클릭커 MVP 10분 밸런스 기록

검증일: 2026-06-15

## 검증 방법

- 자동 검증: `npm test -- tests/unit/balance-simulation.test.ts`
- 시뮬레이션 시간: 5분 핵심 구간과 10분 보조 구간
- active baseline: 2.5 clicks/sec에 가까운 보수적 직접 공격 간격, `DEFEAT_TRANSITION_MS` 처치 전환 시간 포함, `낡은 몽둥이` 우선 구매
- auto-only baseline: 투석기 보유 상태에서 직접 공격 없이 진행

## 판정

- 5분 active baseline은 25~40마리 범위에 들어오고, 2종 이상 업그레이드를 경험한다.
- active baseline은 10분 안에 20마리 이상 처치, `낡은 몽둥이` 구매, 3회 이상 구매를 만족한다.
- auto-only baseline은 active baseline보다 느리다.
- 따라서 MVP 의도인 “직접 클릭이 가장 빠른 진행 방법이고 자동 피해는 보조 수단”을 유지한다.

## 근거

`tests/unit/balance-simulation.test.ts`가 위 조건을 회귀 테스트로 고정한다.
