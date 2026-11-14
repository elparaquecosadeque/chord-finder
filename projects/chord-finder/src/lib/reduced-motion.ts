// Shared by every GSAP tween in this lib — checked live (not cached) since the
// OS setting can change while the page is open.
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function motionDuration(seconds: number): number {
  return prefersReducedMotion() ? 0 : seconds;
}
