# Weekly System — Source of Truth

## 🎯 Core Principle

Weekly data is ALWAYS scoped by:

sharedAthleteId

There is no valid weekly outside of an athlete.

---

## 🧱 Data Model

Worker storage:

weeklyByAthleteId: {
  [sharedAthleteId]: WeeklyDoc
}

Optional legacy (to be removed):
- invite-level weekly
- fallback assignment modes

---

## ✍️ Write Path (Coach)

Coach MUST send:

- sharedAthleteId

Publish flow:

KidDetailScreen →
coachSyncPublishWeekly →
Worker

---

## 🧠 Worker Behavior

On publish:

1. Validate:
   - sharedAthleteId exists in session roster
2. Merge into:

weeklyByAthleteId[sharedAthleteId]

3. DO NOT overwrite other athletes

---

## 📥 Read Path (Parent)

Parent MUST:

1. Determine selected athlete (UI selection)
2. Resolve sharedAthleteId
3. Read ONLY:

weeklyByAthleteId[sharedAthleteId]

---

## 🚫 Forbidden Behavior

DO NOT:

- fallback to another athlete
- fallback to invite-level weekly
- select based on name or order
- guess when data is missing
- silently switch athletes

---

## ✅ Valid States

| State | Meaning |
|------|--------|
| weekly exists | show weekly |
| no weekly exists | show empty state |
| mismatch | BUG |

---

## 🔍 Logging Contract

Correct behavior:

requested === available

Example:

[WEEKLY PIPELINE TRACE]
{
  athleteId: "shared_ath_123",
  hasAthleteDoc: true,
  available: ["shared_ath_123"]
}

---

Broken behavior:

requested !== available

Example:

[weekly-doc-missing-athlete]
{
  requested: "shared_ath_A",
  available: ["shared_ath_B"]
}

---

## 🔒 System Guarantee

If weekly exists for an athlete:
→ it MUST be shown

If it does not exist:
→ NOTHING is shown

---

## ⚠️ Edge Cases

### Single Athlete
- Auto-select
- Always safe

### Multiple Athletes
- Selection MUST be explicit or validated
- Never fallback to first/only key
- Never assume ordering

---

## 🧠 Decision Rule

When resolving weekly:

IF sharedAthleteId exists in weeklyByAthleteId
→ return it

ELSE
→ return null

---

## 🚀 Future (Planned)

- Remove invite-level weekly entirely
- Add parent athlete selector UI
- Make weekly strictly per-athlete everywhere

---

## 📌 Guiding Principle

No guessing.
No fallback.
Only truth tied to athlete.

---

END
