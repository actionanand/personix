import { Injectable } from '@angular/core';
import { DatabaseTable, TableRecordMap } from '../models/app.models';
import { DATABASE_TABLES, DatabasePort } from './database.port';

const DATABASE_NAME = 'personix';
const DATABASE_VERSION = 1;

interface StoreDefinition {
  readonly name: DatabaseTable;
  readonly indexes: readonly {
    readonly name: string;
    readonly keyPath: string | readonly string[];
  }[];
}

const STORES: readonly StoreDefinition[] = [
  {
    name: 'saved_content',
    indexes: [
      { name: 'createdAt_id', keyPath: ['createdAt', 'id'] },
      { name: 'updatedAt', keyPath: 'updatedAt' },
      { name: 'categoryId', keyPath: 'categoryId' },
      { name: 'contentType', keyPath: 'contentType' },
      { name: 'platform', keyPath: 'platform' },
      { name: 'adult', keyPath: 'adult' },
      { name: 'sent', keyPath: 'sent' },
    ],
  },
  { name: 'content_categories', indexes: [{ name: 'archived', keyPath: 'archived' }] },
  { name: 'content_tags', indexes: [{ name: 'archived', keyPath: 'archived' }] },
  { name: 'content_recipients', indexes: [{ name: 'lastUsedAt', keyPath: 'lastUsedAt' }] },
  {
    name: 'family_members',
    indexes: [
      { name: 'createdAt_id', keyPath: ['createdAt', 'id'] },
      { name: 'archived', keyPath: 'archived' },
    ],
  },
  {
    name: 'hospital_op_records',
    indexes: [
      { name: 'hospitalName', keyPath: 'hospitalName' },
      { name: 'opNumber', keyPath: 'opNumber' },
      { name: 'familyMemberId', keyPath: 'familyMemberId' },
    ],
  },
  { name: 'medical_insurance', indexes: [{ name: 'archived', keyPath: 'archived' }] },
  {
    name: 'important_items',
    indexes: [
      { name: 'itemType', keyPath: 'itemType' },
      { name: 'familyMemberId', keyPath: 'familyMemberId' },
    ],
  },
  {
    name: 'blood_group_records',
    indexes: [
      { name: 'bloodGroup', keyPath: 'bloodGroup' },
      { name: 'familyMemberId', keyPath: 'familyMemberId' },
    ],
  },
  {
    name: 'vehicles',
    indexes: [
      { name: 'normalizedRegistration', keyPath: 'normalizedRegistration' },
      { name: 'archived', keyPath: 'archived' },
    ],
  },
  {
    name: 'notes',
    indexes: [
      { name: 'createdAt_id', keyPath: ['createdAt', 'id'] },
      { name: 'archived', keyPath: 'archived' },
      { name: 'deleted', keyPath: 'deleted' },
    ],
  },
  { name: 'note_tags', indexes: [{ name: 'archived', keyPath: 'archived' }] },
  {
    name: 'checklists',
    indexes: [
      { name: 'createdAt_id', keyPath: ['createdAt', 'id'] },
      { name: 'archived', keyPath: 'archived' },
    ],
  },
  {
    name: 'checklist_items',
    indexes: [
      { name: 'checklistId', keyPath: 'checklistId' },
      { name: 'completed', keyPath: 'completed' },
    ],
  },
  { name: 'attachments', indexes: [{ name: 'owner', keyPath: ['ownerType', 'ownerId'] }] },
  { name: 'app_settings', indexes: [] },
  { name: 'schema_migrations', indexes: [{ name: 'version', keyPath: 'version' }] },
];

@Injectable({ providedIn: 'root' })
export class IndexedDbDatabase implements DatabasePort {
  private databasePromise: Promise<IDBDatabase> | null = null;

  async initialize(): Promise<void> {
    await this.database();
  }

  async get<K extends DatabaseTable>(table: K, id: string): Promise<TableRecordMap[K] | null> {
    const store = await this.store(table, 'readonly');
    return this.request<TableRecordMap[K] | undefined>(store.get(id)).then(
      (value) => value ?? null,
    );
  }

  async getAll<K extends DatabaseTable>(table: K): Promise<readonly TableRecordMap[K][]> {
    const store = await this.store(table, 'readonly');
    return this.request<TableRecordMap[K][]>(store.getAll());
  }

  async put<K extends DatabaseTable>(table: K, value: TableRecordMap[K]): Promise<void> {
    const store = await this.store(table, 'readwrite');
    await this.request(store.put(value));
  }

  async putMany<K extends DatabaseTable>(
    table: K,
    values: readonly TableRecordMap[K][],
  ): Promise<void> {
    if (!values.length) return;
    const database = await this.database();
    const transaction = database.transaction(table, 'readwrite');
    const store = transaction.objectStore(table);
    for (const value of values) store.put(value);
    await this.transactionComplete(transaction);
  }

  async delete<K extends DatabaseTable>(table: K, id: string): Promise<void> {
    const store = await this.store(table, 'readwrite');
    await this.request(store.delete(id));
  }

  async deleteMany(
    changes: Partial<Readonly<Record<DatabaseTable, readonly string[]>>>,
  ): Promise<void> {
    const tables = DATABASE_TABLES.filter((table) => (changes[table]?.length ?? 0) > 0);
    if (!tables.length) return;
    const database = await this.database();
    const transaction = database.transaction(tables, 'readwrite');
    for (const table of tables) {
      const store = transaction.objectStore(table);
      for (const id of changes[table] ?? []) store.delete(id);
    }
    await this.transactionComplete(transaction);
  }

  async replaceTables(
    changes: Partial<Readonly<Record<DatabaseTable, readonly TableRecordMap[DatabaseTable][]>>>,
  ): Promise<void> {
    const tables = DATABASE_TABLES.filter((table) => changes[table] !== undefined);
    if (!tables.length) return;
    const database = await this.database();
    const transaction = database.transaction(tables, 'readwrite');
    for (const table of tables) {
      const store = transaction.objectStore(table);
      store.clear();
      const values = changes[table];
      for (const value of values ?? []) store.put(value);
    }
    await this.transactionComplete(transaction);
  }

  async count<K extends DatabaseTable>(table: K): Promise<number> {
    const store = await this.store(table, 'readonly');
    return this.request<number>(store.count());
  }

  async clear<K extends DatabaseTable>(table: K): Promise<void> {
    const store = await this.store(table, 'readwrite');
    await this.request(store.clear());
  }

  private database(): Promise<IDBDatabase> {
    this.databasePromise ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onerror = () => reject(request.error ?? new Error('Unable to open Personix data.'));
      request.onblocked = () => reject(new Error('Close other Personix tabs and try again.'));
      request.onupgradeneeded = () => {
        const database = request.result;
        for (const definition of STORES) {
          const store = database.objectStoreNames.contains(definition.name)
            ? request.transaction?.objectStore(definition.name)
            : database.createObjectStore(definition.name, { keyPath: 'id' });
          if (!store) continue;
          for (const index of definition.indexes) {
            if (!store.indexNames.contains(index.name))
              store.createIndex(index.name, index.keyPath);
          }
        }
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
    });
    return this.databasePromise;
  }

  private async store(table: DatabaseTable, mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const database = await this.database();
    return database.transaction(table, mode).objectStore(table);
  }

  private request<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error('Personix database operation failed.'));
    });
  }

  private transactionComplete(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () =>
        reject(transaction.error ?? new Error('Personix transaction was rolled back.'));
      transaction.onerror = () =>
        reject(transaction.error ?? new Error('Personix transaction failed.'));
    });
  }
}
