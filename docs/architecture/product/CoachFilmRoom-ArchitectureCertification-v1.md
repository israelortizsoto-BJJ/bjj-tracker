# Coach Film Room — Architecture Certification v1

Status: Certified v1

Classification: Foundational Product Architecture

Purpose:

Define certified architectural principles for Coach Film Room. These principles govern long-term system shape. They do not prescribe frameworks, libraries, or implementation details.

Runtime ownership claims in this document must remain consistent with the Media Runtime Foundation certification (`docs/architecture/certification/MediaRuntimeFoundation-v1-Certification.md`). Where product language and certified runtime ownership diverge, repository-certified runtime ownership prevails.

---

## Certification Stance

The principles in this document are product-architecture law for Film Room.

Engineering may implement against them.
Engineering may not violate them for convenience.

Where a principle conflicts with an implementation preference, the principle prevails.

---

## 1. Timeline Is Domain Addressing Model

The timeline is the authoritative domain addressing model of a Film Room session.

All moments, commentary anchors, coaching markers, and review artifacts derive meaning from their position on the timeline.

If a fact has a time, it belongs on the timeline as a domain address.

The timeline is not the playback clock.
Session playhead is the runtime temporal publication for media coordination.
No timeline module may compete with session playhead as the playback clock.

---

## 2. Playback Coordination

Playback is coordinated through certified runtime ownership — not a single product-level clock owner.

### PlaybackCoordinator (field)

Owns:

- playback engine lifecycle (via adapters)
- field-local playback intent (`play` / `pause` / `seek` / `replay` / `unload`)
- playback measurement and field snapshot truth

### FilmRoomSessionCoordinator (session)

Owns:

- synchronization
- session playhead
- seek authority (`requestSeek`)
- active participant
- cross-media coordination

Surfaces may request playback changes through certified Session APIs.
Surfaces may not independently redefine session temporal truth.
Field coordinators remain peer-unaware.

---

## 3. Time-Addressable Artifacts

Every coaching artifact in Film Room must be addressable by time.

Commentary, markers, lessons, and related evidence attach to temporal addresses on the timeline.

Artifacts without temporal addressability cannot participate as Film Room coaching memory.
Untimed notes may exist elsewhere. In Film Room, time is the join key.

---

## 4. Presentation Independent of Reasoning

Presentation and reasoning are separate planes.

- Reasoning produces coaching meaning from evidence and coach judgment.
- Presentation renders that meaning for a specific audience and moment.

Presentation must never become the source of coaching truth.
Reasoning must never require a particular presentation form to remain valid.

The same coaching meaning must be expressible across presentations without rewriting authority.

---

## 5. Coaching Lens

The Coaching Lens is the interpretive frame applied to timeline evidence.

Architecture must preserve the lens as a first-class concept:

- Evidence answers what occurred.
- The lens answers what deserves teaching attention.

Film Room systems may assist lens construction.
They may not dissolve the lens into undifferentiated analysis.

Without a Coaching Lens, Film Room degenerates into playback.

---

## 6. Coach Commentary Authoritative

Coach commentary is the authoritative instructional voice of Film Room.

Derived suggestions, automatic highlights, and system annotations are subordinate.
They may assist. They may not override coach commentary.

When coach commentary and system-derived signals conflict, coach commentary wins.

Authority order:

1. Coach commentary
2. Coach-directed structure
3. System-derived assistance
4. Raw media alone

---

## 7. Deterministic Playback

Given the same timeline addresses and the same playback intent, Film Room must produce the same observable playback behavior.

Determinism requirements:

- Seeking to a time reaches that time.
- Time-bound artifacts appear in stable relation to time.
- Replaying a coached sequence does not invent new temporal relationships.

Product session seeks use Session `requestSeek`.
Field `seek` remains field/engine I/O and sync execution — not a second product temporal authority.

Non-deterministic presentation that alters instructional meaning is an architectural defect.

---

## 8. Extension Architecture

Film Room must remain extendable without rewriting core temporal authority.

Extensions may add:

- new artifact types addressable by time on the timeline
- new presentation surfaces that consume Session playhead / `requestSeek` and field snapshots
- new coaching lenses over existing timeline evidence

Extensions may not:

- treat the timeline as the playback clock
- bypass Session seek authority / playhead for product temporal truth
- elevate derived signals above coach commentary
- couple reasoning permanence to a single presentation
- make field coordinators peer-aware or multi-engine

Extension is allowed. Authority fragmentation is not.

---

## Principle Summary

| Principle | Law |
|-----------|-----|
| Timeline is domain addressing model | Timeline addresses artifacts; timeline ≠ playback clock |
| Playback coordination | Field owns intent/measurement; Session owns playhead/seek/sync |
| Time-addressable artifacts | Time is the join key |
| Presentation independent of reasoning | Render ≠ authority |
| Coaching Lens | Interpretation is first-class |
| Coach commentary authoritative | Coach voice prevails |
| Deterministic playback | Same input → same instructional behavior |
| Extension architecture | Grow without splitting certified runtime ownership |

---

## Certification Boundary

This document certifies architectural principles only.

It does not authorize:

- specific media engines
- UI frameworks
- storage schemas
- transport protocols
- feature shipping

All Film Room architecture work must remain consistent with these certified principles and with Media Runtime Foundation ownership.
