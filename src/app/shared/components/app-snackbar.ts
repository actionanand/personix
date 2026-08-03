import { Component, inject } from '@angular/core';
import { FeedbackService } from '../../core/services/feedback.service';
import { AppIcon } from './app-icon';

@Component({
  selector: 'app-snackbar',
  imports: [AppIcon],
  template: `
    @if (feedback.current(); as message) {
      <section
        class="snackbar"
        [class]="'snackbar ' + message.kind"
        role="status"
        aria-live="polite"
      >
        <app-icon
          [name]="
            message.kind === 'success' ? 'check' : message.kind === 'error' ? 'alert' : 'info'
          "
        />
        <span>{{ message.text }}</span>
        @if (message.actionLabel) {
          <button type="button" (click)="feedback.dismiss(true)">{{ message.actionLabel }}</button>
        }
        <button
          type="button"
          class="icon-button"
          aria-label="Dismiss notification"
          (click)="feedback.dismiss()"
        >
          <app-icon name="close" />
        </button>
      </section>
    }
  `,
  styles: `
    .snackbar {
      position: fixed;
      z-index: 100;
      left: 50%;
      bottom: calc(5.5rem + env(safe-area-inset-bottom));
      transform: translateX(-50%);
      width: min(calc(100% - 2rem), 34rem);
      display: grid;
      grid-template-columns: auto 1fr auto auto;
      gap: 0.75rem;
      align-items: center;
      padding: 0.85rem 1rem;
      border: 1px solid var(--border);
      border-radius: 1rem;
      color: var(--text);
      background: var(--surface-strong);
      box-shadow: var(--shadow-lg);
    }
    .success {
      border-color: color-mix(in srgb, var(--primary) 35%, var(--border));
    }
    .error {
      border-color: color-mix(in srgb, var(--danger) 45%, var(--border));
    }
    button {
      border: 0;
      color: var(--primary);
      background: transparent;
      font-weight: 700;
    }
  `,
})
export class AppSnackbar {
  readonly feedback = inject(FeedbackService);
}
