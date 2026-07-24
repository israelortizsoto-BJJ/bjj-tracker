# Shared Match Media Commentary Alignment — ADR v1

Status: **ACCEPTED — contract only; implementation not authorized by this ADR**

Engineering floor: `8165722915a1db1d28cc08730a5288dc6839304d`

## Decision

New Coach commentary may carry a fixed capture-time offset to the Parent-owned Match
video. The selected first contract is **Model A**:

```text
commentaryStartVideoMs = video session playhead when Coach presses Record
audioTimeMs = videoPlayheadMs - commentaryStartVideoMs
```

The Parent video remains the authoritative playback clock. Synchronized commentary
is only a follower. This does not create a new coordinator, clock, resolver, or
media authority.

The origin belongs in the existing Coach MatchBlock / `CoachVoiceNoteField` authoring
corridor, not Film Room. Repository evidence: MatchBlock creates the per-Match
`FilmRoomSessionCoordinator`, reads its playhead, and passes
`shouldPausePlayback={recordingState === "recording"}` to `MatchMediaAttachments`
(`src/features/competition/competitionMatchEditor.tsx`). `CoachVoiceNoteField`
starts the recorder before reporting `recording`, so capture instrumentation must
take the session playhead immediately at the successful Record transition, before
or with that transition—not later at transcription or publication.

## Required alignment metadata

Each aligned commentary reference carries these optional fields together:

| Field | Semantics |
|---|---|
| `commentaryStartVideoMs` | Finite, non-negative integer millisecond offset from the capture-time video start. |
| `matchMediaAssetId` | Attached asset ID observed at Record. |
| `attachmentRevision` | Positive integer attachment revision observed at Record. |

`matchLineageKey` remains the Match association but is insufficient for alignment.
`matchMediaAssetId` plus `attachmentRevision` bind the offset to the exact attachment
state observed during capture. Do **not** add `objectVersion`: the canonical
attachment's immutable asset ID and monotonic revision are the Match-level binding,
while the certified resolution boundary already validates the asset object's exact
version before it issues a capability. A resolution-time stale-revision convergence
may return the current attachment revision for delivery, but it must not overwrite
the capture-time revision binding.

No new commentary-artifact ID is required in this slice. `VoiceNoteRef.id` already
identifies the local companion note, and existing synchronized Coach Match Breakdown
artifacts already carry optional remote `mediaId` for the commentary bytes
(`src/types/coachMatchBreakdownOverlay.ts`, `src/types/coachWeeklySync.ts`). A new
identifier would be required only if a later product supports multiple independently
aligned commentary items per Match; that is out of scope.

The future transport **must introduce a backward-compatible artifact schema v2**.
The current artifact set is statically `schemaVersion: 1` and both client and Worker
parsers reject any other version (`src/services/coachMatchBreakdownArtifactParser.ts`,
`coach-sync-worker/src/index.ts`). v2 must explicitly accept v1 as legacy
unsynchronized data and validate v2's finite/non-negative timing plus non-empty
asset ID and positive revision. This ADR does not change those parsers or Worker
contracts.

## Playback contract

`FilmRoomSessionCoordinator` remains the existing video-owned session/playhead and
seek authority; `PlaybackCoordinator` remains the existing engine primitive. The
Parent Film Room performs only offset-aware follower orchestration.

- Before `commentaryStartVideoMs`, commentary is inactive/silent; it is never
  sought to a negative time.
- At or after the offset, seek commentary to `videoPlayheadMs -
  commentaryStartVideoMs` before play/resume.
- Video pause pauses synchronized commentary. Resume recalculates the follower
  position from the current video playhead before resuming.
- A video seek recalculates the same expression. A seek before the offset leaves
  commentary inactive; a seek beyond commentary duration leaves it completed/inactive.
- Re-align only on play, resume, and seek. This v1 contract deliberately adds no
  continuous drift-correction loop.
- The current Film Room sources expose no playback-rate control (`FilmRoomScreen`,
  `FilmRoomVideoPlayer`, and `src/playback/**`); v1 documents normal-rate behavior
  only and adds no rate-synchronization machinery.

## Compatibility, replacement, and removal

**Model C remains the compatibility path.** Commentary with missing alignment metadata
is a Match-scoped unsynchronized voice note. It remains available under its existing
commentary-media availability policy and must never be falsely seek-aligned to video.

An aligned note is synchronized only if the current attached projection is
`attached` and its `matchMediaAssetId` and `revision` exactly equal the captured
values. Runtime states are distinct:

| State | Behavior |
|---|---|
| synchronized | Current attachment exactly matches capture identity/revision; apply the fixed offset. |
| legacy unsynchronized | Alignment metadata absent; normal Match voice-note behavior. |
| stale | Attachment exists but asset ID or revision differs; do not apply the old offset. |
| video unavailable or removed | Attachment absent/tombstoned/unresolvable; synchronized playback unavailable. |

Replacing or tombstoning video never deletes or mutates commentary. It only makes
synchronized playback unavailable; commentary may remain visible/playable as an
unsynchronized Match note. This preserves the existing Coach Match Breakdown
artifact and hydration direction instead of making the media attachment a
commentary-write authority.

## Ownership and transport boundary

| Boundary | Future responsibility |
|---|---|
| Capture | MatchBlock reads current session video playhead and current attached projection at Record. |
| Local model | Optional metadata lives with the existing `VoiceNoteRef` / Coach Match Breakdown overlay. |
| Publication | Coach Match Breakdown artifact v2 transports safe alignment metadata. |
| Validation | Worker validates timing and asset/revision shapes; no delivery capability is admitted. |
| Projection/hydration | Existing artifact publication and Parent hydration transport fields without becoming alignment owners. |
| Runtime | Parent Film Room checks attachment identity/revision and drives commentary as a video-session follower. |

The contract never contains signed URLs, URL expiry, resolution responses, writer or
link credentials, signatures, object keys, or other durable capabilities. It does
not add a second resolution authority.

## Rejected first-slice model

**Model B is rejected for v1.** There is no seek-aware segment map, pause/resume
interval map, recording-time scrub map, Timeline Builder integration, or new
playback coordinator/clock. Reconsider a Timeline Builder or editorial timeline
only when the product requires true multi-segment commentary editing, multiple
recording intervals with distinct video anchors, or durable editorial markers.

## First implementation slice (separately authorized)

Capture instrumentation only:

1. In `src/features/competition/competitionMatchEditor.tsx`, read the existing
   MatchBlock session playhead and current Coach attachment projection at the Record
   transition.
2. In `src/features/coach/CoachVoiceNoteField.tsx`, add the narrow callback/data
   handoff needed to bind that capture context to the successfully persisted voice note.
3. Extend `src/types/coachMatchBreakdownOverlay.ts` and
   `src/storage/coachMatchBreakdownOverlayStore.ts` only as needed to hold the optional
   local metadata.
4. Add focused coverage beside the existing MatchBlock/session and overlay-store
   tests, including missing/tombstoned attachment and a stable playhead capture.

That slice must not modify Worker transport, Parent hydration, Parent Film Room
orchestration, Timeline Builder, or resolution/playback contracts. A later separately
authorized transport slice would update the artifact types, builder, parser, Worker
validation, and Parent hydration for v2.

## Explicit non-goals

- Seek-aware multi-segment editing or segment maps.
- Capture-time scrubbing maps or pause/resume interval maps.
- Playback-rate synchronization or continuous drift correction.
- Commentary recording inside Film Room.
- Timeline Builder changes.
- Attachment/publication/resolution authority changes.
- Persistence of any delivery capability or media object identity beyond the safe
  `matchMediaAssetId` and attachment revision binding.
