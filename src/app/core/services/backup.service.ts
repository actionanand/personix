import { inject, Injectable } from '@angular/core';
import { DATABASE_TABLES, DATABASE } from '../database/database.port';
import {
  BackupEnvelope,
  BackupModule,
  BackupPayload,
  DatabaseTable,
  TableRecordMap,
} from '../models/app.models';
import { CryptoService } from './crypto.service';
import { NativeIntegrationService } from './native-integration.service';

export type BackupDelivery = 'native' | 'browser';

const MODULE_TABLES: Readonly<Record<BackupModule, readonly DatabaseTable[]>> = {
  content: ['saved_content', 'content_categories', 'content_tags', 'content_recipients'],
  'family-health': [
    'family_members',
    'hospital_op_records',
    'medical_insurance',
    'important_items',
    'blood_group_records',
  ],
  vehicles: ['vehicles'],
  notes: ['notes', 'note_tags'],
  checklists: ['checklists', 'checklist_items'],
  settings: ['app_settings'],
};

@Injectable({ providedIn: 'root' })
export class BackupService {
  private readonly database = inject(DATABASE);
  private readonly crypto = inject(CryptoService);
  private readonly native = inject(NativeIntegrationService);

  async create(
    password: string,
    modules: readonly BackupModule[] = Object.keys(MODULE_TABLES) as BackupModule[],
  ): Promise<BackupEnvelope> {
    if (password.length < 8) throw new Error('Use at least 8 characters for the backup password.');
    const selected = new Set(modules.flatMap((module) => MODULE_TABLES[module]));
    const tables: Partial<Record<DatabaseTable, readonly TableRecordMap[DatabaseTable][]>> = {};
    const recordCounts: Record<string, number> = {};
    for (const table of DATABASE_TABLES.filter((item) => selected.has(item))) {
      const values = await this.database.getAll(table);
      if (table === 'app_settings') {
        tables[table] = values.map((item) => ({ ...item, pin: null, biometricEnabled: false }));
      } else tables[table] = values;
      recordCounts[table] = values.length;
    }
    const payload: BackupPayload = { schemaVersion: 1, recordCounts, tables };
    const encrypted = await this.crypto.encrypt(JSON.stringify(payload), password);
    return {
      format: 'personix-backup',
      version: 1,
      createdAt: new Date().toISOString(),
      appVersion: '1.0.0',
      salt: encrypted.salt,
      iterations: encrypted.iterations,
      iv: encrypted.iv,
      ciphertext: encrypted.ciphertext,
    };
  }

  async download(envelope: BackupEnvelope): Promise<BackupDelivery> {
    const contents = JSON.stringify(envelope);
    const filename = `personix-${envelope.createdAt.slice(0, 10)}.pxbackup`;
    if (await this.native.exportBackup(contents, filename)) return 'native';

    const blob = new Blob([contents], {
      type: 'application/vnd.personix.backup+json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    return 'browser';
  }

  async inspect(envelope: BackupEnvelope, password: string): Promise<BackupPayload> {
    this.validateEnvelope(envelope);
    const json = await this.crypto.decrypt(envelope, password);
    const payload = JSON.parse(json) as BackupPayload;
    if (payload.schemaVersion !== 1 || !payload.tables)
      throw new Error('This backup version is not supported.');
    return payload;
  }

  async restore(
    payload: BackupPayload,
    mode: 'replace' | 'merge',
    modules: readonly BackupModule[],
  ): Promise<void> {
    const selected = new Set(modules.flatMap((module) => MODULE_TABLES[module]));
    const changes: Partial<Record<DatabaseTable, readonly TableRecordMap[DatabaseTable][]>> = {};
    for (const table of DATABASE_TABLES.filter((item) => selected.has(item))) {
      const incoming = payload.tables[table];
      if (!incoming) continue;
      if (mode === 'replace') changes[table] = incoming;
      else {
        const existing = await this.database.getAll(table);
        const merged = new Map([...existing, ...incoming].map((item) => [item.id, item]));
        changes[table] = [...merged.values()];
      }
    }
    await this.database.replaceTables(changes);
  }

  parse(text: string): BackupEnvelope {
    try {
      return JSON.parse(text) as BackupEnvelope;
    } catch {
      throw new Error('The selected file is not a Personix backup.');
    }
  }

  private validateEnvelope(value: BackupEnvelope): void {
    if (
      value.format !== 'personix-backup' ||
      value.version !== 1 ||
      !value.ciphertext ||
      !value.iv ||
      !value.salt
    ) {
      throw new Error('The selected file is not a supported Personix backup.');
    }
  }
}
