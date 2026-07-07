# Active Slice

## Project

- Founder Proof Floor v0.1
- State: Active / Executing

## Current Slice

- Continue execution against: Prove ODS value in under 10 seconds: Python generates Mission State, EOS, and updates Notion.
- Latest promoted event: Architecture freeze: implementation proceeds without further redesign unless implementation breaks architecture.
- Latest EOS signal: Final polish: operational posture, mission replay, Notion sync.
- Latest promoted knowledge: Founder value > engineering elegance. (founder-doctrine).

## Promoted Knowledge

- Ship something every day. (always-read)
- Founder value > engineering elegance. (founder-doctrine)

## Repository

- /Users/ods/Repos/bjj-tracker/ods-eos

## Files Involved

- `M cli.py`
- `M docs/bootstrap/active-slice.md`
- `M docs/bootstrap/operator-bootstrap.md`
- `M ods/commands/__init__.py`
- `M ods/commands/capture.py`
- `M ods/config.py`
- `M ods/eos_pipeline.py`
- `M ods/generators/active_slice.py`

## Acceptance Criteria

- Continue Founder Proof Floor v0.1 remains aligned with Mission State.
- Generated startup artifacts refresh through `python3 cli.py eod`.
- No protected schema or architecture boundary changes are introduced.

## Known Constraints

- Do not modify Mission State, Mission Registry schema, Event Store, EOS, or Law #001.
- Preserve generated-document boundaries; do not hand-author projected output.

## QA Path

- `PYTHONPYCACHEPREFIX=/private/tmp/ods-pycache python3 -m py_compile cli.py ods/config.py ods/commands/__init__.py ods/eos_pipeline.py ods/generators/active_slice.py`
- `python3 cli.py active-slice`
- `python3 cli.py eod`

## Immediate Next Command

- `git status --short -- .`
