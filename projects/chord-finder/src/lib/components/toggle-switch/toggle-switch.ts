import { Component, DestroyRef, ElementRef, effect, inject, input, output, viewChild } from '@angular/core';
import gsap from 'gsap';
import { motionDuration, prefersReducedMotion } from '../../reduced-motion';

// Standard on/off switch for this lib — visual lifted from @gblp/bass-notes'
// own toggle (same markup/CSS shape), with the thumb's slide animated by
// GSAP instead of a plain CSS transition so it can overshoot on toggle.
@Component({
  selector: 'app-toggle-switch',
  standalone: true,
  templateUrl: './toggle-switch.html',
  styleUrl: './toggle-switch.scss',
})
export class ToggleSwitch {
  readonly checked = input(false);
  readonly label = input.required<string>();
  readonly toggled = output<boolean>();

  private readonly thumb = viewChild<ElementRef<HTMLElement>>('thumb');
  private tween: gsap.core.Tween | null = null;

  constructor() {
    effect(() => {
      const on = this.checked();
      const el = this.thumb()?.nativeElement;
      if (!el) return;
      this.tween?.kill();
      this.tween = gsap.to(el, {
        x: on ? 14 : 0,
        duration: motionDuration(0.28),
        ease: prefersReducedMotion() ? 'none' : 'back.out(2.2)',
      });
    });
    inject(DestroyRef).onDestroy(() => this.tween?.kill());
  }

  onChange(event: Event): void {
    this.toggled.emit((event.target as HTMLInputElement).checked);
  }
}
