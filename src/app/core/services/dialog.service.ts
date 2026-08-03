import { Injectable, signal } from '@angular/core';

export interface DialogRequest {
  readonly title: string;
  readonly description: string;
  readonly confirmText: string;
  readonly cancelText: string;
  readonly destructive: boolean;
  readonly icon: string;
  readonly checkboxLabel: string;
  readonly typedConfirmation: string;
  readonly promptLabel: string;
  readonly promptType: 'text' | 'password';
}

export interface DialogResult {
  readonly confirmed: boolean;
  readonly value: string;
  readonly checked: boolean;
}

interface ActiveDialog extends DialogRequest {
  readonly resolve: (result: DialogResult) => void;
}

@Injectable({ providedIn: 'root' })
export class DialogService {
  readonly active = signal<ActiveDialog | null>(null);

  open(
    request: Partial<DialogRequest> & Pick<DialogRequest, 'title' | 'description'>,
  ): Promise<DialogResult> {
    return new Promise((resolve) =>
      this.active.set({
        title: request.title,
        description: request.description,
        confirmText: request.confirmText ?? 'Confirm',
        cancelText: request.cancelText ?? 'Cancel',
        destructive: request.destructive ?? false,
        icon: request.icon ?? 'circle-help',
        checkboxLabel: request.checkboxLabel ?? '',
        typedConfirmation: request.typedConfirmation ?? '',
        promptLabel: request.promptLabel ?? '',
        promptType: request.promptType ?? 'text',
        resolve,
      }),
    );
  }

  close(result: DialogResult): void {
    const dialog = this.active();
    this.active.set(null);
    dialog?.resolve(result);
  }
}
