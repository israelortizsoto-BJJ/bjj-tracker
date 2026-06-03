export type SaveLifecycleTracePoint =
  | "save_handler_enter"
  | "mutation_begin"
  | "mutation_complete"
  | "setSaving_false"
  | "syncTabAndExit_enter"
  | "syncTabAndExit_step_before"
  | "syncTabAndExit_step_after"
  | "syncTabAndExit_lane_normalize_bypass"
  | "syncTabAndExit_before_navigation"
  | "syncTabAndExit_after_navigation"
  | "edit_screen_blur"
  | "compete_screen_focus"
  | "edit_screen_unmount";

export type SaveLifecycleTraceContext = {
  competitionId?: string | null;
  sharedCompetitionId?: string | null;
  saving?: boolean;
  navOp?: string;
  [key: string]: unknown;
};

/** Phase 0 — post-save navigation lifecycle forensics (trace only). */
export function logSaveLifecycleTrace(
  point: SaveLifecycleTracePoint,
  ctx: SaveLifecycleTraceContext = {},
): void {
  const { competitionId, sharedCompetitionId, saving, navOp, ...rest } = ctx;
  console.log("[SAVE_LIFECYCLE_TRACE]", {
    point,
    timestamp: Date.now(),
    competitionId: competitionId ?? null,
    sharedCompetitionId: sharedCompetitionId ?? null,
    ...(saving !== undefined ? { saving } : {}),
    ...(navOp ? { navOp } : {}),
    ...rest,
  });
}
