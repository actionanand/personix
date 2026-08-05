import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NameDisplayPreference, ThemePreference } from '../../core/models/app.models';
import { ContentRepository } from '../../core/repositories/content.repository';
import { AppStore } from '../../core/services/app-store.service';
import { DialogService } from '../../core/services/dialog.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { NativeIntegrationService } from '../../core/services/native-integration.service';
import { AppIcon } from '../../shared/components/app-icon';
import { SelectPicker, SelectPickerOption } from '../../shared/components/select-picker';

@Component({
  selector: 'app-settings',
  imports: [ReactiveFormsModule, AppIcon, SelectPicker],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings {
  protected readonly store = inject(AppStore);
  private readonly content = inject(ContentRepository);
  private readonly dialogs = inject(DialogService);
  private readonly feedback = inject(FeedbackService);
  protected readonly native = inject(NativeIntegrationService);
  private readonly formBuilder = inject(FormBuilder);
  protected readonly securityPanel = signal<'none' | 'set' | 'change'>('none');
  protected readonly busy = signal(false);
  protected readonly clearingData = signal(false);
  protected readonly adultCount = signal(0);
  protected readonly autoLockOptions: readonly SelectPickerOption[] = [
    { value: '0', label: 'Never' },
    { value: '1', label: '1 minute' },
    { value: '5', label: '5 minutes' },
    { value: '15', label: '15 minutes' },
    { value: '30', label: '30 minutes' },
  ];
  protected readonly timeoutOptions: readonly SelectPickerOption[] = [
    { value: '5000', label: '5 seconds' },
    { value: '10000', label: '10 seconds' },
    { value: '15000', label: '15 seconds' },
  ];
  protected readonly imageSizeOptions: readonly SelectPickerOption[] = [
    { value: '1000000', label: '1 MB' },
    { value: '3000000', label: '3 MB' },
    { value: '5000000', label: '5 MB' },
  ];
  protected readonly notePageOptions: readonly SelectPickerOption[] = [
    { value: '20', label: '20' },
    { value: '40', label: '40' },
    { value: '60', label: '60' },
  ];
  protected readonly nameDisplayOptions: readonly SelectPickerOption[] = [
    { value: 'english', label: 'English only' },
    { value: 'tamil', label: 'Tamil only' },
    { value: 'both', label: 'Both names' },
  ];
  protected readonly pinForm = this.formBuilder.nonNullable.group({
    current: [''],
    next: ['', [Validators.required, Validators.pattern(/^\d{4,8}$/)]],
    confirm: ['', Validators.required],
  });
  constructor() {
    void this.refreshCounts();
  }
  protected selectTheme(theme: ThemePreference): void {
    void this.store.updateSettings({ theme });
  }
  protected async savePin(): Promise<void> {
    if (this.pinForm.invalid || this.busy()) return;
    const value = this.pinForm.getRawValue();
    if (value.next !== value.confirm) {
      this.feedback.notify('The PIN entries do not match.', 'error');
      return;
    }
    const changing = Boolean(this.store.settings().pin);
    this.busy.set(true);
    try {
      if (changing) await this.store.changePin(value.current, value.next);
      else await this.store.setPin(value.next);
      this.securityPanel.set('none');
      this.pinForm.reset();
      this.feedback.notify(changing ? 'Application PIN updated' : 'Application PIN enabled');
    } catch (error) {
      this.feedback.notify(
        error instanceof Error ? error.message : 'PIN could not be saved.',
        'error',
      );
    } finally {
      this.busy.set(false);
    }
  }
  protected async removePin(): Promise<void> {
    const result = await this.dialogs.open({
      title: 'Remove application PIN?',
      description:
        'Personix will open without requesting a PIN and biometric unlock will be disabled.',
      confirmText: 'Remove PIN',
      destructive: true,
      icon: 'lock',
      promptLabel: 'Current PIN',
      promptType: 'password',
    });
    if (!result.confirmed) return;
    try {
      await this.store.removePin(result.value);
      this.feedback.notify('Application PIN removed');
    } catch (error) {
      this.feedback.notify(error instanceof Error ? error.message : 'PIN is incorrect.', 'error');
    }
  }
  protected async toggleBiometric(): Promise<void> {
    if (this.store.settings().biometricEnabled) {
      await this.store.disableBiometrics();
      this.feedback.notify('Biometric unlock disabled', 'info');
      return;
    }
    if (!this.store.settings().pin) {
      this.securityPanel.set('set');
      this.feedback.notify('Set an application PIN first', 'warning');
      return;
    }
    if (!this.native.biometricAvailable()) {
      this.feedback.notify('Add a strong fingerprint or biometric in Android first.', 'warning');
      return;
    }
    const result = await this.dialogs.open({
      title: 'Enable biometric unlock',
      description:
        'Android will protect your application PIN with an authentication-bound Keystore key. Your PIN remains the fallback.',
      confirmText: 'Continue',
      icon: 'biometric',
      promptLabel: 'Current PIN',
      promptType: 'password',
    });
    if (!result.confirmed) return;
    try {
      await this.store.enableBiometrics(result.value);
      this.feedback.notify('Biometric unlock enabled');
    } catch (error) {
      this.feedback.notify(
        error instanceof Error ? error.message : 'Biometric unlock could not be enabled.',
        'error',
      );
    }
  }
  protected async toggleBrowserMetadata(enabled: boolean): Promise<void> {
    if (!enabled) {
      await this.store.updateSettings({ browserMetadataEnabled: false });
      return;
    }
    const result = await this.dialogs.open({
      title: 'Enable third-party metadata fetching?',
      description:
        'Saved URLs will be sent to api.microlink.io to retrieve titles, descriptions and images. Personix will never do this unless you enable it.',
      confirmText: 'I understand, enable',
      checkboxLabel: 'I understand saved URLs will leave this device',
      requireCheckbox: true,
      icon: 'globe',
    });
    if (!result.confirmed || !result.checked) {
      this.feedback.notify('Browser metadata fetching remains off', 'info');
      return;
    }
    await this.store.updateSettings({ browserMetadataEnabled: true });
    this.feedback.notify('Browser metadata fetching enabled', 'warning');
  }
  protected async toggleAdult(enabled: boolean): Promise<void> {
    if (!enabled) {
      await this.store.updateSettings({ showAdultContent: false });
      this.feedback.notify('Adult content is hidden', 'info');
      return;
    }
    const confirmation = await this.dialogs.open({
      title: 'Show adult content?',
      description:
        'Adult records and thumbnails will become visible in Saved Content, Home and search on this device.',
      confirmText: 'Show adult content',
      icon: 'shield-alert',
    });
    if (!confirmation.confirmed) return;
    if (!(await this.authorizeSensitiveAction())) return;
    await this.store.updateSettings({ showAdultContent: true });
    this.feedback.notify('Adult content is now visible', 'warning');
  }
  protected async deleteAdult(): Promise<void> {
    const count = await this.content.adultCount();
    this.adultCount.set(count);
    if (!count) {
      this.feedback.notify('There is no adult content to delete', 'info');
      return;
    }
    if (!(await this.authorizeSensitiveAction())) return;
    const first = await this.dialogs.open({
      title: 'Delete all adult content?',
      description: `${count} saved record${count === 1 ? '' : 's'}, downloaded images and related attachments will be removed in one transaction.`,
      confirmText: 'Continue',
      destructive: true,
      icon: 'trash',
    });
    if (!first.confirmed) return;
    const second = await this.dialogs.open({
      title: 'This cannot be undone',
      description: 'Type DELETE to permanently remove every adult-content record from this device.',
      confirmText: `Delete ${count} records`,
      destructive: true,
      typedConfirmation: 'DELETE',
      icon: 'alert',
    });
    if (!second.confirmed) return;
    try {
      const removed = await this.content.deleteAllAdult();
      await this.store.updateSettings({ showAdultContent: false });
      this.feedback.notify(`${removed} adult record${removed === 1 ? '' : 's'} deleted`);
      await this.refreshCounts();
    } catch {
      this.feedback.notify('Deletion failed. The transaction was rolled back.', 'error');
    }
  }
  protected updateNumber(
    key: 'autoLockMinutes' | 'metadataTimeoutMs' | 'maxMetadataImageBytes' | 'notePageSize',
    value: string,
  ): void {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) void this.store.updateSettings({ [key]: parsed });
  }
  protected updateNameDisplay(key: 'rasiDisplay' | 'nakshatraDisplay', value: string): void {
    if (value === 'english' || value === 'tamil' || value === 'both')
      void this.store.updateSettings({ [key]: value as NameDisplayPreference });
  }
  protected async clearAllData(): Promise<void> {
    if (this.clearingData()) return;
    if (
      !(await this.authorizeSensitiveAction(
        'Enter your application PIN before permanently clearing Personix.',
      ))
    )
      return;
    const result = await this.dialogs.open({
      title: 'Clear all Personix data?',
      description:
        'Every saved item, family and health record, vehicle, note, checklist, attachment reference, setting and application PIN will be permanently removed from this device.',
      confirmText: 'Clear all data',
      destructive: true,
      typedConfirmation: 'CLEAR ALL',
      icon: 'alert',
    });
    if (!result.confirmed) return;
    this.clearingData.set(true);
    try {
      await this.store.clearAllData();
      this.feedback.notify('All Personix data was cleared');
      await this.refreshCounts();
    } catch (error) {
      this.feedback.notify(
        error instanceof Error ? error.message : 'Data could not be cleared.',
        'error',
      );
    } finally {
      this.clearingData.set(false);
    }
  }
  private async authorizeSensitiveAction(
    description = 'Enter your application PIN before changing protected adult-content settings.',
  ): Promise<boolean> {
    if (!this.store.settings().pin) return true;
    const result = await this.dialogs.open({
      title: 'Confirm your identity',
      description,
      confirmText: 'Continue',
      icon: 'lock',
      promptLabel: 'Application PIN',
      promptType: 'password',
    });
    if (!result.confirmed) return false;
    if (await this.store.authenticate(result.value)) return true;
    this.feedback.notify('The application PIN is incorrect.', 'error');
    return false;
  }
  private async refreshCounts(): Promise<void> {
    this.adultCount.set(await this.content.adultCount());
  }
}
