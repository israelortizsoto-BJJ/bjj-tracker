# Shared Match Media Publication

Pure domain foundation for the Parent-owned canonical
`MatchMediaAttachment`.

This package owns only:

- one attachment record per Parent Competition Match identity;
- monotonic attachment revision;
- attached/replaced/tombstoned transitions;
- exact verified-media provenance validation; and
- compare-and-swap persistence through an injected conditional-object capability.

It does not own or import upload sessions, Production Verification records, R2
binary operations, Worker routes, Coach projection, resolution, playback, Film
Room, local `videoUri`, `videoAssetId`, or `parentMediaRefs`.

Runtime composition lives only in `coach-sync-worker` behind
`SHARED_MATCH_MEDIA_PUBLICATION_ENABLED` (default off). The client and
Production Verification packages must not import this module.
