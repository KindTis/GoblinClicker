import { expect, test } from "@playwright/test";

test("모바일 상점 시트는 공격 영역과 하단 토글 접근성을 보존한다", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile project only");
  await page.goto("/");
  const toggle = page.getByRole("button", { name: /상점 열기/ });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(page.getByRole("button", { name: /상점 닫기/ })).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#shop-sheet h2")).toBeFocused();
  await expect(page.getByTestId("goblin-attack-area")).toBeVisible();
  const box = await page.getByTestId("goblin-attack-area").boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(160);
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(page.getByRole("button", { name: /상점 열기/ })).toBeFocused();
});
