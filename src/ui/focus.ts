export function shouldRouteSpaceToCombat(event: KeyboardEvent, gameRoot: HTMLElement): boolean {
  if (event.code !== "Space" || event.repeat) return false;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;
  if (!gameRoot.contains(target)) return false;
  if (target.closest("button, [role='dialog'], input, textarea, select, #shop-sheet")) return false;
  return target === gameRoot || target.dataset.combatFocus === "true";
}
