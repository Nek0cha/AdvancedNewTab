# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Chrome (MV3) extension, built with [WXT](https://wxt.dev/), that replaces the new-tab page with a
dashboard of freely-arrangeable widgets (clock, search, links, memo, top sites, bookmarks, weather,
RSS, a YouTube/YouTube Music mini player). See `README.md` for the user-facing feature list.

## Commands

```bash
npm install       # also runs `wxt prepare` (postinstall) to generate .wxt/ types
npm run dev        # dev server with HMR, loads as unpacked extension
npm run dev:firefox
npm run build      # production build -> .output/chrome-mv3
npm run build:firefox
npm run compile    # tsc --noEmit — run this after any change, it's the fastest correctness check
npm run zip        # production build + zip -> .output/*.zip (what gets distributed via GitHub Releases)
npm run zip:firefox
```

There is no test suite and no lint script configured. `npm run compile` (strict TypeScript, see
`tsconfig.json` — `strict: true`, `noUncheckedIndexedAccess: true`) is the primary safety net; treat a
clean `tsc --noEmit` as a required gate before considering a change done.

To manually verify a change end-to-end: `npm run build`, then load `.output/chrome-mv3` as an unpacked
extension via `chrome://extensions` (developer mode → "Load unpacked"). Chrome does **not** hot-reload
an already-open new-tab page or an already-loaded extension after files change on disk — after rebuilding,
click the reload icon on the extension card in `chrome://extensions` and close/reopen any new-tab pages.

## Architecture

### Entry points (`entrypoints/`)

- `newtab/` — the dashboard itself (`chrome_url_overrides.newtab`, auto-wired by WXT from the directory name).
- `options/` — settings page (JSON export/import; most per-widget/theme editing actually happens in the
  newtab side panel, not here). `open_in_tab: true` is set via a `<meta name="manifest.open_in_tab">` tag
  in `entrypoints/options/index.html`, **not** `wxt.config.ts`'s `manifest.options_ui` — WXT detects the
  `options` entrypoint and regenerates `manifest.options_ui` from that entrypoint's own meta tags,
  silently discarding whatever `wxt.config.ts` sets there (confirmed by reading
  `node_modules/wxt/dist/core/utils/manifest.mjs`). Any other WXT-generated manifest field with a
  per-entrypoint equivalent likely has the same trap.
- `background.ts` — RSS pre-fetch on an alarm, an `openOptionsPage` toolbar-click handler, and the
  YouTube-media message relay (see below).
- `youtube-media.content.ts` — content script for `youtube.com` / `music.youtube.com`, registered at
  **runtime**, not in the manifest (see "Permissions model" below).

`wxt.config.ts` also disables Vite's automatic `modulePreload` (`vite: () => ({ build: { modulePreload:
false } })`): the default `<link rel="modulepreload" crossorigin>` hints for chunks shared between
newtab/options (e.g. a lucide-react icon module) trigger Chrome's "cross-world extension resource
mismatch" console warning on `chrome-extension://` pages. The chunk still loads correctly via the normal
`<script type="module">` import graph either way — only the (harmless but noisy) preload hint is lost.

### Widget plugin system (`widgets/`)

The whole point of this codebase's extensibility is `widgets/types.ts`'s `WidgetDef<S>` contract. Adding
a widget is "one file in `widgets/<name>/index.tsx` + one line in `widgets/registry.ts`" — the add-widget
dialog, the settings form, and permission requests are all derived from the `WidgetDef` declaration, with
no per-widget UI code required elsewhere:

- `defaultSettings` / `settingsSchema`: the settings panel is entirely schema-driven. A widget declares a
  flat array of `FieldSchema` entries (`text`, `number`, `toggle`, `select`, `color`, `icon`, `imageList`,
  `list`) and `components/Field/Field.tsx` renders the whole form generically, writing changes back
  through `patchWidgetSettings`. Do not hand-write settings JSX for a widget — add schema entries instead.
  `imageList` (`components/Field/ImageListField.tsx`) holds `string[]` of data URLs and is the multi-image
  upload picker (`widgets/image`); it deliberately does *not* use the File System Access API to reference
  a live folder — re-requesting folder permission every session/reload is worse UX than just uploading the
  files once, so images are copied in as data URLs the same way the background-image picker works.
- `permissions.chrome` / `permissions.hosts`: declarative permission requirements, resolved through
  `lib/permissions.ts` and requested via `chrome.permissions.request()` **only when the widget is added**
  (see below) — never add anything to `wxt.config.ts`'s required `permissions` for a single widget's sake.
- `frame: 'bare'` vs `'card'`: `'bare'` is for widgets that shouldn't look like they're in a card (clock,
  search); everything else defaults to `'card'`.
- `widgets/registry.ts` holds the `Map<type, WidgetDef>`; `type` is persisted in storage, so it's not
  safe to rename after release.

`FieldSchema(kind: 'list')` supports an optional `presets` array (see `widgets/links/index.tsx` /
`lib/link-presets.ts`) that turns the "add" button into a popover offering "blank item" + a list of
pre-filled presets (used for the links widget's known-site shortcuts, icons sourced from Iconify's
simple-icons, CC0), and an optional `maxItems` that hides the add button once reached (`widgets/worldclock`
caps at 4 cities this way — there's no per-field conditional visibility in the schema, so a widget that
needs two mutually-exclusive input shapes for two modes, like `widgets/countdown`'s detailed vs.
date-only, just declares both fields and each mode's `Component` branch reads only the one it needs).

### List field drag-and-drop (`components/Field/Field.tsx`)

`FieldSchema(kind: 'list')` items (links, world-clock cities) are reordered by dragging the whole card —
not a separate handle — and render collapsed by default, showing only an icon+title summary derived from
the first `icon`- and `text`-kind entries in `itemFields`. A few details are load-bearing:

- Click vs. drag is disambiguated by a 5px pointer-movement threshold (`pendingRef`), not by a dedicated
  drag handle: `pointerdown` on the card just starts tracking, and a plain click (no movement past the
  threshold) never calls `setDrag`, so the collapse toggle and delete button keep working normally. Text
  selection is suppressed with both `e.preventDefault()` and CSS `user-select: none`; native form controls
  are excluded via `target.closest('input, textarea, select')` so typing/selecting inside an expanded
  item's own fields is unaffected.
- The dragged card is **not** spliced out and live-reordered in the DOM. Only that card gets a
  `transform: translateY(...)` (vertical-only — translateX is never set, so the card can't drift
  sideways) computed from the pointer's Y delta; every other card stays exactly where it started, and a
  separate `.dropIndicator` line shows where it would land. The array is only actually reordered once, on
  drop. This was chosen over a live-splicing preview specifically to avoid measuring/animating sibling
  cards of unequal height (collapsed vs. expanded items differ a lot).
- `computeOverIndex` returns a position in the array *with the dragged item already removed* — exactly
  what `array.splice(overIndex, 0, moved)` expects right after `array.splice(from, 1)`. Treating it as an
  index into the original (not-yet-shortened) array is the natural mistake and lands drops one slot off
  whenever the drag crosses more than one neighbor.
- The collapsed/expanded state is a positional `Set<number>` (list items have no stable id), so any
  reorder or delete must transform it in lockstep (`moveOpen`/`removeOpen`) or the wrong card ends up
  looking expanded after a drag.
- Commits happen only on `pointerup`, never on every `pointermove` — same rationale as the store's
  rev-guard below (writing on every move would spam `chrome.storage.local` and risk the same race class).

### State and persistence (`lib/store.ts`, `lib/storage.ts`, `lib/defaults.ts`)

Single Zustand store (`useAppStore`) holding one `PersistedState` blob: `{ version, rev, theme, layouts,
widgets }`. All mutations go through `commit()` inside `store.ts`, which synchronously updates the store,
re-applies the theme to the DOM, and queues a **debounced** (400ms) write to `chrome.storage.local` via
`lib/storage.ts`. Cross-tab changes (e.g. the options page importing JSON) are picked up through
`chrome.storage.onChanged`.

The self-write guard is a monotonically increasing `rev` counter (`commit()` always writes
`highestLocalRev + 1`), not a "does this match the last thing I wrote" string comparison. An earlier
version compared the incoming `chrome.storage.onChanged` payload against a single remembered
`lastSerialized` string, which broke under a real (not simulated) race: `chrome.storage.onChanged` fires
asynchronously, so committing twice in quick succession (two clicks within ~1s — including two
keystrokes in a text field, since every keystroke is its own commit) could let a **stale** echo of the
first write arrive *after* the second commit had already moved `lastSerialized` forward, matching neither
and getting misread as an "external" change that reverts the newer edit. This was the actual cause of the
long-standing "buttons/tabs/typed text flash back to a moment ago" reports — timing-dependent, so it never
reproduced in quick manual testing and looked fixed after unrelated React-key fixes, only to resurface.
Comparing `external.rev <= highestLocalRev` instead is immune to arrival order: a stale echo's `rev` is
never higher than what's already applied locally, no matter how late it arrives.

`chrome.storage.sync` is deliberately not used (100KB/8KB quota won't fit a background-image data URL);
cross-device transfer goes through JSON export/import on the options page instead.

Schema migrations live in `lib/storage.ts`'s `migrateRaw()`, keyed off `SCHEMA_VERSION` in
`lib/defaults.ts`. **Do the shape conversion on the raw/untyped object before the generic
`normalize()` merge runs** — `normalize()` does a shallow merge against defaults, so a field whose
*shape* changed (not just added) must already be converted before it gets there, or the old shape will
silently pass through merged with new defaults.

A fresh install's very first state is `createDefaultState()` (hardcoded in `lib/defaults.ts`), *unless*
`lib/default-state.json` is non-`null` — that file (default `null`) is meant to be replaced wholesale with
a real `PersistedState` exported from the options page's JSON download, and `loadState()` only consults it
when storage is completely empty (never on top of an existing install). It's routed through the same
`normalize()` used for imports, so a stale schema in it self-heals the same way an old exported JSON
would. `createDefaultState()` itself stays untouched by this feature — `normalize()` still falls back to
it as the last resort when stored/imported data is unreadable, so it has to remain a known-good literal
independent of whatever `default-state.json` contains.

### First-paint (FOUC) handling

`public/boot.js` is a plain (non-module, non-TypeScript) script loaded synchronously in
`entrypoints/newtab/index.html`'s `<head>`, before the React bundle. It reads a small mirror of the
theme (background + text color) from `localStorage` — synchronous, unlike `chrome.storage.local` — and
paints it onto `<html>` immediately, avoiding a white flash on a dark theme. `lib/theme.ts`'s
`applyTheme()` keeps that `localStorage` mirror (`BOOT_THEME_KEY`) in sync on every theme change. If you
touch either file, keep the key name and value shape in sync between them — there's no type sharing across
the MV3-CSP boundary that forces `boot.js` to stay plain JS.

### Theming (`lib/theme.ts`, `lib/theme-schema.ts`)

Theme values are pushed to the DOM exclusively as CSS custom properties (`--ant-*`) on `<html>`;
components consume `var(--ant-*)`, never the `ThemeConfig` object directly. `BackgroundConfig` holds
**all three** background modes (`solid` / `gradient` / `image`) simultaneously with an `active` selector,
specifically so that switching tabs in the background editor doesn't discard what you'd entered for the
other modes.

### Grid (`components/Grid/Grid.tsx`, `lib/grid-collision.ts`)

This is the most fragile part of the codebase — read it before touching drag/resize behavior.

Uses `react-grid-layout` v2 (hooks-based rewrite, not the v1 API). Several v2.2.4 bugs are worked around
deliberately, and un-doing any of these workarounds silently reintroduces the original bug:

- `compactor` is **always** a `type: null` compactor (`noCompactor`-derived). Passing `verticalCompactor`
  while the component is mounted breaks dragging entirely.
- `compactor.allowOverlap` must be `true` (`dragCompactor = { ...noCompactor, allowOverlap: true }` in
  Grid.tsx), even though this app never actually wants persisted overlaps. With `allowOverlap: false`,
  react-grid-layout's own `onDrag` handler calls its internal `moveElement()` on *every pointermove*
  during a drag and — because `compactType === null` — swaps positions with whatever it's currently
  hovering, live, using a drag-path-dependent algorithm that has nothing to do with `resolveOverlaps`
  below. That live swap is what actually drives the on-screen position of every *other* widget during
  the drag (react-grid-layout renders from its own internal `layout` state, not from this app's store).
  The mismatch between that live preview and `resolveOverlaps`'s result at drop caused the "push down /
  revert" behavior to visibly snap to a different layout at the exact moment of release — the
  "不安定"/inconsistent feeling was real, not a misperception. Setting `allowOverlap: true` makes
  `moveElement` a no-op for every widget except the one being dragged (it returns the layout unchanged on
  any collision instead of pushing/swapping), so nothing else moves until drop, and `resolveOverlaps`
  becomes the *only* thing that ever repositions other widgets. Verified by dispatching real
  `mousedown`/`mousemove`/`mouseup` sequences and reading each item's `style.transform` mid-drag: other
  widgets now stay pixel-identical for the entire gesture, even while heavily overlapped, and only settle
  on `mouseup`.
- The page height is intentionally capped at exactly one viewport (`maxRows` in Grid.tsx, derived from
  `window.innerHeight`, no scrolling multiplier). react-grid-layout clamps drag/resize coordinates to
  `[0, maxRows - h]` on its own (`gridBounds` constraint, `node_modules/react-grid-layout`'s
  `calcGridItemPosition`), so this single number is enough to stop widgets from being dragged or resized
  past the bottom of the screen — no separate "forbid" logic needed. The one thing that constraint does
  **not** cover is `resolveOverlaps`'s own cascade: pushing a widget below another can still walk the
  pushed widget's `y` past `maxRows`. `resolveOverlaps` takes an optional `maxRows` argument and, *after*
  the push/revert cascade has fully converged (never mid-cascade — clamping mid-loop breaks the
  "only ever push down" invariant and can leave items un-pushed), clamps every item's `y` back down to
  `maxRows - h` in one final pass. In pathological cases (too many/tall widgets for the space) this can
  leave residual overlap rather than growing the page — treated as the acceptable tradeoff over letting
  the page silently grow past one screen again.
- The library's own `onLayoutChange` fires repeatedly *after* drag/resize stop with its stale,
  library-internal (unresolved) layout, and if wired to a save path it clobbers a just-computed correct
  result. `onLayoutChange` is intentionally not used for persistence; only `onDragStop`/`onResizeStop` save.
- Overlap resolution is entirely custom (`lib/grid-collision.ts`'s `resolveOverlaps`), not the library's
  compaction: on drop, every widget except the one just moved/resized is reset to its position from the
  *start* of that drag gesture, then only the widgets actually overlapping the moved one get pushed
  directly below it. This is what gives "drop onto another widget → it moves down minimally" and "drag
  back off it within the same gesture → it snaps back" — the revert only works within one continuous
  drag gesture, not retroactively across separate ones (same as Notion/Trello-style dashboards).
  `floatUp()` (a "pack upward" pass) exists but is **not** wired into the auto-commit path anymore — it
  actively undid `resolveOverlaps`'s result when it was.
- react-grid-layout's own array ordering is not stable across renders; layouts are always
  `canonicalOrder()`-sorted by `.i` before being compared/saved, otherwise a reorder-only "change" was
  causing an infinite `setLayouts` → re-render → `onLayoutChange` loop (React error #185).
- Even when the resolved layout is byte-identical to what's already stored, `setLayouts` must still be
  called (never skip on a no-op resolve) — react-grid-layout's own internal visual state can be out of
  sync with the store in that case, and skipping the call leaves stale drag-time positions on screen
  while storage is actually correct.
- `dragConfig.bounded: true` is unusable in this version (breaks dragging outright); horizontal
  containment is done in CSS (`overflow-x: clip`) instead.

### Custom form controls (`components/Dropdown`, `components/ColorPicker`, `components/NumberStepper`, `components/Field/AddWithPresets`)

Native `<select>` / `<input type="color">` / number-spinner UI is replaced everywhere for cross-OS visual
consistency. `Dropdown` and `AddWithPresets` render their open menu into `document.body` via
`createPortal` — **not** a styling choice, a requirement: an ancestor `SidePanel` uses `backdrop-filter`,
and per spec that makes it the containing block for `position: fixed` descendants, so an un-portaled menu
gets positioned relative to the panel instead of the viewport. Both also filter their `scroll` listener
(capture-phase, used to close-on-outside-scroll) to ignore scroll events whose target is inside the
menu itself, otherwise scrolling a long menu closes it. If you add another portal-based popover, follow
the same two patterns.

### Icons (`lib/icon-value.ts`, `components/IconValueDisplay`)

`IconValue` is a tagged union (`default` / `lucide` / `image` / `svg` / `url`) used both by the link
list's per-item icon picker and the preset library. User-supplied SVG markup (`source: 'svg'`) is never
rendered via `dangerouslySetInnerHTML` — it's converted to a `data:image/svg+xml` URI and rendered through
a plain `<img>`, so embedded `<script>`/event handlers can't execute. This has one consequence to keep in
mind: an `<img>` is an opaque replaced element, so page CSS (including `currentColor`) cannot reach inside
it. Bulk-recoloring SVG icons (`widgets/links`' `svgIconColor` setting) is therefore done by string-
replacing `currentColor` in the SVG source itself before building the data URI
(`lib/icon-value.ts`'s `tintSvgCode`), not via CSS. The same constraint applies to icons rendered in the
always-dark UI chrome regardless of the user's theme (preset popovers, `Field.tsx`'s collapsed list-item
summary) — `DARK_UI_ICON_TINT` in `lib/icon-value.ts` is the one shared fixed tint for that context, kept
separate from the user's theme text color on purpose.

### Fonts (`lib/fonts.ts`, `lib/fonts.css`, `public/fonts/`)

Latin webfonts (Space Grotesk, IBM Plex Sans, JetBrains Mono) are self-hosted (`public/fonts/`,
`lib/fonts.css`'s `@font-face` rules with `unicode-range`-scoped `latin`/`latin-ext` subsets only — no
runtime CDN fetch, keeps CSP simple and works offline). CJK glyphs are **not** bundled (Noto Sans JP's
full character set is hundreds of small chunks and would bloat the extension); Japanese text always falls
through to the OS's own Japanese font via the fallback stack baked into every `FontOption` in
`lib/fonts.ts`. When adding a font option, always include that CJK fallback in the stack.

### Permissions model

`wxt.config.ts`'s required `permissions` is deliberately minimal (`storage`, `unlimitedStorage`,
`favicon`, `alarms`, `scripting`) so installing the extension triggers no scary prompt. Everything else —
`topSites`, `bookmarks`, `history`, `sessions`, and all host access (`optional_host_permissions:
['https://*/*']`) — is `optional_*` and requested through `lib/permissions.ts`'s
`requestWidgetPermissions()` only when a widget needing it is actually added
(`components/AddWidgetList/AddWidgetList.tsx`). `chrome.permissions.request()` only works inside the
synchronous call stack of a user gesture — call it directly from the click handler, before any `await`.

The YouTube-media content script follows the same principle at the manifest level:
`entrypoints/youtube-media.content.ts` uses `registration: 'runtime'` with **no `matches` field** —
WXT adds a runtime-registered script's `matches` straight to the manifest's `host_permissions` (required)
if you set one, defeating the whole "nothing until requested" design. Instead `matches` is supplied at
call time to `browser.scripting.registerContentScripts()` in `lib/media-registration.ts`, invoked from
`background.ts` once the optional host permission for `youtube.com`/`music.youtube.com` is actually
granted (`browser.permissions.onAdded`) and again on every background-script startup (dynamic
registrations don't reliably survive an extension reload).

`ensureYoutubeMediaContentScript()` always unregisters before registering, rather than checking
`getRegisteredContentScripts()` first — the check-then-act version raced against itself when both
triggers fired close together (e.g. startup coinciding with a permission grant for a *different* widget,
since `permissions.onAdded` fires for any permission), throwing "Duplicate script ID" and leaving the
content script unregistered for the rest of that browser session (nothing retried it, so the YouTube
widget just stayed empty until the extension was reloaded). Registration is now also retried with backoff
(`RETRY_DELAYS_MS`), since the `scripting` API can be unavailable in the first moments after an MV3
service worker cold-starts.

### YouTube/YouTube Music mini player relay (`lib/media-relay.ts`, `lib/media-store.ts`, `lib/media-registration.ts`)

Three-party message relay, since the newtab page can't see into another tab directly:
`youtube-media.content.ts` polls `navigator.mediaSession.metadata` + the page's `<video>` element once a
second and `sendMessage`s a `MediaState` (or `null`) to the background on change → `background.ts`
aggregates per-tab state in a `MediaStore` (prefers a currently-playing tab, else most-recently-updated)
and broadcasts the winner to all extension pages → the widget listens for that broadcast and also
requests the current value once on mount (`ant/media-get`). Controls flow the other way:
widget → background → `chrome.tabs.sendMessage(tabId, ...)` → content script performs the actual DOM
action (`video.play()/pause()` directly; site-specific button clicks for next/previous, `video.currentTime
= ...` for seek, since there's no universal API for those).

`MediaState` carries `currentTime`/`duration` (seconds) plus `capturedAt` (the content script's
`Date.now()` at read time). The widget doesn't just render `currentTime` as-is — since polling is only
1/s, that would make the seek bar visibly step once a second. Instead it interpolates
(`currentTime + (Date.now() - capturedAt) / 1000`) and re-renders every 250ms while playing
(`useDisplayedTime` in `widgets/youtube-media/index.tsx`), so the position appears to move continuously
between polls. The content script's own change-detection (`sendIfChanged`) compares a version of the
state with `capturedAt` zeroed and `currentTime` floored to whole seconds — comparing the raw state would
never dedupe (both fields change every single poll), spamming a message every second even while paused.

## Marketing site (`site/`)

A separate, mostly-static landing site — `terms/` and `privacy/` are directories (not `.html` files) so
they're reachable at extension-less `/terms` / `/privacy` URLs on static hosts, the same trick `site/app/`
(the `npm run build:web` output) already used. It has its own locked design system: read `site/design.md`
before touching any page under `site/`, and see `site/README.md` for how the pieces fit together.
`lib/site-links.ts` is the one place the extension itself (the appearance tab's "about" links) points out
to that site, independent of everything else under `site/`.

## Localization

All user-facing strings (UI copy, code comments) are Japanese. Match this in any new code — comments in
particular are written as prose explaining *why*, not *what*, and that convention is worth preserving
since several of the trickiest fixes in this codebase (see the Grid section above) are only safe to touch
because the reasoning is written down at the point of the workaround.
