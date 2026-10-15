import { describe, expect, it } from 'vitest';
import { positionDifficulty, qualityDifficulty } from './chord-difficulty';
import { ChordsDbChord, ChordsDbPosition } from './models/chord.model';

describe('positionDifficulty', () => {
  it('scores an open, no-barre position low', () => {
    const open: ChordsDbPosition = { frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] };
    // 3 distinct fingers (3, 2, 1) * 2 + no barre + span(3-1=2) = 8
    expect(positionDifficulty(open)).toBe(8);
  });

  it('scores a barre position higher than an equivalent open one', () => {
    const barre: ChordsDbPosition = {
      frets: [1, 3, 3, 2, 1, 1],
      fingers: [1, 3, 4, 2, 1, 1],
      barres: [1],
    };
    const open: ChordsDbPosition = { frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] };
    expect(positionDifficulty(barre)).toBeGreaterThan(positionDifficulty(open));
  });

  it('falls back to counting fretted strings when fingers is missing', () => {
    const noFingers: ChordsDbPosition = { frets: [-1, 3, 2, 0, 1, 0] };
    // 3 fretted strings * 2 + no barre + span(3-1=2) = 8
    expect(positionDifficulty(noFingers)).toBe(8);
  });

  it('does not blow up on an all-open/muted position', () => {
    const allOpen: ChordsDbPosition = { frets: [0, 0, -1, -1, -1, -1] };
    expect(positionDifficulty(allOpen)).toBe(0);
  });
});

describe('qualityDifficulty', () => {
  it('takes the easiest of several positions', () => {
    const chord: ChordsDbChord = {
      key: 'C',
      suffix: 'major',
      positions: [
        { frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1], barres: [1] }, // harder
        { frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] }, // easier
      ],
    };
    expect(qualityDifficulty(chord)).toBe(positionDifficulty(chord.positions[1]));
  });
});
