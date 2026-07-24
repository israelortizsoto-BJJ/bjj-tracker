# Shared Match Media Commentary Alignment — ADR v1

Status: **ACCEPTED — contract only; implementation not authorized by this ADR**

Engineering floor: `86ae7356a688572c43e95541e26bacecc35082cd`

## Decision

New Coach commentary may carry a fixed capture-time offset to the Parent-owned Match
video. The selected first contract is **Model A**:

```text
commentaryStartVideoMs = confirmed native-paused video positionMillis
audioTimeMs = videoPlayheadMs - commentaryStartVideoMs
```

The Parent video remains the authoritative playback clock. Synchronized commentary
is only a follower. This does not create a new coordinator, clock, resolver, or
media authority.

The origin belongs in the existing Coach MatchBlock / `CoachVoiceNoteField` authoring
corridor, not Film Room. Pressing Record begins one atomic aligned-record attempt;
it does **not** capture the offset. Repository evidence shows why: the current
`CoachVoiceNoteField` starts `recording.startAsync()` before it reports `recording`,
and MatchBlock presently passes `shouldPausePlayback={recordingState === "recording"}`
to `MatchMediaAttachments` (`src/features/coach/CoachVoiceNoteField.tsx`,
`src/features/competition/competitionMatchEditor.tsx`). Current behavior therefore
starts audio before its effect requests a video pause and does not supply a stable
paused origin.

The implementation must acquire an immediate ref-based one-attempt lock before any
asynchronous permission, pause, preparation, or recorder work. A visible or internal
`starting` state is also required so MatchBlock locks media controls during startup;
the ref lock remains the synchronous duplicate-attempt authority.

Before audio recording starts, the existing Match video coordinator must be asked to
pause through its existing ownership corridor. The attempt may continue only after
request-correlated native status proves that the intended player is loaded and
`isPlaying === false`. `commentaryStartVideoMs` is the `positionMillis` in that
confirmed status. At the same confirmed boundary, capture the attached
`matchMediaAssetId`, `attachmentRevision`, and the ephemeral Match/athlete/competition
context used for later validation. Only then may `recording.startAsync()` begin audio
capture. A pre-pause Record-press snapshot must never be silently substituted.

Today `PlaybackCoordinator.pause()` and `getSnapshot().playbackState` are not native
pause proof: `VideoAdapter.pause()` swallows `pauseAsync()` failures and the
coordinator then writes its logical snapshot to paused. Native status arrives later
through `Video.onPlaybackStatusUpdate` and `applyVideoStatus`, but no
request-correlated, awaitable pause-confirmation contract exists yet. This ADR
therefore authorizes no capture instrumentation until the separately scoped primitive
below exists.

## Accepted amendment — editor shared-media player identity

This amendment resolves the editor-side identity prerequisite for aligned commentary.
It does not authorize runtime implementation, flag enablement, or deployment.

An editor player is **alignment-capable** only when a valid, attached Coach Match
Media projection and an authorized shared-media resolution jointly establish one
in-memory binding for the player generation that loaded the resolved URI:

```text
playableUri
matchMediaAssetId
attachmentRevision
matchLineageKey
sharedAthleteId
sharedCompetitionId
playerBindingToken
```

`playerBindingToken` is ephemeral and unique to that loaded player generation. The
resolved URI is a memory-only delivery capability; neither it nor the token is
durable commentary metadata, synchronized state, or log material.

`LocalMatch.videoUri` and `LocalMatch.videoAssetId` do not prove correspondence to
`matchMediaAssetId` and `attachmentRevision`. They may remain available for legacy
unbound editor viewing, but cannot produce `VoiceNoteRef.alignment` by themselves.
The editor must never infer identity by joining a local URI with the current shared
attachment row.

The editor may reuse the pure resolution core in
`src/features/filmRoom/coachMatchMediaPlaybackResolve.ts`. It must not import or
create `FilmRoomScreen`, `FilmRoomSessionCoordinator`,
`useCoachMatchMediaPlaybackUri`, a second player, a second `PlaybackCoordinator`, or
another session authority. The existing editor field coordinator remains the sole
playback owner for its bound player.

Both authoritative attachment projection and shared-media resolution capability are
required. While either capability is default-off or unavailable, editor local-URI
playback remains legacy-unbound: it may be viewed, but recording from it must not
create alignment and the UI/runtime must not represent it as alignment-capable. This
amendment does not enable `SHARED_MATCH_MEDIA_ATTACHMENT_PROJECTION_ENABLED` or
`SHARED_MATCH_MEDIA_RESOLUTION_ENABLED`.

When both a local URI and a valid attached row exist, the resolved shared attachment
is the authoritative source for alignment-capable playback. The local URI is only an
explicitly unbound fallback. If shared resolution fails, the local URI may remain
usable for legacy viewing, but alignment capture remains unavailable; failure must
not attach shared identity to the local player or discard otherwise usable local
video.

The binding is active only after its resolved URI has loaded into its specific player
generation. Invalidate it on asset replacement, revision change, tombstone, Match,
athlete, competition, or lineage change, URI/player-generation replacement, unload,
unmount, stale resolution completion, resolution failure, or delivery expiry. A
refreshed delivery URI for the same durable asset and revision preserves durable
identity but creates a new `playerBindingToken` and player generation; it invalidates
any pending confirmed-pause request associated with the prior generation until the
new URI is successfully resolved and loaded.

## Required alignment metadata

Each aligned commentary reference carries these optional fields together:

| Field | Semantics |
|---|---|
| `commentaryStartVideoMs` | Finite, non-negative integer `positionMillis` from the confirmed native-paused video status immediately before audio start. |
| `matchMediaAssetId` | Attached asset ID observed at that same confirmed boundary. |
| `attachmentRevision` | Positive attachment revision observed at that same confirmed boundary. |

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

## Capture attempt and persistence validation

The attempt token, Match lineage, athlete/competition identity, and
`wasPlayingBeforePause` are ephemeral. They never enter `VoiceNoteRef.alignment`.
Only these certified fields may be durable alignment metadata:

- `commentaryStartVideoMs`
- `matchMediaAssetId`
- `attachmentRevision`

If native pause fails, is unconfirmed, or times out, abort the aligned-record attempt:
do not create audio, do not create an aligned record, and do not silently fall back to
a Model C note from that action. Clear the lock and pending alignment while preserving
existing playback ownership.

If permission, recorder preparation, or `startAsync()` fails after this attempt
paused a previously playing video, discard the pending attempt, unload any prepared
recorder, and request restoration through that same existing `PlaybackCoordinator`.
Current APIs cannot prove native restoration success; no second playback owner may be
introduced to compensate.

At local-audio persistence time, retain alignment only when the live attempt token
matches and current reads prove that Match lineage, athlete identity, and competition
identity remain unchanged; the attachment is still `attached`; and its asset ID and
revision equal the captured values. These reads validate the frozen capture context;
they must never combine a newly read identity with an old playhead. Any mismatch
persists no alignment metadata.

## Ownership and transport boundary

| Boundary | Future responsibility |
|---|---|
| Capture | One locked attempt awaits native pause confirmation, then MatchBlock captures confirmed position and current attached projection before audio start. |
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

## Implementation slices (separately authorized)

### Slice 1 — native pause-confirmation primitive

Introduce the narrowest request-correlated native pause-confirmation contract through
the existing playback ownership path. Likely production boundary:

1. `src/playback/PlaybackCoordinator.ts`
2. `src/playback/VideoAdapter.ts`
3. `src/components/MatchMediaAttachments.tsx`

Its exact API shape must be selected from repository evidence during implementation.
It must expose native failure and reject or time out when confirmation does not arrive.
It must not start audio capture or introduce a second player, clock, coordinator, or
playback owner. It must not touch Worker, Parent transport, hydration, resolution,
Timeline Builder, flags, or deployment configuration.

### Slice 1.5 — editor shared-media player binding

Before aligned recording capture, independently implement and checkpoint the
editor-side binding defined in the accepted amendment above. It may reuse the pure
shared-media resolution core, but must preserve the existing editor
`PlaybackCoordinator` as the sole player owner. It must prove source precedence,
capability gating, load-generation activation, invalidation, delivery-refresh
supersession, and that legacy local playback cannot create alignment. Feature-flag
enablement and deployment remain separate missions.

### Slice 2 — aligned recording capture

Use Slice 1's confirmed-pause primitive and the independently certified Slice 1.5
player binding to add the startup lock and `starting` state,
capture the confirmed position and attached-media identity, bind one snapshot to one
recording attempt, validate it again at persistence, and write optional
`VoiceNoteRef.alignment` only when the complete contract remains valid. Likely
production boundary:

1. `src/features/competition/competitionMatchEditor.tsx`
2. `src/features/coach/CoachVoiceNoteField.tsx`
3. `app/(tabs)/coach/kid/[kidId]/competition/edit.tsx`
4. `src/types/coachMatchBreakdownOverlay.ts`

Do not include `src/storage/coachMatchBreakdownOverlayStore.ts` unless later
repository evidence proves the existing normalization path cannot retain the optional
alignment. Slice 2 must not modify Worker transport, artifact schema v2, Parent
hydration, Parent Film Room orchestration, Timeline Builder, or delivery/resolution
contracts. A later separately authorized transport slice may update the artifact
types, builder, parser, Worker validation, and Parent hydration for v2.

## Explicit non-goals

- Seek-aware multi-segment editing or segment maps.
- Capture-time scrubbing maps or pause/resume interval maps.
- Playback-rate synchronization or continuous drift correction.
- Commentary recording inside Film Room.
- Timeline Builder changes.
- Attachment/publication/resolution authority changes.
- Persistence of any delivery capability or media object identity beyond the safe
  `matchMediaAssetId` and attachment revision binding.
