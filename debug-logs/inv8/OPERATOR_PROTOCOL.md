# INV8 Necessary Condition — Operator Protocol

Gate installed at `setCachedWeeklyForLinkToken` artifact bump.
Default: OFF (`globalThis.__INV8_SUPPRESS_ARTIFACT_HYDRATION_BUMP__` unset/false).

## Run A — Flag OFF (baseline)

1. Parent device + athlete selected + MatMind Dev connected to this Metro.
2. Do **not** set the flag.
3. Focus Compete once (leave Summary → Compete, or re-focus Compete).
4. Preserve Metro slice into `debug-logs/inv8/run-A-flag-off.log` (or confirm tee capture covers it).

Expected starvation signature if Mechanism B still holds:
`FOCUS_ENTER` → `REFRESH_BEGIN` → `coach_match_breakdown_artifacts_hydrated` bump
→ `RETURN_BEFORE_LOAD_COMPETITIONS` (and missing stable `LOAD_COMPETITIONS_BEGIN` → `SET_ENTRIES_APPLY`).

## Run B — Flag ON (suppressed publication)

1. In RN debugger / remote console on the same Parent session:

```js
globalThis.__INV8_SUPPRESS_ARTIFACT_HYDRATION_BUMP__ = true
```

2. Focus Compete once again (same athlete/role).
3. Preserve Metro slice into `debug-logs/inv8/run-B-flag-on.log`.

Expected if suppressing publication is necessary for further progress:
`[INV8_CONVERGENCE_EXPERIMENT] publication_suppressed`
and no new `[COACH_SYNC_HYDRATION] version_bump` with `coach_match_breakdown_artifacts_hydrated`
and bridge reaches `LOAD_COMPETITIONS_BEGIN` → `SET_ENTRIES_APPLY`
without `RETURN_BEFORE_LOAD_COMPETITIONS` loop.

## After both runs

Compare only:
- FOCUS_ENTER
- REFRESH_BEGIN
- coach_match_breakdown_artifacts_hydrated (or publication_suppressed)
- LOAD_COMPETITIONS_BEGIN
- SET_ENTRIES_APPLY
- RETURN_BEFORE_LOAD_COMPETITIONS (if present)

Conclude only: necessary condition yes/no from that pair.
