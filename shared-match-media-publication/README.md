# Shared Match Media Publication

Pure, unwired domain foundation for the Parent-owned canonical
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

The package is deliberately not imported by any production or client runtime.
