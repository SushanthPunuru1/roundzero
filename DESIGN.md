# RoundZero — Design System (binding)

## Direction

**Precision instrument.** Mission-control calm: data-dense, quiet, serious.
The aesthetic of an audit log and a flight console — not a hoodie. We are
deliberately the opposite of gamer-neon security sites (THM/HTB): restrained
surfaces, disciplined color, monospace as native material rather than
decoration. Two audiences shape every call: students who want it to feel
technical and real, and non-technical teacher-coaches who need it to feel
trustworthy enough to show a principal.

Dark-first. Print surfaces (checklist export, readiness PDF) use the
'field datasheet' identity: warm light, assessment-record header with
record ID, outlined chips — see DECISIONS.md 013 for reference.

## Color tokens

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#0B0D11` | App background (near-black, blue-leaning neutral) |
| `--surface` | `#12151A` | Cards, panels |
| `--surface-2` | `#171B21` | Raised/hover surfaces, table header |
| `--hairline` | `#232830` | Borders, dividers. Elevation = borders, not shadows |
| `--text` | `#E8EAF0` | Primary text |
| `--text-dim` | `#98A1AE` | Secondary text, labels, metadata |
| `--accent` | `#E8A33D` | Signal amber: brand, focus ring, primary actions, links |
| `--accent-hover` | `#F2B45A` | Hover state of accent elements |
| `--score` | `#3FB950` | **Scoring semantics only**: points gained, item found |
| `--penalty` | `#F85149` | **Scoring semantics only**: penalties, destructive confirm |

Hard rules: `--score` and `--penalty` never appear decoratively — no green
success toasts for "settings saved" (use accent/neutral), no red marketing
accents. When green appears, it means points. Contrast: all text/background
pairs meet WCAG AA; check any new pairing before use.

## Typography

- **UI / body:** Switzer (Fontshare, self-hosted, free license). Weights
  400 / 500 / 600 only.
- **Mono / data:** IBM Plex Mono (self-hosted). Commands, paths, scores,
  seeds, usernames, IDs, terminal, code — anything from the machine's world
  is set in mono. The mono carries the brand.
- Scale (px / line-height): 12/16 caption · 13/20 table & dense data ·
  14/22 base UI · 16/24 lesson body · 20/28 section title · 25/32 page
  title · 32/40 display (marketing only).
- `font-variant-numeric: tabular-nums` on every number that aligns or
  updates (scores, timers, counts, tables).
- Sentence case everywhere. No all-caps except tiny eyebrow labels
  (11px, tracked +0.06em, `--text-dim`).

## Space, radius, elevation

- 4px spacing grid: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64.
- Radius: 6px standard, 3px small (chips, inline keys). Nothing larger —
  no pills, no 16px consumer-app corners.
- Elevation via `--hairline` borders and surface steps. Shadows only on
  overlays (menus, dialogs, command palette): one shadow token,
  `0 8px 24px rgb(0 0 0 / 0.4)`.

## Motion

- One duration, one easing: 150ms `cubic-bezier(0.2, 0, 0, 1)` for all
  transitions (opacity, background, transform ≤ 4px).
- **The one expressive exception:** score changes. A score delta may
  count up over ~400ms with a brief `--score`/`--penalty` text flash. This
  is the only celebratory motion in the product.
- Respect `prefers-reduced-motion`: disable transforms and count-ups,
  keep instant state changes.

## Iconography

Lucide only. Sizes 16 and 20. `stroke-width: 1.75`. Icons always paired
with a label or an `aria-label`. No emoji anywhere in the UI.

## Signature component: ScoreLine

The one element this product is remembered by. It renders every scored
item everywhere it appears — live score feed, debrief, checklist
cross-reference, coach drill-down — with identical grammar:

```
[glyph] [±points, mono, tabular] [Category chip] Title of the item
        one-line "why" in --text-dim ......................... Lesson ->
```

States:
- **found** — solid check glyph, points in `--score`
- **missed** (debrief only) — hollow circle glyph, neutral points, row at
  full opacity (misses are the lesson, never de-emphasize them)
- **penalty** — alert glyph, negative points in `--penalty`
- penalty rows may carry a subtle `--penalty` background tint (~6%
  opacity); found/missed rows stay untinted
- score count-ups and charts are enhancement only: the final value and
  the event list must be the at-rest DOM state, correct with JS or
  motion disabled

Build it once in `packages/ui`, prop-driven, before any screen uses it.

## packages/ui v1 inventory

Button (primary / ghost / destructive) · Input, Select, Checkbox · Card ·
DataTable (13px, sticky header, tabular-nums) · Badge/Chip (category,
division, level) · ScoreLine · TerminalFrame (xterm.js wrapper shell —
visual shell only in Phase 1) · EmptyState (icon, one sentence, one action)
· Toast · Dialog · CommandPalette (⌘K) · PageHeader (title, eyebrow,
actions) · Skeleton.

Every screen composes from these. New primitive → add here, tokenized,
then use.

## Interface writing

Copy is design material. Name things by what people control ("Practice
schedule", not "Cron config"). Buttons say what happens: "Create team",
not "Submit" — and the name persists ("Create team" → toast "Team
created"). Errors state what went wrong and how to fix it; they never
apologize and are never vague. Empty states are invitations: "No labs run
yet — launch your first guided lab." Plain verbs, sentence case, zero
filler.

## Quality floor (non-negotiable, unannounced)

WCAG 2.1 AA contrast · fully keyboard-navigable with visible
`:focus-visible` rings (accent, 2px, offset 2px) · reduced motion
respected · touch targets ≥ 40px on mobile-readable pages · every async
surface has designed loading, empty, and error states before it ships.

## Screen craft checklist

Every user-facing screen must pass this before a session ends:

- **Frame present** — no content floats loose in the viewport; it sits
  inside the persistent app shell/container.
- **Hierarchy** — eyebrow / title / support line read in that order at a
  glance.
- **Density appropriate to the data** — dense tables stay dense (13px,
  tight padding); sparse screens get room to breathe. Neither crowds nor
  pads out the actual content.
- **n=1, n=7 (or similar mid-size), and empty states are all designed** —
  not just the happy-path screenshot. A list of one is a deliberate moment,
  not a table with one row.
- **Hover + focus states** — every interactive row/control has a visible
  hover surface step and a visible `:focus-visible` ring.
- **Numbers in mono with `tabular-nums`** — any value that can change or
  align.
- **No dead columns or placeholder voids** — an empty cell renders an em
  dash or is omitted, never blank space implying something is missing.

## Don't list

No new colors, fonts, radii, shadows, or durations outside this file ·
no gradients on text · no glassmorphism/blur cards · no emoji as icons ·
no centered-hero-with-gradient-headline marketing clichés · no purple ·
no acid-green-on-black hacker theming · no decorative use of `--score` /
`--penalty` · no animation without a reason · no lorem ipsum — design
with real content from `docs/spec.md` Appendix A.
