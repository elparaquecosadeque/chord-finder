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

  async exportPng(): Promise<void> {
    if (this.inputMode() === 'sections') {
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
        const filename =
          section.name
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '') || 'section';
        await this.renderPng(svgs, filename);
      }
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
    // ponytail: text inside filled dots/barres inverts bg; transparent defaults to white
    const fgInverse = this.exportTransparent ? '#ffffff' : this.exportBgColor;

    for (const [index, svg] of svgs.entries()) {
      const clone = svg.cloneNode(true) as SVGSVGElement;

      clone.insertAdjacentHTML(
        'afterbegin',
        `<style>
      .chord-svg{font-family:Roboto,Arial,sans-serif;font-weight:400}
      .card-bg{fill:${bg}}.title{font-size:42px;font-weight:400;fill:${fg}}
      .grid line{stroke:${fg};stroke-width:2.6;stroke-linecap:square}
      .grid line.nut{stroke-width:7}.barres rect,.dots circle{fill:${fg}}
      .barres text,.dots text{fill:${fgInverse};font-size:16px;font-weight:400;dominant-baseline:central;alignment-baseline:middle}
      .markers text{fill:${fg};font-size:30px;font-weight:400}
      .fret-number{fill:${fg};font-size:42px;font-weight:400}
      .string-labels text{fill:${fg};font-size:18px;font-weight:400}
    </style>`,
      );

      const url = URL.createObjectURL(
        new Blob([new XMLSerializer().serializeToString(clone)], {
          type: 'image/svg+xml',
        }),
      );
      const image = new Image();
      image.src = url;
      await image.decode();

      ctx.drawImage(
        image,
        padding + index * (width + gap),
        padding,
        width,
        height,
      );
      URL.revokeObjectURL(url);
    }

    const link = document.createElement('a');
    link.download = `${filename}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
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
