# @gblp/chord-finder

Standalone Angular 22 component for finding guitar chords and rendering SVG chord diagrams.

[View the package on npm](https://www.npmjs.com/package/@gblp/chord-finder)

```bash
npm install @gblp/chord-finder
```

```ts
import { Component } from "@angular/core";
import { ChordFinderComponent } from "@gblp/chord-finder";

@Component({
  imports: [ChordFinderComponent],
  template: `<the-chords-chord-finder [language]="'es'" />`,
})
export class App {}
```

`language` accepts `en` or `es` and defaults to `en`.

Override the component theme from any ancestor with these inherited CSS variables:

```css
--chords-background;
--chords-background-alt;
--chords-surface;
--chords-surface-elevated;
--chords-text;
--chords-muted;
--chords-primary;
--chords-secondary;
--chords-highlight;
--chords-danger;
--chords-border;
--chords-on-primary;
```

Build the package with `npm run build:lib`. The publishable Angular package is written to `dist/chord-finder`.
