# Parent Progress Understanding Doctrine

## Date

2026-06-08

## Status

Strategic product doctrine.  
Read-only governance. Non-implementation.

## Scope

This document defines the **governing philosophy for the parent Summary experience**.

It answers one question:

> When a parent opens Summary, what should they psychologically *experience*?

This is **not** a UI redesign, feature plan, dashboard spec, implementation work, or AI brainstorming document.

---

## Governing Product Principle

> The best performance apps don't make users feel like they are managing data.  
> They make users feel like they are understanding progress.

MatMind Summary should evolve toward:

# athlete progress understanding

NOT:

# statistics management

---

## Source Context

This doctrine synthesizes:

- `docs/canonical-coaching-workflow.md`
- `docs/coaching-payload-semantics-audit.md`
- `docs/coach-athlete-review-workflow.md`
- `docs/coach-surface-responsibility-map.md`
- Read-only Summary semantic inspection (2026-06-08)
- Runkeeper / WHOOP / Oura product psychology research (documented in coach-athlete-review-workflow §8)

---

# SECTION 1 — SUMMARY PURPOSE

## What Summary Actually Exists To Do

Summary is the **parent-facing synthesis layer** where coach direction, training proof, and competition validation converge into a single interpretive experience.

Per surface responsibility governance, Summary owns:

- athlete identity and operating summary
- coach-direction synthesis
- training and competition proof *interpretation*
- trend, alignment, and progression signals
- recognized skills and emerging game patterns

Summary does **not** own weekly payload authoring, family delivery, competition event editing, coach private check-ins, or roster administration. Those truths live elsewhere by design.

Summary's job is **read, interpret, reinforce** — not capture, publish, or archive.

## What Summary Is NOT

| Misread | Why it is wrong |
|---|---|
| Stats dashboard | Aggregate KPI tiles without developmental framing train data-management psychology. |
| Competition report | Compete owns event proof and match narrative; Summary may synthesize, not replicate archives. |
| Training ledger | Training owns session logging and day/week review; Summary consumes proof, not inventory browsing. |
| KPI surface | Win rate, sub rate, and session counts are evidence — not the product's emotional center. |
| Analytics screen | Derived signals must serve understanding, not dashboard density. |

## What Summary IS

| Role | Meaning |
|---|---|
| Developmental understanding surface | Parents leave knowing *where growth is happening*, not just what was logged. |
| Progress interpretation surface | Summary answers "what is changing?" before "what data exists?" |
| Coach-guided reinforcement surface | When coach weekly mission is active, coach-authored truth leads; proof validates. |
| Athlete identity mirror | Header framing, recognized skills, and focus lanes reflect *who the athlete is becoming*. |
| Confidence / progression understanding surface | Alignment, habit rhythm, and progression steps express trajectory — not performance judgment. |

## Strategic Position in the Product Loop

Per canonical coaching workflow, Summary sits at the convergence point:

```txt
Training (proof)
  + Competition (pressure validation)
  + Coach Interpretation (weekly direction)
    → Summary (parent synthesis)
      → Parent Reinforcement (This Week / Family Huddle)
        → Longitudinal Athlete Development
```

Summary is where **meaning meets proof** for parents. It is the only parent-facing surface designed to compose all three inputs into one interpretive stack.

---

# SECTION 2 — PARENT PSYCHOLOGY

## What Parents Should Psychologically Leave Summary Understanding

When a parent closes Summary, the intended mental model is:

| Takeaway | Example internal monologue |
|---|---|
| Where development is happening | "They're building real consistency in guard work." |
| What currently matters | "Coach wants top pressure this week — that's the through-line." |
| Where confidence is improving | "They're showing up regularly and the focus is landing in sparring." |
| What identity is emerging | "Their game is taking shape around closed guard and sweeps." |
| What coach is reinforcing | "The coach is pushing the same emphasis we've been working on." |
| How consistency is evolving | "Three weeks in a row hitting the training rhythm." |
| How pressure adaptation is changing | "Last tournament they held composure longer under score pressure." |

These are **understanding outcomes**, not data-retrieval outcomes.

## What Parents Want

Parents want **reassurance of development**, not data management.

They are not opening MatMind to:

- audit session logs
- compare win rates
- manage profile completeness scores
- review career statistics like a fantasy sports dashboard

They are opening MatMind to feel:

- *My athlete is growing*
- *Coach and home are aligned*
- *I understand what matters right now*
- *I can reinforce the right things at home*

## Current Psychology Gap (Inspection Finding)

Today's Summary experience is **hybrid**:

- **Top third:** developmental understanding — identity mirror, coach-directed meaning (Hero V2).
- **Middle:** operational proof — weekly activity, patterns, consistency.
- **Bottom:** performance reporting — competition metrics dominate the scroll's closing impression.

The dominant **lingering feeling** after a full scroll is still half developmental mirror, half performance dashboard — with dashboard energy strongest at the exit.

**Doctrine implication:** Parent psychology must be governed by **what parents remember last**, not only what they see first. The closing impression should reinforce development, not statistics.

## Parent vs Coach Cognition Boundary

Per canonical coaching workflow, parents receive **coach-interpreted simplification**:

- simplified direction
- reinforcement
- support guidance
- clear weekly focus
- athlete encouragement

Parents do **not** receive full tactical interpretation, complete coaching cognition, or longitudinal diagnostic complexity. Summary must respect this boundary while still conveying developmental understanding.

---

# SECTION 3 — PROOF VS MEANING

## The Governing Rule

# Proof supports meaning.
# Meaning leads the experience.

Proof is essential. Proof must not be removed. The issue is **hierarchy and framing**, not proof existence.

## What This Means in Practice

| Principle | Application |
|---|---|
| Proof remains important | Training sessions, competition outcomes, alignment evidence, and technique repetition counts ground credibility. |
| Proof should not dominate emotional memory | Metric grids at the bottom of a scroll should not overwrite the developmental framing established at the top. |
| Metrics support developmental understanding | Session counts prove alignment; win/loss facts validate pressure response — they do not *become* the story. |
| Competition/training proof validate progression | The canonical loop is: coach emphasis → training proof → competition validation → interpreted meaning. |

## Current Balance (Inspection Finding)

| Scroll zone | Dominant character |
|---|---|
| Above the fold | Meaning leads — header identity mirror + Hero V2 interpretive stack. |
| Below the fold | Proof dominates — three substantial proof cards + competition metric grid. |
| Scroll-weighted overall | Proof slightly wins because four proof cards follow one meaning card. |

The **Hero V2 proof-meaning loop** is well-governed: when coach weekly mission exists, coach mission owns focus/progress/why semantics; signals prove alignment in `computeCoachAlignment`. This matches the coaching payload contract.

## What Should Remain Factual / Proof-Oriented

These truths stay grounded in evidence:

- training session counts and logged techniques (This Week, Consistency)
- competition outcomes — last event, match record, placement facts
- alignment evidence in Hero Why ("trained N times, not yet showing in live rounds")
- gi/no-gi and technique repetition counts in Game Patterns
- podium and placement facts as factual proof lines
- gi/no-gi split and 14-day focus as rolling evidence windows

Proof surfaces must remain **honest, bounded, and linkable** to Compete and Training for parents who want depth.

## What Should Increasingly Become Developmental Framing

These lanes should carry the emotional center:

- **Hero Focus** — what coach is emphasizing / what identity is emerging
- **Hero Progress** — alignment state translation (directed → misaligned → aligned → validated)
- **Hero Why** — explanatory gap or validation narrative
- **Hero Action / Coach direction** — what happens next in the skill arc
- **Header + Recognized Skills** — athlete identity emergence
- **Consistency** — confidence-through-rhythm, not attendance policing
- **Competition section lead** — pressure adaptation and strategic identity hints before rate tiles
- **Coach-linked state** — reinforcement channel, not sync-status jargon

## Anti-Confusion Rule

When proof and meaning compete for the same semantic slot, **meaning wins presentation hierarchy; proof wins factual authority**.

Example from coaching workflow doctrine:

```txt
Coach emphasis: top pressure
Training proof: high
Competition execution: low
Interpretation: athlete abandons pressure under stress
```

The parent should remember the **interpretation**, with proof available as validation — not the three raw numbers independently.

---

# SECTION 4 — HERO V2 AS CANONICAL MODEL

## The Structure

Hero V2 (`SummaryV2Card`) presents a four-lane interpretive rhythm:

```txt
Focus
  → Action / Coach direction
    → Progress
      → Why
```

| Lane | Semantic role | Parent psychology |
|---|---|---|
| **Focus** | What matters right now — coach mission headline or emerging system/technique | "This is the through-line." |
| **Action / Coach direction** | What to do next in the skill arc; relabeled "Coach direction" when weekly mission is active | "This is what we're working toward." |
| **Progress** | Alignment state — is training proving the emphasis? | "This is how it's going." |
| **Why** | Explanatory reinforcement — gap, validation, or honest proof-based reasoning | "This is why it matters." |

## Why This Structure Is Strategically Important

### 1. It mirrors parent cognition rhythm

Parents think in narrative sequence, not dashboard tiles:

1. What is the focus?
2. What should we do about it?
3. How is it going?
4. Why does this matter?

This is the same rhythm Oura and WHOOP use for daily outlook — one interpretive theme before action.

### 2. It encodes coach authority

Per `buildSummaryViewModel` contract: when `coachWeekly` carries a mission, that mission owns alignment target, progression, progress/why labels, and focus headline. Signals prove alignment; they do not author the mission.

When `weeklyCoachActive`, Action relabels to **"Coach direction"** — a subtle but critical semantic lift that ties meaning to human coaching credibility, not algorithmic inference.

### 3. It implements the platform's premium intelligence loop

Hero V2 embeds the canonical coaching lifecycle in one card:

```txt
Weekly direction → training proof → alignment interpretation → explanatory why
```

`computeCoachAlignment` performs execution-vs-direction comparison. `computeProgression` holds system-specific skill arc memory (`stepKey`, `lastAction`). This is the doctrine's premium example of coaching intelligence — not more charts.

### 4. It is the semantic nucleus of the future moat

Hero V2 maps cleanly to the **Identity / Progression Synthesis** layer described in canonical coaching workflow. It is the only parent-facing surface that composes coach intent + training proof + competition validation into a single interpretive stack.

## Why Hero V2 Currently Feels Stronger Than Lower Sections

| Hero V2 strength | Lower section weakness |
|---|---|
| Single interpretive theme (Oura/WHOOP pattern) | Multiple metric grids dilute the outlook |
| Coach-authored focus when weekly active | Count-first framing (sessions, win rate) |
| Alignment states answer "what is changing?" | Aggregate rates answer "what data exists?" |
| Proof-based Why copy is honest, not fluff | Competition grid feels like performance reporting |
| One card, calm density | Stacked tiles train inventory review |

**Inspection verdict:** Hero V2 is the screen's "daily outlook." Everything below it currently behaves like supporting evidence that too often reads as a separate dashboard.

## Canonical Parent Cognition Rhythm

This four-lane structure is likely the **canonical parent cognition rhythm** for MatMind Summary:

```txt
Focus (what matters)
  → Direction (what to do)
    → Progress (how it's going)
      → Why (why it matters)
```

Future Summary evolution should **extend and reinforce this rhythm longitudinally**, not replace it with metric-first layouts.

Substrate already computed but not fully parent-visible (progression memory, trend labels, identity phase) should eventually **enrich these four lanes** — not spawn parallel insight cards.

---

# SECTION 5 — DEVELOPMENTAL UNDERSTANDING

## The Core Distinction

| Question | Psychology | Summary character |
|---|---|---|
| **"What data exists?"** | Data management | Dashboard, ledger, report |
| **"What is changing?"** | Progress understanding | Development, trajectory, evolution |

Summary must increasingly default to the second question.

## Data-Oriented vs Progress-Oriented Examples

| Data-oriented (inventory) | Progress-oriented (evolution) |
|---|---|
| Win rate | Pressure adaptation improving |
| Sub rate | Execution becoming more decisive under score |
| Match counts | Confidence building through repeated composure |
| Session counts | Consistency building across weeks |
| Profile completeness score | Strategic identity emerging |
| Technique repetition totals | Focus landing in live rounds |
| Podium counts | Recurring strengths stabilizing |

## What Already Feels Developmental (Inspection Finding)

- **Hero V2** — alignment progression (`directed_no_proof` → `misaligned` → `aligned` → `validated`)
- **Operating header** — "A mirror of the athlete" sets developmental expectation
- **Recognized Skills** — identity declaration, not measurement
- **Consistency** — habit trajectory, not win/loss
- **Coach direction relabel** — human coaching authority
- **Game Patterns 14-Day Focus** — emerging repetition signal with light developmental subtext

## What Still Feels Like Activity Inventory

- **Identity score** as raw number
- **This week** session/technique counts
- **Game Patterns** four-tile metric grid
- **Competition Snapshot** — record, win rate, sub rate, avg time, win style (6+ numeric tiles)

**Weak zone:** Mid-to-lower scroll stacks proof tiles without enough "compared to before" or "what this means for development" — parents accumulate inventory, not trajectory.

## MatMind Framing Doctrine

MatMind should increasingly frame:

# athlete evolution

NOT:

# activity inventory

This does not mean removing activity data. It means **subordinating inventory to evolution** in language, hierarchy, and emotional memory.

Examples of evolutionary framing:

- "Building consistency" not "7 sessions logged"
- "Pressure composure improving" not "67% win rate"
- "Guard identity emerging" not "top technique: closed guard x12"
- "Coach focus landing in training" not "alignment 78%"

Proof numbers may appear as supporting evidence inside Why lanes — not as the headline memory.

---

# SECTION 6 — LONGITUDINAL ALIGNMENT

## How Summary Should Support Development Over Time

Summary should eventually feel like:

# understanding a journey

NOT:

# reviewing a report

## Longitudinal Dimensions Summary Must Serve

| Dimension | Parent understanding goal |
|---|---|
| Athlete development over time | "They've grown from hesitant to decisive in scrambles." |
| Progression understanding | "We're in the control phase of the guard arc." |
| Recurring strengths | "Closed guard keeps showing up — it's becoming their game." |
| Confidence evolution | "They're trusting the same focus under competition pressure." |
| Identity emergence | "A guard player identity is taking shape." |
| Coach-guided reinforcement | "Coach has been reinforcing the same theme for weeks — it's sticking." |

## What Already Hints at Longitudinal Understanding

| Signal | Longitudinal hint | Current limitation |
|---|---|---|
| Recognized Skills | Declared identity persists | Collapsed by default; profile-edit feel |
| Hero progression `stepKey` + `lastAction` | Remembers progression step per week/system | Not surfaced in parent-visible copy |
| Game Patterns 14-Day Focus | Rolling window | Still count-based |
| Consistency streak | Multi-week habit memory | Weekly goal is static (3+) |
| `bucketFocusEvidenceLine` | Placement trajectory language | Competition section only; advisory |
| Coach weekly hydration | Cross-week coach mission continuity | Weekly-scoped, not arc narrative |
| Identity phase (cold/developing/experienced) | Lifecycle stage | Computed; not shown in V2 hero |

## What Still Feels Episodic / Statistical

- **This week** — hard weekly boundary, count-first
- **Competition Snapshot** — last event hero + aggregate career stats; no season arc
- **Win rate / sub rate** — point-in-time aggregates, not "improving vs last quarter"
- **Session counts** — inventory, not slope

## The Longitudinal Gap

No parent-visible **"athlete evolution over time"** headline exists today. Longitudinal intelligence is **substrate-rich, presentation-thin**.

Conceptual readiness exists without new architecture:

- Hero alignment loop models coach emphasis → training proof → competition validation
- Progression memory is persisted per athlete/week/system
- Game Patterns + coach weakness blending in derivation — pattern memory exists, thin in presentation
- Competition `placementTrend` + `bucketFocusEvidenceLine` — seeds for pressure-adaptation narrative

## Journey Framing Doctrine

Summary should evolve from **weekly synthesis** toward **longitudinal synthesis** while preserving weekly relevance:

```txt
Weekly: "This week coach wants X; training is proving Y."
Longitudinal: "Over the last months, this athlete's identity and confidence are evolving toward Z."
```

Weekly and longitudinal are not opposites. Weekly is the pulse; longitudinal is the arc. Summary must eventually carry both — with the arc as the emotional frame and the week as the current chapter.

Runkeeper UX research supports this: **journey tab over leaderboard** for emotional progression. MatMind's journey is interpreted athlete development, not social comparison.

---

# SECTION 7 — WHAT SUMMARY SHOULD NEVER BECOME

## Explicit Anti-Patterns

Restraint is part of the premium feeling. Summary must resist:

| Anti-pattern | Why it violates doctrine |
|---|---|
| **Metric sprawl** | Each new KPI tile trains data-management psychology and dilutes Hero V2's single theme. |
| **Chart overload** | Premium is accumulated understanding, not visualization density. |
| **Fake AI inspiration** | Motivational fluff without proof provenance erodes trust. |
| **Dashboard chaos** | Stacked metric grids after an interpretive hero converts understanding back into statistics review. |
| **KPI addiction** | Win rate, sub rate, session counts, identity score, alignment % simultaneously competing for attention. |
| **Over-quantified parenting** | Parents should not feel like performance analysts managing their child's metrics. |
| **AI pretending to be coach truth** | Derived copy that looks coach-authored violates AI boundary in coaching payload semantics. |
| **Duplicated proof surfaces** | Re-rendering Compete cards or Training logs inside Summary creates semantic overlap with authoritative surfaces. |
| **Noisy "insight" spam** | Multiple advisory suggestions, trend badges, and validation notes competing with coach weekly mission. |
| **Second This Week** | Summary re-delivering weekly family payload duplicates Parent This Week's job. |
| **Second Compete** | Full competition archive browsing belongs in Compete; Summary owns synthesis, not event proof browsing. |
| **Semantic vocabulary drift** | Focus / Coach direction / Weekly focus / Mission / This week's direction appearing as competing concepts on one screen. |

## Restraint as Premium Signal

WHOOP stays quiet when nothing warrants action. Oura surfaces one daily insight theme. Runkeeper keeps reinforcement calm and utility-first.

MatMind Summary premium feeling comes from:

- **curated understanding** over data overload
- **one interpretive theme** over dashboard breadth
- **coach credibility** over algorithmic authority
- **calm hierarchy** over feature sprawl

## Hidden ≠ Deleted

Visual simplification must not casually mutate lifecycle orchestration, reconcile paths, derived narratives, cache arbitration, or overlay integrity. Substrates may remain active when visual surfaces are hidden. Anti-pattern removal is a **presentation governance** decision, not a substrate deletion decision.

---

# SECTION 8 — RUNKEEPER / WHOOP / OURA LESSONS

## Strongest Product Psychology Lessons for MatMind

Research across calm performance apps (documented in `docs/coach-athlete-review-workflow.md` §8) yields patterns directly applicable to parent Summary philosophy.

### Cross-App Patterns

| Pattern | Mechanism | MatMind Summary translation |
|---|---|---|
| **Proof ≠ interpretation** | Raw activity capture separated from coached meaning | Training/Compete own proof; Summary owns interpretation |
| **One primary daily theme** | Single interpretive headline, not a dashboard | Hero V2 is the daily outlook; lower cards are supporting evidence |
| **Calm hierarchy** | Depth available but not default | Recognized Skills collapsed by default; link to depth over inline dump |
| **Progression framing** | Comparative memory (you vs your past self), not more KPI tiles | Alignment and progression arcs vs raw win rate |
| **Premium understanding feeling** | Insights relative to *your* norm with provenance | Coach focus as personal baseline, not population average |
| **Reinforcement without shame** | Adaptive plans that catch up instead of marking behind | Consistency "N sessions to goal" framing; misaligned copy must not feel punitive |
| **Curated understanding over data overload** | One outlook card before metrics | Hero before grids; meaning before inventory |
| **Quiet when unnecessary** | Premium calm includes silence | Empty states stay quiet; don't surface noise or empty proof sections |
| **Journey / narrative framing** | Personal journey over leaderboard | Athlete evolution over competition trophy browsing |
| **Closure feedback** | Completing review feels finished | Summary should feel like understanding achieved, not endless analytics |

### Runkeeper — Special Focus

Runkeeper is instructive because it is **quiet, utility-first, and reinforcement-oriented** rather than social-analytics heavy.

| Runkeeper strength | Parent Summary philosophy |
|---|---|
| No-frills tracking; own journey not social feed | Summary should not compete with Compete on trophy browsing |
| Goals with gentle nudges | Consistency + weekly direction as gentle reinforcement loop |
| Post-activity feeling check | Hero Progress/Why as human interpretation atop proof |
| Follow-up care after reflection | Parent reinforcement aligns with This Week; Summary sets understanding |
| Journey over leaderboard | Longitudinal identity over competition metric grid |
| Guided audio coaching | Family Huddle owns guided read-through; Summary owns synthesis |
| Configurable cue density | Don't surface every advisory suggestion at full volume |
| Clear weekly structure | One clear mission; longitudinal memory separate |

**Runkeeper parent-side inspiration:** Simple weekly direction, emotional reinforcement, low cognitive load — not tactical depth.

### WHOOP — Calm Prioritization

| WHOOP strength | Parent Summary philosophy |
|---|---|
| Daily Outlook — one interpretive grounding | Hero V2 before action |
| Quiet when nothing warrants action | Don't show empty proof noise |
| Biometric interpretation with provenance | Proof-based Why copy, not generic tips |
| My Memory — accumulated context | Progression memory and recognized skills as persistent thread |
| Proactive check-ins at life moments | Future: life-context-aware reinforcement (doctrine only) |

### Oura — Interpretive Tone

| Oura strength | Parent Summary philosophy |
|---|---|
| Readiness insight — one headline | Hero Focus lane |
| Personal baseline vs population | Coach focus + athlete's own history as baseline |
| 14-day balance vs 2-month personal norm | Rolling windows (14-day focus, streak) vs career aggregates |
| "Each day will look different" | Summary composition varies; calm empty states |
| Longitudinal trends as narrative | Placement trend and bucket evidence as arc hints, not footnotes |

### Alignment Assessment (Current Summary)

| Reference principle | Aligned today | Gap |
|---|---|---|
| Runkeeper journey over leaderboard | Header mirror + hero meaning | Competition grid reintroduces leaderboard energy |
| WHOOP one daily outlook | Hero V2 strong single-theme card | Four sections below hero dilute outlook |
| Oura interpretive personal baseline | Alignment vs coach focus | No "vs your past self" baseline framing |
| Runkeeper gentle weekly structure | Consistency + hero Action | This week is count-first |
| WHOOP quiet when empty | Good empty states | Identity score + competition badge add noise |
| Nike Run Club encouragement without shame | Forgiving consistency copy | Misaligned wording could feel corrective |

### Dilution Risk

Each card alone is reasonable. **Stacked metric grids** after an interpretive hero converts the scroll from "understanding" back to "reviewing statistics." Doctrine requires governing **scroll-weighted psychology**, not individual card quality.

---

# SECTION 9 — FUTURE MOAT ALIGNMENT

## The Platform Moat

Per canonical coaching workflow, MatMind's long-term differentiator is:

# interpreted athlete development over time

MatMind is NOT evolving into a training tracker, competition archive, statistics dashboard, or BJJ logging app with AI.

MatMind IS evolving into a **longitudinal coaching intelligence platform**.

## Why Summary Is Strategically Important

Summary is the **parent-facing synthesis layer** where:

- coach direction
- training proof
- competition validation
- developmental interpretation

begin converging into:

# athlete progress understanding

No other parent surface is designed for this convergence:

| Surface | Owns | Does not own |
|---|---|---|
| Parent This Week | weekly delivery, acknowledgement, family reflection | longitudinal synthesis, proof archives |
| Training | session proof, patterns | coaching interpretation |
| Compete | event proof, match narrative | weekly family guidance |
| Coach Dashboard | team triage, operations | parent developmental psychology |
| **Summary** | **identity + synthesis + progression interpretation** | authoring, publishing, proof editing |

## Moat Alignment Today

| Summary surface | Moat alignment |
|---|---|
| Hero V2 | Embeds weekly direction → proof → validation loop |
| `computeCoachAlignment` | Execution vs direction — doctrine's premium intelligence example |
| `computeProgression` | System-specific skill arc with memory |
| Coach weekly hydration | Parent receives coach-interpreted simplification |
| Game Patterns | Recurring training patterns (longitudinal substrate) |
| Competition hints | Pressure-validation → suggested meaning |
| Recognized Skills | Strategic identity persistence |

## Surfaces Still Transactional

- This week — proof inventory
- Identity score — profile transaction meter
- Competition metric grid — archive statistics, not interpreted development
- Athlete switcher — roster operations

## Future-Compatible Surfaces

- Hero V2 four-lane structure → Identity / Progression Synthesis layer
- Progression `stepKey` memory → arc display without new architecture
- Collapsed Recognized Skills → identity timeline entry point
- Hidden legacy hero substrate (trend, suggestions, validation) → advisory layers already computed; presentation governance needed

## Surfaces That May Become Noise

- Redundant session counts across Hero Progress, This Week, Consistency
- Raw win rate / sub rate tiles if hero already communicates validation state
- Identity score number without stage narrative
- Competition count badge if last-event context suffices

## Premium Tier Vision (Parent Lens)

Premium is NOT more charts, graphs, KPIs, or statistics.

Premium becomes **accumulated coaching understanding**:

- evolving strategic identity
- pressure tendencies
- progression arcs
- recurring themes
- athlete maturity

Summary is where parents first *feel* this premium — as calm, curated understanding of their athlete's journey.

## Conceptual Readiness Verdict

Summary is **beginning to support** interpreted athlete development over time — primarily through the hero alignment/progression pipeline and coach weekly authority.

It is **not yet** a longitudinal intelligence surface. It is a **weekly synthesis surface with longitudinal substrates waiting for presentation governance**.

The strategic position is correct. The product psychology gap is **hierarchy and longitudinal framing**, not missing proof or missing metrics.

---

# SECTION 10 — IMPLEMENTATION GUARDRAILS

## Purpose

These guardrails constrain **future** Summary work. This doctrine does not authorize implementation. Any future surface change requires slice-specific audit per coaching payload semantics §8.

## Semantic Guardrails

| Rule | Rationale |
|---|---|
| **No metric-first redesigns** | Hero V2 meaning lanes must lead; proof subordinates. |
| **No chart-heavy drift** | Premium is understanding, not visualization density. |
| **No replacing coach meaning with AI meaning** | Coach weekly mission owns focus when present; AI assists, never owns canonical truth. |
| **No proof duplication** | Do not re-render Compete cards or Training logs as Summary content. |
| **No semantic overlap with Compete/Training** | Summary synthesizes; Compete and Training own authoritative proof browsing. |
| **Preserve calm operational tone** | Dark panel rhythm, quiet empty states, collapsed defaults — restraint is premium. |
| **Preserve developmental framing** | Language answers "what is changing?" before "what data exists?" |
| **Preserve grounded coaching credibility** | Coach direction label, coach weekly authority, proof-based Why — not generic AI tips. |
| **One concept = one authoritative purpose** | Avoid duplicate meanings across Summary, This Week, and Compete. |
| **Author once, render intentionally** | Coach authors weekly row; Summary derives synthesis; no second authoring surface. |
| **Parent simplification boundary** | No full tactical interpretation or coach-private memory on parent Summary. |

## Protected Systems (Do Not Casually Mutate)

Per coaching payload semantics and coach surface responsibility map:

- canonical athlete authority
- coach/parent ownership boundaries
- coach weekly sync publish/hydrate
- parent feedback publish paths
- training proof persistence and publication
- competition lifecycle, topology, overlay lineage
- aggregate projection freshness arbitration
- Summary projection freshness
- hydration replay governance
- `load()` orchestration in lifecycle-heavy screens
- navigation return flows after save/delete
- active athlete selection
- signal derivation pipelines

## Safe vs High-Risk Change Zones

| Usually safe (with inspection) | High-risk (architecture review required) |
|---|---|
| Labels and section headings | `SummaryScreen` hydration and signal derivation paths |
| Visual grouping and card hierarchy | Coach weekly cache arbitration |
| Card density and scroll order | Competition slice merge in Summary |
| Vocabulary alignment (no payload field change) | `buildSummaryViewModel` contract mutations |
| Collapsing/hiding render blocks (substrate intact) | Deleting computed substrates assumed unused |
| Developmental framing copy in existing lanes | New derived surfaces competing with Hero V2 |

## AI Boundary (Summary-Specific)

AI may assist Summary through:

- phrasing reinforcement copy
- pattern surfacing for coach review (not parent canonical display)
- identity suggestion derivation (advisory until accepted)
- trend recognition in derived modules

AI must never own on Summary:

- canonical athlete identity
- canonical weekly mission headline
- coach-authored interpretation presented as coach truth
- parent-facing developmental judgment without coach provenance

## Closing Impression Rule

Future Summary work must pass this test:

> After scrolling Summary, does the parent remember **who their athlete is becoming and what coach is reinforcing** — or **win rate and session counts**?

If the answer is statistics, the change violates this doctrine regardless of visual quality.

## Parent Consumption Hierarchy (Context)

Summary sits third in parent consumption hierarchy — after This Week (current direction) and Family Huddle (reflection). Summary's job is **broader athlete progression**, not re-delivering the weekly note.

```txt
1. Parent This Week — current direction and acknowledgement
2. Family Huddle — read/reflection flow
3. Summary — athlete progression understanding
4. Training / Compete — proof and history when depth is needed
```

Summary must complement This Week, not compete with it.

---

## Doctrine Summary

MatMind parent Summary exists to help parents **understand athlete progress** — not manage athlete data.

The governing rhythm is Hero V2's **Focus → Action → Progress → Why**, led by coach meaning and validated by proof.

Proof supports meaning. Meaning leads the experience.

Summary should evolve toward **athlete evolution** framing, **journey** feeling, and **longitudinal coaching intelligence** — with restraint, coach credibility, and calm hierarchy as premium signals.

Everything else in the app supports this surface. Summary is where parents should feel they understand their athlete's development.

---

*Document version: 2026-06-08 · Read-only governance · No implementation authorized by this document alone.*
