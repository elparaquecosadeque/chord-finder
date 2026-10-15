import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { qualityDifficulty } from './chord-difficulty';
import { ResultCard } from './components/result-card/result-card';
import {
  ChordSearchResult,
  ChordSection,
  ChordsDbChord,
  Language,
} from './models/chord.model';
import { ChordService } from './services/chord.service';
import { FavoriteQualitiesService } from './services/favorite-qualities.service';

const SHOW_NOTES_KEY = 'chord-finder-show-notes';

function loadShowNotes(): boolean {
  try {
    return localStorage.getItem(SHOW_NOTES_KEY) === 'true';
  } catch {
    return false;
  }
}

export interface ChordFinderCopy {
  eyebrow: string;
  title: string;
  descriptionStart: string;
  descriptionLimit: string;
  descriptionEnd: string;
  inputLabel: string;
  showNotes: string;
  exportPng: string;
  bgColor: string;
  lineColor: string;
  transparent: string;
  download: string;
  downloadBySection: string;
  downloadIndividual: string;
  availableTypes: string;
  resultsLabel: string;
  chord: string;
  normalizedAs: string;
  position: string;
  of: string;
  changeQuality: string;
  applyQuality: string;
  cancelQuality: string;
  quality: string;
  qualityCatalogLabel: string;
  previousQuality: string;
  nextQuality: string;
  addFavoriteQuality: string;
  removeFavoriteQuality: string;
  openSource: string;
  contributions: string;
  assistance: string;
}

const COPY: Record<Language, ChordFinderCopy> = {
  en: {
    eyebrow: 'Angular · SVG · chords-db',
    title: 'Chord Finder',
    descriptionStart: 'Enter up to',
    descriptionLimit: '5 chords',
    descriptionEnd: 'separated by commas. Sharps and flats are supported:',
    inputLabel: 'Chords',
    showNotes: 'Show notes',
    exportPng: 'Export PNG',
    bgColor: 'Background',
    lineColor: 'Diagram color',
    transparent: 'Transparent',
    download: 'Download',
    downloadBySection: 'Download by section',
    downloadIndividual: 'Download individually',
    availableTypes: 'Available chord types:',
    resultsLabel: 'Chord results',
    chord: 'Chord',
    normalizedAs: 'Normalized as',
    position: 'Position',
    of: 'of',
    changeQuality: 'Qualities',
    applyQuality: 'Apply',
    cancelQuality: 'Cancel',
    quality: 'Quality',
    qualityCatalogLabel: 'Chord quality catalog',
    previousQuality: 'Previous quality',
    nextQuality: 'Next quality',
    addFavoriteQuality: 'Mark as favorite',
    removeFavoriteQuality: 'Remove from favorites',
    openSource: 'Open source project:',
    contributions: 'Contributions are welcome.',
    assistance:
      'Built with AI assistance under supervision from the repository owner.',
  },
  es: {
    eyebrow: 'Angular · SVG · chords-db',
    title: 'Buscador de acordes',
    descriptionStart: 'Escribe hasta',
    descriptionLimit: '5 acordes',
    descriptionEnd: 'separados por coma. Soporta sostenidos y bemoles:',
    inputLabel: 'Acordes',
    showNotes: 'Mostrar notas',
    exportPng: 'Exportar PNG',
    bgColor: 'Fondo',
    lineColor: 'Color del diagrama',
    transparent: 'Transparente',
    download: 'Descargar',
    downloadBySection: 'Descargar por sección',
    downloadIndividual: 'Descargar individualmente',
    availableTypes: 'Tipos de acorde disponibles:',
    resultsLabel: 'Resultados de acordes',
    chord: 'Acorde',
    normalizedAs: 'Normalizado como',
    position: 'Posición',
    of: 'de',
    changeQuality: 'Calidades',
    applyQuality: 'Aplicar',
    cancelQuality: 'Cancelar',
    quality: 'Calidad',
    qualityCatalogLabel: 'Catálogo de calidades del acorde',
    previousQuality: 'Calidad anterior',
    nextQuality: 'Calidad siguiente',
    addFavoriteQuality: 'Marcar como favorita',
    removeFavoriteQuality: 'Quitar de favoritas',
    openSource: 'Proyecto de código abierto:',
    contributions: 'Las contribuciones son bienvenidas.',
    assistance:
      'Creado con asistencia de IA bajo la supervisión del propietario del repositorio.',
  },
};

@Component({
  selector: 'the-chords-chord-finder',
  standalone: true,
  imports: [FormsModule, ResultCard],
  templateUrl: './chord-finder.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './chord-finder.scss',
  host: { '[attr.lang]': 'language()' },
})
export class ChordFinderComponent {
  readonly language = input<Language>('en');
  readonly text = computed(() => COPY[this.language()]);
  query = signal('C');
  // Global — one switch for every diagram on the page, not per-card.
  // Persisted across sessions (see onShowNotesChange below).
  showNotes = signal(loadShowNotes());
  results = signal<ChordSearchResult[]>([]);
  sections = signal<ChordSection[]>([]);
  inputMode = signal<'plain' | 'sections'>('plain');
  inputError = signal<string | null>(null);
  selectedPositionIndex: Record<string, number> = {};
  // Per-card quality carousel state, keyed by result.id — same plain-object-mutation
  // pattern as selectedPositionIndex above, never shared across cards even when the
  // same chord is typed twice.
  catalogOpen: Record<string, boolean> = {};
  catalogPreviewIndex: Record<string, number> = {};
  supportedSuffixes = computed(() =>
    this.chordService.suffixes().slice(0, 18).join(', '),
  );
  readonly hasResults = computed(() =>
    this.inputMode() === 'sections'
      ? this.sections().length > 0
      : this.results().length > 0,
  );

  resultsRow = viewChild<ElementRef<HTMLElement>>('resultsRow');
  sectionsContainer = viewChild<ElementRef<HTMLElement>>('sectionsContainer');

  exportPanelOpen = signal(false);
  exportBgColor = '#ffffff';
  exportLineColor = '#000000';
  exportTransparent = false;

  constructor(
    private readonly chordService: ChordService,
    private readonly favoriteQualities: FavoriteQualitiesService,
  ) {
    effect(() => this.runSearch(this.language()));
  }

  private static readonly DOWNLOAD_STAGGER_MS = 220;

  /** Combined download: one row (plain) or all sections stacked with labels (sections). */
  async exportCombined(): Promise<void> {
    if (this.inputMode() === 'sections') {
      const container = this.sectionsContainer()?.nativeElement;
      if (!container) return;
      const groups = this.sections()
        .map((section, i) => {
          const sectionEl = container.querySelector<HTMLElement>(
            `[data-section="${i}"]`,
          );
          const svgs = sectionEl
            ? Array.from(
                sectionEl.querySelectorAll<SVGSVGElement>('svg.chord-svg'),
              )
            : [];
          return { label: section.name, svgs };
        })
        .filter((group) => group.svgs.length > 0);
      if (!groups.length) return;
      await this.renderStackedPng(groups, 'chords');
    } else {
      const svgs = Array.from(
        this.resultsRow()?.nativeElement.querySelectorAll<SVGSVGElement>(
          'svg.chord-svg',
        ) ?? [],
      );
      if (!svgs.length) return;
      await this.renderPng(svgs, 'chords');
    }
  }

  /** Sections mode only: one PNG per section. */
  async exportBySection(): Promise<void> {
    const container = this.sectionsContainer()?.nativeElement;
    if (!container) return;
    for (const [i, section] of this.sections().entries()) {
      const sectionEl = container.querySelector<HTMLElement>(
        `[data-section="${i}"]`,
      );
      if (!sectionEl) continue;
      const svgs = Array.from(
        sectionEl.querySelectorAll<SVGSVGElement>('svg.chord-svg'),
      );
      if (!svgs.length) continue;
      await this.renderPng(svgs, this.slugify(section.name) || 'section');
      await this.delay(ChordFinderComponent.DOWNLOAD_STAGGER_MS);
    }
  }

  /** One PNG per unique (chord, selected position), deduplicated across sections. */
  async exportIndividual(): Promise<void> {
    const sectionsMode = this.inputMode() === 'sections';
    const flatResults = sectionsMode
      ? this.sections().flatMap((section) => section.results)
      : this.results();
    const root = sectionsMode
      ? this.sectionsContainer()?.nativeElement
      : this.resultsRow()?.nativeElement;
    if (!root) return;

    for (const { result, filename } of this.uniqueChordSelections(
      flatResults,
    )) {
      const svg = root.querySelector<SVGSVGElement>(
        `[data-result-id="${result.id}"] svg.chord-svg`,
      );
      if (!svg) continue;
      await this.renderPng([svg], filename);
      await this.delay(ChordFinderComponent.DOWNLOAD_STAGGER_MS);
    }
  }

  private uniqueChordSelections(
    results: ChordSearchResult[],
  ): { result: ChordSearchResult; filename: string }[] {
    const firstByKey = new Map<
      string,
      { result: ChordSearchResult; positionIndex: number }
    >();
    for (const result of results) {
      if (result.error || !result.positions.length) continue;
      const positionIndex = this.selectedIndex(result.id);
      const key = `${result.displayName}::${positionIndex}`;
      if (!firstByKey.has(key)) {
        firstByKey.set(key, { result, positionIndex });
      }
    }

    const countByName = new Map<string, number>();
    for (const { result } of firstByKey.values()) {
      countByName.set(
        result.displayName,
        (countByName.get(result.displayName) ?? 0) + 1,
      );
    }

    return Array.from(firstByKey.values()).map(
      ({ result, positionIndex }) => {
        const slug = this.slugify(result.displayName);
        const hasVariants = (countByName.get(result.displayName) ?? 0) > 1;
        return {
          result,
          filename: hasVariants ? `${slug}-pos${positionIndex + 1}` : slug,
        };
      },
    );
  }

  private slugify(value: string): string {
    return (
      value
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '') || 'chord'
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private diagramStyleTag(bg: string, fg: string, fgInverse: string): string {
    // ponytail: text inside filled dots/barres inverts bg; transparent defaults to white
    return `<style>
      .chord-svg{font-family:Roboto,Arial,sans-serif;font-weight:400}
      .card-bg{fill:${bg}}.title{font-size:42px;font-weight:400;fill:${fg}}
      .grid line{stroke:${fg};stroke-width:2.6;stroke-linecap:square}
      .grid line.nut{stroke-width:7}.barres rect,.dots circle{fill:${fg}}
      .barres text,.dots text{fill:${fgInverse};font-size:16px;font-weight:400;dominant-baseline:central;alignment-baseline:middle}
      .barres text.note,.dots text.note{font-size:13px}
      .markers text{fill:${fg};font-size:30px;font-weight:400}
      .markers text.note{font-size:15px}
      .fret-number{fill:${fg};font-size:42px;font-weight:400}
      .string-labels text{fill:${fg};font-size:18px;font-weight:400}
    </style>`;
  }

  private async drawSvgToCanvas(
    ctx: CanvasRenderingContext2D,
    svg: SVGSVGElement,
    bg: string,
    fg: string,
    fgInverse: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ): Promise<void> {
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.insertAdjacentHTML('afterbegin', this.diagramStyleTag(bg, fg, fgInverse));

    const url = URL.createObjectURL(
      new Blob([new XMLSerializer().serializeToString(clone)], {
        type: 'image/svg+xml',
      }),
    );
    const image = new Image();
    image.src = url;
    await image.decode();

    ctx.drawImage(image, x, y, width, height);
    URL.revokeObjectURL(url);
  }

  private triggerDownload(canvas: HTMLCanvasElement, filename: string): void {
    const link = document.createElement('a');
    link.download = `${filename}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  private async renderPng(
    svgs: SVGSVGElement[],
    filename: string,
  ): Promise<void> {
    const padding = 32;
    const gap = 24;
    const width = 240;
    const height = 330;
    const scale = 2;

    const canvas = document.createElement('canvas');
    canvas.width =
      (padding * 2 + svgs.length * width + (svgs.length - 1) * gap) * scale;
    canvas.height = (padding * 2 + height) * scale;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(scale, scale);

    if (!this.exportTransparent) {
      ctx.fillStyle = this.exportBgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const bg = this.exportTransparent ? 'transparent' : this.exportBgColor;
    const fg = this.exportLineColor;
    const fgInverse = this.exportTransparent ? '#ffffff' : this.exportBgColor;

    for (const [index, svg] of svgs.entries()) {
      await this.drawSvgToCanvas(
        ctx,
        svg,
        bg,
        fg,
        fgInverse,
        padding + index * (width + gap),
        padding,
        width,
        height,
      );
    }

    this.triggerDownload(canvas, filename);
  }

  private async renderStackedPng(
    groups: { label: string; svgs: SVGSVGElement[] }[],
    filename: string,
  ): Promise<void> {
    const padding = 32;
    const gap = 24;
    const rowGap = 56;
    const labelHeight = 40;
    const width = 240;
    const height = 330;
    const scale = 2;

    const maxCols = Math.max(...groups.map((group) => group.svgs.length));
    const rowWidth = maxCols * width + (maxCols - 1) * gap;
    const totalHeight =
      groups.length * (labelHeight + height) + (groups.length - 1) * rowGap;

    const canvas = document.createElement('canvas');
    canvas.width = (padding * 2 + rowWidth) * scale;
    canvas.height = (padding * 2 + totalHeight) * scale;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(scale, scale);

    if (!this.exportTransparent) {
      ctx.fillStyle = this.exportBgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const bg = this.exportTransparent ? 'transparent' : this.exportBgColor;
    const fg = this.exportLineColor;
    const fgInverse = this.exportTransparent ? '#ffffff' : this.exportBgColor;

    let y = padding;
    for (const group of groups) {
      ctx.fillStyle = fg;
      ctx.font = '700 26px Roboto, Arial, sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillText(group.label.toUpperCase(), padding, y);
      y += labelHeight;

      for (const [index, svg] of group.svgs.entries()) {
        await this.drawSvgToCanvas(
          ctx,
          svg,
          bg,
          fg,
          fgInverse,
          padding + index * (width + gap),
          y,
          width,
          height,
        );
      }

      y += height + rowGap;
    }

    this.triggerDownload(canvas, filename);
  }

  onShowNotesChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.showNotes.set(checked);
    try {
      localStorage.setItem(SHOW_NOTES_KEY, String(checked));
    } catch {
      // localStorage unavailable (private browsing, etc.) — preference just won't persist.
    }
  }

  onQueryChange(value: string): void {
    this.query.set(value);
    this.runSearch();
  }

  runSearch(language: Language = this.language()): void {
    const query = this.query().trim();

    if (this.chordService.isSectionFormat(query)) {
      this.inputMode.set('sections');
      const { sections, error } = this.chordService.searchSections(
        query,
        language,
      );
      this.inputError.set(error);
      this.sections.set(sections);
      this.results.set([]);
      for (const section of sections) {
        for (const result of section.results) {
          if (this.selectedPositionIndex[result.id] === undefined) {
            this.selectedPositionIndex[result.id] = 0;
          }
        }
      }
    } else {
      this.inputMode.set('plain');
      this.inputError.set(null);
      const results = this.chordService.search(query, language);
      this.results.set(results);
      this.sections.set([]);
      for (const result of results) {
        if (this.selectedPositionIndex[result.id] === undefined) {
          this.selectedPositionIndex[result.id] = 0;
        }
      }
    }
  }

  selectPosition(resultId: string, value: string | number): void {
    this.selectedPositionIndex[resultId] = Number(value);
  }

  selectedIndex(resultId: string): number {
    return this.selectedPositionIndex[resultId] ?? 0;
  }

  trackByResultId(_: number, result: ChordSearchResult): string {
    return result.id;
  }

  // --- Quality catalog (per-card carousel) ---

  // Favorites for this root first (easiest-to-hardest among themselves), then
  // everything else, also easiest-to-hardest. One ordering pass, not two lists.
  qualityCatalog(result: ChordSearchResult): ChordsDbChord[] {
    const dbRoot = result.dbRoot;
    if (!dbRoot) return [];
    const catalog = this.chordService.qualityCatalog(dbRoot);
    return [...catalog].sort((a, b) => {
      const favA = this.favoriteQualities.isFavorite(dbRoot, a.suffix);
      const favB = this.favoriteQualities.isFavorite(dbRoot, b.suffix);
      if (favA !== favB) return favA ? -1 : 1;
      return qualityDifficulty(a) - qualityDifficulty(b);
    });
  }

  isCatalogOpen(resultId: string): boolean {
    return !!this.catalogOpen[resultId];
  }

  toggleCatalog(result: ChordSearchResult): void {
    if (this.isCatalogOpen(result.id)) {
      this.closeCatalog(result.id);
      return;
    }
    const catalog = this.qualityCatalog(result);
    const currentIndex = catalog.findIndex((c) => c.suffix === result.chord?.suffix);
    this.catalogPreviewIndex[result.id] = currentIndex >= 0 ? currentIndex : 0;
    this.catalogOpen[result.id] = true;
  }

  closeCatalog(resultId: string): void {
    this.catalogOpen[resultId] = false;
  }

  catalogPreviewEntry(result: ChordSearchResult): ChordsDbChord | null {
    const catalog = this.qualityCatalog(result);
    return catalog[this.catalogPreviewIndex[result.id] ?? 0] ?? null;
  }

  catalogPreviewIndexOf(resultId: string): number {
    return this.catalogPreviewIndex[resultId] ?? 0;
  }

  catalogPreviewName(result: ChordSearchResult): string {
    const entry = this.catalogPreviewEntry(result);
    return entry && result.root ? this.chordService.formatChordName(result.root, entry.suffix) : '';
  }

  // Toggling can re-sort the catalog (favorites float to the front), which would
  // shift catalogPreviewIndex to point at a DIFFERENT entry if left as-is — re-find
  // the same quality by suffix afterward so the preview stays on what you just starred.
  toggleFavoriteQuality(result: ChordSearchResult): void {
    const entry = this.catalogPreviewEntry(result);
    if (!entry || !result.dbRoot) return;
    this.favoriteQualities.toggle(result.dbRoot, entry.suffix);
    const catalog = this.qualityCatalog(result);
    const newIndex = catalog.findIndex((c) => c.suffix === entry.suffix);
    this.catalogPreviewIndex[result.id] = newIndex >= 0 ? newIndex : 0;
  }

  isPreviewFavorite(result: ChordSearchResult): boolean {
    const entry = this.catalogPreviewEntry(result);
    return !!entry && !!result.dbRoot && this.favoriteQualities.isFavorite(result.dbRoot, entry.suffix);
  }

  stepCatalog(result: ChordSearchResult, delta: number): void {
    const catalog = this.qualityCatalog(result);
    if (!catalog.length) return;
    const current = this.catalogPreviewIndexOf(result.id);
    this.catalogPreviewIndex[result.id] = Math.max(0, Math.min(catalog.length - 1, current + delta));
  }

  applyCatalogQuality(result: ChordSearchResult): void {
    const entry = this.catalogPreviewEntry(result);
    if (!entry || !result.root) return;
    const newName = this.chordService.formatChordName(result.root, entry.suffix);
    const rename = (r: ChordSearchResult): string => (r.id === result.id ? newName : r.raw);
    const newQuery =
      this.inputMode() === 'sections'
        ? this.sections()
            .map((section) => `${section.name}: ${section.results.map(rename).join(', ')}`)
            .join('; ')
        : this.results().map(rename).join(', ');
    this.closeCatalog(result.id);
    this.onQueryChange(newQuery);
  }
}
