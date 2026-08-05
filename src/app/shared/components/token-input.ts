import {
  booleanAttribute,
  Component,
  computed,
  ElementRef,
  forwardRef,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { isValidEmailAddress } from '../validators/comma-separated-emails.validator';
import { AppIcon } from './app-icon';

let nextTokenInputId = 0;

@Component({
  selector: 'app-token-input',
  imports: [AppIcon],
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => TokenInput), multi: true },
  ],
  template: `
    <div class="token-shell">
      <div
        class="token-field"
        [class.disabled]="disabled()"
        [class.invalid]="invalid() || rejectionMessage()"
      >
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
          role="combobox"
          aria-autocomplete="list"
          [attr.inputmode]="inputMode()"
          [value]="draft()"
          [placeholder]="tokens().length ? '' : placeholder()"
          [attr.aria-label]="ariaLabel()"
          [attr.aria-describedby]="inputDescriptionIds()"
          [attr.aria-invalid]="invalid() || !!rejectionMessage()"
          [attr.aria-controls]="listboxId"
          [attr.aria-expanded]="filteredSuggestions().length > 0"
          [attr.aria-activedescendant]="activeSuggestionId()"
          [disabled]="disabled()"
          (focus)="beginEditing()"
          (input)="updateDraft($event)"
          (keydown)="handleKeydown($event)"
          (blur)="commitAndTouch()"
        />
      </div>
      @if (rejectionMessage()) {
        <small class="token-rejection" [id]="rejectionId" role="alert">
          {{ rejectionMessage() }}
        </small>
      }
      @if (filteredSuggestions().length) {
        <div
          class="suggestion-list"
          role="listbox"
          [id]="listboxId"
          [attr.aria-label]="ariaLabel() + ' suggestions'"
        >
          @for (suggestion of filteredSuggestions(); track suggestion; let index = $index) {
            <button
              type="button"
              role="option"
              [id]="suggestionId(index)"
              [class.active]="index === activeSuggestionIndex()"
              [attr.aria-selected]="index === activeSuggestionIndex()"
              (pointerdown)="$event.preventDefault()"
              (click)="chooseSuggestion(suggestion)"
            >
              {{ suggestion }}
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .token-shell {
      position: relative;
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
    .token-field.invalid {
      border-color: var(--danger);
    }
    .token-field.invalid:focus-within {
      outline-color: color-mix(in srgb, var(--danger) 28%, transparent);
    }
    .token-field.disabled {
      cursor: not-allowed;
      opacity: 0.65;
    }
    .token-rejection {
      display: block;
      margin-top: 0.35rem;
      color: var(--danger);
      font-size: 0.7rem;
      font-weight: 600;
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
    .suggestion-list {
      position: absolute;
      z-index: 12;
      top: calc(100% + 0.3rem);
      right: 0;
      left: 0;
      display: grid;
      max-height: 14rem;
      overflow-y: auto;
      padding: 0.35rem;
      border: 1px solid var(--border-strong);
      border-radius: 0.75rem;
      background: var(--surface);
      box-shadow: var(--shadow-lg);
    }
    .suggestion-list button {
      width: 100%;
      min-height: 2.65rem;
      padding: 0.55rem 0.7rem;
      border: 0;
      border-radius: 0.55rem;
      color: var(--text);
      background: transparent;
      font: inherit;
      font-size: 0.82rem;
      font-weight: 650;
      text-align: left;
    }
    .suggestion-list button:hover,
    .suggestion-list button.active {
      color: var(--primary-deep);
      background: var(--primary-soft);
    }
  `,
})
export class TokenInput implements ControlValueAccessor {
  readonly placeholder = input('Type and press comma');
  readonly ariaLabel = input('Add values');
  readonly ariaDescribedBy = input<string>();
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly inputMode = input<'text' | 'tel' | 'email'>('text');
  readonly tokenType = input<'text' | 'email'>('text');
  readonly contactCharactersOnly = input(false, { transform: booleanAttribute });
  readonly suggestions = input<readonly string[]>([]);
  readonly tokens = signal<readonly string[]>([]);
  readonly draft = signal('');
  readonly disabled = signal(false);
  readonly suggestionsVisible = signal(false);
  readonly activeSuggestionIndex = signal(-1);
  readonly rejectionMessage = signal('');
  readonly listboxId = `token-suggestions-${nextTokenInputId++}`;
  readonly rejectionId = `${this.listboxId}-error`;
  readonly inputDescriptionIds = computed(() =>
    [this.ariaDescribedBy(), this.rejectionMessage() ? this.rejectionId : '']
      .filter(Boolean)
      .join(' '),
  );
  readonly filteredSuggestions = computed(() => {
    const query = this.draft().trim().toLocaleLowerCase();
    if (!this.suggestionsVisible() || !query) return [];
    const selected = new Set(this.tokens().map((token) => token.toLocaleLowerCase()));
    const seen = new Set<string>();
    return this.suggestions()
      .map((suggestion) => suggestion.trim())
      .filter(Boolean)
      .filter((suggestion) => {
        const key = suggestion.toLocaleLowerCase();
        if (selected.has(key) || seen.has(key) || !key.includes(query)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 8);
  });
  readonly activeSuggestionId = computed(() => {
    const index = this.activeSuggestionIndex();
    return index >= 0 && index < this.filteredSuggestions().length
      ? this.suggestionId(index)
      : null;
  });
  private readonly entry = viewChild<ElementRef<HTMLInputElement>>('entry');
  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: string | null | undefined): void {
    this.tokens.set(this.parse(value ?? ''));
    this.draft.set('');
    this.rejectionMessage.set('');
    this.closeSuggestions();
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

  beginEditing(): void {
    this.suggestionsVisible.set(true);
  }

  updateDraft(event: Event): void {
    this.rejectionMessage.set('');
    const inputElement = event.target as HTMLInputElement;
    const value = this.contactCharactersOnly()
      ? inputElement.value.replace(/[^\d+\-, ]/g, '')
      : inputElement.value;
    if (value !== inputElement.value) inputElement.value = value;
    if (!value.includes(',')) {
      this.draft.set(value);
      this.suggestionsVisible.set(true);
      this.activeSuggestionIndex.set(-1);
      return;
    }
    const parts = value.split(',');
    this.add(parts.slice(0, -1));
    const remainder = parts.at(-1) ?? '';
    this.draft.set(remainder);
    inputElement.value = remainder;
    this.suggestionsVisible.set(true);
    this.activeSuggestionIndex.set(-1);
  }

  handleKeydown(event: KeyboardEvent): void {
    const suggestions = this.filteredSuggestions();
    if (event.key === 'ArrowDown' && suggestions.length) {
      event.preventDefault();
      this.activeSuggestionIndex.update((index) => (index + 1) % suggestions.length);
      return;
    }
    if (event.key === 'ArrowUp' && suggestions.length) {
      event.preventDefault();
      this.activeSuggestionIndex.update((index) =>
        index <= 0 ? suggestions.length - 1 : index - 1,
      );
      return;
    }
    if (event.key === 'Escape' && suggestions.length) {
      event.preventDefault();
      this.closeSuggestions();
      return;
    }
    if (event.key === 'Enter' && this.activeSuggestionIndex() >= 0) {
      event.preventDefault();
      const selected = suggestions[this.activeSuggestionIndex()];
      if (selected) this.chooseSuggestion(selected);
      return;
    }
    if (this.contactCharactersOnly() && event.key.length === 1 && !/[\d+\-, ]/.test(event.key)) {
      event.preventDefault();
      return;
    }
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
    this.closeSuggestions();
    this.onTouched();
  }

  chooseSuggestion(suggestion: string): void {
    this.add([suggestion]);
    this.draft.set('');
    this.closeSuggestions();
    this.focusInput();
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
    this.closeSuggestions();
  }

  suggestionId(index: number): string {
    return `${this.listboxId}-option-${index}`;
  }

  private closeSuggestions(): void {
    this.suggestionsVisible.set(false);
    this.activeSuggestionIndex.set(-1);
  }

  private add(values: readonly string[]): void {
    const candidates = values.map((value) => value.trim()).filter(Boolean);
    if (!candidates.length) return;
    const acceptedCandidates =
      this.tokenType() === 'email'
        ? candidates.filter((candidate) => isValidEmailAddress(candidate))
        : candidates;
    if (acceptedCandidates.length !== candidates.length) {
      this.rejectionMessage.set('Enter a valid email address. The invalid value was removed.');
    }
    if (!acceptedCandidates.length) return;
    this.tokens.update((tokens) => {
      const next = [...tokens];
      const normalized = new Set(next.map((token) => token.toLocaleLowerCase()));
      for (const candidate of acceptedCandidates) {
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
