import { Injectable, signal } from '@angular/core';

export type FeedbackKind = 'success' | 'info' | 'warning' | 'error';

export interface SnackbarMessage {
  readonly id: string;
  readonly text: string;
  readonly kind: FeedbackKind;
  readonly actionLabel: string;
  readonly action?: () => void;
  readonly duration: number;
}

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private readonly queue = signal<readonly SnackbarMessage[]>([]);
  readonly current = signal<SnackbarMessage | null>(null);
  private timer: number | null = null;

  notify(
    text: string,
    kind: FeedbackKind = 'success',
    options?: {
      readonly actionLabel?: string;
      readonly action?: () => void;
      readonly duration?: number;
    },
  ): void {
    const message: SnackbarMessage = {
      id: crypto.randomUUID(),
      text,
      kind,
      actionLabel: options?.actionLabel ?? '',
      action: options?.action,
      duration: options?.duration ?? (kind === 'error' ? 6000 : 3500),
    };
    this.queue.update((items) => [...items, message]);
    this.showNext();
  }

  dismiss(runAction = false): void {
    const current = this.current();
    if (runAction) current?.action?.();
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
    this.current.set(null);
    this.showNext();
  }

  private showNext(): void {
    if (this.current()) return;
    const next = this.queue()[0];
    if (!next) return;
    this.queue.update((items) => items.slice(1));
    this.current.set(next);
    this.timer = window.setTimeout(() => this.dismiss(), next.duration);
  }
}
