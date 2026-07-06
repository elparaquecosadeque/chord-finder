# Chord Generator

Angular app for entering guitar chord names, rendering chord diagrams, choosing alternate positions, and exporting the visible diagrams as one PNG.

Repository: https://github.com/elparaquecosadeque/chord-generator

Contributions are welcome. This project was built with AI assistance under supervision from the repository owner.

## npm package

The reusable Angular component is published as [@gblp/chord-finder](https://www.npmjs.com/package/@gblp/chord-finder).

```bash
npm install @gblp/chord-finder
```

## Use The App

1. Type up to 5 chords separated by commas.
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

The static app is generated in `dist/neon-chord-finder/browser`.

## Code Map

- `src/app/app.ts` - root app state, chord search trigger, selected positions, PNG export.
- `src/app/app.html` - page layout, input, export button, result cards, footer.
- `src/app/app.scss` - page, form, cards, and footer styles.
- `src/app/services/chord.service.ts` - parses chord input and reads chord data from `@tombatossals/chords-db`.
- `src/app/models/chord.model.ts` - TypeScript shapes for chord data and search results.
- `src/app/components/chord-diagram/chord-diagram.ts` - computes SVG fret lines, dots, barres, labels, and position code.
- `src/app/components/chord-diagram/chord-diagram.html` - SVG guitar chord diagram markup.
- `src/app/components/chord-diagram/chord-diagram.scss` - SVG diagram styling.
- `.github/workflows/pages.yml` - GitHub Pages deployment workflow.
- `package.json` - npm scripts and dependencies.

## Deploy

Push to `master`. GitHub Actions builds the app with `/chord-generator/` as the base href and publishes the browser output to GitHub Pages.
