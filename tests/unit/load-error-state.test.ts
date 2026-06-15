import { describe, expect, it } from "vitest";
import { createLoadErrorState, formatLoadErrorMessage } from "../../src/app/loadErrorState";

describe("loadErrorState", () => {
  it("reason을 사용자 메시지와 loadError 상태로 변환한다", () => {
    for (const reason of ["parseFailed", "migrationFailed", "readFailed", "deleteFailed"] as const) {
      const state = createLoadErrorState(reason);
      expect(state).toEqual({
        mode: "loadError",
        reason,
        message: formatLoadErrorMessage(reason),
      });
    }
  });
});
