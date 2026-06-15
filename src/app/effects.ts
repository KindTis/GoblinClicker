import type { RuntimeEffect } from "../domain/runtime";
import type { SceneVisualEffect } from "../game/sceneEvents";

export function toSceneVisualEffects(effects: RuntimeEffect[]): SceneVisualEffect[] {
  const visualEffects: SceneVisualEffect[] = [];
  for (const effect of effects) {
    if (effect.type === "damageNumber") {
      visualEffects.push({
        type: "showDamage",
        enemyInstanceId: effect.enemyInstanceId,
        source: effect.source,
        damage: effect.damage,
      });
      continue;
    }
    if (effect.type === "defeatTransitionStarted") {
      visualEffects.push({ type: "showDefeat", enemyInstanceId: effect.enemyInstanceId });
    }
  }
  return visualEffects;
}

export function selectLatestSaveEffect(
  effects: RuntimeEffect[],
): Extract<RuntimeEffect, { type: "save" }> | null {
  const saveEffects = effects.filter(
    (effect): effect is Extract<RuntimeEffect, { type: "save" }> => effect.type === "save",
  );
  return saveEffects.at(-1) ?? null;
}
