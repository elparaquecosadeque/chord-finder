import { Component, computed, input, ChangeDetectionStrategy } from '@angular/core';
import { ChordsDbPosition } from '../../models/chord.model';

interface BarreNote {
  x: number;
  note: string | undefined;
}

interface BarreSpan {
  fret: number;
  x: number;
  y: number;
  width: number;
  labelX: number;
  labelY: number;
  finger: number | undefined;
  barreNotes: BarreNote[];
}

interface DotMarker {
  fret: number;
  stringIndex: number;
  finger?: number;
  note?: string;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

@Component({
  selector: 'app-chord-diagram',
  imports: [],
  templateUrl: './chord-diagram.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './chord-diagram.scss'
})
export class ChordDiagram {
  title = input.required<string>();
  position = input.required<ChordsDbPosition>();
  positionIndex = input<number>(0);
  showNotes = input<boolean>(false);

  readonly width = 240;
  readonly height = 330;
  readonly left = 54;
  readonly top = 112;
  readonly stringGap = 28;
  readonly fretGap = 34;
  readonly dotRadius = 13;
  readonly stringLabels = ['E', 'A', 'D', 'G', 'B', 'E'];

  fretCount = computed(() => Math.max(5, ...this.position().frets.filter((fret) => fret > 0)));

  fretLines = computed(() => Array.from({ length: this.fretCount() + 1 }, (_, index) => index));

  stringLines = computed(() => Array.from({ length: 6 }, (_, index) => index));

  // One entry per string (low E to high E), matching `frets` 1:1 — undefined
  // for a muted string, otherwise the note actually sounding there. Reads
  // straight off chords-db's own `midi` array rather than computing pitch
  // from fret + tuning ourselves: `midi` already has exactly one entry per
  // non-muted string, in string order (verified against the full guitar.json
  // dataset — present and length-consistent on all 3283 positions), so it's
  // correct even under a capo/barre without us modeling either.
  noteByString = computed<(string | undefined)[]>(() => {
    const frets = this.position().frets;
    const midi = this.position().midi ?? [];
    let midiIndex = 0;
    return frets.map((fret) => {
      if (fret === -1) return undefined;
      const note = midi[midiIndex];
      midiIndex++;
      return note === undefined ? undefined : NOTE_NAMES[((note % 12) + 12) % 12];
    });
  });

  visibleDots = computed<DotMarker[]>(() => {
    const barres = new Set(this.position().barres ?? []);
    const fingers = this.position().fingers ?? [];
    const notes = this.noteByString();

    return this.position().frets
      .map((fret, stringIndex) => ({
        fret,
        stringIndex,
        finger: fingers[stringIndex] > 0 ? fingers[stringIndex] : undefined,
        note: notes[stringIndex]
      }))
      .filter(({ fret }) => fret > 0)
      .filter(({ fret }) => !barres.has(fret));
  });

  barreSpans = computed<BarreSpan[]>(() => {
    const barres = this.position().barres ?? [];
    const fingers = this.position().fingers ?? [];
    const notes = this.noteByString();

    return barres
      .map((barreFret) => {
        const playableStrings = this.position().frets
          .map((fret, index) => ({ fret, index }))
          .filter(({ fret }) => fret >= barreFret);

        if (playableStrings.length < 2) return null;

        const firstString = playableStrings[0].index;
        const lastString = playableStrings[playableStrings.length - 1].index;
        const x = this.stringX(firstString) - this.dotRadius;
        const y = this.dotY(barreFret) - this.dotRadius;
        const width = this.stringX(lastString) - this.stringX(firstString) + this.dotRadius * 2;
        const labelX = x + width / 2;
        const labelY = y + this.dotRadius;
        const finger = fingers[firstString] > 0 ? fingers[firstString] : undefined;

        // Only strings actually fretted AT the barre itself — a string
        // fretted higher on top of the barre already gets its own dot from
        // visibleDots above, with its own note label there.
        const barreNotes: BarreNote[] = this.position()
          .frets.map((fret, index) => ({ fret, index }))
          .filter(({ fret }) => fret === barreFret)
          .map(({ index }) => ({ x: this.stringX(index), note: notes[index] }));

        return {
          fret: barreFret,
          x,
          y,
          width,
          labelX,
          labelY,
          finger,
          barreNotes
        } satisfies BarreSpan;
      })
      .filter((span): span is BarreSpan => span !== null);
  });

  get viewBox(): string {
    return `0 0 ${this.width} ${this.height}`;
  }

  baseFret(): number {
    return this.position().baseFret ?? 1;
  }

  stringX(index: number): number {
    return this.left + index * this.stringGap;
  }

  fretY(index: number): number {
    return this.top + index * this.fretGap;
  }

  dotY(fret: number): number {
    return this.top + (fret - 0.5) * this.fretGap;
  }

  // Open strings show their note instead of '○' in notes mode — same spot,
  // no new circle, so the diagram's layout doesn't shift. Muted strings
  // always show '×': nothing sounds there regardless of display mode.
  markerFor(fret: number, stringIndex: number): string {
    if (fret === -1) return '×';
    if (fret === 0) return (this.showNotes() ? this.noteByString()[stringIndex] : undefined) ?? '○';
    return '';
  }

  fretLabel(): string {
    return String(this.baseFret());
  }

  positionCode(): string {
    return this.position().frets.map((fret) => (fret === -1 ? 'x' : String(fret))).join('');
  }
}
