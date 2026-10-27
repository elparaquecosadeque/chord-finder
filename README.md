# Chord Generator

Angular app for entering guitar chord names, rendering chord diagrams, choosing alternate positions, and exporting the visible diagrams as one PNG.

Repository: https://github.com/elparaquecosadeque/chord-finder

Contributions are welcome. This project was built with AI assistance under supervision from the repository owner.

## npm package

The reusable Angular component is published as [@gblp/chord-finder](https://www.npmjs.com/package/@gblp/chord-finder).

```bash
npm install @gblp/chord-finder
```

## Use The App

1. Type chords separated by commas, or name song sections: `intro: A, Bm; chorus: C, D`.
2. Use sharps or flats, for example `C, F#, C#m, Bb, Am7`.
3. If a chord has multiple positions, choose one from the position selector.
4. Click `Exportar PNG` to download the currently visible chord diagrams as one image.

## Run Locally

```bash
npm install
npm start
```

Open `http://localhost:4200/`.

## Build

```bash
npm run build
```

GitHub Pages build:

```bash
npm run build:gh-pages
```

The static app is generated in `dist/demo-chord-finder/browser`.

## Code Map

- `projects/chord-finder/` - the publishable library (`@gblp/chord-finder`).
  - `src/lib/chord-finder.ts` / `.html` / `.scss` - main component: input, sections mode, quality catalog, PNG export.
  - `src/lib/services/chord.service.ts` - parses chord input and reads chord data from `@gblp/chords-db`.
  - `src/lib/services/favorite-qualities.service.ts` - favorite qualities persisted in localStorage.
  - `src/lib/chord-difficulty.ts` - fingering-difficulty score used to sort qualities.
  - `src/lib/components/chord-diagram/` - SVG chord diagram.
  - `src/lib/components/result-card/` - one result card (diagram + position selector).
  - `src/lib/models/chord.model.ts` - TypeScript shapes for chord data and search results.
- `src/` - demo app that consumes the library.
- `.github/workflows/` - GitHub Pages deploy, npm publish, GitHub release.

## Deploy

Push to `master`. GitHub Actions builds the app with `/chord-finder/` as the base href and publishes the browser output to GitHub Pages.
