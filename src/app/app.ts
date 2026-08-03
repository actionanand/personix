import { NgOptimizedImage } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AppStore } from './core/services/app-store.service';
import { FeedbackService } from './core/services/feedback.service';
import { AppDialog } from './shared/components/app-dialog';
import { AppIcon } from './shared/components/app-icon';
import { AppSnackbar } from './shared/components/app-snackbar';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    ReactiveFormsModule,
    NgOptimizedImage,
    AppIcon,
    AppDialog,
    AppSnackbar,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly store = inject(AppStore);
  private readonly feedback = inject(FeedbackService);
  protected readonly drawerOpen = signal(false);
  protected readonly quickAddOpen = signal(false);
  protected readonly unlocking = signal(false);
  protected readonly unlockError = signal('');
  protected readonly pin = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^\d{4,8}$/)],
  });

  constructor() {
    void this.store.initialize();
  }

  protected async unlock(): Promise<void> {
    if (this.pin.invalid || this.unlocking()) return;
    this.unlocking.set(true);
    this.unlockError.set('');
    try {
      if (await this.store.unlock(this.pin.value)) this.pin.reset();
      else this.unlockError.set('Incorrect PIN. Try again.');
    } catch (error) {
      this.unlockError.set(
        error instanceof Error ? error.message : 'Personix could not verify the PIN.',
      );
    } finally {
      this.unlocking.set(false);
    }
  }

  protected async unlockBiometric(): Promise<void> {
    if (this.unlocking()) return;
    this.unlocking.set(true);
    this.unlockError.set('');
    try {
      if (!(await this.store.unlockWithBiometrics()))
        this.unlockError.set('Biometric verification did not unlock Personix.');
    } catch (error) {
      this.unlockError.set(
        error instanceof Error ? error.message : 'Biometric verification was cancelled.',
      );
    } finally {
      this.unlocking.set(false);
    }
  }

  protected closeNavigation(): void {
    this.drawerOpen.set(false);
    this.quickAddOpen.set(false);
  }
  protected manualLock(): void {
    this.store.lock();
    this.feedback.notify('Personix locked', 'info');
  }
}
