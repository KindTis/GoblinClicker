import Phaser from "phaser";
import { ASSETS } from "../assets/assetManifest";
import type { EnemyRenderState } from "../domain/types";
import { emitSceneEvent, type AppToSceneEvent, type SceneVisualEffect } from "./sceneEvents";

export class GoblinScene extends Phaser.Scene {
  private goblinSprite: Phaser.GameObjects.Image | null = null;
  private baseEnemyRenderState: EnemyRenderState | null = null;
  private inputBlocked = true;
  private hitTimer: Phaser.Time.TimerEvent | null = null;
  private damageTexts: Phaser.GameObjects.Text[] = [];

  constructor() {
    super("GoblinScene");
  }

  preload(): void {
    for (const asset of Object.values(ASSETS)) {
      this.load.image(asset.key, asset.src);
    }
  }

  create(): void {
    const { width, height } = this.scale;
    this.add.image(width / 2, height / 2, "background").setDisplaySize(width, height).setDepth(0);
    this.goblinSprite = this.add.image(width / 2, height * 0.48, "goblinIdle").setDisplaySize(230, 230).setDepth(2);

    const attackZone = this.add
      .zone(width / 2, height * 0.48, Math.max(230, 160), Math.max(230, 160))
      .setInteractive({ useHandCursor: true });
    attackZone.on("pointerdown", () => {
      if (!this.inputBlocked) {
        emitSceneEvent({ type: "directAttackRequested" });
      }
    });

    emitSceneEvent({ type: "sceneReady" });
  }

  dispatch(event: AppToSceneEvent): void {
    switch (event.type) {
      case "renderGoblinVisualState":
        this.renderGoblinVisualState(event.state);
        return;
      case "applyVisualEffects":
        this.applyVisualEffects(event.effects);
        return;
      case "setInputBlocked":
        this.inputBlocked = event.blocked;
        return;
    }
  }

  private renderGoblinVisualState(state: EnemyRenderState): void {
    this.baseEnemyRenderState = state;
    if (!this.goblinSprite) return;
    this.goblinSprite.setTexture(state.visualState === "defeated" ? "goblinDefeat" : "goblinIdle");
    this.goblinSprite.setAlpha(1);
    this.goblinSprite.setScale(1);
  }

  private applyVisualEffects(effects: SceneVisualEffect[]): void {
    if (!this.baseEnemyRenderState || !this.goblinSprite) return;
    const currentId = this.baseEnemyRenderState.enemyInstanceId;
    const validDefeatIds = new Set(
      effects
        .filter((effect): effect is Extract<SceneVisualEffect, { type: "showDefeat" }> => effect.type === "showDefeat")
        .filter((effect) => effect.enemyInstanceId === currentId)
        .map((effect) => effect.enemyInstanceId),
    );

    for (const effect of effects) {
      if (effect.type === "showDamage" && effect.enemyInstanceId === currentId) {
        this.showDamage(effect, !validDefeatIds.has(effect.enemyInstanceId));
      }
    }

    for (const effect of effects) {
      if (effect.type === "showDefeat" && effect.enemyInstanceId === currentId) {
        this.showDefeat();
      }
    }
  }

  private showDamage(
    effect: Extract<SceneVisualEffect, { type: "showDamage" }>,
    allowHitState: boolean,
  ): void {
    if (!this.goblinSprite) return;
    const text = this.add
      .text(this.goblinSprite.x + (effect.source === "catapult" ? 32 : -20), this.goblinSprite.y - 100, `-${effect.damage}`, {
        color: effect.source === "catapult" ? "#f8d36a" : "#ffffff",
        fontFamily: "Arial, sans-serif",
        fontSize: "26px",
        fontStyle: "700",
        stroke: "#2a160c",
        strokeThickness: 4,
      })
      .setDepth(5);
    this.damageTexts.push(text);
    while (this.damageTexts.length > 6) {
      this.damageTexts.shift()?.destroy();
    }
    this.tweens.add({
      targets: text,
      y: text.y - 44,
      alpha: 0,
      duration: 600,
      onComplete: () => {
        this.damageTexts = this.damageTexts.filter((item) => item !== text);
        text.destroy();
      },
    });

    if (allowHitState) {
      this.goblinSprite.setTexture("goblinHit");
      this.hitTimer?.remove(false);
      const capturedId = this.baseEnemyRenderState?.enemyInstanceId;
      this.hitTimer = this.time.delayedCall(120, () => {
        const renderState = this.baseEnemyRenderState;
        if (renderState && renderState.enemyInstanceId === capturedId && renderState.visualState === "idle") {
          this.goblinSprite?.setTexture("goblinIdle");
        }
      });
    }
  }

  private showDefeat(): void {
    if (!this.goblinSprite) return;
    this.goblinSprite.setTexture("goblinDefeat");
    const dust = this.add.image(this.goblinSprite.x, this.goblinSprite.y + 48, "defeatDust").setDisplaySize(160, 100).setDepth(4);
    this.tweens.add({
      targets: [this.goblinSprite, dust],
      alpha: 0.15,
      scale: 1.08,
      duration: 260,
      onComplete: () => dust.destroy(),
    });
  }
}
