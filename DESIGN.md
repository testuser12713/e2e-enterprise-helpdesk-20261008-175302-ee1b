# Design — Project Identity

> This document is project-long-lived. Tokens are not changed without
> the Architect's approval. Developers MUST use these tokens
> instead of improvising their own colors/spacings.

## Style Direction

Calm, dense enterprise console in the spirit of Linear/Stripe: light neutral canvas, a single indigo accent reserved for primary actions and focus, color used only as information (priority, status, overdue) — tables and typographic hierarchy carry the interface, no decoration.

## Colors

- `--color-bg`: **#F7F8FA**
- `--color-surface`: **#FFFFFF**
- `--color-surface-alt`: **#F2F4F7**
- `--color-fg`: **#1A1D21**
- `--color-fg-muted`: **#5C6470**
- `--color-fg-subtle`: **#98A2B3**
- `--color-border`: **#E4E7EC**
- `--color-border-strong`: **#D0D5DD**
- `--color-accent`: **#2F5BEA**
- `--color-accent-hover`: **#2749C7**
- `--color-accent-active`: **#1F3AA8**
- `--color-accent-subtle`: **#EEF2FF**
- `--color-accent-fg`: **#FFFFFF**
- `--color-success`: **#067647**
- `--color-success-bg`: **#ECFDF3**
- `--color-success-border`: **#ABEFC6**
- `--color-warning`: **#B54708**
- `--color-warning-bg`: **#FFFAEB**
- `--color-warning-border`: **#FEDF89**
- `--color-danger`: **#B42318**
- `--color-danger-bg`: **#FEF3F2**
- `--color-danger-border`: **#FECDCA**
- `--color-info`: **#175CD3**
- `--color-info-bg`: **#EFF8FF**
- `--color-info-border`: **#B2DDFF**
- `--color-neutral-badge-bg`: **#F2F4F7**
- `--color-neutral-badge-fg`: **#475467**
- `--color-priority-critical-bg`: **#FEF3F2**
- `--color-priority-critical-fg`: **#B42318**
- `--color-priority-high-bg`: **#FFFAEB**
- `--color-priority-high-fg`: **#B54708**
- `--color-priority-medium-bg`: **#EFF8FF**
- `--color-priority-medium-fg`: **#175CD3**
- `--color-priority-low-bg`: **#F2F4F7**
- `--color-priority-low-fg`: **#475467**
- `--color-overdue-bg`: **#FEF3F2**
- `--color-overdue-fg`: **#B42318**
- `--color-overdue-row-bg`: **#FFFBFB**
- `--color-focus-ring`: **#2F5BEA**

## Typography

- `font_family`: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif
- `font_mono`: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace
- `heading_weight`: 600
- `body_weight`: 400
- `weight_medium`: 500
- `weight_semibold`: 600
- `size-xs`: 12px
- `size-sm`: 13px
- `size-base`: 14px
- `size-md`: 16px
- `size-lg`: 20px
- `size-xl`: 24px
- `size-2xl`: 30px
- `line-height-tight`: 1.25
- `line-height-base`: 1.5
- `letter-spacing-heading`: -0.01em
- `numeric`: tabular-nums for all IDs, counts, dates and metric figures

## Spacing Scale

- `--space-0`: 4px
- `--space-1`: 8px
- `--space-2`: 12px
- `--space-3`: 16px
- `--space-4`: 24px
- `--space-5`: 32px
- `--space-6`: 48px

## Border-Radii

- `--radius-sm`: 4px
- `--radius-md`: 8px
- `--radius-lg`: 12px
- `--radius-pill`: 999px

## Components

### Button

Base: height 40px desktop / 44px on touch layouts (min tap target 44x44px), padding 0 16px, radius md (8px), font size 14px/weight 500, gap 8px for optional icon (16px), single line, no wrap. Variants: primary bg=accent/fg=#FFFFFF; secondary bg=surface, border 1px border-strong, fg=fg; ghost bg=transparent, fg=fg-muted, hover bg=surface-alt; danger bg=#FFFFFF with border 1px danger-border and fg=danger, hover bg=danger-bg (used for 'Deaktivieren', 'Abmelden' is ghost). States for every variant: default; hover (primary -> accent-hover, secondary -> surface-alt, ghost -> surface-alt); active/pressed (primary -> accent-active, plus 1px downward shift, no scale transform); focus-visible (2px outline focus-ring with 2px offset, never removed); disabled (opacity 0.5, cursor not-allowed, no hover change — every disabled action must carry a tooltip/reason, e.g. 'Nur Agenten und Administratoren dürfen zuweisen'); loading (spinner replaces leading icon, label unchanged, button stays disabled). Button group in forms right-aligned: primary last, ghost/secondary first, 8px gap.

### StatusBadge

Inline pill: radius pill, padding 2px 10px, font size 12px/weight 500, border 1px. Mapping for ticket status: offen = info (bg info-bg, fg info, border info-border); in Bearbeitung = warning (warning-bg/warning/warning-border); geschlossen = neutral (neutral-badge-bg/neutral-badge-fg, border border) — closed tickets are additionally rendered with muted text (fg-muted) throughout list and detail. Always include the German label text ('offen', 'in Bearbeitung', 'geschlossen'); color alone never carries meaning.

### PriorityBadge

Same pill geometry as StatusBadge. Mapping: kritisch = priority-critical (with a filled 6px dot in fg color before the label), hoch = priority-high, mittel = priority-medium, niedrig = priority-low. Labels exactly: 'kritisch', 'hoch', 'mittel', 'niedrig'. Sorted order in all filters and lists: kritisch > hoch > mittel > niedrig.

### OverdueBadge

Pill, bg=overdue-bg, fg=overdue-fg, border 1px danger-border, prefix icon exclamation (12px), label 'überfällig'. Complemented in tables by: 2px left border in danger on the row, row background overdue-row-bg, and the due-date cell in danger color with weight 500. Rules: shown only for status offen/in Bearbeitung with due date in the past; never on closed tickets (mirrors AC-06); text must never be the only signal — icon + border + background always accompany it.

### MetricCard

Dashboard card: bg=surface, border 1px border, radius lg (12px), padding 20px, min-height 112px. Layout: label (12px, uppercase, letter-spacing 0.04em, fg-muted) above value (30px/weight 600, tabular-nums), optional sub-line 13px fg-subtle. Variant for 'überfällig' uses danger value color and danger-border; 'heute geschlossen' uses success value color. The priority-distribution card instead renders four labelled horizontal bars (label + badge + count + bar, bar height 8px, radius pill, width proportional to count, colors from the priority palette) — no chart library, pure CSS.

### DataTable

Container bg=surface, border 1px border, radius lg, overflow hidden; header row bg=surface-alt, height 44px, cells 12px uppercase fg-muted weight 500, padding 0 16px; body rows height 48px, 14px, padding 0 16px, border-bottom 1px border (last row none). Row hover bg=#FAFBFC, cursor pointer (row opens detail), focus-visible outline inset. Sortable headers: clickable button inside the th, active sort shows arrow caret (12px) and header text in fg; only one active sort column. Every column grows/shrinks with ellipsis + title attribute; the title column is the flexible one (min 240px). Horizontal scroll inside the container below 960px, first column sticky. Empty state (filter combination without hits, AC-09): centred block inside the table area, 48px padding, icon 32px fg-subtle, heading 16px/600 'Keine Tickets gefunden', body 14px fg-muted 'Für die aktuellen Filter gibt es keine Treffer.', secondary button 'Filter zurücksetzen' — never a bare empty surface.

### TableToolbar

Above the table: search input (flex, min 240px, magnifier icon, placeholder 'Titel oder Beschreibung suchen', debounce 300ms) + filter selects (Status, Priorität, Zuständigkeit) each 160-200px + view actions right-aligned ('CSV exportieren' secondary button, disabled with tooltip while the result set is empty). Wrap to a second line under 1100px; on mobile collapse filters into a 'Filter' button opening a sheet. Active filters render as removable chips below the toolbar with a 'Alle zurücksetzen' link; the result count is shown as 'X Tickets' (tabular-nums, fg-muted) so list metrics always match the active filter (AC-09/AC-10).

### Input / Textarea / Select

Field wrapper: label above (13px/weight 500, fg, margin-bottom 6px), control below, helper text 12px fg-muted, error text 12px danger. Control: height 40px (44px touch), padding 0 12px, radius md, bg=surface, border 1px border-strong, font 14px, transition 120ms. States: default; hover border #B9C0CA; focus border=accent + 2px focus-ring outline (accent at 30% via box-shadow); disabled bg=surface-alt, fg-subtle, not-allowed; error border=danger + 1px, error text below, aria-invalid and aria-describedby set. Textarea min-height 96px, resize vertical. Select keeps a native chevron and 12px right padding. Validation timing (AC-14): a pristine field is neutral — no border, no icon, no message; validation shows only after blur (touched) or after the form is submitted, then updates live while typing. Submit of an invalid form focuses the first invalid field and renders a form-level error summary in the danger alert. Placeholder never replaces a label. Server 422 field errors are mapped to the same field-level rendering with the German message from the API.

### AppShell & Navigation

Fixed left sidebar 240px, bg=surface, border-right 1px border, full viewport height, sticky; product name at top (16px/600), nav items 40px high, radius md, padding 0 12px, 14px/500 fg-muted, icon 18px, active item bg=accent-subtle + fg=accent + 2px left accent indicator, hover bg=surface-alt. Items: Dashboard ('/'), Tickets, Benutzerverwaltung (Administrator only — not rendered, not merely disabled, for Melder/Agent). Bottom block: current user name, role badge, 'Abmelden' ghost button. Content area: max-width 1280px, centred, padding 24px 32px, page header (24px/600 title + optional description 14px fg-muted + right-aligned page actions) with 24px bottom margin, then 24px between blocks. Mobile < 900px: sidebar becomes a top bar with hamburger opening a full-height drawer; content padding 16px. Every reachable route (Dashboard, Tickets, Benutzerverwaltung) is present in the nav for its role, and the nav highlights the active route (AC-18).

### PageHeader / Section

Page header: h1 24px/600 with -0.01em letter-spacing, optional one-line description 14px fg-muted (max 72ch), primary action button right-aligned on the same row (wraps below under 720px). Sections inside a page: white card (bg=surface, border 1px border, radius lg, padding 24px) with a 16px/600 section title and 16px gap to content. Consecutive cards separated by 24px. No page ever shows more than one primary button.

### Alert / Toast

Action feedback (AC-17): after create/update/close/assign/reset, a toast appears top-right, 24px from viewport edges, width 360px, bg=surface, border 1px, radius md, padding 12px 16px, icon 16px + message 14px; success variant border success-border/icon success, error variant border danger-border/icon danger; auto-dismiss 5s, hover pauses, close button always present, role=status/alert. Inline form-level errors use a full-width alert block above the form (bg danger-bg, border danger-border, fg danger, radius md, padding 12px 16px) instead of a toast. All user-facing texts are German and describe the next step, never a raw error code.

### EmptyState / LoadingState

Empty state: 48px vertical padding, 32px icon fg-subtle, heading 16px/600, one line of 14px fg-muted explanation, single optional action button. Used for empty ticket list, empty comment history ('Noch keine Kommentare — schreiben Sie den ersten.'), empty user list and empty audit log. Loading: skeleton rows (3-5) in table shape with a 1.5s shimmer between surface-alt and border, never a bare spinner on a full page; buttons show an inline spinner while a request runs.

### CommentTimeline

Chronological ascending list in the detail page's right column (36% width on desktop, stacked below the ticket data on mobile). Entry: 12px gap between entries, avatar circle 32px (bg=accent-subtle, initials 12px/600 accent), header line 'Author name · 15.05.2024, 14:32' (author 13px/600 fg, timestamp 12px fg-muted tabular-nums), body 14px fg, 1.5 line-height, max 72ch. New entries must be appended to the end of the list immediately after submit and the composer cleared and refocused; newest entry gets no special colour, the list simply ends with it (AC-08). Composer fixed at the bottom of the column: textarea + primary 'Kommentar abschreiben' button, disabled while empty, error shown inline, never a modal.

### AuditLogList

Detail-page section labelled 'Änderungsprotokoll' (AC-12). Vertical list, each entry a row of: timestamp (13px fg-muted tabular-nums, 150px fixed column), actor name (13px/500 fg), and the change as 'Feld: alt → neu' where old value is rendered 13px fg-subtle with line-through and new value 13px fg with weight 500; assignment events read 'Zuständigkeit: — → Name'. Field labels are the German field names (Status, Priorität, Kategorie, Zuständigkeit, Zuweisung). Reverse-chronological, 11px vertical padding, 1px border between entries, collapsible to the last 5 entries with 'Alle N Einträge anzeigen'.

### Pagination

Below the table, right-aligned on desktop / centred on mobile: 'Zeige 21–40 von 137' (13px fg-muted tabular-nums), then page-size select (10/25/50), then previous/next icon buttons with 44px tap targets, disabled at the bounds. Page numbers rendered as small ghost buttons with the current page in accent-subtle + accent. Pagination keeps search, filters and sort in the URL query so a filtered list is shareable and survives reload.

### ConfirmDialog

Modal for destructive or state-changing confirmations (deactivate user, close ticket): overlay rgba(26,29,33,0.45), panel max-width 440px, bg=surface, radius lg, padding 24px, title 20px/600, body 14px fg-muted, footer with ghost 'Abbrechen' and primary/danger confirm button, 8px gap right-aligned. Focus trapped inside, Escape and overlay click cancel, initial focus on the cancel button, role=dialog aria-modal. Never used for plain form submission or comments.

### UserTable (Administrator)

Same DataTable tokens, columns Name, E-Mail, Rolle, Status (badge active/inactive), Letzte Anmeldung. Row actions: role select (Melder/Agent/Administrator) and a danger 'Deaktivieren' button; deactivated rows get fg-muted text and a neutral 'deaktiviert' badge, and their role select is disabled (AC-11). 'Benutzer anlegen' is the page's single primary action, opening a focused form card or dialog with Name, E-Mail, Rolle, initial password; validation identical to the login/registration pattern.

## Layout Principles

- Container: app content max-width 1280px, centred, horizontal padding 32px desktop / 24px tablet / 16px mobile; sidebar fixed 240px (72px collapsed), content 24px below the sticky page header.
- Breakpoints: 640px (mobile, single column, tables scroll horizontally, sidebar becomes a drawer), 900px (tablet, two-column detail view stacks), 1200px (desktop, 4-up dashboard grid and side-by-side table filters), 1440px+ (content stays at 1280px, extra space is margin).
- Grid: dashboard metrics use CSS grid 4 columns at >=1200px, 2 at >=640px, 1 below; ticket detail is 64/36 split (data left, comments right) at >=1024px, stacked below; forms are single column with max 640px content width and a right-aligned action row.
- Vertical rhythm: 32px between page sections, 24px between cards, 16px between a label/input pair and the next field, 8px between an inline icon and its text. Card padding 24px (16px on mobile). No other spacing values than the token scale.
- Tables are the primary instrument: left-aligned text columns, right-aligned or tabular-nums for counts and dates, never truncate the title column, sortable headers always show the active direction, and every table has a toolbar above and pagination below.
- ONE date and time format for the whole product: local time as 'TT.MM.JJJJ, HH:MM' (e.g. '15.05.2024, 14:32'), used for created-at, due date, closing time, comment and audit timestamps. Date-only contexts (CSV values, exported columns) keep the same order without the time: 'TT.MM.JJJJ'. Never show ISO strings or English month names in the UI; the API's UTC ISO 8601 stays internal.
- ONE duration format: overdue and age are shown relative and short — 'überfällig seit 3 Std.', 'überfällig seit 2 Tagen', 'vor 12 Min.'; under one hour use 'Min.', under one day 'Std.', then 'Tagen'. Priority deadlines in help texts use the fixed spelled-out form 'kritisch 4 Stunden, hoch 1 Tag, mittel 3 Tage, niedrig 7 Tage'.
- ONE number format: counts and IDs as integers with '.' as the thousands separator (e.g. '1.240'), always tabular-nums so columns align; a count of zero is shown as '0', never as an empty cell or a dash.
- Role-driven UI: Melder/Agent/Administrator see exactly the nav entries and actions their role permits, and a forbidden action is either not rendered or rendered visibly disabled with a German tooltip reason — never a silently dead button (AC-15). Destructive actions always require a ConfirmDialog.
- Colour discipline: greys and white carry the layout, accent appears only on primary actions, active nav, focus rings and links, and semantic colour appears only inside badges, alerts and overdue markers. Text contrast is at least 4.5:1 (fg on bg, accent-fg on accent); every state that uses colour also carries a label or icon.
