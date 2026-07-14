export type Language = 'en' | 'es';

export interface ChordsDbPosition {
  frets: number[];
  fingers?: number[];
  barres?: number[];
  capo?: boolean;
  baseFret?: number;
  midi?: number[];
}

export interface ChordsDbChord {
  key: string;
  suffix: string;
  positions: ChordsDbPosition[];
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
}

export interface ChordSection {
  name: string;
  results: ChordSearchResult[];
}
