import type { LoadErrorReason } from "../domain/saveTypes";
import type { LoadErrorRuntimeState } from "../domain/types";

export function formatLoadErrorMessage(reason: LoadErrorReason): string {
  switch (reason) {
    case "parseFailed":
      return "저장 데이터를 읽을 수 없습니다.";
    case "migrationFailed":
      return "저장 데이터 버전을 복원할 수 없습니다.";
    case "readFailed":
      return "저장소에 접근할 수 없습니다.";
    case "deleteFailed":
      return "저장 데이터를 삭제할 수 없습니다.";
  }
}

export function createLoadErrorState(reason: LoadErrorReason): LoadErrorRuntimeState {
  return {
    mode: "loadError",
    reason,
    message: formatLoadErrorMessage(reason),
  };
}
