# MatMind Engineering Parking Lot

> Purpose:
>
> Capture engineering ideas that are intentionally deferred.
> This is not a backlog.
> This is not an investigation register.
> This is not a developer handoff.
>
> Founder decision required:
>
> Work may be parked only after an explicit founder decision to defer it.
> Parking is a governed deferral, not a dumping ground for unfinished thoughts.
>
> Resume Trigger required:
>
> Every parked item must include a clear Resume Trigger.
> If an item has no clear Resume Trigger, it does not belong in the Engineering Parking Lot.
>
> Priority to Resume:
>
> Priority to Resume is not today's execution priority.
> It is the priority once the Resume Trigger has been satisfied.
> Allowed values: Critical | High | Medium | Low
> Examples: DOCOPS v3 → Medium; Founder OS Audit → High; AI Interview Portfolio → Medium
>
> ChatGPT supplies the parking model.
> Python writes and verifies this document.

## Parking Item Template

```text
### PARKING ID — TITLE

- Parking ID:
- Title:
- Date Parked: YYYY-MM-DD
- Status: PARKED
- Reason for Parking:
- Resume Trigger:
- Priority to Resume: Critical | High | Medium | Low
- Dependencies:
- First Resume Step:
- Notes:
```

## Parked Items

#Engineering Parking Lot (Updates)
Documentation / Engineering Infrastructure
High Priority
Repair DOCOPS v2 Python serializer so Python only formats, writes, and verifies GPT-authored content.
Decide whether docs/dev-handoff.backup.md remains a permanent recovery artifact or can be retired after DOCOPS is recertified.
Review and formally certify today's new architecture documents:
consumer-observation-contract-v1.md
parent-initialization-ownership-contract-v1.md
docs/architecture/governance/*
docs/engineering/inv8-production-design-v1.md
Product / UX
Improve Pull-To-Refresh affordance and visual feedback on Parent and Coach Compete screens.
Polish loading states during competition synchronization.
Review spacing, labels, and interaction polish before TestFlight.
Future Features (Post-MVP)
Push notification when Coach publishes a Match Breakdown.
Push notification when weekly summaries become available.
Evaluate background synchronization versus explicit refresh after MVP stabilization.

Engineering Observatory / Digital Twin

Status:
PARKED

Resume Trigger:
Coach Film Room Runtime Architecture is implemented and the Parent/Coach coaching loop is operational.

Priority:
Medium
Release Readiness
Build next TestFlight from the certified floor.
Execute full production-device regression checklist.
Compare TestFlight behavior against the certified QA17–QA19 scenarios.
