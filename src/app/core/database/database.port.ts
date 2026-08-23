import { InjectionToken } from '@angular/core';
import { DatabaseTable, TableRecordMap } from '../models/app.models';

export interface DatabasePort {
  initialize(): Promise<void>;
  get<K extends DatabaseTable>(table: K, id: string): Promise<TableRecordMap[K] | null>;
  getAll<K extends DatabaseTable>(table: K): Promise<readonly TableRecordMap[K][]>;
  put<K extends DatabaseTable>(table: K, value: TableRecordMap[K]): Promise<void>;
  putMany<K extends DatabaseTable>(table: K, values: readonly TableRecordMap[K][]): Promise<void>;
  delete<K extends DatabaseTable>(table: K, id: string): Promise<void>;
  deleteMany(changes: Partial<Readonly<Record<DatabaseTable, readonly string[]>>>): Promise<void>;
  replaceTables(
    changes: Partial<Readonly<Record<DatabaseTable, readonly TableRecordMap[DatabaseTable][]>>>,
  ): Promise<void>;
  count<K extends DatabaseTable>(table: K): Promise<number>;
  clear<K extends DatabaseTable>(table: K): Promise<void>;
}

export const DATABASE = new InjectionToken<DatabasePort>('PERSONIX_DATABASE');

export const DATABASE_TABLES: readonly DatabaseTable[] = [
  'saved_content',
  'content_categories',
  'content_tags',
  'content_recipients',
  'family_members',
  'hospital_op_records',
  'medical_insurance',
  'important_items',
  'blood_group_records',
  'residence_history',
  'employment_history',
  'vehicles',
  'notes',
  'note_tags',
  'checklists',
  'checklist_items',
  'attachments',
  'app_settings',
  'schema_migrations',
];
