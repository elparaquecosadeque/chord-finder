export type Language = 'en' | 'es';

export interface ChordsDbPosition {
  frets: number[];
  fingers?: number[];
  barres?: number[];
  capo?: boolean;
  baseFret?: number;
  midi?: number[];
  // Generated close-position triad (chords-db 1.2+), listed after the hand-written ones.
  triad?: boolean;
}

export interface ChordsDbChord {
  key: string;
  suffix: string;
  positions: ChordsDbPosition[];
}

export interface ChordsDbFormula {
  formula: string[];
  optional: string[];
}

export interface ChordsDbInstrument {
  main: {
    strings: number;
    fretsOnChord: number;
    name: string;
    numberOfChords?: number;
  };
  tunings: Record<string, string[]>;
  keys: string[];
  suffixes: string[];
  // Scale degrees per suffix (slash suffixes excluded), e.g. m7 → 1 b3 5 b7.
  formulas: Record<string, ChordsDbFormula>;
  chords: Record<string, ChordsDbChord[]>;
}

export interface ParsedChord {
  raw: string;
  root: string;
  dbRoot: string;
  displayName: string;
  suffix: string;
}

export interface ChordSearchResult {
  id: string;
  raw: string;
  displayName: string;
  dbName?: string;
  chord?: ChordsDbChord;
  positions: ChordsDbPosition[];
  error?: string;
  root?: string; // normalized root as typed, e.g. "C#" — set alongside `chord`, used to rebuild a token with a different quality
  dbRoot?: string; // chords-db key for that root, e.g. "Csharp" — looks up the full quality catalog
}

export interface ChordSection {
  name: string;
  results: ChordSearchResult[];
}
