import { ASSETS } from "../assets/assetManifest";
import { UPGRADE_DEFINITIONS } from "../domain/constants";
import { calculateCatapultDamage, calculateClickDamage, calculateGoblinLevel, calculateGoblinMaxHp, calculateUpgradeCost } from "../domain/progression";
import { countAffordableUpgrades } from "../domain/upgrades";
import type { EnemyRenderState, RuntimeState, UpgradeId } from "../domain/types";
import type { PurchaseFeedback } from "../domain/runtime";
import { createShopRowViewModels, type ShopRowViewModel } from "./shop";

export type HudHandlers = {
  onPurchase(upgradeId: UpgradeId): void;
  onOpenResetModal(): void;
  onToggleShop(open: boolean): void;
};

export type HudRenderState = {
  runtime: RuntimeState;
  enemy: EnemyRenderState | null;
  shopOpen: boolean;
  purchaseFeedback: PurchaseFeedback | null;
};

const ghostHpByEnemyId = new Map<number, number>();

export function renderHud(root: HTMLElement, state: HudRenderState, handlers: HudHandlers): void {
  root.replaceChildren();
  root.append(createStatusPanel(state), createShop(state, handlers), createMobileShopToggle(state, handlers));
}

function createStatusPanel(state: HudRenderState): HTMLElement {
  const section = document.createElement("section");
  section.className = "hud-panel";
  section.setAttribute("aria-label", "게임 상태");

  if (state.runtime.mode === "loadError") {
    section.append(textBlock("저장 오류", state.runtime.message));
    return section;
  }

  if (!state.enemy || (state.runtime.mode !== "ready" && state.runtime.mode !== "defeatTransition")) {
    section.append(textBlock("로딩", "게임을 준비하는 중입니다"));
    return section;
  }

  const game = state.runtime.game;
  const maxHp = state.enemy.maxHp;
  const ghostHp = selectGhostHp(state.enemy);
  const clickDamage = calculateClickDamage(game.upgrades.club);
  const catapultDamage = game.upgrades.catapult > 0 ? calculateCatapultDamage(clickDamage, game.upgrades.catapult) : 0;
  const warning =
    state.runtime.persistence.kind === "unavailable"
      ? "저장소에 접근할 수 없어 저장되지 않음. 새로고침하면 진행이 사라질 수 있습니다."
      : state.runtime.persistence.saveWarning === "unsaved"
        ? "저장되지 않음"
        : "";

  section.innerHTML = `
    <div class="stat-row">
      <span>처치 ${game.defeatedCount}</span>
      <span><img src="${ASSETS.coin.src}" alt="" /> 녹슨 동전 ${game.coins}</span>
    </div>
    <div class="enemy-summary">
      <span>고블린 레벨 ${state.enemy.goblinLevel}</span>
      <span>클릭 피해 ${clickDamage}</span>
    </div>
    <div class="hp-label">
      <span>HP ${state.enemy.hp} / ${maxHp}</span>
    </div>
    <div class="hp-bar" data-enemy-id="${state.enemy.enemyInstanceId}" data-hp="${state.enemy.hp}" data-max-hp="${maxHp}" aria-label="고블린 체력">
      <div class="hp-ghost" style="width:${Math.max(0, (ghostHp / maxHp) * 100)}%"></div>
      <div class="hp-now" style="width:${Math.max(0, (state.enemy.hp / maxHp) * 100)}%"></div>
    </div>
    ${
      game.upgrades.catapult > 0
        ? `<p class="sub-stat">투석기: ${(game.catapultCooldownRemainingMs / 1000).toFixed(1)}초 후 ${catapultDamage} 피해</p>`
        : ""
    }
    ${warning ? `<p class="save-warning">${warning}</p>` : ""}
  `;
  return section;
}

function createShop(state: HudRenderState, handlers: HudHandlers): HTMLElement {
  const section = document.createElement("section");
  section.id = "shop-sheet";
  section.className = `shop-panel ${state.shopOpen ? "is-open" : ""}`;
  section.setAttribute("aria-label", "업그레이드 상점");
  section.innerHTML = `
    <div class="shop-heading">
      <h2 tabindex="-1">상점</h2>
      <button type="button" class="mobile-close">닫기</button>
    </div>
    <div class="shop-list"></div>
    <button type="button" class="reset-button">저장 초기화</button>
  `;

  section.querySelector<HTMLButtonElement>(".mobile-close")?.addEventListener("click", () => handlers.onToggleShop(false));
  section.querySelector<HTMLButtonElement>(".reset-button")?.addEventListener("click", handlers.onOpenResetModal);

  const list = section.querySelector<HTMLElement>(".shop-list");
  if (list) {
    for (const row of createShopRowViewModels(state.runtime)) {
      list.append(createShopRow(row, state.runtime, state.purchaseFeedback, handlers));
    }
  }
  return section;
}

function createShopRow(
  row: ShopRowViewModel,
  runtime: RuntimeState,
  purchaseFeedback: PurchaseFeedback | null,
  handlers: HudHandlers,
): HTMLElement {
  const definition = UPGRADE_DEFINITIONS[row.upgradeId];
  const article = document.createElement("article");
  article.className = `shop-row ${row.inputState}`;
  const level = runtime.mode === "ready" || runtime.mode === "defeatTransition" ? runtime.game.upgrades[row.upgradeId] : 0;
  const cost = runtime.mode === "ready" || runtime.mode === "defeatTransition" ? calculateUpgradeCost(row.upgradeId, level) : definition.baseCost;
  const statusText = feedbackStatusText(row, purchaseFeedback) ?? row.statusText;
  article.innerHTML = `
    <img class="upgrade-icon" src="${ASSETS[row.iconAssetKey].src}" alt="" />
    <div class="shop-copy">
      <div class="shop-title">
        <strong>${definition.name}</strong>
        ${row.upgradeId === "club" && level === 0 ? "<span class=\"recommend\">추천</span>" : ""}
      </div>
      <p>레벨 ${level} · 비용 ${cost}</p>
      <p>${definition.description}</p>
      <p id="${row.describedById}" class="shop-status">${statusText}</p>
    </div>
    <button type="button" aria-disabled="${row.ariaDisabled}" aria-describedby="${row.describedById}">${row.buttonText}</button>
  `;
  article.querySelector("button")?.addEventListener("click", () => {
    if (row.activationBehavior === "purchase") {
      handlers.onPurchase(row.upgradeId);
    } else if (row.activationBehavior === "showInsufficientFeedback") {
      article.classList.add("feedback");
      window.setTimeout(() => article.classList.remove("feedback"), 220);
    }
  });
  return article;
}

function feedbackStatusText(row: ShopRowViewModel, feedback: PurchaseFeedback | null): string | null {
  if (!feedback || feedback.upgradeId !== row.upgradeId) return null;
  if (feedback.type === "success") return `레벨 ${feedback.nextLevel} 구매 완료`;
  if (feedback.type === "insufficientCoins") return `녹슨 동전 ${feedback.missingCoins}개 부족`;
  return "잠시 후 구매 가능";
}

function selectGhostHp(enemy: EnemyRenderState): number {
  const previous = ghostHpByEnemyId.get(enemy.enemyInstanceId);
  if (previous === undefined || enemy.hp >= previous) {
    ghostHpByEnemyId.set(enemy.enemyInstanceId, enemy.hp);
    return enemy.hp;
  }
  window.setTimeout(() => {
    ghostHpByEnemyId.set(enemy.enemyInstanceId, enemy.hp);
    const bar = document.querySelector<HTMLElement>(
      `.hp-bar[data-enemy-id="${enemy.enemyInstanceId}"] .hp-ghost`,
    );
    if (bar) {
      bar.style.width = `${Math.max(0, (enemy.hp / enemy.maxHp) * 100)}%`;
    }
  }, 250);
  return previous;
}

function createMobileShopToggle(state: HudRenderState, handlers: HudHandlers): HTMLElement {
  const button = document.createElement("button");
  button.type = "button";
  button.id = "shop-toggle";
  button.setAttribute("aria-controls", "shop-sheet");
  button.setAttribute("aria-expanded", String(state.shopOpen));
  const count =
    state.runtime.mode === "ready" || state.runtime.mode === "defeatTransition"
      ? countAffordableUpgrades(state.runtime.game)
      : 0;
  button.textContent = state.shopOpen
    ? count > 0
      ? `상점 닫기, 구매 가능 업그레이드 ${count}개`
      : "상점 닫기, 구매 가능 업그레이드 없음"
    : count > 0
      ? `상점 열기, 구매 가능 업그레이드 ${count}개`
      : "상점 열기, 구매 가능 업그레이드 없음";
  button.addEventListener("click", () => handlers.onToggleShop(!state.shopOpen));
  return button;
}

function textBlock(title: string, body: string): HTMLElement {
  const block = document.createElement("div");
  block.innerHTML = `<strong>${title}</strong><p>${body}</p>`;
  return block;
}
