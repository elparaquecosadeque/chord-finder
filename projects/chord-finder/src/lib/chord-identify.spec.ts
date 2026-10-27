import { describe, expect, it } from 'vitest';
import { identifyChord } from './chord-identify';

// Frets low E → high E, -1 muted.
const names = (frets: number[]) => identifyChord(frets).map((reading) => reading.name);

describe('identifyChord', () => {
  it('needs at least two sounding strings', () => {
    expect(identifyChord([-1, 3, -1, -1, -1, -1])).toEqual([]);
  });

  it('names the open C shape and finds it as chords-db position 1', () => {
    const [best] = identifyChord([-1, 3, 2, 0, 1, 0]);
    expect(best.name).toBe('C');
    expect(best.degrees).toEqual(['1', '3', '5']);
    expect(best.positionIndex).toBe(0);
  });

  it('lists the db positions as absolute frets, ready to draw', () => {
    const [best] = identifyChord([-1, 3, 2, 0, 1, 0]);
    expect(best.positions[0]).toEqual([-1, 3, 2, 0, 1, 0]);
    expect(best.positions[1]).toEqual([-1, 3, 5, 5, 5, 3]);
  });

  it('finds close-position triads chords-db does not have', () => {
    for (const shape of [[-1, -1, -1, 9, 8, 7], [-1, 7, 5, 4, -1, -1]]) {
      const [best] = identifyChord(shape);
      expect(best.name).toBe('Em');
      expect(best.positionIndex).toBeNull();
      expect(best.triads[best.triadIndex!]).toEqual(shape);
    }
  });

  it('has no triads for chords of more than three notes', () => {
    expect(identifyChord([-1, 3, 2, 3, 1, 0])[0].triads).toEqual([]); // C7
  });

  it('matches a barre shape above the first fret (chords-db stores it relative to baseFret)', () => {
    const [best] = identifyChord([-1, 3, 5, 5, 5, 3]);
    expect(best.name).toBe('C');
    expect(best.positionIndex).toBe(1);
  });

  it('accepts an omitted fifth and reports it', () => {
    const [best] = identifyChord([-1, 3, 2, 3, -1, -1]); // C E Bb
    expect(best.name).toBe('C7');
    expect(best.omitted).toEqual(['5']);
  });

  it('prefers the reading with the root in the bass, but lists the others', () => {
    expect(names([-1, 3, 2, 2, 1, 3]).slice(0, 2)).toEqual(['C6', 'Am7/C']); // C E A C G
  });

  it('prefers a complete chord over one missing a degree', () => {
    expect(names([-1, 3, 2, 2, 1, 0]).slice(0, 2)).toEqual(['Am/C', 'C6']); // C E A C E
  });

  it('adds a slash chord chords-db has under its own suffix', () => {
    const [best] = identifyChord([0, 3, 2, 0, 1, 0]); // E C E G C E
    expect(best.name).toBe('C/E');
    expect(best.addName).toBe('C/E');
    expect(best.bassDropped).toBe(false);
  });

  it('drops a bass chords-db has no slash chord for', () => {
    const reading = identifyChord([0, 3, 2, 3, 1, 0]).find((r) => r.name === 'C7/E');
    expect(reading?.addName).toBe('C7');
    expect(reading?.bassDropped).toBe(true);
  });

  it('labels each pitch class with its degree', () => {
    const [best] = identifyChord([-1, 0, 2, 2, 1, 0]); // Am
    expect(best.name).toBe('Am');
    expect(best.degreeOf).toEqual({ 9: '1', 0: 'b3', 4: '5' });
  });

  it('finds nothing for a cluster no quality covers', () => {
    expect(identifyChord([-1, 3, 4, 5, -1, -1])).toEqual([]); // C F# B
  });
});
