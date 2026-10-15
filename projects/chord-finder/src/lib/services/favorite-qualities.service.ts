import { Injectable } from '@angular/core';

const STORAGE_KEY = 'chord-finder-favorite-qualities';

function loadAll(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string[]>) : {};
  } catch {
    return {};
  }
}

// Favorite chord qualities, scoped per root (dbRoot) — favoriting "add9" for C doesn't
// affect D's catalog. Plain-object storage, mirroring the rest of ChordFinderComponent's
// state (selectedPositionIndex, catalogOpen): no signals, re-read on demand.
@Injectable({ providedIn: 'root' })
export class FavoriteQualitiesService {
  private favorites: Record<string, string[]> = loadAll();

  isFavorite(dbRoot: string, suffix: string): boolean {
    return this.favorites[dbRoot]?.includes(suffix) ?? false;
  }

  toggle(dbRoot: string, suffix: string): void {
    const current = this.favorites[dbRoot] ?? [];
    const next = current.includes(suffix) ? current.filter((s) => s !== suffix) : [...current, suffix];
    this.favorites = { ...this.favorites, [dbRoot]: next };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.favorites));
  }
}
