export type LoadFailureReason = "parseFailed" | "migrationFailed" | "readFailed";

export type LoadErrorReason = LoadFailureReason | "deleteFailed";
