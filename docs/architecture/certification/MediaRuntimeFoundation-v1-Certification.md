# Media Runtime Foundation v1 — Certification Report

> Status: **CERTIFIED WITH EXCEPTIONS**
>
> Classification: Runtime Architecture Certification
>
> Authority: Repository evidence only (`src/playback/**`, product wiring, tests)
>
> Date: 2026-07-19
>
> Scope: PlaybackCoordinator · FilmRoomSessionCoordinator · Session Playhead · Seek Authority · Synchronization Fan-out · Adapters · Field surfaces

This document is the canonical architectural reference for the Media Runtime Foundation subsystem. Documentation elsewhere that contradicts repository evidence is superseded for runtime ownership claims.

---

## Executive Summary

The Media Runtime Foundation is a layered, single-owner runtime:

| Layer | Owner | Role |
|-------|-------|------|
| Product / MatchBlock | Composition host | Creates session; registers field coordinators; mirrors UI |
| FilmRoomSessionCoordinator | Session | Membership, exclusivity, active participant, playhead, seek intent, sync fan-out |
| PlaybackCoordinator | Field | Play/pause/seek/replay/unload intent + field snapshot truth |
| VideoAdapter / AudioAdapter | Translation | Engine I/O only; no snapshot publication |
| expo-av Video / Audio.Sound | Engine | Measurement source; field-owned instances |

Repository inspection found **no circular dependencies**, **no peer-aware field coordinators**, **no session engine ownership**, and **no adapter-owned playback state**. Core invariants are proven by code and by `src/playback/tests/filmRoomExclusivity.v0.test.ts` (29 passing).

Certification is **WITH EXCEPTIONS** because: (1) field `seek()` remains a parallel entry point by design; (2) product Film Room architecture docs still claim timeline/PlaybackCoordinator temporal authority that the runtime has superseded.

**EX-1 closed (2026-07-19):** single-engine binding is repository-enforced via `assertSingleEngineBound` / `PlaybackCoordinatorDualBindError` (video XOR audio).

**EX-3 closed (2026-07-19):** MatchBlock consumes session `getPlayhead()` (read) and `requestSeek` (write). Field `replay()` remains field-local (Invariant 21).

---

## Certified Ownership Matrix

| Responsibility | Certified Owner | Repository Evidence | Explicit Non-Owners | Status |
|----------------|-----------------|---------------------|---------------------|--------|
| **Engine Layer** | | | | |
| Engine lifecycle (create / bind / destroy) | Field surface (`MatchMediaAttachments`, `CoachVoiceNoteField`, `MatchCard`) | Surfaces hold `videoRef` / `soundRef`; create via `<Video>` / `Audio.Sound.createAsync` | Session, PlaybackCoordinator, adapters (adapters only pause/unload bound engines) | Certified |
| Engine playback I/O | Bound engine via adapter | `VideoAdapter` → `playAsync`/`pauseAsync`/`setPositionAsync`; `AudioAdapter` → same + `stopAsync`/`unloadAsync` | Session, UI (no direct `playAsync` in field surfaces after migration) | Certified |
| Engine measurement | Engine → surface status callback → coordinator `apply*Status` | `onPlaybackStatusUpdate` / Sound status → `applyVideoStatus` / `applyAudioStatus` | Session (reads snapshots only), adapters (measure via `getStatusAsync` on demand only) | Certified |
| Engine seek execution | Bound engine via adapter `seek` | Adapters call `setPositionAsync` | Session (routes intent only), sync (propagation only) | Certified |
| **Adapter Layer** | | | | |
| VideoAdapter responsibilities | `VideoAdapter` | Forward play/pause/seek; pause-on-unload; optional position/duration read | Snapshot truth, exclusivity, playhead, UI | Certified |
| AudioAdapter responsibilities | `AudioAdapter` | Forward play/pause/seek; stop+unload; optional position/duration read | Snapshot truth, exclusivity, playhead, UI | Certified |
| Adapter unload | Adapter under coordinator `unload()` | Video: pause-only; Audio: stop+unload | Session (`destroy` emits no playback calls) | Certified (asymmetric by media kind) |
| Adapter translation | Adapters | Thin I/O façade over expo-av | Intent arbitration, snapshot publication | Certified |
| **PlaybackCoordinator Layer** | | | | |
| Playback intent | Field `PlaybackCoordinator.play` | Notifies optional play-intent handler, then adapter play | Session (arbitrates via handler only), UI | Certified |
| Replay intent | Field `PlaybackCoordinator.replay` | Seek(0)+play; same play-intent path | Session (does not intercept replay) | Certified |
| Pause intent | Field `PlaybackCoordinator.pause` | Adapter pause + snapshot paused | Session may *invoke* pause for exclusivity; does not own field pause API | Certified |
| Playback snapshot | Field `PlaybackCoordinator` | Private `snapshot` + `publish` / `getSnapshot` / `subscribe` | Adapters, Session (session has separate playhead), UI mirrors only | Certified |
| Status publication | Field coordinator `applyVideoStatus` / `applyAudioStatus` | Engine status → field snapshot | Adapters do not publish; Session filters to active | Certified |
| Field lifecycle termination | Field `unload()` | Resets snapshot to idle; adapter unload | Session `destroy` (clears membership only) | Certified |
| Single-engine binding | Field `PlaybackCoordinator` (`assertSingleEngineBound`) | `video.isBound() && audio.isBound()` → `PlaybackCoordinatorDualBindError`; adapters expose `isBound()`; call sites remain video-only or audio-only | Dual live engines on one coordinator | Certified (**EX-1 closed**) |
| Engine authority | Field surface owns engine instance; coordinator owns intent over bound adapters | Getter closures over refs | Session never holds engines | Certified |
| **FilmRoomSessionCoordinator Layer** | | | | |
| Membership | Session `register` / `unregister` / `participants` | `MatchBlock` registers video + coach_audio | Field coordinators (no peer APIs) | Certified |
| Registration hooks | Session | Installs play-intent handler + snapshot forwarder | Product beyond wiring | Certified |
| Observability | Session `emitSessionEvent` (`__DEV__` console) | Event taxonomy in `FilmRoomSessionCoordinator.ts` | PlaybackCoordinator | Certified |
| Exclusivity | Session `handlePlayIntent` | Pause other *playing* participants | Field peers, adapters | Certified |
| Active participant | Session `setActiveParticipant` | Set on play intent; clear on unregister/destroy; pause does not clear | Measurement, sync | Certified |
| Session playhead | Session `playhead` via `applyPlayheadFromActive` | Active snapshot only; MatchBlock polls `getPlayhead()` | Inactive measurements, sync | Certified (**EX-3 closed**) |
| Seek authority | Session `requestSeek` | Routes to active `seek()` only; MatchBlock `onReplay` → `requestSeek(0)` | Inactive (follow via sync); field `replay()` stays field-local | Certified (**EX-3 closed**) |
| Synchronization propagation | Session `propagateSyncToInactive` | After playhead update → inactive `seek(time)` | Playhead ownership, play/pause, engines | Certified |
| **Domain Layer** | | | | |
| Timeline artifacts | *Not present in runtime* | No timeline clock module under `src/playback` | Must not become playback clock | Outside runtime (intentional) |
| Transcript / marker / commentary / annotation addresses | Domain / product data models | Competition overlays, coach notes, voice refs — not temporal runtime addresses | Media runtime | Outside runtime (intentional) |
| **Product Layer** | | | | |
| MatchBlock session host | `competitionMatchEditor.MatchBlock` | Creates session; register/unregister; destroy; `getPlayhead` chrome; `requestSeek` via `onReplay` | Engine I/O; field `replay()` | Certified wiring (**EX-3 closed**) |
| MatchMediaAttachments | Video field surface | Coordinator + VideoAdapter; exposes coordinator | Session internals | Certified |
| CoachVoiceNoteField | Coach audio field surface | Coordinator + AudioAdapter; exposes coordinator | Session internals | Certified |
| MatchCard | Parent commentary surface (non–Film Room session) | Independent audio coordinator; no session registration | Film Room exclusivity/playhead | Certified (out of Film Room) |
| competitionMatchEditor | Host for MatchBlock | Imports session only via MatchBlock | — | Certified |

### Responsibilities intentionally outside the runtime

| Feature | Status | May consume | Must not own |
|---------|--------|-------------|--------------|
| Transcript highlighting | Outside | Session playhead / time | Playback clock, seek authority |
| Marker navigation | Outside | `requestSeek` | Engine I/O, field snapshot |
| Waveform | Outside | Session playhead | Sync authority |
| Chapters | Outside | `requestSeek` / playhead | Multi-engine coordinator |
| Scrubbing UI | Outside | `requestSeek` | Field peer coordination |
| Film Room UI chrome | Product | Snapshots / playhead | Runtime ownership |
| Diagnostics | Session events + forensics logs | Observability events | Playback truth |

---

## Runtime Dependency Graph

```
Film Room Product (MatchBlock)
        ↓
FilmRoomSessionCoordinator
        ↓
PlaybackCoordinator (per field)
        ↓
VideoAdapter | AudioAdapter
        ↓
expo-av Video | Audio.Sound
```

| Arrow | Why it exists | Why reverse must never exist |
|-------|---------------|------------------------------|
| Product → Session | Product owns session lifetime and membership wiring | Session must not import React/product UI |
| Session → PlaybackCoordinator | Session arbitrates relationships and routes seek/sync via field APIs | Field coordinators must not know peers or session |
| PlaybackCoordinator → Adapters | Coordinator owns intent; adapters execute I/O | Adapters must not publish snapshots or own intent |
| Adapters → Engines | Translation to expo-av | Engines must not call coordinators/session |

**Cyclic dependencies:** None found. Import graph is acyclic:

- `FilmRoomSessionCoordinator` → type-only `PlaybackCoordinator`
- `PlaybackCoordinator` → `VideoAdapter` / `AudioAdapter` types
- Adapters import nothing from playback peers
- Product imports runtime; runtime does not import product

---

## Ownership Leak Audit

Attempted disproof checklist and results:

| Probe | Result |
|-------|--------|
| Duplicate ownership of snapshot | Not found — field snapshot vs session playhead are distinct, single-publisher each |
| Two sources of truth for session time | Not found — only active participant updates playhead |
| Field coordinators knowing each other | Not found — no peer APIs; test `active-5` |
| Session writing engine state | Not found — session calls `pause`/`seek` on coordinators only |
| Adapters publishing playback state | Not found — no subscribe/publish in adapters |
| UI owning runtime intent path | Partial — see EX-2 (`loading` overlay) |
| Timeline becoming playback clock | Not found — no timeline runtime module |
| PlaybackCoordinator multi-engine | Closed — dual live engines rejected fail-fast (`PlaybackCoordinatorDualBindError`); intent still fans out to adapter pair with unbound no-op |
| Synchronization becoming authority | Not found — sync only routes time; tests `sync-2` |
| Measurement becoming authority | Not found — inactive measurements ignored |
| Circular imports | Not found |

### Exceptions / residual findings

| ID | File | Responsibility | Severity | Recommendation |
|----|------|----------------|----------|----------------|
| **EX-1** | `PlaybackCoordinator.ts` | Single-engine binding | — | **Closed** — runtime `assertSingleEngineBound` rejects dual live engines |
| **EX-2** | `MatchCard.tsx` | Ephemeral `loading` UI state written outside coordinator snapshot | Low | Keep as resolve-phase presentation; do not promote into coordinator snapshot unless loading becomes field truth |
| **EX-3** | `competitionMatchEditor.tsx` (`MatchBlock`) | Session playhead/seek product integration | — | **Closed** — `getPlayhead()` chrome + `requestSeek(0)` via MatchBlock `onReplay`; field `replay()` preserved |
| **EX-4** | `CoachFilmRoom-ArchitectureCertification-v1.md` | Claims timeline SoT + PlaybackCoordinator owns current time/sync | High (doc contradiction) | Reconcile product cert with session-owned playhead/sync before product features land |
| **EX-5** | `PlaybackCoordinator.seek` vs `requestSeek` | Dual seek entry points | Low (intentional) | Keep field seek for engine I/O + sync; product session seeks must use `requestSeek` |
| **EX-6** | `VideoAdapter.unload` | Pause-only vs audio stop+unload | Low | Preserve media-kind asymmetry; surface owns Video mount lifecycle |

**No additional ownership leaks found** beyond the exceptions above.

---

## Certified Invariants

### PlaybackCoordinator

1. One coordinator instance per field surface.
2. At most one live engine bound per coordinator (video XOR audio); dual-bind throws `PlaybackCoordinatorDualBindError` (**EX-1 closed**).
3. Owns playback intent (`play` / `pause` / `seek` / `replay` / `unload`).
4. Owns field playback snapshot truth.
5. Owns field lifecycle termination (`unload` → idle snapshot).
6. Optional `setPlayIntentHandler` carries no session/peer knowledge.
7. Unbound adapters no-op.

### FilmRoomSessionCoordinator

8. Relationship authority only (membership, exclusivity, active identity, playhead, seek routing, sync).
9. Session owns canonical playhead `{ currentTimeMs, playbackState }`.
10. Session owns seek intent via `requestSeek` (leader-only).
11. Session owns exclusivity (pause other playing participants on play intent).
12. Session owns synchronization fan-out (time-only to inactive participants).
13. Session never owns engines.
14. Session never measures playback (no polling/timers).
15. Session `destroy` clears membership and handlers; emits no playback calls.
16. Pause does not clear active participant.

### Cross-cutting

17. **Measurement ≠ Authority** — engine measurement updates field snapshot; only active field snapshot updates session playhead.
18. **Timeline ≠ Session Playhead** — no timeline module is the playback clock.
19. **Active participant ≠ Playhead** — identity vs temporal publication are distinct; pause keeps leader while playhead may show paused.
20. **Synchronization ≠ Authority** — sync propagates time; does not write playhead or change play/pause.
21. **Replay remains field-local** — session does not intercept replay.
22. **Engines remain field-owned**.
23. Field coordinators remain peer-unaware.
24. Finish semantics diverge by media kind: video → paused; coach/parent audio → idle + unload.

---

## Runtime State Machine

```
MatchBlock Mount
    → Session Created (FILMROOM_SESSION_CREATED)
    → Field surfaces mount; create field PlaybackCoordinators
    → Participants Register (video / coach_audio)
    → (idle: active=null, playhead idle@0)
    → Play / Replay intent on a participant
        → FILMROOM_PLAY_REQUESTED
        → Exclusivity pauses other playing participants
        → Active participant set (leader)
        → Field snapshot → session playhead publication
        → Sync fan-out seeks inactive clocks to playhead time
    → requestSeek(time) [session API]
        → Route seek to active only
        → Active snapshot publish → playhead → sync to inactive
    → Active measurement ticks
        → Playhead updates → sync fan-out
    → Participants Unregister (clear handler/forwarder; clear active if leader)
    → Session Destroy (on MatchBlock unmount)
    → Unmount / field unload
```

| Transition | Owner | Trigger | Resulting state |
|------------|-------|---------|-----------------|
| Session create | MatchBlock + Session | MatchBlock mount / `createFilmRoomSessionCoordinator` | Empty membership; playhead idle |
| Register | Session | Surface exposes coordinator | Handler + snapshot forwarder installed |
| Play intent | Field → Session handler | `play` / `replay` | Peers paused if playing; initiator = active |
| Playhead publish | Session | Active snapshot change | Canonical playhead updated; sync scheduled |
| Sync fan-out | Session | Playhead update | Inactive field clocks seek to time; states unchanged |
| Seek authority | Session | `requestSeek` | Active `seek`; playhead via measurement path only |
| Pause (field) | Field | `pause` | Field/playhead may go paused; active retained |
| Unregister | Session | Effect cleanup / explicit | Membership removed; active cleared if leader |
| Destroy | Session | MatchBlock unmount | Destroyed; handlers cleared; no engine calls |
| Field unload | Field coordinator | URI change / unmount | Snapshot idle; adapter unload |

---

## Extension Point Map

| Extension | Integration point | May consume | Must NOT own |
|-----------|-------------------|-------------|--------------|
| Transcript following | Subscribe/poll `getPlayhead()` | `currentTimeMs`, `playbackState` | Seek authority, engines, exclusivity |
| Transcript highlighting | Same | Playhead time | Playback snapshot write |
| Waveform following | `getPlayhead()` | Time | Sync, engines |
| Markers | `requestSeek(markerTime)` | Session seek API | Field peer pause, playhead write |
| Annotations | Domain addresses + optional seek | Time addresses | Runtime clock |
| Chapters | `requestSeek` | Session seek | Multi-engine bind |
| Diagnostics | Session `__DEV__` events + existing forensics | Event stream | Truth mutation |
| Analytics | Playhead + field snapshots (read-only) | Observability | Intent |
| Future multi-track playback | New session policy **above** field coordinators | Session relationship APIs | Turning one PlaybackCoordinator into multi-engine |

Approved rule: extensions plug **above** Session (product) or **beside** field snapshot subscribe — never under adapters, and never by making PlaybackCoordinator multi-engine.

---

## Test Coverage Certification

**Suite:** `src/playback/tests/filmRoomExclusivity.v0.test.ts`  
**Runner evidence:** `node --experimental-strip-types --test` → **29/29 pass** (2026-07-19).

| Layer | Tests | Certified behaviors |
|-------|-------|---------------------|
| Single-engine (EX-1) | 6 | Video-only succeeds; audio-only succeeds; dual-bind rejects intent; dual-bind rejects status; zero engines allowed; late second bind rejected |
| Exclusivity | 5 | Pause others on play; ignore paused; replay parity; no coupling outside session; unregister/destroy clears handlers |
| Active participant | 5 | Single active; pause retains; unregister leader clears; destroy clears; fields peer-unaware |
| Playhead | 3 | Active-only publish; inactive ignored; exclusivity unchanged |
| Seek authority | 6 | Active-only route; no-op without active; no playback-state change; playhead via measurement; events; preserves exclusivity |
| Sync fan-out | 4 | Propagates time via seek; sync ≠ playhead authority; originates from session playhead; no play/pause fan-out |

### Uncovered / recommended certification tests

| Gap | Recommendation |
|-----|----------------|
| Product wiring of register/unregister/destroy in MatchBlock | Shallow wiring test or corridor assertion |
| Destroy idempotence + post-destroy no-op of register/seek | Add explicit cases |
| Sync during rapid leadership switches | Race/ordering case |
| Field `replay` does not go through `requestSeek` | Documented; optional assert |
| Adapter unload asymmetry | Pattern-level test optional |
| MatchCard outside session | Assert no FilmRoom import (boundary) |

---

## Architecture Verdict

### CERTIFIED WITH EXCEPTIONS

**Proven:**

- Ownership boundaries for Session, PlaybackCoordinator, Adapters, and Engines are repository-evidenced.
- No circular dependencies.
- No field-coordinator peer coupling.
- Session playhead, seek authority, and sync fan-out honor Measurement ≠ Authority and Synchronization ≠ Authority.
- Test suite certifies exclusivity, active participant, playhead, seek, sync, and single-engine binding behaviors.
- **EX-1 closed:** dual live engine binding is rejected fail-fast by the repository.

**Exceptions (blocking full CERTIFIED):**

1. **EX-4** — Product Film Room architecture certification contradicts runtime temporal ownership (timeline / PlaybackCoordinator vs Session).
2. **EX-5** — Dual seek entry points remain (intentional, but product must not confuse them).

**EX-3 closed:** Session `getPlayhead()` and `requestSeek` are product-consumed by MatchBlock. Field `replay()` remains field-local.

No implementation work is authorized by this report except reconciliation of EX-4 documentation and future product integration against certified extension points.

---

## Recommended Next Phase (Product Integration)

1. **Reconcile product architecture docs** with session-owned playhead and sync (close EX-4).
2. **Wire scrubbing / markers** exclusively through `session.requestSeek` (extend EX-3 write consumers; do not use field `seek` from product).
3. **Consume `getPlayhead()`** for transcript/waveform following (read-only).
4. **Do not** dual-bind adapters or move engines into Session (now runtime-enforced).
5. **Keep MatchCard** outside Film Room session until a deliberate parent Film Room product scope exists.

---

## Evidence Index

| Artifact | Path |
|----------|------|
| PlaybackCoordinator | `src/playback/PlaybackCoordinator.ts` |
| FilmRoomSessionCoordinator | `src/playback/FilmRoomSessionCoordinator.ts` |
| VideoAdapter | `src/playback/VideoAdapter.ts` |
| AudioAdapter | `src/playback/AudioAdapter.ts` |
| Certification tests | `src/playback/tests/filmRoomExclusivity.v0.test.ts` |
| MatchBlock wiring | `src/features/competition/competitionMatchEditor.tsx` |
| Video field | `src/components/MatchMediaAttachments.tsx` |
| Coach audio field | `src/features/coach/CoachVoiceNoteField.tsx` |
| Parent commentary (non-session) | `src/features/competition/MatchCard.tsx` |
