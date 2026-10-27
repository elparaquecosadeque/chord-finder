import guitarDbJson from '@gblp/chords-db/lib/guitar.json' with { type: 'json' };
import { ChordsDbInstrument } from './models/chord.model';
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
  positions: number[][];
  /** Index into `positions` that has exactly this shape, if any. */
  positionIndex: number | null;
  /** Close-position triads on adjacent strings (3-note qualities only), as absolute frets. */
  triads: number[][];
  /** Index into `triads` that has exactly this shape, if any. */
  triadIndex: number | null;
}

const STRING_SETS = [[0, 1, 2], [1, 2, 3], [2, 3, 4], [3, 4, 5]];
const MAX_STRETCH = 4;

/**
 * Every close-position voicing (the three notes ascending within an octave,
 * one per string) of a three-note chord on each set of three adjacent strings:
 * root position and both inversions. Lowest string set first, then up the neck.
 */
export function closeTriads(rootPitchClass: number, semitones: number[]): number[][] {
  const pitchClasses = semitones.map((semitone) => (rootPitchClass + semitone) % 12);
  return STRING_SETS.flatMap((strings) => {
    const triads: number[][] = [];
    for (let inversion = 0; inversion < 3; inversion++) {
      const order = [0, 1, 2].map((i) => pitchClasses[(i + inversion) % 3]);
      const options = strings.map((string, i) =>
        [0, 12].map((octave) => ((order[i] - STANDARD_TUNING[string] + 120) % 12) + octave).filter((f) => f <= FRET_COUNT),
      );
      for (const a of options[0]) for (const b of options[1]) for (const c of options[2]) {
        const chosen = [a, b, c];
        const midi = chosen.map((fret, i) => STANDARD_TUNING[strings[i]] + fret);
        if (!(midi[0] < midi[1] && midi[1] < midi[2] && midi[2] - midi[0] < 12)) continue;
        if (Math.max(...chosen) - Math.min(...chosen) > MAX_STRETCH) continue;
        const frets = Array(6).fill(-1);
        strings.forEach((string, i) => (frets[string] = chosen[i]));
        triads.push(frets);
      }
    }
    const lowest = (frets: number[]) => Math.min(...frets.filter((fret) => fret >= 0));
    return triads.sort((a, b) => lowest(a) - lowest(b));
  });
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
      const target = slash ?? base;
      const positions = target.positions.map((position) => absoluteFrets(position.frets, position.baseFret));
      const index = positions.findIndex((position) => position.join() === frets.join());
      const triads =
        entry.formula.length === 3 && degrees.length === 3
          ? closeTriads(root, entry.formula.map((degree) => DEGREE_SEMITONES[degree]))
          : [];
      const triadIndex = triads.findIndex((triad) => triad.join() === frets.join());

      readings.push({
        name,
        addName: slash ? `${rootName}${slash.suffix}` : formatChordName(rootName, suffix),
        bassDropped: bass !== root && !slash,
        degrees,
        omitted: entry.formula.filter((degree) => !degrees.includes(degree)),
        degreeOf,
        rootPitchClass: root,
        positions,
        positionIndex: index >= 0 ? index : null,
        triads,
        triadIndex: triadIndex >= 0 ? triadIndex : null,
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
