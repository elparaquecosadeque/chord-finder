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
import { ChordDiagram } from './components/chord-diagram/chord-diagram';
import {
  ChordSearchResult,
  ChordSection,
  ChordsDbPosition,
  Language,
} from './models/chord.model';
import { ChordService } from './services/chord.service';

const COPY = {
  en: {
    eyebrow: 'Angular · SVG · chords-db',
    title: 'Chord Finder',
    descriptionStart: 'Enter up to',
    descriptionLimit: '5 chords',
    descriptionEnd: 'separated by commas. Sharps and flats are supported:',
    inputLabel: 'Chords',
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
    openSource: 'Proyecto de código abierto:',
    contributions: 'Las contribuciones son bienvenidas.',
    assistance:
      'Creado con asistencia de IA bajo la supervisión del propietario del repositorio.',
  },
} as const;

@Component({
  selector: 'the-chords-chord-finder',
  standalone: true,
  imports: [FormsModule, ChordDiagram],
  templateUrl: './chord-finder.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './chord-finder.scss',
  host: { '[attr.lang]': 'language()' },
})
export class ChordFinderComponent {
  readonly language = input<Language>('en');
  readonly text = computed(() => COPY[this.language()]);
  query = signal('C');
  results = signal<ChordSearchResult[]>([]);
  sections = signal<ChordSection[]>([]);
  inputMode = signal<'plain' | 'sections'>('plain');
  inputError = signal<string | null>(null);
  selectedPositionIndex: Record<string, number> = {};
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

  constructor(private readonly chordService: ChordService) {
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
      .markers text{fill:${fg};font-size:30px;font-weight:400}
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

  selectedPosition(result: ChordSearchResult): ChordsDbPosition | null {
    if (!result.positions.length) return null;
    return (
      result.positions[this.selectedPositionIndex[result.id] ?? 0] ??
      result.positions[0]
    );
  }

  trackByResultId(_: number, result: ChordSearchResult): string {
    return result.id;
  }
}
