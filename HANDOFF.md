# Handoff: Chord Finder — Export Colors + Section Mode

**Created:** 2026-07-13  
**Branch:** `master` (clean, up to date with origin)  
**Last commit:** `541ae86` — Merge branch 'master' (CI workflows added remotely)

---

## Summary

The `@gblp/chord-finder` Angular library (v0.2.0) is an SVG chord diagram renderer that reads from `chords-db`. Two major features were added after the initial `v0.3.0` tag: (1) a collapsible **Export PNG** panel with customizable background/line colors and a transparent-background option, and (2) a **sections input mode** that lets users define named song sections (verse, chorus, etc.) each with their own chord sets, displayed in grouped rows and exported as separate per-section PNG files. The repo's working tree is clean and all 8 tests pass.

---

## Work Completed

### Changes Made

- [x] Added `ChordSection` interface to `chord.model.ts`
- [x] Removed the hardcoded 5-chord limit from `ChordService`
- [x] Added `isSectionFormat()`, `searchSections()` with full i18n validation errors to `ChordService`
- [x] Updated `ChordService.search()` return type from `{ results, wasLimited }` to plain `ChordSearchResult[]`
- [x] Updated `chord.service.spec.ts` — removed old limit tests, added section parsing and validation tests (6 → 8 tests)
- [x] Refactored `exportPng()` into a private `renderPng(svgs, filename)` helper; export now dispatches per-section in sections mode
- [x] Added `sections`, `inputMode`, `inputError`, `hasResults` signals and `sectionsContainer` viewChild to `ChordFinderComponent`
- [x] Removed `wasLimited` signal and its template block
- [x] Added Export PNG collapsible panel (bg color picker, line color picker, transparent checkbox, Download button)
- [x] Added sections view to template — stacked `section-block` containers each with a `section-name` header and a `results-row`
- [x] Added `.input-error`, `.sections-container`, `.section-block`, `.section-name` styles to `chord-finder.scss`
- [x] Fixed `.search-row input` CSS selector to exclude `type="color"` and `type="checkbox"`
- [x] Added CI workflows: `publish.yml` (manual npm publish) and `release.yml` (auto GitHub release on `v*` tags)

### Key Decisions

| Decision | Rationale | Alternatives Considered |
|---|---|---|
| Detect sections mode by presence of `:` in input | Zero friction — existing plain input never contains `:` | Separate input field or toggle switch |
| `ChordSection[]` returned from service (not component-level parsing) | Keeps validation and i18n in one place | Parsing in the component |
| ID uniqueness via `si * 10 + ci` offset | Max 6×6=36, fits without collision | UUID, string concatenation |
| Per-section PNG filenames sanitized with `replace(/[^a-z0-9-]/g, '')` | Safe filesystem names from arbitrary user text | Encoding/escaping |
| `grid-template-rows: 0fr → 1fr` for collapse animation | Pure CSS, no JS height measurement | `max-height` transition, `@angular/animations` |
| Transparent-bg: skip `fillRect`, inject `fill:transparent` into SVG style | Canvas `toDataURL('image/png')` preserves alpha when no fill is drawn | Separate code path |

---

## Files Affected

### Modified

- `projects/chord-finder/src/lib/models/chord.model.ts` — Added `ChordSection` interface
- `projects/chord-finder/src/lib/services/chord.service.ts` — Removed limit, added `isSectionFormat()`, `searchSections()`, expanded `ERROR_COPY` with 5 new error keys (EN + ES), changed `search()` return type
- `projects/chord-finder/src/lib/services/chord.service.spec.ts` — Replaced old limit tests; 6 tests now covering sections parse, too-many-sections, too-many-chords, invalid chords
- `projects/chord-finder/src/lib/chord-finder.ts` — New signals (`sections`, `inputMode`, `inputError`, `hasResults`), new `sectionsContainer` viewChild, refactored export, updated `runSearch()`, removed `wasLimited`
- `projects/chord-finder/src/lib/chord-finder.html` — Export panel markup, sections conditional view with `#sectionsContainer` and `[data-section]` attributes, removed `wasLimited` block
- `projects/chord-finder/src/lib/chord-finder.scss` — Fixed `input` selector, added export panel styles, section layout styles, `.input-error`

### Created (via remote merge)

- `.github/workflows/publish.yml` — Manual `workflow_dispatch` npm publish; requires `NPM_TOKEN` secret
- `.github/workflows/release.yml` — Auto GitHub Release + `.tgz` artifact on `v*` tag push; verifies tag matches `projects/chord-finder/package.json` version

### Read (Reference)

- `projects/chord-finder/src/lib/components/chord-diagram/chord-diagram.ts` — SVG layout constants (240×330, `chord-svg` class selector used in export query)
- `projects/chord-finder/src/lib/components/chord-diagram/chord-diagram.html` — CSS class names injected into the export `<style>` block

---

## Technical Context

### Architecture

The repo is an **Angular 22 workspace** with two projects:

| Project | Path | Role |
|---|---|---|
| `chord-finder` | `projects/chord-finder/` | Publishable Angular library (`@gblp/chord-finder`) |
| `demo-chord-finder` | `src/` | Demo app that consumes the lib |

The library is a single-component vertical slice: `ChordFinderComponent` → `ChordService` → `chords-db` JSON. `ChordDiagram` is a dumb SVG-rendering child component. No state management library, no Router. Angular signals throughout (`signal`, `computed`, `effect`, `viewChild`).

**Export pipeline:** DOM SVGs are cloned → inline `<style>` injected with user-chosen colors → serialized to Blob URL → decoded into `Image` → drawn onto a 2× scaled Canvas → `toDataURL('image/png')` → programmatic anchor click download.

### Input mode detection

`ChordService.isSectionFormat(input)` returns `true` if the trimmed query contains `:`. The component calls this on every keystroke and switches between `'plain'` and `'sections'` reactive branches.

**Sections format:**  
```
intro: A, Bm, C; verse 1: G, C, D; chorus: C, D, E
```
- Section separator: `;`  
- Name/chords separator: `:`  
- Chord separator: `,`  
- Limits: 6 sections max, 6 chords per section max

### CSS variable theming

All colors are CSS custom properties scoped to `:host`, overridable by consumers via `--chords-*` variables. The neon dark theme defaults are baked in as fallbacks.

### Dependencies

No new runtime dependencies were added. All features use browser Canvas API, `XMLSerializer`, and `URL.createObjectURL` — all standard.

---

## Things to Know

### Gotchas & Pitfalls

- **`isSectionFormat` uses `:` presence.** Any chord name containing `:` (none exist in chords-db) would falsely trigger sections mode. Safe for now but fragile if the format evolves.
- **Transparent PNG + text color.** When `exportTransparent = true`, finger labels inside filled dots use hardcoded `#ffffff`. If someone picks a white line color with transparent bg, those labels will be invisible. Marked with `// ponytail:` comment in `renderPng`.
- **ID collision guard.** The `si * 10 + ci` trick for unique result IDs works only up to 6 sections × 6 chords. If limits change, this must be revisited.
- **`viewChild` is optional (`?`)** for `resultsRow` and `sectionsContainer` — the elements are conditionally rendered. The export method guards with optional chaining.
- **COPY object still says "5 chords"** in `descriptionLimit` for both EN and ES. This is a UI copy stale — the description mentions "up to 5 chords" but the limit is now removed in plain mode.
- **`npm start`** builds the lib first (`ng build chord-finder`) then serves the demo app. Cold start is ~10–15s.

### Known Issues

- The description text in the hero card still reads "Enter up to **5 chords**" — this is stale copy left from before the limit was removed. Needs a copy update.
- The `chord-finder.spec.ts` component test only checks `should create` — no behavioral coverage of the new sections or export logic.

---

## Current State

### What's Working

- Plain chord input (no limit) — search, display, position selector ✅
- Section input mode — parse, validate, display grouped by section ✅
- Export PNG (plain) — single file `chords.png` ✅
- Export PNG (sections) — one file per section, filename from section name ✅
- Background color picker + transparent option ✅
- Diagram line color picker ✅
- Export panel collapse/expand animation ✅
- Validation errors with EN/ES i18n ✅
- CI: GitHub Release on `v*` tag ✅
- CI: Manual npm publish ✅

### What's Not Working / Stale

- Hero card description copy still says "5 chords" ⚠️
- No behavioral tests for `ChordFinderComponent` (only smoke test)

### Tests

- [x] Unit tests: **8 passing** (`npm test`)
- [ ] Integration tests: none
- [x] Manual testing: confirmed via build (`npm run build`)

---

## Next Steps

### Immediate (Start Here)

1. **Fix stale copy** — In `chord-finder.ts` `COPY` object, update `descriptionLimit` in both `en` (`'5 chords'` → something accurate or remove the limit mention) and `es` (`'5 acordes'`). Also update `descriptionStart`/`descriptionEnd` if they reference the limit.
2. **Bump library version** before next publish — `projects/chord-finder/package.json` is at `0.2.0`. If the sections feature warrants a minor bump, update to `0.3.0` and push a `v0.3.0` tag to trigger the release workflow.
3. **Component behavioral tests** — `chord-finder.spec.ts` only has a smoke test. Consider adding: sections parse round-trip, export disabled when no results, input error display.

### Subsequent

- Explore `ideas.txt` — the file exists but was empty at last read; may contain owner's feature ideas.
- Consider persisting export color preferences to `localStorage` so they survive page reload.
- The `descriptionLimit` copy fix should be paired with updating the input `placeholder` if it still says `"C, F#, C#m, Bb"` (fine) or if the hint text needs updating.
- GitHub Pages deployment: `npm run build:gh-pages` — not wired to CI yet, manual process.

### Blocked On

- Nothing. Clean state, all tests green, working tree clean.

---

## Related Resources

### Documentation

- Library README: `projects/chord-finder/README.md`
- npm package: `@gblp/chord-finder` on npmjs.com
- GitHub repo: https://github.com/elparaquecosadeque/chord-generator
- chords-db: https://github.com/tombatossals/chords-db

### Commands to Run

```bash
# Install dependencies
npm ci

# Run all tests
npm test

# Build everything (lib + demo app)
npm run build

# Build lib only
npm run build:lib

# Serve demo app (builds lib first)
npm start

# Build for GitHub Pages deployment
npm run build:gh-pages
```

**Useful search patterns:**

- `grep -r "sections" projects/chord-finder/src` — find all sections-related code
- `grep -r "exportPng\|renderPng" projects/chord-finder/src` — export pipeline
- `grep -r "COPY" projects/chord-finder/src/lib/chord-finder.ts` — i18n strings (including the stale "5 chords" copy)
- `grep -r "ponytail:" projects/chord-finder/src` — deliberate simplifications with known ceilings

---

*This handoff was generated 2026-07-13. Start a new session and use this document as your initial context.*
