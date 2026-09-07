---
label: feature
status: closed
parent: 0043
depends_on: []
blocks: []
---

# 0047 — Catalog expansion: Olympic variations + CrossFit staples

## Context

The typical-exercises catalog shipped in 0043 with 23 entries, scoped as a "starter MVP". The user pointed out four common barbell movements that are not in the list, and a quick survey of the gaps shows that the Olympic lifting family is under-represented and CrossFit staples are missing entirely:

- **Push Press**, **Push Jerk**, **Squat Clean**, **Clean and Jerk** — flagged by the user
- **Split Jerk**, **Snatch**, **Hang Clean**, **Strict Press**, **Thruster** — related gaps in the same families

These are the movements any CrossFit or strength coach programs weekly. Leaving them out forces the coach to type the name manually every time (which is exactly the friction the catalog was created to remove). The catalog is a static list in code (intentionally not editable, per 0043's scope), so the only way to close the gap is to add the entries.

## Goal

Expand the catalog from 23 to 32 entries, adding the four movements the user named plus five related ones in the same families. No behavior changes; no new categories; no storage work.

## User stories

1. As a CrossFit coach, when I type "Push" in the calculator's exercise datalist, I see "Push Press" as a suggestion, not just "Power Clean".
2. As a CrossFit coach, when I record a clean and jerk, the datalist offers "Clean and Jerk" as a one-click option.
3. As a coach programming Olympic lifting, I get the full family in the suggestions: Power Clean, Squat Clean, Hang Clean, Clean and Jerk, Power Snatch, Snatch, Push Jerk, Split Jerk.

## Solution

One ticket, one file changed (`src/lib/calculator/typical-exercises.ts`) plus its test. The new entries are added in the right places inside each category, preserving the file's existing logical grouping.

### New entries (9 total)

**Push family — add 1:**
- `Thruster` (push) — front squat + push press, the CrossFit staple compound

**Overhead family — add 2:**
- `Push Press` (overhead) — overhead press with leg drive
- `Strict Press` (overhead) — overhead press without leg drive (the "pure" press)

**Olympic family — add 6:**
- `Push Jerk` (olympic) — overhead with full leg drive + re-bend of knees
- `Split Jerk` (olympic) — the standard competition jerk (the one in the Olympics)
- `Squat Clean` (olympic) — clean caught in a full squat (vs Power Clean, caught above parallel)
- `Hang Clean` (olympic) — clean from the hang position
- `Clean and Jerk` (olympic) — the complete Olympic lift
- `Snatch` (olympic) — the full snatch (separate from Power Snatch, which is already there)

### Final catalog (32 entries)

Squat (4): Back Squat, Front Squat, Bulgarian Split Squat, Lunge
Hinge (5): Conventional Deadlift, Sumo Deadlift, Romanian Deadlift, Hip Thrust, Good Morning
Push (6): Bench Press, Incline Bench Press, Decline Bench Press, Dip, Dumbbell Bench Press, **Thruster**
Pull (4): Barbell Row, Pendlay Row, Pull-up, Lat Pulldown
Overhead (3): Overhead Press, **Push Press**, **Strict Press**
Olympic (8): Power Clean, **Squat Clean**, **Hang Clean**, **Clean and Jerk**, Power Snatch, **Snatch**, **Push Jerk**, **Split Jerk**
Accessory (2): Barbell Curl, Barbell Shrug

### Test update

- Existing `length >= 20` assertion stays valid (now 32).
- The "no duplicate names" invariant still holds.
- The "no Spanish accent characters" check still holds (all new entries are English).
- The "six most common movements" AC test is extended to eight, with `Push Press` and `Clean and Jerk` added so the test exercises the new entries.
- `findTypicalByName` and `mergeTypicalAndHistory` helpers need no changes — they're name-agnostic and the new entries flow through automatically.

## Out of scope

- **Editable catalog** (per 0043's design decision). The catalog is still a static code-defined list. The user already accepted this trade-off in 0043 and the issue scope did not change.
- **Kettlebell, dumbbell, or bodyweight movements** (KB Swing, Wall Ball, Box Jump, Push-up, Pistol Squat, etc.). The catalog feeds the calculator's datalist, which is a kg/lb weight calculator. CrossFit staples that aren't weighted don't belong here; they belong to the modality side (CrossFit session generation), not the calculator.
- **Paused / tempo / deficit variations** (Pause Squat, Tempo Deadlift, Deficit Deadlift, Snatch Grip RDL, etc.). Real and common, but each is a variation-of-a-variation. If the user wants them, a follow-up ticket adds them; the catalog is now at 32 and adding more starts to bloat the datalist.
- **Renaming or restructuring categories**. The `category` field stays a coarse label; no grouping is surfaced in the UI yet (per 0043's "out of scope: per-category grouping in UI").
- **Updating the chip row** (favorites). The chip row is coach-personal, not the catalog.

## Acceptance

- [ ] `TYPICAL_EXERCISES` has 32 entries (was 23)
- [ ] All 9 new entries are present: `Thruster`, `Push Press`, `Strict Press`, `Push Jerk`, `Split Jerk`, `Squat Clean`, `Hang Clean`, `Clean and Jerk`, `Snatch`
- [ ] No duplicate names (case-insensitive) — preserved
- [ ] No Spanish accent characters in any name — preserved (all English)
- [ ] The "six required by AC" test now covers eight, including `Push Press` and `Clean and Jerk` (the new entries the user explicitly named)
- [ ] `findTypicalByName` and `mergeTypicalAndHistory` work for the new entries (sanity-checked by the existing helper tests, which exercise the helpers generically)
- [ ] `npm run lint` verde, `npm run build` verde, `npm test -- --coverage` verde
- [ ] Coverage on `typical-exercises.ts` stays at 100/100/100/100

## Implementation decisions

- **Order of the new entries inside each category** — placed in a sensible "easier → harder" sequence within their family. Overhead: Overhead Press → Push Press → Strict Press (the "pure" press is the most demanding). Olympic: Power Clean → Squat Clean → Hang Clean → Clean and Jerk → Power Snatch → Snatch → Push Jerk → Split Jerk (the receiving positions and bar paths graduate; the two "complete" lifts come last because they are the most demanding).
- **No new category** — `Thruster` is `push` (the dominant pattern is the press; the front squat is a re-bounce). `Snatch` and `Power Snatch` both stay `olympic`; `Snatch` is just the full version. `Push Jerk` and `Split Jerk` are `olympic` because they're competition lifts.
- **English-only** — DESIGN.md and the 0044 decision are English-only. No Spanish alias, no "Sentadilla" alongside. The catalog stores one canonical English name per entry.
- **No test for each new entry individually** — the existing test (extended to 8 required names) is enough. The data is a static array; testing every entry would be redundant. The duplicate / accent / length invariants are the only structural checks that matter.

## Further notes

- **Relationship to 0043**: this is a follow-up that closes the gap the 0043 starter MVP left. Same shape (static catalog, code-defined) and same scope (feeds the datalist). The chip row (favorites) is unchanged.
- **Relationship to 0044** (favorites): orthogonal. The user can star any of the new entries from the form just like the existing ones; no favorites work is needed.
- **Relationship to the form's polish passes (0045, 0046)**: unrelated. The form's chips and inputs don't know about the catalog's contents; expanding the catalog is invisible to the form's logic and tests.
