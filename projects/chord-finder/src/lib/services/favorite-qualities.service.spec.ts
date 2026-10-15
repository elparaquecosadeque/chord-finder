import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { FavoriteQualitiesService } from './favorite-qualities.service';

describe('FavoriteQualitiesService', () => {
  let service: FavoriteQualitiesService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(FavoriteQualitiesService);
  });

  it('starts with nothing favorited', () => {
    expect(service.isFavorite('C', 'add9')).toBe(false);
  });

  it('toggle turns a favorite on then off', () => {
    service.toggle('C', 'add9');
    expect(service.isFavorite('C', 'add9')).toBe(true);
    service.toggle('C', 'add9');
    expect(service.isFavorite('C', 'add9')).toBe(false);
  });

  it('scopes favorites per root', () => {
    service.toggle('C', 'add9');
    expect(service.isFavorite('D', 'add9')).toBe(false);
  });

  it('persists across a fresh service instance (localStorage)', () => {
    service.toggle('C', 'maj7');
    const fresh = new FavoriteQualitiesService();
    expect(fresh.isFavorite('C', 'maj7')).toBe(true);
  });
});
