import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BackupEnvelope, BackupModule, BackupPayload } from '../../core/models/app.models';
import { BackupService } from '../../core/services/backup.service';
import { DialogService } from '../../core/services/dialog.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { AppIcon } from '../../shared/components/app-icon';

@Component({
  selector: 'app-backup',
  imports: [ReactiveFormsModule, AppIcon],
  templateUrl: './backup.html',
  styleUrl: './backup.scss',
})
export class Backup {
  private readonly backups = inject(BackupService);
  private readonly dialogs = inject(DialogService);
  private readonly feedback = inject(FeedbackService);
  private readonly formBuilder = inject(FormBuilder);
  protected readonly creating = signal(false);
  protected readonly restoring = signal(false);
  protected readonly selectedEnvelope = signal<BackupEnvelope | null>(null);
  protected readonly inspected = signal<BackupPayload | null>(null);
  protected readonly backupForm = this.formBuilder.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    content: [true],
    familyHealth: [true],
    vehicles: [true],
    notes: [true],
    checklists: [true],
    settings: [true],
  });
  protected readonly restorePassword = this.formBuilder.nonNullable.control(
    '',
    Validators.required,
  );
  protected async create(): Promise<void> {
    if (this.backupForm.invalid || this.creating()) {
      this.backupForm.markAllAsTouched();
      return;
    }
    this.creating.set(true);
    try {
      const envelope = await this.backups.create(
        this.backupForm.controls.password.value,
        this.selectedModules(),
      );
      const delivery = await this.backups.download(envelope);
      this.feedback.notify(
        delivery === 'native' ? 'Encrypted backup saved' : 'Encrypted backup downloaded',
      );
      this.backupForm.controls.password.reset();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Backup could not be created.';
      this.feedback.notify(message, message.toLowerCase().includes('cancelled') ? 'info' : 'error');
    } finally {
      this.creating.set(false);
    }
  }
  protected async selectFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      this.selectedEnvelope.set(this.backups.parse(await file.text()));
      this.inspected.set(null);
      this.restorePassword.reset();
    } catch (error) {
      this.feedback.notify(
        error instanceof Error ? error.message : 'Backup file could not be read.',
        'error',
      );
      input.value = '';
    }
  }
  protected async inspect(): Promise<void> {
    const envelope = this.selectedEnvelope();
    if (!envelope || !this.restorePassword.value) return;
    this.restoring.set(true);
    try {
      this.inspected.set(await this.backups.inspect(envelope, this.restorePassword.value));
      this.feedback.notify('Backup integrity verified', 'info');
    } catch (error) {
      this.feedback.notify(
        error instanceof Error ? error.message : 'Backup could not be decrypted.',
        'error',
      );
    } finally {
      this.restoring.set(false);
    }
  }
  protected async restore(mode: 'replace' | 'merge'): Promise<void> {
    const payload = this.inspected();
    if (!payload) return;
    const result = await this.dialogs.open({
      title: mode === 'replace' ? 'Replace selected local data?' : 'Merge backup with local data?',
      description:
        mode === 'replace'
          ? 'The selected modules on this device will be replaced after a temporary encrypted safety backup is created.'
          : 'Backup records will be merged by record ID after a temporary encrypted safety backup is created.',
      confirmText: mode === 'replace' ? 'Replace data' : 'Merge data',
      destructive: mode === 'replace',
      icon: mode === 'replace' ? 'alert' : 'backup',
      typedConfirmation: mode === 'replace' ? 'RESTORE' : '',
    });
    if (!result.confirmed) return;
    this.restoring.set(true);
    try {
      await this.backups.create(this.restorePassword.value, this.selectedModules());
      await this.backups.restore(payload, mode, this.selectedModules());
      this.feedback.notify('Backup restored successfully');
      this.inspected.set(null);
      this.selectedEnvelope.set(null);
    } catch (error) {
      this.feedback.notify(
        error instanceof Error ? error.message : 'Restore failed and local data was not changed.',
        'error',
      );
    } finally {
      this.restoring.set(false);
    }
  }
  protected countEntries(): readonly { readonly name: string; readonly count: number }[] {
    return Object.entries(this.inspected()?.recordCounts ?? {}).map(([name, count]) => ({
      name: name.replaceAll('_', ' '),
      count,
    }));
  }
  private selectedModules(): readonly BackupModule[] {
    const value = this.backupForm.getRawValue();
    return [
      value.content && 'content',
      value.familyHealth && 'family-health',
      value.vehicles && 'vehicles',
      value.notes && 'notes',
      value.checklists && 'checklists',
      value.settings && 'settings',
    ].filter((item): item is BackupModule => Boolean(item));
  }
}
