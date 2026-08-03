import { inject, Injectable, signal } from '@angular/core';
import { DATABASE } from '../database/database.port';
import { AppSettings, SchemaMigration, nowIso } from '../models/app.models';
import { ContentRepository } from '../repositories/content.repository';
import { SettingsRepository, defaultSettings } from '../repositories/settings.repository';
import { NativeIntegrationService } from './native-integration.service';
import { SecurityService } from './security.service';
import { ThemeService } from './theme.service';

@Injectable({ providedIn: 'root' })
export class AppStore {
  private readonly database = inject(DATABASE);
  private readonly settingsRepository = inject(SettingsRepository);
  private readonly contentRepository = inject(ContentRepository);
  private readonly security = inject(SecurityService);
  private readonly theme = inject(ThemeService);
  private readonly native = inject(NativeIntegrationService);

  readonly settings = signal<AppSettings>(defaultSettings());
  readonly ready = signal(false);
  readonly locked = signal(false);
  readonly initializationError = signal('');
  private backgroundedAt = 0;

  async initialize(): Promise<void> {
    try {
      await this.database.initialize();
      await this.runMigrations();
      this.settings.set(await this.settingsRepository.load());
      await this.contentRepository.findOrCreateCategory('Adult', true);
      this.theme.apply(this.settings().theme);
      this.locked.set(Boolean(this.settings().pin));
      this.watchLifecycle();
    } catch (error) {
      this.initializationError.set(
        error instanceof Error ? error.message : 'Personix could not open its local database.',
      );
    } finally {
      this.ready.set(true);
      window.setTimeout(() => this.native.hideSplash(), 80);
    }
  }

  async updateSettings(patch: Partial<AppSettings>): Promise<void> {
    const updated = await this.settingsRepository.update(this.settings(), patch);
    this.settings.set(updated);
    if (patch.theme) this.theme.apply(patch.theme);
  }

  async setPin(pin: string): Promise<void> {
    const parameters = await this.security.createPin(pin);
    await this.updateSettings({ pin: parameters, biometricEnabled: false });
  }

  async changePin(currentPin: string, nextPin: string): Promise<void> {
    if (!(await this.security.verifyPin(currentPin, this.settings().pin)))
      throw new Error('The current PIN is incorrect.');
    if (this.settings().biometricEnabled) await this.native.disableBiometric();
    await this.setPin(nextPin);
  }

  async removePin(currentPin: string): Promise<void> {
    if (!(await this.security.verifyPin(currentPin, this.settings().pin)))
      throw new Error('The current PIN is incorrect.');
    await this.native.disableBiometric();
    await this.updateSettings({ pin: null, biometricEnabled: false });
    this.locked.set(false);
  }

  async unlock(pin: string): Promise<boolean> {
    const valid = await this.security.verifyPin(pin, this.settings().pin);
    if (valid) this.locked.set(false);
    return valid;
  }

  async unlockWithBiometrics(): Promise<boolean> {
    const pin = await this.native.biometricUnlock();
    return this.unlock(pin);
  }

  async enableBiometrics(pin: string): Promise<void> {
    if (!this.settings().pin) throw new Error('Set an application PIN first.');
    if (!(await this.security.verifyPin(pin, this.settings().pin)))
      throw new Error('The PIN is incorrect.');
    await this.native.enableBiometric(pin);
    await this.updateSettings({ biometricEnabled: true });
  }

  async disableBiometrics(): Promise<void> {
    await this.native.disableBiometric();
    await this.updateSettings({ biometricEnabled: false });
  }

  lock(): void {
    if (!this.settings().pin) return;
    this.locked.set(true);
  }

  async authenticate(pin: string): Promise<boolean> {
    return this.security.verifyPin(pin, this.settings().pin);
  }

  private async runMigrations(): Promise<void> {
    const migrations = await this.database.getAll('schema_migrations');
    if (migrations.some((item) => item.version === 1)) return;
    const timestamp = nowIso();
    const migration: SchemaMigration = {
      id: 'migration-1',
      version: 1,
      name: 'Initial module tables and indexes',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.database.put('schema_migrations', migration);
  }

  private watchLifecycle(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.backgroundedAt = Date.now();
        if (this.settings().lockInBackground) this.lock();
        return;
      }
      const timeout = this.settings().autoLockMinutes * 60_000;
      if (this.backgroundedAt && timeout > 0 && Date.now() - this.backgroundedAt >= timeout)
        this.lock();
      this.backgroundedAt = 0;
      this.theme.apply(this.settings().theme);
    });
  }
}
