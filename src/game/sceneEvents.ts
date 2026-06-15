import type { EnemyRenderState } from "../domain/types";

export type SceneToAppEvent = { type: "sceneReady" } | { type: "directAttackRequested" };

export type SceneGoblinVisualState = EnemyRenderState["visualState"] | "hit";

export type SceneVisualEffect =
  | { type: "showDamage"; enemyInstanceId: number; source: "direct" | "catapult"; damage: number }
  | { type: "showDefeat"; enemyInstanceId: number };

export type AppToSceneEvent =
  | { type: "renderGoblinVisualState"; state: EnemyRenderState }
  | { type: "applyVisualEffects"; effects: SceneVisualEffect[] }
  | { type: "setInputBlocked"; blocked: boolean };

type SceneEventHandler = (event: SceneToAppEvent) => void;

let sceneEventHandler: SceneEventHandler | null = null;

export function setSceneEventHandler(handler: SceneEventHandler): void {
  sceneEventHandler = handler;
}

export function emitSceneEvent(event: SceneToAppEvent): void {
  sceneEventHandler?.(event);
}
