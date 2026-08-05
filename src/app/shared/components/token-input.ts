import { Component, ElementRef, forwardRef, input, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { AppIcon } from './app-icon';

@Component({
  selector: 'app-token-input',
  imports: [AppIcon],
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => TokenInput), multi: true },
  ],
  template: `
    <div class="token-field" [class.disabled]="disabled()">
      @for (token of tokens(); track token; let index = $index) {
        <span class="token-pill">
          <span>{{ token }}</span>
          <button
            type="button"
            [attr.aria-label]="'Remove ' + token"
            [disabled]="disabled()"
            (click)="remove(index, $event)"
          >
            <app-icon name="close" />
          </button>
        </span>
      }
      <input
        #entry
        type="text"
        autocomplete="off"
        [value]="draft()"
        [placeholder]="tokens().length ? '' : placeholder()"
        [attr.aria-label]="ariaLabel()"
        [disabled]="disabled()"
        (input)="updateDraft($event)"
        (keydown)="handleKeydown($event)"
        (blur)="commitAndTouch()"
      />
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .token-field {
      display: flex;
      width: 100%;
      min-height: 3.45rem;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.4rem;
      padding: 0.4rem 0.5rem;
      border: 1px solid var(--border-strong);
      border-radius: 0.75rem;
      background: var(--surface);
      cursor: text;
    }
    .token-field:focus-within {
      border-color: var(--primary);
      outline: 3px solid color-mix(in srgb, var(--primary) 28%, transparent);
    }
    .token-field.disabled {
      cursor: not-allowed;
      opacity: 0.65;
    }
    .token-pill {
      display: inline-flex;
      max-width: 100%;
      min-height: 2rem;
      align-items: center;
      gap: 0.2rem;
      padding: 0.2rem 0.25rem 0.2rem 0.65rem;
      border-radius: 2rem;
      color: var(--primary-deep);
      background: var(--primary-soft);
      font-size: 0.78rem;
      font-weight: 700;
    }
    .token-pill > span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .token-pill button {
      display: inline-grid;
      width: 1.6rem;
      height: 1.6rem;
      flex: 0 0 auto;
      place-items: center;
      padding: 0.35rem;
      border: 0;
      border-radius: 50%;
      color: currentColor;
      background: transparent;
    }
    .token-pill button:hover,
    .token-pill button:focus-visible {
      background: color-mix(in srgb, var(--primary) 16%, transparent);
    }
    .token-pill app-icon {
      width: 0.8rem;
      height: 0.8rem;
    }
    .token-field input:not([type='checkbox']):not([type='radio']) {
      width: auto;
      min-width: 8rem;
      min-height: 2rem;
      flex: 1 1 8rem;
      padding: 0.25rem;
      border: 0;
      border-radius: 0;
      outline: 0;
      background: transparent;
    }
  `,
})
export class TokenInput implements ControlValueAccessor {
  readonly placeholder = input('Type and press comma');
  readonly ariaLabel = input('Add values');
  readonly tokens = signal<readonly string[]>([]);
  readonly draft = signal('');
  readonly disabled = signal(false);
  private readonly entry = viewChild<ElementRef<HTMLInputElement>>('entry');
  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: string | null | undefined): void {
    this.tokens.set(this.parse(value ?? ''));
    this.draft.set('');
  }

  registerOnChange(callback: (value: string) => void): void {
    this.onChange = callback;
  }

  registerOnTouched(callback: () => void): void {
    this.onTouched = callback;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  focusInput(): void {
    if (!this.disabled()) this.entry()?.nativeElement.focus();
  }

  updateDraft(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (!value.includes(',')) {
      this.draft.set(value);
      return;
    }
    const parts = value.split(',');
    this.add(parts.slice(0, -1));
    this.draft.set(parts.at(-1) ?? '');
  }

  handleKeydown(event: KeyboardEvent): void {
    if (event.key === ',' || event.key === 'Enter') {
      event.preventDefault();
      this.commitDraft();
      return;
    }
    if (event.key === 'Backspace' && !this.draft() && this.tokens().length) {
      this.tokens.update((tokens) => tokens.slice(0, -1));
      this.emitValue();
    }
  }

  commitAndTouch(): void {
    this.commitDraft();
    this.onTouched();
  }

  remove(index: number, event: MouseEvent): void {
    event.stopPropagation();
    this.tokens.update((tokens) => tokens.filter((_, tokenIndex) => tokenIndex !== index));
    this.emitValue();
    this.focusInput();
  }

  private commitDraft(): void {
    this.add([this.draft()]);
    this.draft.set('');
  }

  private add(values: readonly string[]): void {
    const candidates = values.map((value) => value.trim()).filter(Boolean);
    if (!candidates.length) return;
    this.tokens.update((tokens) => {
      const next = [...tokens];
      const normalized = new Set(next.map((token) => token.toLocaleLowerCase()));
      for (const candidate of candidates) {
        const key = candidate.toLocaleLowerCase();
        if (normalized.has(key)) continue;
        normalized.add(key);
        next.push(candidate);
      }
      return next;
    });
    this.emitValue();
  }

  private emitValue(): void {
    this.onChange(this.tokens().join(', '));
  }

  private parse(value: string): readonly string[] {
    const result: string[] = [];
    const normalized = new Set<string>();
    for (const token of value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)) {
      const key = token.toLocaleLowerCase();
      if (normalized.has(key)) continue;
      normalized.add(key);
      result.push(token);
    }
    return result;
  }
}
