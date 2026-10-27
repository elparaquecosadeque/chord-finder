import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { FRET_COUNT, NOTE_NAMES, STANDARD_TUNING, degreeNote, identifyChord } from '../../chord-identify';
import { Language } from '../../models/chord.model';
import { shapeCode } from '../../services/chord.service';

const LEFT_HANDED_KEY = 'chord-finder-left-handed';
const SHOW_DEGREES_KEY = 'chord-finder-identifier-degrees';
const HIGHLIGHT_KEY = 'chord-finder-identifier-highlight';
const MUTED = -1;
const OPEN = 0;
const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'E'];
const INLAYS = new Set([3, 5, 7, 9, 12, 15]);

/** A section of the chord field the drawn chord can be appended to. */
export interface ChordTarget {
  name: string;
  full: boolean;
}

export interface ChordPick {
  name: string;
  /** chords-db position with exactly the drawn shape, if there is one. */
  positionIndex: number | null;
  /** The drawn shape ("xx200x") when chords-db doesn't have it, so the host can keep it. */
  shape: string | null;
  /** Index into `targets`; 0 when there are none (plain chord list). */
  target: number;
}

const COPY = {
  en: {
    board: 'Fretboard',
    string: (n: number, name: string) => `String ${n} (${name})`,
    fret: (f: number) => `fret ${f}`,
    open: 'open',
    muted: 'muted',
    leftHanded: 'Left-handed',
    clear: 'Clear',
    prompt: 'A chord needs at least two strings ringing — unmute one with ×.',
    noMatch: 'No chord in the database matches these notes',
    omitted: 'omitted',
    alternatives: 'Possible readings',
    exact: (n: number, total: number) => `Database position ${n} of ${total}`,
    triad: (n: number, total: number, strings: string) => `Triad ${n} of ${total} · strings ${strings}`,
    custom: (positions: number, triads: number) =>
      triads ? `Your own shape — ${positions} database positions and ${triads} triads` : `Your own shape — ${positions} positions in the database`,
    previousPosition: 'Draw the previous position',
    nextPosition: 'Draw the next position',
    showNotes: 'Show note names',
    showDegrees: 'Show degrees',
    highlight: 'Whole neck',
    bassDropped: (name: string) => `No slash version in the database: adds as ${name}`,
    section: 'Add to section',
    sectionFull: 'full',
    add: 'Add to progression',
    added: (name: string) => `${name} added`,
  },
  es: {
    board: 'Mástil',
    string: (n: number, name: string) => `Cuerda ${n} (${name})`,
    fret: (f: number) => `traste ${f}`,
    open: 'al aire',
    muted: 'apagada',
    leftHanded: 'Zurdo',
    clear: 'Limpiar',
    prompt: 'Un acorde necesita al menos dos cuerdas sonando — reactiva una con ×.',
    noMatch: 'Ningún acorde de la base coincide con estas notas',
    omitted: 'omitida',
    alternatives: 'Lecturas posibles',
    exact: (n: number, total: number) => `Posición ${n} de ${total} de la base`,
    triad: (n: number, total: number, strings: string) => `Tríada ${n} de ${total} · cuerdas ${strings}`,
    custom: (positions: number, triads: number) =>
      triads ? `Forma propia — ${positions} posiciones en la base y ${triads} tríadas` : `Forma propia — ${positions} posiciones en la base`,
    previousPosition: 'Dibujar la posición anterior',
    nextPosition: 'Dibujar la siguiente posición',
    showNotes: 'Mostrar notas',
    showDegrees: 'Mostrar grados',
    highlight: 'Todo el mástil',
    bassDropped: (name: string) => `La base no tiene esta versión con bajo: se añade como ${name}`,
    section: 'Añadir a la sección',
    sectionFull: 'llena',
    add: 'Añadir a la progresión',
    added: (name: string) => `${name} añadido`,
  },
} satisfies Record<Language, unknown>;

function loadFlag(key: string, fallback: boolean): boolean {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value === 'true';
  } catch {
    return fallback;
  }
}

function saveFlag(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // localStorage unavailable — preference just won't persist.
  }
}

// Draw a shape on a 15-fret board (one note per string, standard tuning),
// read it back as every chords-db quality that fits, and hand the chosen
// name to the host through (pick).
@Component({
  selector: 'chord-identifier',
  standalone: true,
  templateUrl: './chord-identifier.html',
  styleUrl: './chord-identifier.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.left-handed]': 'leftHanded()' },
})
export class ChordIdentifier {
  readonly language = input<Language>('en');
  readonly targets = input<ChordTarget[]>([]);
  readonly pick = output<ChordPick>();

  readonly text = computed(() => COPY[this.language()]);
  readonly fretNumbers = Array.from({ length: FRET_COUNT }, (_, i) => i + 1);
  readonly inlays = INLAYS;
  // High E on top, like tab.
  readonly strings = [5, 4, 3, 2, 1, 0];
  readonly stringNames = STRING_NAMES;

  // Untouched strings ring open, like on a real guitar; × mutes them.
  readonly frets = signal<number[]>(Array(6).fill(OPEN));
  readonly leftHanded = signal(loadFlag(LEFT_HANDED_KEY, false));
  // Dot labels: degrees (R, b3, 5) or note names (E, G, B).
  readonly showDegrees = signal(loadFlag(SHOW_DEGREES_KEY, true));
  // Light up every place the chord's notes fall on the neck, not just the drawn ones.
  readonly highlight = signal(loadFlag(HIGHLIGHT_KEY, false));
  readonly readings = computed(() => identifyChord(this.frets()));
  // Keep the chosen reading (by name) while the shape changes and it still applies.
  readonly readingIndex = linkedSignal<ReturnType<typeof identifyChord>, number>({
    source: this.readings,
    computation: (readings, previous) => {
      const name = previous?.source[previous.value]?.name;
      return Math.max(0, readings.findIndex((reading) => reading.name === name));
    },
  });
  readonly reading = computed(() => this.readings()[this.readingIndex()] ?? null);
  // What › and ‹ walk through: chords-db's positions, then close triads.
  readonly shapes = computed(() => {
    const reading = this.reading();
    return reading ? [...reading.positions, ...reading.triads] : [];
  });
  readonly shapeIndex = computed(() => {
    const reading = this.reading();
    if (!reading) return null;
    if (reading.positionIndex !== null) return reading.positionIndex;
    return reading.triadIndex !== null ? reading.positions.length + reading.triadIndex : null;
  });
  // "3–2–1" for a triad on the top three strings.
  readonly triadStrings = computed(() =>
    this.frets().flatMap((fret, s) => (fret === MUTED ? [] : [6 - s])).join('–'),
  );
  readonly sounding = computed(() => this.frets().filter((fret) => fret !== MUTED).length);
  readonly pristine = computed(() => this.frets().every((fret) => fret === OPEN));
  readonly noteNames = computed(() =>
    [...new Set(this.frets().flatMap((fret, s) => (fret === MUTED ? [] : [NOTE_NAMES[(STANDARD_TUNING[s] + fret) % 12]])))],
  );
  readonly target = linkedSignal(() => {
    const targets = this.targets();
    for (let i = targets.length - 1; i >= 0; i--) if (!targets[i].full) return i;
    return -1;
  });
  readonly canAdd = computed(
    () => !!this.reading() && (this.targets().length === 0 || this.target() >= 0),
  );
  readonly added = signal<string | null>(null);
  private addedTimer?: ReturnType<typeof setTimeout>;

  // Roving focus: one tabbable cell, arrow keys move it. Fret 0 = the open/mute control.
  readonly focusString = signal(5);
  readonly focusFret = signal(0);

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  noteName(string: number, fret: number): string {
    return NOTE_NAMES[(STANDARD_TUNING[string] + fret) % 12];
  }

  label(string: number, fret: number): string {
    const pc = (STANDARD_TUNING[string] + fret) % 12;
    const degree = this.showDegrees() ? this.reading()?.degreeOf[pc] : undefined;
    return degree ? this.degreeLabel(degree) : NOTE_NAMES[pc];
  }

  degreeLabel(degree: string): string {
    return degree === '1' ? 'R' : degree;
  }

  formulaLabel(degree: string): string {
    const reading = this.reading();
    return this.showDegrees() || !reading ? this.degreeLabel(degree) : degreeNote(reading.rootPitchClass, degree);
  }

  inChord(string: number, fret: number): boolean {
    const reading = this.reading();
    return this.highlight() && !!reading && (STANDARD_TUNING[string] + fret) % 12 in reading.degreeOf;
  }

  isRoot(string: number, fret: number): boolean {
    return (STANDARD_TUNING[string] + fret) % 12 === this.reading()?.rootPitchClass;
  }

  cellLabel(string: number, fret: number): string {
    const t = this.text();
    const where = t.string(6 - string, STRING_NAMES[string]);
    if (fret > 0) return `${where}, ${t.fret(fret)}`;
    return `${where}: ${this.frets()[string] === 0 ? t.open : t.muted}`;
  }

  toggleFret(string: number, fret: number): void {
    this.frets.update((frets) => frets.map((f, s) => (s !== string ? f : f === fret ? OPEN : fret)));
  }

  // ○ ↔ ×; a fretted string mutes.
  toggleOpen(string: number): void {
    this.frets.update((frets) => frets.map((f, s) => (s !== string ? f : f === MUTED ? OPEN : MUTED)));
  }

  clear(): void {
    this.frets.set(Array(6).fill(OPEN));
  }

  setLeftHanded(value: boolean): void {
    this.leftHanded.set(value);
    saveFlag(LEFT_HANDED_KEY, value);
  }

  setShowDegrees(value: boolean): void {
    this.showDegrees.set(value);
    saveFlag(SHOW_DEGREES_KEY, value);
  }

  setHighlight(value: boolean): void {
    this.highlight.set(value);
    saveFlag(HIGHLIGHT_KEY, value);
  }

  // Draw the next/previous shape of the current reading; from a shape of your
  // own, › starts at the first one and ‹ at the last.
  stepPosition(delta: number): void {
    const shapes = this.shapes();
    if (!shapes.length) return;
    const current = this.shapeIndex() ?? (delta > 0 ? -1 : 0);
    this.frets.set([...shapes[(current + delta + shapes.length) % shapes.length]]);
  }

  onBoardKey(event: KeyboardEvent): void {
    const flip = this.leftHanded() ? -1 : 1;
    const moves: Record<string, [number, number]> = {
      ArrowRight: [0, flip],
      ArrowLeft: [0, -flip],
      ArrowUp: [1, 0],
      ArrowDown: [-1, 0],
      Home: [0, -FRET_COUNT],
      End: [0, FRET_COUNT],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    const string = Math.max(0, Math.min(5, this.focusString() + move[0]));
    const fret = Math.max(0, Math.min(FRET_COUNT, this.focusFret() + move[1]));
    this.focusString.set(string);
    this.focusFret.set(fret);
    this.host.nativeElement.querySelector<HTMLElement>(`[data-cell="${string}-${fret}"]`)?.focus();
  }

  add(): void {
    const reading = this.reading();
    if (!reading || !this.canAdd()) return;
    this.pick.emit({
      name: reading.addName,
      positionIndex: reading.positionIndex,
      shape: reading.positionIndex === null ? shapeCode(this.frets()) : null,
      target: Math.max(0, this.target()),
    });
    this.added.set(this.text().added(reading.addName));
    clearTimeout(this.addedTimer);
    this.addedTimer = setTimeout(() => this.added.set(null), 2400);
  }
}
