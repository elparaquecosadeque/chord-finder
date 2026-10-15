import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { ChordFinderCopy } from '../../chord-finder';
import { ChordSearchResult, ChordsDbChord, ChordsDbPosition } from '../../models/chord.model';
import { ChordDiagram } from '../chord-diagram/chord-diagram';

// One result card: the normal diagram + position picker, or — while catalogOpen —
// a collapsed-by-default carousel for browsing this same root's other qualities.
// Purely presentational: all state (position index, catalog open/preview index)
// lives in ChordFinderComponent, keyed by result.id, so two cards for the same
// repeated chord never share state.
@Component({
  selector: 'app-result-card',
  standalone: true,
  imports: [FormsModule, ChordDiagram],
  templateUrl: './result-card.html',
  styleUrl: './result-card.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ResultCard {
  readonly result = input.required<ChordSearchResult>();
  readonly text = input.required<ChordFinderCopy>();
  readonly positionIndex = input(0);
  readonly catalog = input<ChordsDbChord[]>([]);
  readonly catalogOpen = input(false);
  readonly previewIndex = input(0);
  readonly previewName = input('');
  readonly previewIsFavorite = input(false);

  readonly positionChange = output<string | number>();
  readonly toggleCatalog = output<void>();
  readonly stepCatalog = output<number>();
  readonly applyCatalog = output<void>();
  readonly toggleFavorite = output<void>();

  readonly selectedPosition = computed<ChordsDbPosition | null>(() => {
    const positions = this.result().positions;
    return positions[this.positionIndex()] ?? positions[0] ?? null;
  });

  readonly previewEntry = computed<ChordsDbChord | null>(() => this.catalog()[this.previewIndex()] ?? null);

  readonly previewPosition = computed<ChordsDbPosition | null>(
    () => this.previewEntry()?.positions[0] ?? null,
  );
}
