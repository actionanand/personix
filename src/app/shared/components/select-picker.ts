import {
  booleanAttribute,
  Component,
  computed,
  forwardRef,
  input,
  model,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { AppIcon } from './app-icon';

export interface SelectPickerOption {
  readonly value: string;
  readonly label: string;
  readonly detail?: string;
  readonly icon?: string;
  readonly disabled?: boolean;
}

@Component({
  selector: 'app-select-picker',
  imports: [AppIcon],
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SelectPicker), multi: true },
  ],
  template: `
    <button
      type="button"
      class="picker-trigger"
      [class.compact]="compact()"
      [disabled]="isDisabled()"
      [attr.aria-expanded]="open()"
      aria-haspopup="dialog"
      (click)="show()"
    >
      <span>{{ selectedOption()?.label ?? placeholder() }}</span>
      <app-icon name="chevron-down" />
    </button>

    @if (open()) {
      <div class="picker-overlay">
        <button
          class="picker-backdrop"
          type="button"
          aria-label="Close options"
          (click)="close()"
        ></button>
        <section
          class="picker-sheet"
          [class.many-options]="options().length > 8"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="sheetTitle()"
        >
          <header>
            <strong>{{ sheetTitle() }}</strong>
            <button type="button" aria-label="Close options" (click)="close()">
              <app-icon name="close" />
            </button>
          </header>
          <div role="listbox" [attr.aria-label]="sheetTitle()">
            @for (option of options(); track option.value) {
              <button
                type="button"
                class="picker-option"
                [class.selected]="option.value === value()"
                [disabled]="option.disabled"
                role="option"
                [attr.aria-selected]="option.value === value()"
                (click)="select(option.value)"
              >
                @if (option.icon) {
                  <span class="option-icon"><app-icon [name]="option.icon" /></span>
                }
                <span class="option-copy"
                  ><strong>{{ option.label }}</strong>
                  @if (option.detail) {
                    <small>{{ option.detail }}</small>
                  }
                </span>
                @if (option.value === value()) {
                  <app-icon class="option-check" name="check" />
                }
              </button>
            }
          </div>
        </section>
      </div>
    }
  `,
  styleUrl: './select-picker.scss',
  host: { '(document:keydown.escape)': 'close()' },
})
export class SelectPicker implements ControlValueAccessor {
  readonly value = model('');
  readonly options = input.required<readonly SelectPickerOption[]>();
  readonly sheetTitle = input('Choose an option');
  readonly placeholder = input('Choose an option');
  readonly disabled = input(false);
  readonly compact = input(false, { transform: booleanAttribute });
  readonly open = signal(false);
  readonly formDisabled = signal(false);
  readonly isDisabled = computed(() => this.disabled() || this.formDisabled());
  readonly selectedOption = computed(() =>
    this.options().find((option) => option.value === this.value()),
  );
  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: string | null | undefined): void {
    this.value.set(value ?? '');
  }
  registerOnChange(callback: (value: string) => void): void {
    this.onChange = callback;
  }
  registerOnTouched(callback: () => void): void {
    this.onTouched = callback;
  }
  setDisabledState(disabled: boolean): void {
    this.formDisabled.set(disabled);
  }

  show(): void {
    if (!this.isDisabled()) this.open.set(true);
  }
  close(): void {
    if (this.open()) this.onTouched();
    this.open.set(false);
  }
  select(value: string): void {
    this.value.set(value);
    this.onChange(value);
    this.onTouched();
    this.open.set(false);
  }
}
