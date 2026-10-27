import { ChordService } from './chord.service';

describe('ChordService', () => {
  let service: ChordService;

  beforeEach(() => {
    service = new ChordService();
  });

  it('finds common chords and their positions', () => {
    const results = service.search('C, F#, C#m, Bb, Am7');

    expect(results.map((r) => r.displayName)).toEqual([
      'C',
      'F#',
      'C#m',
      'Bb',
      'Am7',
    ]);
    expect(results.every((r) => r.positions.length > 0)).toBe(true);
  });

  it('has no chord limit in plain mode', () => {
    const results = service.search('C, D, E, F, G, A, B');

    expect(results.map((r) => r.displayName)).toEqual([
      'C', 'D', 'E', 'F', 'G', 'A', 'B',
    ]);
  });

  it('returns a useful error for invalid chord names', () => {
    const results = service.search('H');
    const spanishResults = service.search('H', 'es');

    expect(results[0].positions).toEqual([]);
    expect(results[0].error).toContain('Invalid');
    expect(spanishResults[0].error).toContain('Nombre');
  });

  it('parses sections format', () => {
    const { sections, error } = service.searchSections(
      'verse: C, D; chorus: G, Am',
    );

    expect(error).toBeNull();
    expect(sections.length).toBe(2);
    expect(sections[0].name).toBe('verse');
    expect(sections[1].name).toBe('chorus');
    expect(sections[0].results.map((r) => r.displayName)).toEqual(['C', 'D']);
  });

  it('returns error for too many sections', () => {
    const input = 'a: C; b: C; c: C; d: C; e: C; f: C; g: C';
    const { error } = service.searchSections(input);

    expect(error).toContain('6');
  });

  it('returns error for too many chords in a section', () => {
    const { error } = service.searchSections('verse: C, D, E, F, G, A, B');

    expect(error).toContain('verse');
  });

  it('finds A5 chord — available in @gblp/chords-db but not in the original tombatossals/chords-db', () => {
    const [result] = service.search('A5');

    expect(result.error).toBeUndefined();
    expect(result.displayName).toBe('A5');
    expect(result.positions.length).toBeGreaterThan(0);
  });

  it('puts a drawn shape from the token first, ahead of the chords-db positions', () => {
    const [plain] = service.search('Em');
    const [result] = service.search('Em[xx200x]');
    expect(result.displayName).toBe('Em');
    expect(result.error).toBeUndefined();
    expect(result.positions.length).toBe(plain.positions.length + 1);
    expect(result.positions[0]).toEqual({ frets: [-1, -1, 2, 0, 0, -1], baseFret: 1, barres: [], midi: [52, 55, 59] });
  });

  it('stores a shape above the 4th fret relative to its baseFret, hex for frets 10+', () => {
    const [result] = service.search('Em[xxx987]');
    expect(result.positions[0]).toMatchObject({ frets: [-1, -1, -1, 3, 2, 1], baseFret: 7 });
    expect(service.search('Em[xxxccc]')[0].positions[0]).toMatchObject({ frets: [-1, -1, -1, 1, 1, 1], baseFret: 12 });
  });

  it('leaves chords-db triads out unless asked for', () => {
    const [base] = service.search('Em');
    const [all] = service.search('Em', 'en', { triads: true });
    expect(base.positions.some((p) => p.triad)).toBe(false);
    expect(all.positions.slice(0, base.positions.length)).toEqual(base.positions);
    expect(all.positions.length).toBeGreaterThan(base.positions.length);
    expect(service.qualityCatalog('E').every((c) => c.positions.every((p) => !p.triad))).toBe(true);
  });
});
