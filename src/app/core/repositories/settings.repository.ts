import { inject, Injectable } from '@angular/core';
import { DATABASE } from '../database/database.port';
import { AppSettings, nowIso } from '../models/app.models';

export const SETTINGS_ID = 'personix-settings';

export function defaultSettings(): AppSettings {
  const timestamp = nowIso();
  return {
    id: SETTINGS_ID,
    createdAt: timestamp,
    updatedAt: timestamp,
    theme: 'automatic',
    showAdultContent: false,
    androidMetadataEnabled: true,
    browserMetadataEnabled: false,
    browserMetadataServiceUrl: 'https://api.microlink.io/',
    autoRefreshMetadata: false,
    downloadOgImages: false,
    metadataTimeoutMs: 10_000,
    maxMetadataImageBytes: 3_000_000,
    defaultCategoryId: '',
    defaultContentType: 'website',
    pin: null,
    biometricEnabled: false,
    autoLockMinutes: 5,
    lockInBackground: true,
    notePageSize: 40,
    showArchivedNotes: false,
    hideCompletedChecklistItems: false,
    confirmClearCompleted: true,
    rasiDisplay: 'both',
    nakshatraDisplay: 'both',
    birthdayReminders: false,
    includeImagesInBackup: true,
    includeAttachmentsInBackup: true,
    backupReminder: false,
  };
}

@Injectable({ providedIn: 'root' })
export class SettingsRepository {
  private readonly database = inject(DATABASE);

  async load(): Promise<AppSettings> {
    const existing = await this.database.get('app_settings', SETTINGS_ID);
    if (existing) return { ...defaultSettings(), ...existing };
    const settings = defaultSettings();
    await this.database.put('app_settings', settings);
    return settings;
  }

  async update(settings: AppSettings, patch: Partial<AppSettings>): Promise<AppSettings> {
    const value = { ...settings, ...patch, id: SETTINGS_ID, updatedAt: nowIso() };
    await this.database.put('app_settings', value);
    return value;
  }
}
