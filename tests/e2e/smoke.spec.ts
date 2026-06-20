import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

test.afterEach(async ({ page }) => {
  const harness = await page.evaluate(() => window.__goblinTest);
  if (harness) {
    await page.evaluate(() => {
      window.__goblinTest?.setStorageFailureMode("none");
      window.__goblinTest?.clearSave();
    });
  }
});

test("테스트 모드 하네스와 기본 클릭 흐름이 동작한다", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("main", { name: "고블린 클릭커 전투 화면" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(window.__goblinTest))).toBe(true);
  await expect(page.getByText("고블린 레벨 1")).toBeVisible();

  const attackArea = page.getByTestId("goblin-attack-area");
  for (let i = 0; i < 5; i += 1) {
    await attackArea.click();
    await page.waitForTimeout(90);
  }
  await expect(page.getByText("처치 1")).toBeVisible();
});

test("두 번째 처치 후 첫 구매, 추천 제거, 저장 복원을 확인한다", async ({ page }) => {
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => Boolean(window.__goblinTest))).toBe(true);
  const attackArea = page.getByTestId("goblin-attack-area");
  for (let i = 0; i < 10; i += 1) {
    await attackArea.click();
    await page.waitForTimeout(90);
    if (i === 4) {
      await page.waitForTimeout(320);
    }
  }
  await expect(page.getByText("처치 2")).toBeVisible();
  const shopToggle = page.getByRole("button", { name: /상점 열기/ });
  if (await shopToggle.isVisible()) {
    await shopToggle.click();
  }
  await page.getByRole("button", { name: "낡은 몽둥이" }).click();
  await expect(page.getByText("레벨 1 · 비용 4")).toBeVisible();
  await expect(page.getByText("추천")).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("처치 2")).toBeVisible();
  const shopToggleAfterReload = page.getByRole("button", { name: /상점 열기/ });
  if (await shopToggleAfterReload.isVisible()) {
    await shopToggleAfterReload.click();
  }
  await expect(page.getByText("레벨 1 · 비용 4")).toBeVisible();
});

test("깨진 저장 데이터는 로드 오류 모달로 분리된다", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.__goblinTest?.setRawSave("{"));
  await page.reload();
  await expect(page.getByRole("dialog")).toContainText("저장 데이터를 읽을 수 없습니다");
});

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
      runtimeClock: { ...state.runtimeClock, lastVisibleTickAtMs: performance.now() },
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

test("새 게임 시작 확인 모달의 취소와 확인 버튼이 동작한다", async ({ page }) => {
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
        coins: 123,
        defeatedCount: 7,
        upgrades: { ...state.game.upgrades, club: 2 },
      },
    });
  });

  const shopToggle = page.getByRole("button", { name: /상점 열기/ });
  if (await shopToggle.isVisible()) {
    await shopToggle.click();
  }

  const newGameButton = page.locator(".reset-button");
  await newGameButton.scrollIntoViewIfNeeded();
  await newGameButton.click();

  const dialog = page.getByRole("dialog", { name: "새 게임 시작 확인" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "취소" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__goblinTest?.getRuntimeSnapshot().mode)).toBe("ready");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const state = window.__goblinTest?.getRuntimeSnapshot();
        return state?.mode === "ready" ? state.game.coins : null;
      }),
    )
    .toBe(123);

  await newGameButton.scrollIntoViewIfNeeded();
  await newGameButton.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "새 게임 시작" }).click();

  await expect(dialog).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const state = window.__goblinTest?.getRuntimeSnapshot();
        return state?.mode === "ready"
          ? {
              coins: state.game.coins,
              defeatedCount: state.game.defeatedCount,
              clubLevel: state.game.upgrades.club,
            }
          : null;
      }),
    )
    .toEqual({ coins: 0, defeatedCount: 0, clubLevel: 0 });
});

test("투석기 틱 중 새 게임 시작 확인 모달 버튼은 실제 포인터 클릭으로 동작한다", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop project covers the reported deployed modal click regression");
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
        catapultCooldownRemainingMs: 3700,
        coins: 137,
        defeatedCount: 38,
        goblinHp: 2134,
        upgrades: { ...state.game.upgrades, club: 7, catapult: 1 },
      },
      runtimeClock: { ...state.runtimeClock, lastVisibleTickAtMs: performance.now() },
    });
  });

  await expect(page.getByText(/투석기:/)).toBeVisible();
  const shopToggle = page.getByRole("button", { name: /상점 열기/ });
  if (await shopToggle.isVisible()) {
    await shopToggle.click();
  }

  const newGameButton = page.locator(".reset-button");
  await newGameButton.scrollIntoViewIfNeeded();
  await newGameButton.click();

  const dialog = page.getByRole("dialog", { name: "새 게임 시작 확인" });
  await expect(dialog).toBeVisible();
  await delayedPointerClick(page, '.modal [data-action="cancel"]');
  await expect(dialog).toBeHidden();

  await newGameButton.scrollIntoViewIfNeeded();
  await newGameButton.click();
  await expect(dialog).toBeVisible();
  await delayedPointerClick(page, '.modal [data-action="confirm"]');
  await expect(dialog).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const state = window.__goblinTest?.getRuntimeSnapshot();
        return state?.mode === "ready"
          ? {
              coins: state.game.coins,
              defeatedCount: state.game.defeatedCount,
              catapultLevel: state.game.upgrades.catapult,
            }
          : null;
      }),
    )
    .toEqual({ coins: 0, defeatedCount: 0, catapultLevel: 0 });
});

test("우측 상점 패널은 투석기 렌더 중에도 스크롤 위치를 유지한다", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop project only");
  await page.setViewportSize({ width: 900, height: 360 });
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
        catapultCooldownRemainingMs: 2000,
        coins: 999,
        upgrades: { ...state.game.upgrades, catapult: 1 },
      },
      runtimeClock: { ...state.runtimeClock, lastVisibleTickAtMs: performance.now() },
    });
  });

  const shop = page.locator("#shop-sheet");
  await expect(shop).toBeVisible();
  await expect.poll(() => shop.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);

  const box = await shop.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(250);

  expect(await shop.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
});

async function delayedPointerClick(page: Page, selector: string): Promise<void> {
  const point = await page.evaluate((targetSelector) => {
    const target = document.querySelector<HTMLElement>(targetSelector);
    if (!target) {
      throw new Error(`target not found: ${targetSelector}`);
    }
    const rect = target.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, selector);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.waitForTimeout(120);
  await page.mouse.up();
}
