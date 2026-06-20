import type { LoadErrorRuntimeState } from "../domain/types";

export type ModalHandlers = {
  onRetryLoad(): void;
  onStartNewFromError(): void;
  onCancelLoadError(): void;
  onConfirmReset(): void;
  onCancelReset(): void;
};

export function renderLoadErrorModal(root: HTMLElement, state: LoadErrorRuntimeState, handlers: ModalHandlers): void {
  root.replaceChildren();
  const dialog = document.createElement("div");
  dialog.className = "modal-backdrop";
  dialog.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="저장 오류">
      <h2>저장 오류</h2>
      <p>${state.message}</p>
      <div class="modal-actions">
        <button type="button" data-action="retry">다시 시도</button>
        <button type="button" data-action="new">새 게임 시작</button>
        <button type="button" data-action="cancel">취소</button>
      </div>
    </div>
  `;
  dialog.querySelector<HTMLButtonElement>('[data-action="retry"]')?.addEventListener("click", handlers.onRetryLoad);
  dialog.querySelector<HTMLButtonElement>('[data-action="new"]')?.addEventListener("click", handlers.onStartNewFromError);
  dialog.querySelector<HTMLButtonElement>('[data-action="cancel"]')?.addEventListener("click", handlers.onCancelLoadError);
  root.append(dialog);
}

export function renderResetModal(root: HTMLElement, handlers: ModalHandlers): void {
  if (root.querySelector('[role="dialog"][aria-label="새 게임 시작 확인"]')) {
    return;
  }
  root.replaceChildren();
  const dialog = document.createElement("div");
  dialog.className = "modal-backdrop";
  dialog.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="새 게임 시작 확인">
      <h2>새 게임 시작</h2>
      <p>정말 새 게임으로 시작할까요?</p>
      <div class="modal-actions">
        <button type="button" data-action="confirm">새 게임 시작</button>
        <button type="button" data-action="cancel">취소</button>
      </div>
    </div>
  `;
  dialog.querySelector<HTMLButtonElement>('[data-action="confirm"]')?.addEventListener("click", handlers.onConfirmReset);
  dialog.querySelector<HTMLButtonElement>('[data-action="cancel"]')?.addEventListener("click", handlers.onCancelReset);
  root.append(dialog);
}

export function clearModal(root: HTMLElement): void {
  root.replaceChildren();
}
