# Coach Athlete Review Workflow

Status: semantic workflow governance  
Scope: `src/features/kid/KidDetailScreen.tsx` — coach cognition, review sequence, and product psychology  
Audience: product, design, and engineering before any future surface work  

This document is **not** a UI spec, implementation plan, visual redesign, or runtime change request. It defines the intended coach workflow doctrine for the Coach Athlete Detail surface.

Related governance:
- `docs/coach-surface-responsibility-map.md`
- `docs/coaching-payload-semantics-audit.md`
- `docs/canonical-coaching-workflow.md`

---

## SECTION 1 — SCREEN PURPOSE

### What KidDetailScreen is actually for

`KidDetailScreen` is the **individual athlete coach interpretation workspace**. When a coach opens an athlete from the Coach Dashboard or roster, this surface should answer:

> *Who is this athlete in my coaching mind right now? What am I carrying forward? What is this week's direction? Did the family receive and absorb it? What do I need to do operationally before I leave?*

It is the bridge between:
- team-level triage (Coach Dashboard)
- weekly family delivery (Parent This Week / Family Huddle)
- longitudinal coaching memory (What Matters Next, check-in history, future voice-note memory)

### What KidDetailScreen is NOT

| Misread | Why it is wrong |
|---|---|
| Training archive | Training proof lives in **Training**. Session logs, calendar review, and pattern carousels belong there. |
| Competition archive | Competition proof lives in **Compete**. Podium record, match cards, and coach match breakdown rendering belong there. |
| Admin utility page | Roster/household grouping is a low-priority utility, not the screen's reason to exist. |
| Statistics dashboard | Aggregate metrics, alignment, and progression synthesis live in **Summary** and team snapshots in **Coach Dashboard**. |
| Family publishing app | Publishing is one bounded action inside a larger review workflow — not the screen's identity. |

### What KidDetailScreen IS

| Role | Meaning |
|---|---|
| Coach interpretation workspace | Where meaning is formed, reviewed, and prepared — not where raw proof is browsed. |
| Weekly direction oversight | Where the coach confirms current weekly intent, publish readiness, and family delivery state. |
| Parent reinforcement oversight | Where the coach reviews acknowledgement/viewed status and previews what parents will read. |
| Longitudinal observation workspace | Where standing guidance, recurring interpretation, and private check-in memory are anchored before weekly action. |

The screen's emotional center is **calm operational review**, not data entry overload.

---

## SECTION 2 — CANONICAL COACH EXPERIENCE

When a coach opens an athlete, the intended psychological sequence is staged — not a flat scroll of mixed responsibilities.

### Stage 1 — Athlete Context

| Dimension | Definition |
|---|---|
| **Purpose** | Orient. Confirm *which athlete*, *what lane*, and *what this screen owns*. |
| **Mental mode** | Situational awareness — "I am in coaching review, not logging or archiving." |
| **Ownership** | Coach Athlete Detail header and explanatory copy. |
| **What belongs** | Athlete name, role-aware framing ("coaching space" vs parent-lane copy), light return navigation to Coach Dashboard. |
| **What does NOT belong** | Team triage groups, full roster tables, training calendar, competition cards, summary metrics. |

**Repo grounding:** Header copy already distinguishes coach vs This Week lane operator context.

---

### Stage 2 — Longitudinal Interpretation

| Dimension | Definition |
|---|---|
| **Purpose** | Recall accumulated coaching understanding before reacting to this week. |
| **Mental mode** | Memory and pattern — "What do I already know about this kid's development?" |
| **Ownership** | Coach-private longitudinal layer. |
| **What belongs** | What Matters Next standing guidance (review + link to edit), recent check-in themes, interpretation history entry points, future voice-note memory hooks, advisory suggestions clearly labeled as non-canonical. |
| **What does NOT belong** | Weekly mission authoring, publish buttons, raw training session lists, competition event cards, parent acknowledgement status. |

**Psychological rule:** Longitudinal interpretation should **lead** weekly reaction. The coach should see development memory before drafting or publishing this week's message.

**Repo grounding:** "What matters next" block in the COACH ONLY lane; `what-matters-next` route for authoring; History route for week-grouped longitudinal review.

---

### Stage 3 — Weekly Operational Review

| Dimension | Definition |
|---|---|
| **Purpose** | Assess how the current weekly focus is landing in practice. |
| **Mental mode** | Operational diagnosis — "Is the emphasis transferring?" |
| **Ownership** | Coach-private weekly/rolling observations. |
| **What belongs** | How it's going, applied in sparring, coach check-in notes, saved check-in list for this week, bounded outcome signal, link to Progress Reflection for deeper edit. |
| **What does NOT belong** | Full weekly payload composition, family recap fields, competition archive, training log browsing, team attention badges. |

**Psychological rule:** This is **review + light capture**, not long-form authoring. Check-ins are quick operational signals that accumulate into longitudinal memory.

**Repo grounding:** COACH ONLY lane below What Matters Next; `progress-reflection` route for fuller edit.

---

### Stage 4 — Weekly Direction Oversight

| Dimension | Definition |
|---|---|
| **Purpose** | Review the current weekly coaching intent and its readiness for family delivery. |
| **Mental mode** | Editorial oversight — "Is this week's direction clear, complete, and worth sending?" |
| **Ownership** | Coach weekly row review; authoring delegated to Weekly Focus Edit. |
| **What belongs** | Weekly focus title/body preview, suggested focus (advisory), lightweight competition context line ("based on last competition"), system classification awareness, links to full weekly focus edit, History for prior weeks. |
| **What does NOT belong** | Inline full mission composition, template picker UI, system classification editor, coach-only reference video editor, training session proof, match breakdown overlays. |

**Psychological rule:** The coach **reviews** the weekly payload here; they **author** it on the dedicated weekly focus surface.

**Repo grounding:** Weekly focus card with edit CTA to `/coach/kid/[kidId]/weekly-focus`; suggested focus apply/edit affordances.

---

### Stage 5 — Parent Reinforcement Oversight

| Dimension | Definition |
|---|---|
| **Purpose** | Ensure family-safe delivery is coherent and observe parent uptake. |
| **Mental mode** | Delivery QA — "Will this read well at home? Did they see it?" |
| **Ownership** | Family/publish lane review; parent acknowledgement is parent-authored. |
| **What belongs** | Family huddle source map, Why this matters (bounded edit), parent feedback status (acknowledged / viewed / not viewed), Preview Family Huddle, publish readiness signal, final publish action. |
| **What does NOT belong** | Private coach notes, standing guidance, sparring assessment, training proof, competition editing, roster danger zone. |

**Psychological rule:** Coach interpretation precedes parent reinforcement. The coach reviews family-facing copy **after** internal interpretation, not before.

**Repo grounding:** FAMILY / PUBLISH lane; `ReadTogetherStoryModal` preview; `feedbackStatus` labels; publish CTA.

---

### Stage 6 — Operational Utilities

| Dimension | Definition |
|---|---|
| **Purpose** | Low-frequency admin without derailing review flow. |
| **Mental mode** | Housekeeping — "Anything I need to fix on the roster edge?" |
| **Ownership** | Coach roster utility. |
| **What belongs** | Collapsed household/roster grouping, soft archive / remove-from-roster danger zone. |
| **What does NOT belong** | Weekly coaching content, interpretation, publish workflow, proof browsing. |

**Psychological rule:** Utilities are **terminal and quiet**. They should not visually compete with interpretation or weekly oversight.

**Repo grounding:** Bottom roster/household utility (top block intentionally hidden); danger zone for roster removal.

---

### Intended stage order (canonical cognition)

```txt
1. Athlete Context
2. Longitudinal Interpretation      ← leads
3. Weekly Operational Review
4. Weekly Direction Oversight
5. Parent Reinforcement Oversight
6. Operational Utilities            ← trails
```

**Note on current repo layout:** The present render tree places FAMILY / PUBLISH above COACH ONLY. This document defines the **intended psychological sequence**, not the current visual order. Future surface work should move toward interpretation-first hierarchy without mutating protected lifecycle substrates.

---

## SECTION 3 — REVIEW VS AUTHORING

### Definitions

| Mode | Coach mental state | Surface behavior |
|---|---|---|
| **Review** | Read, interpret, decide, confirm readiness | Display canonical state, status signals, previews, bounded inline adjustments |
| **Authoring** | Compose, classify, structure payload | Dedicated edit surfaces with full field ownership |

`KidDetailScreen` should primarily feel like:

# review + interpretation

NOT:

# fragmented inline authoring

### Delegated authoring (stay off the detail screen)

| Concept | Authoring surface | Why delegated |
|---|---|---|
| Full weekly payload | `/coach/kid/[kidId]/weekly-focus` | Mission, body, system classification, mission link, study link, coach-only reference video need focused composition. |
| Standing longitudinal guidance | `/coach/kid/[kidId]/what-matters-next` | Long-form coach memory with AI draft review; explicitly does not message parents. |
| Deep progress reflection | `/coach/kid/[kidId]/progress-reflection` | Full `coachOutcome` / `coachNotes` edit on a saved weekly row. |
| Competition proof / match breakdown | Compete + competition edit routes | Canonical proof and additive overlay authority live elsewhere. |
| Training sessions | Training tab | Proof substrate, not coaching message composition. |

### Inline review (belongs on the detail screen)

| Concept | Review behavior on detail screen |
|---|---|
| What Matters Next | Display standing guidance; link to edit surface. |
| Weekly focus | Preview title, week, links; link to full edit. |
| Suggested focus | Advisory display; optional apply into bounded fields. |
| How it's going | Quick sparring assessment + check-in capture. |
| Parent feedback status | Read-only review of acknowledgement/viewed state. |
| Family huddle preview | Read-only walkthrough of published family experience. |
| Publish readiness | Review composed payload state before dispatch. |

### Bounded inline authoring (acceptable exceptions)

These are intentionally small, high-frequency edits that should not require navigation:

| Field | Boundary |
|---|---|
| Why this matters / family recap | Short parent-facing reinforcement; maps to `familyCoachRecapNote`. |
| Check-in notes | Quick operational capture; private coach memory. |
| Applied in sparring | Single-select operational signal. |
| Suggested focus apply | Advisory → bounded field prefill; coach still saves/publishes intentionally. |

### Publish actions that belong here

| Action | Why it belongs |
|---|---|
| Publish to family phones | Final delivery dispatch after review; uses `kidWeeklyFocusToPublishPayload()` + `coachSyncPublishWeekly()`. |
| Preview Family Huddle | Delivery QA before publish. |

Publish does **not** belong on Weekly Focus Edit. Author once on the edit surface; review and dispatch on the detail surface.

---

## SECTION 4 — WEEKLY VS LONGITUDINAL

### Weekly concepts

Short-lived directional reinforcement. Primary job: *immediate correction and family guidance for this week.*

| Concept | Examples in MatMind |
|---|---|
| Mission / weekly focus | `KidWeeklyFocusEntry.title`, body, template/custom selection |
| Reinforcement | Why this matters, family coach recap |
| Current focus | Active weekly row, suggested focus line |
| Family delivery | Publish state, mission link, study link, Family Huddle cards |
| Operational check-in | Applied in sparring, weekly outcome for active row |
| Parent acknowledgement | Viewed / acknowledged feedback |

**Weekly surfaces emphasize:** current direction, family reinforcement, this week's status.

### Longitudinal concepts

Persistent athlete understanding over time. Primary job: *developmental intelligence and coaching memory.*

| Concept | Examples in MatMind |
|---|---|
| Recurring patterns | Summary patterns, team focus buckets (derived) |
| Strategic identity | Summary hero identity, recognized skills |
| Coach observations | Private check-ins, coach notes history |
| Athlete evolution | Weekly History, progression arcs |
| Interpretation history | Match breakdown overlays, future voice-note memory |
| Recurring tendencies | What Matters Next, AI draft payload themes |
| Voice-note memory | Future premium coaching artifact (doctrine) |

**Longitudinal surfaces emphasize:** pattern recognition, memory, trajectory — not overwritten by one weekly message.

### Rolling / derived concepts (neither purely weekly nor immutable)

| Concept | Treatment |
|---|---|
| Suggested focus | Advisory until coach accepts into weekly row |
| Attention level | Coach Dashboard triage signal |
| Alignment / trend | Summary-derived proof interpretation |
| Last competition context line | Lightweight weekly support, not full archive |

### Which concepts should psychologically lead the screen

**Longitudinal interpretation leads. Weekly direction follows. Parent reinforcement closes the loop.**

```txt
LONGITUDINAL (memory, identity, standing guidance)
        ↓
WEEKLY OPERATIONAL (how it's going, check-ins)
        ↓
WEEKLY DIRECTION (mission preview, edit link)
        ↓
PARENT REINFORCEMENT (preview, status, publish)
```

Weekly concepts should feel *current and actionable*. Longitudinal concepts should feel *stable and accumulative*. The screen fails its job when weekly publish UI visually dominates before the coach has re-grounded in development memory.

---

## SECTION 5 — WHAT DOES NOT BELONG

### Intentionally hidden substrates

The following render blocks are **visually hidden** in the current `KidDetailScreen` tree but remain **lifecycle-active**:

| Hidden block | Backing substrate still active |
|---|---|
| "This week in action" | Training session data, narrative derivation, training proof |
| Competition archive/cards | Competitions state, load/reconcile, merge, overlay projection |
| Top Roster · Household | Household draft (bottom utility remains visible) |

### Why these remain hidden

| Hidden content | Why it does not belong on this screen |
|---|---|
| Raw training logs | Proof browsing belongs in **Training**. Coach detail should interpret, not replicate session archives. |
| Competition archive/cards | Event/match proof belongs in **Compete**. Summary owns aggregate competition snapshot. |
| Operational overload | Team triage, full metrics, and multi-surface duplication create dashboard chaos and dilute interpretation. |

### Where those truths already live

| Truth type | Canonical surface |
|---|---|
| Training proof & patterns | Training, Summary (`SummaryWeekCard`, `SummaryPatternsCard`) |
| Competition proof & match narrative | Compete (`CompetitionCard`, `MatchCard`, medal archive) |
| Aggregate competition metrics | Summary (`SummaryCompetitionCard`) |
| Team attention & class focus | Coach Dashboard |
| Family consumption & acknowledgement | Parent This Week, Family Huddle |

### KidDetailScreen focus

# meaning and guidance

NOT:

# raw proof browsing

### Hidden ≠ Deleted

Substrates remain active. The detail screen may still:
- load training and competition data for narrative derivation
- feed suggested focus from recent competitions
- support family huddle source mapping
- preserve reconcile/refresh orchestration in `load()`

**No future surface simplification should assume hidden UI equals dead lifecycle.** Deletion requires a separate lifecycle audit per `docs/coaching-payload-semantics-audit.md` §8.

---

## SECTION 6 — LONGITUDINAL INTELLIGENCE ALIGNMENT

### Platform direction

MatMind is evolving into a **longitudinal coaching intelligence platform** (`docs/canonical-coaching-workflow.md`). The governing loop:

```txt
Training → Competition → Coach Interpretation → Weekly Direction
    → Parent Reinforcement → Longitudinal Development → Identity Synthesis
```

`KidDetailScreen` sits at the **Coach Interpretation → Weekly Direction → Parent Reinforcement** junction.

### How this screen supports future intelligence

| Future capability | Screen role |
|---|---|
| Longitudinal coaching intelligence | Anchor for standing guidance + check-in memory before weekly action |
| Recurring interpretation | Entry to What Matters Next, History, future match-breakdown themes |
| Athlete development memory | Private check-ins accumulate; weekly rows historicize |
| Progression understanding | Review suggested focus and last-competition context without opening Compete |
| Recurring themes | What Matters Next holds steady coach framing across weeks |
| Future voice-note memory | Coach-only lane is the natural review home for captured tone/emphasis |
| Premium coaching intelligence | Interpretation-first layout prepares for intelligence feed without turning into analytics dashboard |

### Why "What Matters Next" is strategically important

What Matters Next is MatMind's **standing coach cognition artifact**:

| Property | Strategic value |
|---|---|
| Longitudinal, not weekly | Survives week boundaries; holds developmental through-line |
| Coach-owned, not parent-published | Preserves full interpretive complexity on coach side |
| AI-assistable, not AI-owned | Drafts from kid-scoped data; coach must apply and save |
| Interpretation before simplification | Captures what the coach believes matters before it is reduced for family delivery |

It is the on-screen embodiment of **accumulated coaching understanding** — the premium opposite of "more charts."

Without a visible longitudinal anchor, the screen collapses into weekly publishing utility. What Matters Next prevents that collapse.

### Parent simplification boundary

Parents receive coach-interpreted simplification (weekly direction, huddle, acknowledgement). They do not receive full tactical interpretation or longitudinal diagnostic complexity. The detail screen's COACH ONLY vs FAMILY / PUBLISH lane split encodes this boundary.

---

## SECTION 7 — IMPLEMENTATION GUARDRAILS

Future implementation on or around `KidDetailScreen` must respect these constraints.

### Semantic guardrails

| Rule | Rationale |
|---|---|
| No semantic duplication | One concept, one authoritative owner. Do not re-render Compete cards or Training logs as "coaching content." |
| Author once, render intentionally | Weekly row authored on edit surface; published snapshot consumed by This Week / Huddle; Summary derives synthesis. |
| Review vs authoring separation | Detail screen reviews; edit routes author. Bounded inline exceptions only where listed in §3. |
| Weekly vs longitudinal separation | Do not fold standing guidance into weekly publish payload. Do not treat check-in history as family message. |
| Coach interpretation before parent reinforcement | Stage order in §2 is a product invariant. |
| No proof duplication from Summary/Compete | Lightweight context lines are acceptable; full proof browsing is not. |
| AI is advisory until coach persists | Suggestions, drafts, and derived copy must not present as canonical coach truth. |

### Protected systems (do not casually mutate)

Per `docs/coaching-payload-semantics-audit.md` and `docs/coach-surface-responsibility-map.md`:

- `load()` orchestration in `KidDetailScreen.tsx`
- Coach weekly sync publish/hydrate paths
- Parent feedback publish/cache paths
- Training proof persistence and publication
- Competition lifecycle, topology, overlay lineage
- Freshness arbitration and projection pipelines
- Navigation return flows after save/delete
- Hidden render substrates (training, competition, household)

### Safe vs high-risk change zones

| Usually safe (with inspection) | High-risk (architecture review required) |
|---|---|
| Labels and section headings | `load()` and publish paths |
| Visual grouping and card density | Weekly payload mapper semantics |
| Show/hide render blocks (substrate intact) | Competition reconcile/merge in detail screen |
| Vocabulary alignment (no payload field change) | Parent feedback cache arbitration |
| Stage reordering in UI only | Deleting "hidden" state/handlers |

### Calm operational design invariant

The screen should reduce coach decision fatigue:
- One primary action per stage
- Status signals over raw data
- Links to deep surfaces over inline duplication
- Quiet utilities at the bottom

---

## SECTION 8 — RESEARCH FINDINGS

Read-only product research across apps known for calm performance UX, progression feeling, coach interpretation, and review-first workflows. **We are studying product psychology and workflow clarity — not copying visuals.**

### Research scope

| App | Primary study lens |
|---|---|
| Runkeeper | Calm utility, reinforcement rhythm, post-activity reflection |
| Strava | Activity memory vs interpretation gap |
| WHOOP | Biometric interpretation, daily outlook, quiet when nothing to do |
| Oura | Daily insight themes, longitudinal trends, personal baseline |
| TrainingPeaks | Coach-athlete async review, season reflection, proof + comment loop |
| Hudl | Video interpretation, individual development plans, review cadence |
| Notion | Progressive disclosure, weekly review archives, minimalist dashboards |
| Linear | Opinionated workflow, cycles, progressive disclosure, calm density |
| Superhuman | Review-first triage, split inbox, closure rituals |
| Nike Run Club | Audio coaching tone, adaptive weekly plans, guided reinforcement |

---

### Strongest patterns observed (cross-app)

| Pattern | Description | Example sources |
|---|---|---|
| **Proof ≠ interpretation** | Successful products separate raw activity capture from coached meaning. | Strava (logs) vs TrainingPeaks (coach comments); MatMind analog: Training/Compete vs Coach Detail |
| **One primary daily theme** | Best calm apps surface a single interpretive headline, not a dashboard. | Oura Readiness insight; WHOOP Daily Outlook |
| **Staged disclosure** | Depth is available but not default. | Notion properties; Linear command palette; Hudl layout modules |
| **Review cadence rituals** | Weekly/monthly/seasonal review structures beat always-on analytics. | TrainingPeaks season review; Notion weekly review DB |
| **Quiet when unnecessary** | Premium calm includes silence. | WHOOP: "When nothing warrants action, WHOOP stays quiet" |
| **Opinionated default workflow** | Flexible chaos scales poorly. | Linear Method: one good default way |
| **Closure feedback** | Completing a review feels finished, not endless. | Superhuman Inbox Zero; Runkeeper goal confetti |

---

### Strongest progression-feeling patterns

| Pattern | What creates "development over time" |
|---|---|
| Rolling baselines vs single snapshots | Oura 14-day balance metrics compared to 2-month personal norm |
| CTL/ATL/TSB fatigue modeling | TrainingPeaks PMC tells a story across weeks/months |
| Season reflection documents | TrainingPeaks end-of-season athlete review with goals comparison |
| Journey / narrative framing | Runkeeper UX research: journey tab over leaderboard for emotional progression |
| Cumulative distance / consistency slopes | Strava ecosystem dashboards: rolling averages smooth noise into trajectory |
| Individual development plans | Hudl Lens: named development priorities with quarterly review rhythm |

**Insight:** Progression feeling comes from **comparative memory** (you vs your past self), not from more KPI tiles.

---

### Strongest calm-review patterns

| Pattern | Mechanism |
|---|---|
| Split inbox / split lanes | Superhuman: VIP lane processed first; chaos separated from priority |
| Today tab with timely cards only | Oura: "Each day will look different… most timely and relevant" |
| Keyboard/command efficiency | Linear, Superhuman: reduce friction for repeat reviewers |
| Atmospheric minimalism | Superhuman: low clutter, progressive disclosure, calm completion state |
| Configurable audio/chat cadence | Runkeeper: reduce default cue chatter; user controls reinforcement frequency |
| Flexible workspace layouts | Hudl: resize/hide modules so review focus stays on film, not chrome |

---

### Strongest longitudinal-memory patterns

| Pattern | Mechanism |
|---|---|
| My Memory / persistent context | WHOOP Coach stores goals, constraints, lifestyle context across interactions |
| Behavior ↔ outcome correlation | WHOOP Journal links habits to physiological response over time |
| Searchable review archive | TrainingPeaks templates + Notion weekly review DB: past reviews remain retrievable |
| Standing guidance separate from daily plan | TrainingPeaks ATP goals vs daily workout comments |
| Voice/tone preservation | Hudl voiceover feedback; Runkeeper guided audio coaching |
| Match/event interpretation layered on proof | Hudl playlists with coach annotations — proof stays, meaning is additive |

---

### Strongest coach/guide patterns

| Pattern | Mechanism |
|---|---|
| Coach in your ear (bounded session) | Nike Run Club Guided Runs; Runkeeper guided workouts |
| Adaptive plan without shame | NRC: "Miss a session and the plan catches up instead of marking you as behind" |
| Prompted athlete comments | TrainingPeaks: "How did this go?" templates when athlete is uncertain |
| Proactive check-ins at life moments | WHOOP: travel, stress, routine change triggers |
| Player-driven development | Hudl: athlete-owned clip playlists with coach scaffolding |
| Post-activity reflection | Runkeeper: "How did this run feel?" with follow-up care suggestions |

---

### Strongest "premium understanding" patterns

| Pattern | Why it feels premium |
|---|---|
| Personalized baseline, not population average | Oura, WHOOP: insights relative to *your* norm |
| Interpretation with provenance | WHOOP: biometric data + performance science, not generic tips |
| Human tone with restraint | WHOOP Coach personality work; NRC Coach Bennett warmth without corporate feel |
| Accumulated context | WHOOP My Memory; "Every interaction builds on the last" |
| Season-level coach partnership | TrainingPeaks season review as mutual accountability |
| Calm completion rituals | Superhuman Inbox Zero imagery; Runkeeper goal celebration |

---

### Runkeeper — what it does WELL (special focus)

Runkeeper is instructive for MatMind because it is deliberately **quiet, utility-first, and reinforcement-oriented** rather than social-analytics heavy.

| Runkeeper strength | Product psychology | MatMind inspiration |
|---|---|---|
| **No-frills tracking** | Does not compete with Strava on social feed; stays focused on the athlete's own journey | Coach detail should not compete with Summary/Compete on proof display |
| **Goals with gentle nudges** | Monthly distance goals + push reminders create rhythm without dashboard noise | Weekly direction + parent acknowledgement as a gentle reinforcement loop |
| **Post-activity feeling check** | "How did this run feel?" invites reflection beyond pace/distance | Coach check-ins and sparring application as human interpretation atop proof |
| **Follow-up care after reflection** | Bad run → stretching suggestion; good run → schedule next run | Parent reinforcement: translate coach interpretation into supportive next step |
| **Journey over leaderboard** | UX research advocates replacing friends/leaderboard with personal journey framing | Longitudinal What Matters Next + History over competition medal browsing on coach detail |
| **Guided audio coaching** | Coach in the ear during activity, not a stats wall after | Family Huddle as guided read-together flow; coach preview before publish |
| **Configurable cue density** | Users reduce chatty audio cues — calm is configurable | Coach detail should not surface every advisory suggestion at full volume |
| **Training plans with clear weekly structure** | 5K plan: "gentle build up, clear weekly structure" | Weekly focus as one clear mission; longitudinal memory separate |

**Runkeeper parent-side inspiration:** Simple weekly direction, emotional reinforcement, low cognitive load — not tactical depth.

**Runkeeper coach-side inspiration:** Quick operational check-in after activity, interpretation prompts, calm utility — not archive browsing.

---

### Anti-patterns observed (dashboard chaos sources)

| Anti-pattern | Where seen | Lesson for MatMind |
|---|---|---|
| Social feed dominance | Strava | Proof + social distracts from interpretation |
| Bubble chart without intensity story | Strava Training Log critiques | Volume metrics without meaning feel hollow |
| Feature sprawl in one dropdown | Strava training tools consolidation requests | Multiple competing "focus" surfaces confuse |
| Everything editable inline | Generic dashboards | Authoring + review + admin in one scroll = fatigue |
| Hidden power features | Notion (if never discovered) | Longitudinal tools must be findable, just not dominant |
| Metrics without coach voice | Raw CTL charts alone | TrainingPeaks still pairs data with coach comments |

---

## SECTION 9 — MATMIND ALIGNMENT

For each major research finding: alignment assessment for MatMind's Coach Athlete Review workflow.

### Alignment matrix

| Finding | Aligns with MatMind | Does NOT align | Dashboard chaos risk | Supports longitudinal intelligence | Supports calm operational review |
|---|---|---|---|---|---|
| Proof ≠ interpretation separation | **Yes** — core doctrine | — | Removing separation would chaos | **Yes** — interpretation layer is the product | **Yes** — coach reviews meaning, not logs |
| One primary daily/weekly theme | **Yes** — weekly mission | Competing "focus" labels across surfaces | Multiple headline concepts on one screen | Partial — weekly only unless What Matters Next leads | **Yes** |
| Longitudinal baseline memory | **Yes** — What Matters Next, check-ins | Pure weekly-publish screen identity | — | **Yes** — primary future premium vector | **Yes** — reduces re-derivation each visit |
| Staged workflow (6 stages §2) | **Yes** — matches coach cognition | Current FAMILY-before-COACH render order | Flat scroll of all lanes | **Yes** when interpretation leads | **Yes** |
| Review-first, author-on-demand | **Yes** — weekly focus edit delegation | Inline full payload authoring on detail | Inline authoring overload | Neutral | **Yes** |
| Parent reinforcement loop | **Yes** — acknowledgement + huddle | Parent-facing tactical depth | Parent status + publish + edit in one card stack | No — weekly by design | **Yes** when separated from interpretation |
| AI advisory with human ownership | **Yes** — explicit in What Matters Next / suggestions | AI as canonical coach voice | AI suggestion cards competing with standing guidance | **Yes** if drafts feed longitudinal memory | **Yes** if sparse and labeled |
| Quiet when nothing to do | **Aspirational** — WHOOP pattern | Showing empty proof sections | Hidden substrates ≠ show empty UI | Neutral | **Yes** — don't surface noise |
| Season/weekly review archive | **Yes** — History route | Re-implementing History inline on detail | Full history log on main screen | **Yes** | **Yes** — link, don't dump |
| Guided family reflection | **Yes** — Family Huddle / Read Together | — | Preview + publish + huddle source map redundancy | Weekly reinforcement only | **Yes** |
| Individual development plan rhythm | **Yes** — Hudl Lens analog via What Matters Next | Full IDP form on detail screen | — | **Yes** | **Yes** |
| Split lane visual language | **Yes** — COACH ONLY vs FAMILY / PUBLISH | — | Low if lanes match stage order | **Yes** — encodes ownership | **Yes** |
| Social/competition trophy browsing | Partial — parent Compete | Coach detail competition archive | **High** — hidden for good reason | Low on detail screen | Low |
| CTL/TSB-style analytics | Partial — Summary alignment | Raw charts on coach detail | **High** | Derived only | Low on detail |
| Superhuman split-inbox triage | Partial — Coach Dashboard attention groups | Full triage on athlete detail | Medium if team signals leak in | Low | **Yes** on dashboard, not detail |
| Nike adaptive plan forgiveness | **Yes** — parent tone | Shame-based "behind on plan" UX | — | Neutral | **Yes** |
| Runkeeper feeling check | **Yes** — sparring + check-ins | Emoji gamification without meaning | Low | **Yes** — accumulates | **Yes** |
| Voice-note memory (future) | **Yes** — doctrine fit | Treating as media attachment only | Low if coach-only | **Yes** — high premium value | **Yes** — review, don't auto-publish |
| Notion progressive disclosure | **Yes** — utilities collapsed, History linked | Burying What Matters Next | Low if interpretation stays visible | Neutral | **Yes** |
| Linear opinionated workflow | **Yes** — canonical 6-stage cognition | Per-coach infinite customization | Flexibility → chaos | Neutral | **Yes** |

---

### Natural MatMind synthesis (research → doctrine)

The research supports a Coach Athlete Detail that behaves like:

1. **WHOOP/Oura daily outlook** — one interpretive grounding (What Matters Next) before action  
2. **TrainingPeaks coach comment loop** — quick operational check-in atop proof that lives elsewhere  
3. **Hudl interpretation layer** — coach meaning additive to canonical proof (match breakdown doctrine)  
4. **Runkeeper calm reinforcement** — weekly direction + feeling/check-in without social noise  
5. **Superhuman split lanes** — coach-private vs family-publish mentally separated  
6. **Notion/Linear disclosure** — deep authoring and archives one navigation away  
7. **NRC guided tone** — family huddle as supportive read-through, not tactical dump  

### What MatMind should resist (even if competitors do it)

| Temptation | Why resist on KidDetailScreen |
|---|---|
| Full training calendar | Training tab owns proof |
| Competition card grid | Compete owns proof; Summary owns snapshot |
| Real-time analytics dashboard | Summary + Coach Dashboard own derived signals |
| AI-generated weekly mission without coach save | Violates AI boundary |
| Parent-visible standing guidance | Violates simplification boundary |
| Inline everything authoring | Violates review-first doctrine |

---

## GOVERNANCE SUMMARY

`KidDetailScreen` is the **coach interpretation and weekly oversight workspace** for one athlete. Its canonical job:

```txt
Remember (longitudinal) → Assess (operational) → Review (weekly)
    → Confirm (family) → Dispatch (publish) → Maintain (utilities)
```

It is not a training archive, competition browser, statistics dashboard, or family publishing app.

It is where coach meaning is formed, reviewed, and selectively delivered — while proof substrates remain active elsewhere under the rule:

# Hidden ≠ Deleted

Future surface work should clarify this workflow in language and hierarchy before any further visual consolidation — without touching protected lifecycle, hydration, overlay, or `load()` orchestration.

---

*Document version: 2026-06-08 · Read-only governance · No implementation authorized by this document alone.*
