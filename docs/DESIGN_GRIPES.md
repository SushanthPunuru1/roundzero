# Design gripes — input for the full design pass

Running list. Add a line whenever something looks wrong, however small, even
without a fix in mind. This file is the input to step 3 of the locked build
order (see `docs/ROADMAP.md`) — the point is that the design pass starts from
concrete observations rather than "make it look premium."

**Read before adding a typography gripe.** Switzer and IBM Plex Mono are not
self-hosted yet; the app currently renders system fallback stacks. Self-
hosting them is the first task of the design pass, not an entry here. Until
that lands, anything about letterforms, weight, rhythm or optical size is an
observation about the fallback and will likely evaporate. Gripes about which
*size token* is used (13px vs 12px) are still valid — those are class
choices, independent of the face.

Format: one bullet per gripe. Where it is, what's wrong, and — only if it's
obvious — what it should be. Severity tags optional: `[systemic]` for things
that repeat across screens, `[blocking]` for things that make a screen
unusable.

## Systemic — affects every screen

- `[systemic]` **One texture everywhere.** Nearly every surface is
  `rounded-md border-hairline bg-surface` at 14px. Dashboard rows, team
  cards, pillar rows, next-step rows and footer escape hatches are visually
  indistinguishable, so nothing on a screen reads as more important than
  anything else without adding an accent border by hand.
- `[systemic]` **Missing `packages/ui` primitives push screens to improvise.**
  Not yet built: `DataTable`, `Toast`, `Dialog`, `CommandPalette`.
  (`Checkbox` and `Select` were on this list and DO exist — 19 components
  ship today. Corrected 2026-08-27 by counting them rather than trusting
  the list.)
  Tables are hand-rolled per screen today. Every screen that improvises is a
  screen the design pass has to fix individually instead of once.
- `[systemic]` **Section-heading tier missing outside `/app`.** `SectionHeader`
  (20/28) now exists and the dashboard uses it, but other screens still use
  `<Eyebrow as="h2">` for section headings — an 11px caps label rendered
  *smaller* than the 14px support line beneath it, inverting the hierarchy.
  Audit every screen for this.
- `[systemic]` **Dense-data type size.** `DESIGN.md`'s scale specifies 13/20
  for tables and dense data, but several readouts use `text-xs` (12px, the
  caption size). `text-[13px]` is already established in five files; the
  usage is just inconsistent.
- `[systemic]` **Token alpha variants are undefined.** `border-accent/30` is
  used in two places. `DESIGN.md` defines no opacity variants of any token,
  so these are technically off-system. Either define the alphas or stop
  using them.
- `[systemic]` **Empty / loading / error states unaudited.** An open
  Milestone 4 roadmap item. The dashboard was done; no other screen has been
  checked.

## Dashboard (`/app`)

- The Windows and Networking pillar rows show 9 grey ticks and `0/9 lessons`
  while being fully clickable links styled identically to a populated row.
  A pillar you have not started looks the same as one you are working
  through.
- The Linux pillar row reads `No lessons yet` and links to `/app/lessons`
  anyway, which is a link to a page that will not show Linux content. Fixed
  once Linux lessons land, but the general "empty pillar is still a link"
  pattern needs a decision.
- Forensics row reads `No lessons yet · 100% quiz avg` — two facts that
  read oddly side by side.
- The Networking detail line (`0/9 lessons · 40% quiz avg · subnetting best
  20%`) is long enough to crowd the row at narrower widths.
- The drill step's reason renders a live count (`30 cards due`) as prose in
  a `text-sm` span, not in mono with `tabular-nums`. Minor, but it is a
  number that changes.

## Print surfaces

- `[blocking]` **The 'field datasheet' print identity is entirely unbuilt.**
  `DESIGN.md` and `DECISIONS.md` 013 specify warm light background, an
  assessment-record header with a record ID, and outlined chips for the
  checklist export and readiness PDF. Nothing implements it, and the
  checklist print/PDF export is load-bearing — teams use printed references
  during a round. Being built in step 1 of the locked order; this entry is
  the design-quality bar it has to clear, not a request to build it.

## Add yours below
