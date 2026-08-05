import { Component, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogService } from '../../core/services/dialog.service';
import { AppIcon } from './app-icon';

@Component({
  selector: 'app-dialog',
  imports: [FormsModule, AppIcon],
  template: `
    @if (dialogs.active(); as dialog) {
      <div class="backdrop" (click)="cancel()" aria-hidden="true"></div>
      <section
        class="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-description"
        (keydown.escape)="cancel()"
      >
        <div class="dialog-icon" [class.destructive]="dialog.destructive">
          <app-icon [name]="dialog.icon" />
        </div>
        <div>
          <h2 id="dialog-title">{{ dialog.title }}</h2>
          <p id="dialog-description">{{ dialog.description }}</p>
        </div>
        @if (dialog.promptLabel) {
          <label
            >{{ dialog.promptLabel }}
            <input
              #dialogInput
              [type]="dialog.promptType"
              [ngModel]="value()"
              (ngModelChange)="value.set($event)"
              autocomplete="off"
            />
          </label>
        }
        @if (dialog.checkboxLabel) {
          <label class="checkbox"
            ><input type="checkbox" [ngModel]="checked()" (ngModelChange)="checked.set($event)" />
            <span>{{ dialog.checkboxLabel }}</span></label
          >
        }
        @if (dialog.typedConfirmation) {
          <label
            >Type <strong>{{ dialog.typedConfirmation }}</strong> to confirm
            <input
              #dialogInput
              type="text"
              [ngModel]="value()"
              (ngModelChange)="value.set($event)"
              autocomplete="off"
            />
          </label>
        }
        <div class="actions">
          <button type="button" class="button secondary" (click)="cancel()">
            {{ dialog.cancelText }}
          </button>
          <button
            type="button"
            class="button"
            [class.danger]="dialog.destructive"
            [disabled]="
              (dialog.typedConfirmation && value() !== dialog.typedConfirmation) ||
              (dialog.requireCheckbox && !checked())
            "
            (click)="confirm()"
          >
            {{ dialog.confirmText }}
          </button>
        </div>
      </section>
    }
  `,
  styleUrl: './app-dialog.scss',
})
export class AppDialog {
  readonly dialogs = inject(DialogService);
  readonly value = signal('');
  readonly checked = signal(false);
  private readonly input = viewChild<ElementRef<HTMLInputElement>>('dialogInput');

  constructor() {
    effect(() => {
      if (!this.dialogs.active()) return;
      this.value.set('');
      this.checked.set(false);
      window.setTimeout(() => this.input()?.nativeElement.focus(), 0);
    });
  }

  protected cancel(): void {
    this.dialogs.close({ confirmed: false, value: this.value(), checked: this.checked() });
  }
  protected confirm(): void {
    this.dialogs.close({ confirmed: true, value: this.value(), checked: this.checked() });
  }
}
