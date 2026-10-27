import { Injectable } from '@angular/core';
import guitarDbJson from '@gblp/chords-db/lib/guitar.json' with { type: 'json' };
import {
  ChordSearchResult,
  ChordSection,
  ChordsDbChord,
  ChordsDbInstrument,
  ChordsDbPosition,
  Language,
  ParsedChord,
} from '../models/chord.model';

const ERROR_COPY = {
  en: {
    invalid: 'Invalid chord name. Try C, F#, C#m, Bb, Am7, or Dsus4.',
    missingRoot: 'Chord root not found in chords-db.',
    missingType: (suffix: string) =>
      `The type "${suffix}" is not available for this chord.`,
    tooManySections: (max: number) =>
      `Too many sections — maximum allowed is ${max}.`,
    tooManyChords: (section: string, max: number) =>
      `Section "${section}" exceeds the maximum of ${max} chords.`,
    emptySectionName: 'Section name cannot be empty.',
    emptySection: (name: string) => `Section "${name}" has no chords.`,
    noValidSections:
      'No valid sections found. Expected format: "name: chord1, chord2; name2: chord3".',
  },
  es: {
    invalid: 'Nombre inválido. Prueba C, F#, C#m, Bb, Am7 o Dsus4.',
    missingRoot: 'Raíz no encontrada en chords-db.',
    missingType: (suffix: string) =>
      `El tipo "${suffix}" no existe para este acorde en la base actual.`,
    tooManySections: (max: number) =>
      `Demasiadas secciones — el máximo permitido es ${max}.`,
    tooManyChords: (section: string, max: number) =>
      `La sección "${section}" supera el máximo de ${max} acordes.`,
    emptySectionName: 'El nombre de la sección no puede estar vacío.',
    emptySection: (name: string) =>
      `La sección "${name}" no tiene acordes.`,
    noValidSections:
      'No se encontraron secciones válidas. Formato esperado: "nombre: acorde1, acorde2; nombre2: acorde3".',
  },
} satisfies Record<
  Language,
  {
    invalid: string;
    missingRoot: string;
    missingType: (suffix: string) => string;
    tooManySections: (max: number) => string;
    tooManyChords: (section: string, max: number) => string;
    emptySectionName: string;
    emptySection: (name: string) => string;
    noValidSections: string;
  }
>;

// A drawn shape riding on a chord token, in chords-db's own notation (x = muted,
// a–f = frets 10–15), low E first: "Em[xx200x]". The card shows it as position 1.
const SHAPE_SUFFIX = /^(.*?)\[([0-9a-fx]{6})\]$/i;
const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "E2" → 40. */
function noteMidi(note: string): number {
  const shift = note[1] === '#' ? 1 : note[1] === 'b' ? -1 : 0;
  return (Number(note.at(-1)) + 1) * 12 + LETTER_PC[note[0]] + shift;
}

/** [-1, -1, 2, 0, 0, -1] → "xx200x". */
export function shapeCode(frets: number[]): string {
  return frets.map((fret) => (fret < 0 ? 'x' : fret.toString(16))).join('');
}

// "C" + "major" → "C", "C" + "minor" → "Cm", "C" + "m7" → "Cm7".
export function formatChordName(root: string, suffix: string): string {
  if (suffix === 'major') return root;
  if (suffix === 'minor') return `${root}m`;
  return `${root}${suffix}`;
}

@Injectable({ providedIn: 'root' })
export class ChordService {
  private readonly MAX_SECTIONS = 6;
  readonly MAX_CHORDS_PER_SECTION = 6;

  private readonly guitarDb = guitarDbJson as ChordsDbInstrument;
  private readonly tuning = this.guitarDb.tunings['standard'].map(noteMidi);

  private readonly dbRootMap: Record<string, string> = {
    C: 'C',
    'C#': 'Csharp',
    Db: 'Csharp',
    D: 'D',
    'D#': 'Eb',
    Eb: 'Eb',
    E: 'E',
    Fb: 'E',
    'E#': 'F',
    F: 'F',
    'F#': 'Fsharp',
    Gb: 'Fsharp',
    G: 'G',
    'G#': 'Ab',
    Ab: 'Ab',
    A: 'A',
    'A#': 'Bb',
    Bb: 'Bb',
    B: 'B',
    Cb: 'B',
    'B#': 'C',
  };

  private readonly suffixAliases: Record<string, string> = {
    '': 'major',
    M: 'major',
    maj: 'major',
    major: 'major',
    m: 'minor',
    min: 'minor',
    '-': 'minor',
    minor: 'minor',
    Δ: 'maj7',
    maj7: 'maj7',
    M7: 'maj7',
    m7: 'm7',
    min7: 'm7',
    dim: 'dim',
    diminished: 'dim',
    '°': 'dim',
    aug: 'aug',
    augmented: 'aug',
    sus: 'sus4',
    sus2: 'sus2',
    sus4: 'sus4',
    add9: 'add9',
    4: 'sus4',
  };

  search(
    input: string,
    language: Language = 'en',
  ): ChordSearchResult[] {
    return input
      .split(',')
      .map((token) => token.trim())
      .filter(Boolean)
      .map((token, index) => this.searchSingle(token, index, language));
  }

  isSectionFormat(input: string): boolean {
    return input.includes(':');
  }

  searchSections(
    input: string,
    language: Language = 'en',
  ): { sections: ChordSection[]; error: string | null } {
    const copy = ERROR_COPY[language];

    const rawSections = input
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);

    if (!rawSections.length) {
      return { sections: [], error: copy.noValidSections };
    }

    if (rawSections.length > this.MAX_SECTIONS) {
      return { sections: [], error: copy.tooManySections(this.MAX_SECTIONS) };
    }

    const sections: ChordSection[] = [];

    for (const [si, raw] of rawSections.entries()) {
      const colonIndex = raw.indexOf(':');
      if (colonIndex === -1) {
        return { sections: [], error: copy.noValidSections };
      }

      const name = raw.slice(0, colonIndex).trim();
      const chordsStr = raw.slice(colonIndex + 1).trim();

      if (!name) {
        return { sections: [], error: copy.emptySectionName };
      }

      const tokens = chordsStr
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      if (!tokens.length) {
        return { sections: [], error: copy.emptySection(name) };
      }

      if (tokens.length > this.MAX_CHORDS_PER_SECTION) {
        return {
          sections: [],
          error: copy.tooManyChords(name, this.MAX_CHORDS_PER_SECTION),
        };
      }

      sections.push({
        name,
        results: tokens.map((token, ci) =>
          // ponytail: offset by si*10 to keep IDs unique across sections (max 6 chords × 6 sections = 36 < 60)
          this.searchSingle(token, si * 10 + ci, language),
        ),
      });
    }

    return { sections, error: null };
  }

  suffixes(): string[] {
    return this.guitarDb.suffixes;
  }

  private searchSingle(
    token: string,
    index: number,
    language: Language,
  ): ChordSearchResult {
    const shapeMatch = token.match(SHAPE_SUFFIX);
    const shape = shapeMatch ? this.shapePosition(shapeMatch[2]) : null;
    const parsed = this.parseChordName(shapeMatch ? shapeMatch[1] : token);
    const copy = ERROR_COPY[language];

    if (!parsed) {
      return {
        id: `${index}-${token}`,
        raw: token,
        displayName: token,
        positions: [],
        error: copy.invalid,
      };
    }
    const chordFamily = this.guitarDb.chords[parsed.dbRoot];

    if (!chordFamily) {
      return {
        id: `${index}-${parsed.displayName}`,
        raw: token,
        displayName: parsed.displayName,
        positions: [],
        error: copy.missingRoot,
      };
    }

    const chord = chordFamily.find((item) => item.suffix === parsed.suffix);

    if (!chord) {
      return {
        id: `${index}-${parsed.displayName}`,
        raw: token,
        displayName: parsed.displayName,
        dbName: `${parsed.dbRoot} ${parsed.suffix}`,
        positions: [],
        error: copy.missingType(parsed.suffix),
      };
    }

    return {
      id: `${index}-${parsed.dbRoot}-${parsed.suffix}${shape ? `-${shapeMatch![2]}` : ''}`,
      raw: token,
      displayName: parsed.displayName,
      dbName: `${chord.key} ${chord.suffix}`,
      chord,
      positions: shape ? [shape, ...chord.positions] : chord.positions,
      root: parsed.root,
      dbRoot: parsed.dbRoot,
    };
  }

  // Same layout chords-db's generator uses: frets relative to baseFret once the
  // shape sits above the 4th fret, and one MIDI note per sounding string.
  private shapePosition(code: string): ChordsDbPosition | null {
    const frets = [...code.toLowerCase()].map((char) => (char === 'x' ? -1 : parseInt(char, 16)));
    if (frets.every((fret) => fret < 0)) return null;
    const fretted = frets.filter((fret) => fret > 0);
    const baseFret = Math.max(...frets) > 4 ? Math.min(...fretted) : 1;
    return {
      frets: frets.map((fret) => (fret > 0 ? fret - baseFret + 1 : fret)),
      baseFret,
      barres: [],
      midi: frets.flatMap((fret, string) => (fret < 0 ? [] : [this.tuning[string] + fret])),
    };
  }

  // Every quality chords-db has for this root, excluding bass-alternate suffixes
  // (e.g. "/E", "m9/Bb") — those name a different bass note, not a chord quality,
  // and are out of scope for a quality catalog/carousel.
  qualityCatalog(dbRoot: string): ChordsDbChord[] {
    const family = this.guitarDb.chords[dbRoot];
    if (!family) return [];
    return family.filter((c) => !c.suffix.includes('/'));
  }

  formatChordName(root: string, suffix: string): string {
    return formatChordName(root, suffix);
  }

  private parseChordName(raw: string): ParsedChord | null {
    const cleaned = raw
      .replaceAll('♯', '#')
      .replaceAll('♭', 'b')
      .replace(/\s+/g, '');

    const match = cleaned.match(/^([A-Ga-g])([#b]?)(.*)$/);
    if (!match) return null;

    const letter = match[1].toUpperCase();
    const accidental = match[2] ?? '';
    const suffixRaw = match[3] ?? '';
    const root = `${letter}${accidental}`;
    const dbRoot = this.dbRootMap[root];

    if (!dbRoot) return null;

    const suffix = this.normalizeSuffix(suffixRaw);
    if (!suffix) return null;

    return {
      raw,
      root,
      dbRoot,
      displayName: formatChordName(root, suffix),
      suffix,
    };
  }

  private normalizeSuffix(rawSuffix: string): string | null {
    const trimmed = rawSuffix.trim();

    if (this.suffixAliases[trimmed] !== undefined) {
      return this.suffixAliases[trimmed];
    }

    const lower = trimmed.toLowerCase();
    if (this.suffixAliases[lower] !== undefined) {
      return this.suffixAliases[lower];
    }

    if (this.guitarDb.suffixes.includes(trimmed)) {
      return trimmed;
    }

    if (this.guitarDb.suffixes.includes(lower)) {
      return lower;
    }

    return null;
  }
}
