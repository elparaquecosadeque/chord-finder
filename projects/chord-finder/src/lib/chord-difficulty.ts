import { ChordsDbChord, ChordsDbPosition } from './models/chord.model';

// Objective fingering-difficulty score for one position: how many distinct fingers
// it uses, whether it needs a barre, and how far the fretting hand has to stretch.
// Deliberately NOT harmonic complexity (triad vs 7th vs 9th) — chords-db's 45
// suffixes have no interval data to build that from without a hand-built table
// (see TODO.md for that as a future alternative).
export function positionDifficulty(position: ChordsDbPosition): number {
  const frettedFrets = position.frets.filter((fret) => fret > 0);

  const fingersUsed = position.fingers
    ? new Set(position.fingers.filter((finger) => finger > 0)).size
    : frettedFrets.length;

  const hasBarre = (position.barres?.length ?? 0) > 0;

  const fretSpan = frettedFrets.length ? Math.max(...frettedFrets) - Math.min(...frettedFrets) : 0;

  return fingersUsed * 2 + (hasBarre ? 2 : 0) + fretSpan;
}

// A quality's difficulty is its easiest available voicing — if there's an easy way
// to play it, it counts as easy even when harder variants also exist.
export function qualityDifficulty(chord: ChordsDbChord): number {
  return Math.min(...chord.positions.map(positionDifficulty));
}
