// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { renderResetModal } from "../../src/ui/modal";

const handlers = {
  onRetryLoad: vi.fn(),
  onStartNewFromError: vi.fn(),
  onCancelLoadError: vi.fn(),
  onConfirmReset: vi.fn(),
  onCancelReset: vi.fn(),
};

describe("modal", () => {
  it("재시작 확인 모달은 새 게임 시작 문구를 사용한다", () => {
    const root = document.createElement("div");

    renderResetModal(root, handlers);

    expect(root.textContent).toContain("새 게임 시작");
    expect(root.textContent).toContain("정말 새 게임으로 시작할까요?");
    expect(root.textContent).not.toContain("저장 초기화");
  });
});
