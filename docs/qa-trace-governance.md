# QA & trace governance

Operator-focused rules for QA logging, debug instrumentation, trace ownership, and stabilization audits. This doc does not change product architecture.

---

## 1. Purpose

**Why QA logging exists**

- Reproduce intermittent bugs (hydration order, athlete scope, weekly map shape) that disappear in the debugger.
- Share **evidence** with humans or tools (GPT, Cursor) without guessing from memory.
- Keep weekly Summary / coach-sync behavior **auditable**: requested athlete vs available `weeklyByAthleteId` keys must match intent.

**Why architecture tracing was introduced**

- Multi-hop pipelines (publish → worker → cache → resolve → view-model → UI) need **correlated breadcrumbs** across layers.
- Stabilization work added named traces (for example `[SUMMARY WEEKLY TRACE]`, `[SYSTEMKEY TRACE SUMMARY]`) so weekly audits have a repeatable story in Metro logs.

**Operational logging vs dev-only instrumentation vs temporary stabilization traces**

| Kind | Intent | Typical guards | Lifetime |
|------|--------|----------------|----------|
| **Operational logging** | Field debugging, coarse request/response visibility | Often always-on `console.log` | Long-lived; tighten when noisy or risky |
| **Dev-only instrumentation** | Deep state dumps, pipeline stages | `if (__DEV__)` | Keep or fold into helpers; strip before treating as “done” |
| **Temporary stabilization traces** | Prove a hypothesis during a stabilization sprint | Prefer `__DEV__` + clear tag | Remove **after** sign-off (see cleanup policy) |

---

## 2. QA logging workflow

**Expo QA session (`expoqa`)**

- Not defined in repo `package.json`; treat as your **local convention** for a dev-client QA run (Metro + `__DEV__` true), for example a shell alias around `npx expo start` (and the right scheme/device).
- Goal: same traces as CI/device captures used for Summary weekly audits.

**Timestamped log capture**

- Save Metro / device logs to a **dated file** under `logs/` (example: `logs/summary-lines.log`).
- One file per session or per bug repro keeps uploads small and blame clear.

**`logs/`**

- Working directory for raw captures and derived slices.
- May contain **invite tails, athlete ids, headlines, URLs**. Treat as sensitive; do not commit raw captures unless scrubbed.
- `scripts/extract-qa-signals.sh` writes to `logs/extracted/`.

**Extraction workflow**

1. Run the repro under Expo QA / dev client with logging visible.
2. Copy output to `logs/<topic>-<date>.log` (or pipe if your environment supports it).
3. Run `./scripts/extract-qa-signals.sh logs/<file>.log`.
4. Review `logs/extracted/*.log` (line numbers preserved via `grep -n`).

**`extract-qa-signals.sh`**

- Splits a single log into buckets: `SUMMARY`, `SYSTEM`, `ALIGNMENT`, `PROGRESSION`, `WEEKLY`, `ERROR`, `WARN`.
- Adjust the script if new high-signal tags are added during a stabilization pass.

**Grep strategy**

- Start from extracted files, not the full multi-thousand-line capture.
- Anchor on bracket tags: `[SUMMARY WEEKLY TRACE]`, `[SYSTEMKEY TRACE SUMMARY]`, `[WEEKLY PIPELINE TRACE]`, `[SUMMARY DUAL VM AUDIT]`, `[SUMMARY FINAL HERO VM TRACE]`, `[PUBLISH`, `[API`.
- For weekly scope bugs, search `resolveWeeklyDoc`, `weeklyKeysAvailable`, `resolvedWeeklySharedAthleteId`, `weekly-doc-missing-athlete`.

**Uploading filtered traces**

- Upload **only** the smallest slice that proves the issue (one grep window or one extracted file).
- Redact before sharing: see Security rules. Prefer `tokenTail`-style fields over full tokens in pasted text.

---

## 3. Trace categories

| Category | Description | Ownership |
|----------|-------------|-----------|
| **Permanent operational logs** | Always-on logs for publish/API flow, status lines | Team maintains; review for noise and PII |
| **Dev-only traces** | `__DEV__`-gated structured logs (Summary VM input, `resolveWeeklyDoc` stages) | Feature owner + whoever touches that pipeline |
| **Temporary stabilization traces** | Audits such as dual-VM or “final hero VM” traces during weekly stabilization | Stabilization lead removes after sign-off |
| **High-risk logs** | Anything that can print **full URLs with encoded tokens**, full request bodies with secrets, or `Authorization` material | Must not appear in shared QA bundles; fix or gate aggressively |
| **Security-sensitive logs** | Invite/link identifiers, `writerSecret`, refresh tokens, raw storage dumps | Same as high-risk; never attach to external tools unredacted |

---

## 4. Security rules

- **Never log full invite / link tokens** in text shared outside the device. Prefer **`tokenTail`** (last few chars) or opaque ids already used in app code.
- **Never log secrets**: `writerSecret`, parent writer secrets, API keys, auth headers.
- **Token tails only** for correlating multi-line traces to a session without exposing the full secret-bearing URL.
- **Worker / client payload logs**: full `body` and URLs that embed `encodeURIComponent(linkToken)` are effectively credential-bearing in logs. When capturing QA logs, **assume compromise** if those lines are included—redact or use dev-only gates before sharing.
- **Upload policy**: if a trace might contain the above, do not paste into GPT/Cursor; scrub first.

---

## 5. Stabilization trace ladder (Summary weekly / V2-era audits)

End-to-end story used for weekly Summary stabilization reviews:

1. **Publish** — Coach path publishes weekly payload (`coachSyncPublishWeekly`, kid weekly publish). Look for `[PUBLISH → API CALL]` and related client traces.
2. **Worker** — Cloudflare worker validates roster / `sharedAthleteId`, persists `weeklyByAthleteId` (see `coach-sync-worker`).
3. **Cache** — Parent device updates local cache (`setCachedWeeklyForLinkToken`, `coachWeeklySyncCacheStore`). Traces may show `dataPlane: "cache" | "network"` on hydration.
4. **`resolveWeeklyDoc`** — Deterministic weekly doc for the selected athlete; logs include `[WEEKLY RESOLVE TRACE]`, `[WEEKLY PIPELINE TRACE]`, `[SYSTEMKEY TRACE SUMMARY]` stage `9_resolveWeeklyDoc_result`.
5. **Summary VM** — `buildSummaryViewModel` (focus pipeline, system key propagation). Tags: `[SUMMARY WEEKLY TRACE]`, `[SYSTEMKEY TRACE SUMMARY]` stage `11_…`, `[SUMMARY FINAL HERO VM TRACE]` where enabled.
6. **Render** — `SummaryScreen` / `SummaryHeroCard` consume VM; dual-VM audit lines compare screen vs card inputs when stabilization requires it.

Use this ladder in weekly audits: walk top-down until the first stage where **requested athlete** and **available weekly keys** diverge from product rules (`docs/system-notes/weekly-system.md`).

---

## 6. Cleanup policy

- **Remove temporary stabilization traces only after stabilization sign-off** (product + eng agree weekly hero is stable).
- **Prefer `__DEV__`** for new instrumentation so production builds stay quiet and safer.
- **Avoid hot-path spam** (every render, every tick): gate on stage transitions or meaningful diffs.
- **Centralize tags** when possible (one prefix family per feature, e.g. `[SUMMARY WEEKLY TRACE]`) so `extract-qa-signals.sh` and grep stay useful.

---

## 7. Future recommendations

- **Log levels** — map `console.log` / `warn` / `error` to semantics (noise vs actionable) and document which levels operators should file.
- **Centralized debug helpers** — single small module for “safe summary trace” payloads (tails, truncated headlines) to reduce copy-paste risk.
- **Trace toggles** — feature flags or dev-menu switches for heavy audits (`SUMMARY DUAL VM AUDIT`) without editing code each sprint.
- **Structured QA bundles** — script that emits one JSON (metadata + redacted lines) per incident for upload to tools, instead of raw Metro dumps.

---

## Quick reference: high-signal tags

| Tag | Layer |
|-----|--------|
| `[SUMMARY WEEKLY TRACE]` | Summary hydration + VM focus pipeline |
| `[SYSTEMKEY TRACE SUMMARY]` | System key / coach weekly propagation |
| `[SYSTEMKEY TRACE CLIENT]` | Client publish / wire JSON (dev) |
| `[WEEKLY RESOLVE TRACE]` / `[WEEKLY PIPELINE TRACE]` | `resolveWeeklyDoc` inputs |
| `[weekly-doc-missing-athlete]` | Requested id missing from map |
| `[SUMMARY DUAL VM AUDIT]` / `[SUMMARY FINAL HERO VM TRACE]` | Stabilization audits |
