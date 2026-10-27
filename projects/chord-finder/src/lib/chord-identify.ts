import guitarDbJson from '@gblp/chords-db/lib/guitar.json' with { type: 'json' };
import { ChordsDbChord, ChordsDbInstrument } from './models/chord.model';
import { formatChordName } from './services/chord.service';

const guitarDb = guitarDbJson as ChordsDbInstrument;

// Standard tuning as MIDI notes, low E (index 0) to high E (index 5) — the
// same string order as chords-db's `frets`.
export const STANDARD_TUNING = [40, 45, 50, 55, 59, 64];
export const FRET_COUNT = 15; // chords-db never goes past fret 15

// chords-db's own key spelling, indexed by pitch class.
export const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export const DEGREE_SEMITONES: Record<string, number> = {
  '1': 0, b2: 1, b9: 1, '2': 2, '9': 2, '#9': 3, b3: 3, '3': 4, '4': 5, '11': 5,
  '#11': 6, b5: 6, '5': 7, '#5': 8, b13: 8, '6': 9, '13': 9, bb7: 9, b7: 10, '7': 11,
};

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function pitchClass(note: string): number {
  const shift = note[1] === '#' ? 1 : note[1] === 'b' ? -1 : 0;
  return (LETTER_PC[note[0]] + shift + 12) % 12;
}

export interface ChordReading {
  /** Shown name, e.g. "C7/E". */
  name: string;
  /** What goes into the chord field — `name`, or without the bass when chords-db has no such slash chord. */
  addName: string;
  bassDropped: boolean;
  /** Formula degrees present in the shape, in formula order ("1", "b3", "b7"…). */
  degrees: string[];
  /** Optional degrees the shape leaves out. */
  omitted: string[];
  /** Pitch class → degree label, for labelling dots. */
  degreeOf: Record<number, string>;
  rootPitchClass: number;
  /** chords-db positions for `addName`, as absolute frets (same shape as the input). */
  positions: { frets: number[]; triad: boolean }[];
  /** Index into `positions` that has exactly this shape, if any. */
  positionIndex: number | null;
}

/** Note name of a formula degree over a root pitch class, e.g. (4, 'b3') → "G". */
export function degreeNote(rootPitchClass: number, degree: string): string {
  return NOTE_NAMES[(rootPitchClass + DEGREE_SEMITONES[degree]) % 12];
}

/** Sounding MIDI notes for a shape; -1 = muted string. */
export function shapeMidi(frets: number[]): number[] {
  return frets.flatMap((fret, string) => (fret < 0 ? [] : [STANDARD_TUNING[string] + fret]));
}

function absoluteFrets(frets: number[], baseFret = 1): number[] {
  return frets.map((fret) => (fret > 0 ? fret + baseFret - 1 : fret));
}

/**
 * Every chords-db quality whose formula covers the shape's notes, best first:
 * fewest omitted degrees, then root in the bass, then simplest formula.
 */
export function identifyChord(frets: number[]): ChordReading[] {
  const midi = shapeMidi(frets);
  if (midi.length < 2) return [];
  const pitchClasses = new Set(midi.map((note) => note % 12));
  const bass = Math.min(...midi) % 12;
  const readings: (ChordReading & { rank: number[] })[] = [];

  for (const root of pitchClasses) {
    const intervals = new Set([...pitchClasses].map((pc) => (pc - root + 12) % 12));
    const rootName = NOTE_NAMES[root];
    const family = guitarDb.chords[rootName.replace('#', 'sharp')] ?? [];

    guitarDb.suffixes.forEach((suffix, suffixIndex) => {
      const entry = guitarDb.formulas[suffix];
      // "sus" is the same chord as "sus4" (and the chord field reads it as such).
      if (!entry || suffix === 'sus') return;
      const all = new Set(entry.formula.map((degree) => DEGREE_SEMITONES[degree]));
      const required = entry.formula.filter((degree) => !entry.optional.includes(degree));
      if (![...intervals].every((interval) => all.has(interval))) return;
      if (!required.every((degree) => intervals.has(DEGREE_SEMITONES[degree]))) return;
      const base = family.find((chord) => chord.suffix === suffix);
      if (!base) return;

      const degrees = entry.formula.filter((degree) => intervals.has(DEGREE_SEMITONES[degree]));
      const degreeOf: Record<number, string> = {};
      for (const degree of degrees) degreeOf[(root + DEGREE_SEMITONES[degree]) % 12] = degree;

      // Slash chords live in chords-db as their own suffixes: "/E", "m/B", "7/G".
      const prefix = suffix === 'major' ? '' : suffix === 'minor' ? 'm' : suffix;
      const slash =
        bass === root
          ? undefined
          : family.find(
            (chord) =>
              chord.suffix.startsWith(`${prefix}/`) &&
              pitchClass(chord.suffix.slice(prefix.length + 1)) === bass,
          );
      const name =
        bass === root ? formatChordName(rootName, suffix) : `${formatChordName(rootName, suffix)}/${NOTE_NAMES[bass]}`;
      const shapeIn = (chord: ChordsDbChord) =>
        chord.positions.findIndex((position) => absoluteFrets(position.frets, position.baseFret).join() === frets.join());
      // An inverted triad ("Em/G") is filed under its chord ("Em"), bass and all.
      const asTriad = slash === undefined || shapeIn(slash) < 0 ? shapeIn(base) : -1;
      const target = asTriad >= 0 && base.positions[asTriad].triad ? base : (slash ?? base);
      const index = shapeIn(target);

      readings.push({
        name,
        addName: target === slash ? `${rootName}${slash.suffix}` : formatChordName(rootName, suffix),
        bassDropped: bass !== root && target === base && index < 0,
        degrees,
        omitted: entry.formula.filter((degree) => !degrees.includes(degree)),
        degreeOf,
        rootPitchClass: root,
        positions: target.positions.map((position) => ({
          frets: absoluteFrets(position.frets, position.baseFret),
          triad: !!position.triad,
        })),
        positionIndex: index >= 0 ? index : null,
        rank: [entry.formula.length - degrees.length, bass === root ? 0 : 1, entry.formula.length, suffixIndex],
      });
    });
  }

  return readings
    .sort((a, b) => compareRank(a.rank, b.rank))
    .map(({ rank: _rank, ...reading }) => reading);
}

function compareRank(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}
