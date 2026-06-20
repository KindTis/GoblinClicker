# Graph Report - .  (2026-06-18)

## Corpus Check
- 74 files · ~51,134 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 278 nodes · 698 edges · 15 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `createInitialGameState` - 15 edges
3. `renderAll()` - 15 edges
4. `GoblinScene` - 12 edges
5. `UpgradeId` - 11 edges
6. `createLoadErrorState` - 10 edges
7. `applyDirectAttack` - 10 edges
8. `tickCatapult` - 10 edges
9. `loadGame` - 10 edges
10. `saveGame` - 10 edges

## Surprising Connections (you probably didn't know these)
- `handleRuntimeResult()` --calls--> `toSceneVisualEffects`  [EXTRACTED]
  src/main.ts → src/app/effects.ts
- `handleRuntimeResult()` --calls--> `selectLatestSaveEffect`  [EXTRACTED]
  src/main.ts → src/app/effects.ts
- `startNewGameFromLoadError` --calls--> `createInitialGameState`  [EXTRACTED]
  src/app/loadErrorActions.ts → src/domain/save.ts
- `processFrame` --calls--> `applyDirectAttack`  [EXTRACTED]
  src/domain/runtime.ts → src/domain/combat.ts
- `simulate()` --calls--> `applyDirectAttack`  [EXTRACTED]
  src/test/balanceSimulator.ts → src/domain/combat.ts

## Import Cycles
- None detected.

## Communities (15 total, 0 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.08
Nodes (47): AutoSaveSchedulerState, createAutoSaveSchedulerState, isAutoSaveDue, recordAutoSaveBaseline, cancelLoadError, LoadErrorActionResult, readyState(), retryLoadFromLoadError (+39 more)

### Community 1 - "Community 1"
Cohesion: 0.13
Nodes (33): applyDirectAttack, AttackResult, AttackSource, CatapultTickResult, defeatCurrentGoblin, tickCatapult, calculateBaseKillReward, calculateCatapultDamage (+25 more)

### Community 2 - "Community 2"
Cohesion: 0.13
Nodes (26): AssetKey, UPGRADE_DEFINITIONS, UPGRADE_ORDER, calculateUpgradeCost, processPurchase, createInitialGameState, GameState, UpgradeId (+18 more)

### Community 3 - "Community 3"
Cohesion: 0.13
Nodes (13): AssetDefinition, ASSETS, centerAnchor, goblinSize, EnemyRenderState, GoblinScene, AppToSceneEvent, emitSceneEvent (+5 more)

### Community 4 - "Community 4"
Cohesion: 0.11
Nodes (17): isPlainObject(), LoadContext, LoadResult, normalizeSaveData, safeNonNegativeInteger(), toSaveData, LoadErrorReason, LoadFailureReason (+9 more)

### Community 5 - "Community 5"
Cohesion: 0.21
Nodes (20): RuntimeState, assertExactKeys(), assertGameStateForTest(), assertNonNegativeFinite(), assertNonNegativeInteger(), assertPersistenceForTest(), assertPlainObject(), assertRuntimeClockForTest() (+12 more)

### Community 6 - "Community 6"
Cohesion: 0.10
Nodes (20): dependencies, phaser, devDependencies, jsdom, @playwright/test, @types/node, typescript, vite (+12 more)

### Community 7 - "Community 7"
Cohesion: 0.11
Nodes (17): compilerOptions, allowJs, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, lib, module (+9 more)

### Community 8 - "Community 8"
Cohesion: 0.22
Nodes (11): selectLatestSaveEffect, toSceneVisualEffects, canDirectAttack(), processFrame, PurchaseFeedback, PurchaseTransactionResult, RuntimeEffect, RuntimeFrameInput (+3 more)

### Community 9 - "Community 9"
Cohesion: 0.38
Nodes (4): delay(), isServerReady(), serverArgs, waitForServer()

## Knowledge Gaps
- **72 isolated node(s):** `LoadErrorActionResult`, `AssetDefinition`, `AttackSource`, `AttackResult`, `CatapultTickResult` (+67 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `GoblinScene` connect `Community 3` to `Community 0`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Why does `createInitialGameState` connect `Community 2` to `Community 0`, `Community 1`, `Community 4`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `EnemyRenderState` connect `Community 3` to `Community 8`, `Community 1`, `Community 4`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `LoadErrorActionResult`, `AssetDefinition`, `AttackSource` to the rest of the system?**
  _72 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07704918032786885 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.1282051282051282 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.1251778093883357 - nodes in this community are weakly interconnected._