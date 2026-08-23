import { Injectable } from '@angular/core';
import { CapacitorSQLite, type CapacitorSQLitePlugin } from '@capacitor-community/sqlite';
import { DatabaseTable, TableRecordMap } from '../models/app.models';
import { DATABASE_TABLES, DatabasePort } from './database.port';

interface SqlitePayloadRow {
  readonly payload: string;
}
const DATABASE_NAME = 'personix';
const SCHEMA_VERSION = 2;

@Injectable({ providedIn: 'root' })
export class SqliteDatabase implements DatabasePort {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    const plugin = this.plugin();
    try {
      await plugin.closeConnection({ database: DATABASE_NAME, readonly: false });
    } catch {
      // A fresh application process has no connection to close.
    }
    await plugin.createConnection({
      database: DATABASE_NAME,
      encrypted: false,
      mode: 'no-encryption',
      version: SCHEMA_VERSION,
      readonly: false,
    });
    await plugin.open({ database: DATABASE_NAME, readonly: false });
    await plugin.execute({ database: DATABASE_NAME, statements: this.schema(), transaction: true });
    this.initialized = true;
  }

  async get<K extends DatabaseTable>(table: K, id: string): Promise<TableRecordMap[K] | null> {
    await this.initialize();
    const result = await this.plugin().query({
      database: DATABASE_NAME,
      statement: `SELECT payload FROM ${table} WHERE id = ? LIMIT 1`,
      values: [id],
    });
    return this.readRows<TableRecordMap[K]>(result.values)[0] ?? null;
  }

  async getAll<K extends DatabaseTable>(table: K): Promise<readonly TableRecordMap[K][]> {
    await this.initialize();
    const result = await this.plugin().query({
      database: DATABASE_NAME,
      statement: `SELECT payload FROM ${table} ORDER BY created_at DESC, id DESC`,
      values: [],
    });
    return this.readRows<TableRecordMap[K]>(result.values);
  }

  async put<K extends DatabaseTable>(table: K, value: TableRecordMap[K]): Promise<void> {
    await this.initialize();
    await this.upsert(table, value, true);
  }

  async putMany<K extends DatabaseTable>(
    table: K,
    values: readonly TableRecordMap[K][],
  ): Promise<void> {
    if (!values.length) return;
    await this.initialize();
    await this.transaction(async () => {
      for (const value of values) await this.upsert(table, value, false);
    });
  }

  async delete<K extends DatabaseTable>(table: K, id: string): Promise<void> {
    await this.initialize();
    await this.plugin().run({
      database: DATABASE_NAME,
      statement: `DELETE FROM ${table} WHERE id = ?`,
      values: [id],
      transaction: true,
    });
  }

  async deleteMany(
    changes: Partial<Readonly<Record<DatabaseTable, readonly string[]>>>,
  ): Promise<void> {
    await this.initialize();
    await this.transaction(async () => {
      for (const table of DATABASE_TABLES)
        for (const id of changes[table] ?? [])
          await this.plugin().run({
            database: DATABASE_NAME,
            statement: `DELETE FROM ${table} WHERE id = ?`,
            values: [id],
            transaction: false,
          });
    });
  }

  async replaceTables(
    changes: Partial<Readonly<Record<DatabaseTable, readonly TableRecordMap[DatabaseTable][]>>>,
  ): Promise<void> {
    await this.initialize();
    await this.transaction(async () => {
      for (const table of DATABASE_TABLES) {
        const values = changes[table];
        if (!values) continue;
        await this.plugin().run({
          database: DATABASE_NAME,
          statement: `DELETE FROM ${table}`,
          values: [],
          transaction: false,
        });
        for (const value of values) await this.upsert(table, value, false);
      }
    });
  }

  async count<K extends DatabaseTable>(table: K): Promise<number> {
    await this.initialize();
    const result = await this.plugin().query({
      database: DATABASE_NAME,
      statement: `SELECT COUNT(*) AS count FROM ${table}`,
      values: [],
    });
    return Number((result.values?.[0] as { readonly count?: number } | undefined)?.count ?? 0);
  }

  async clear<K extends DatabaseTable>(table: K): Promise<void> {
    await this.initialize();
    await this.plugin().run({
      database: DATABASE_NAME,
      statement: `DELETE FROM ${table}`,
      values: [],
      transaction: true,
    });
  }

  private async transaction(work: () => Promise<void>): Promise<void> {
    const plugin = this.plugin();
    await plugin.beginTransaction({ database: DATABASE_NAME });
    try {
      await work();
      await plugin.commitTransaction({ database: DATABASE_NAME });
    } catch (error) {
      await plugin.rollbackTransaction({ database: DATABASE_NAME });
      throw error;
    }
  }

  private async upsert<K extends DatabaseTable>(
    table: K,
    value: TableRecordMap[K],
    transaction: boolean,
  ): Promise<void> {
    const row = value as TableRecordMap[K] & Readonly<Record<string, unknown>>;
    const searchable = Object.values(row)
      .filter((item): item is string => typeof item === 'string')
      .join(' ')
      .toLocaleLowerCase();
    await this.plugin().run({
      database: DATABASE_NAME,
      statement: `INSERT OR REPLACE INTO ${table} (id, created_at, updated_at, archived, category, type, adult, sent, relation_id, normalized_key, searchable_text, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      values: [
        value.id,
        value.createdAt,
        value.updatedAt,
        row['archived'] === true ? 1 : 0,
        String(row['categoryId'] ?? row['category'] ?? ''),
        String(row['contentType'] ?? row['itemType'] ?? row['vehicleType'] ?? ''),
        row['adult'] === true ? 1 : 0,
        row['sent'] === true ? 1 : 0,
        String(row['familyMemberId'] ?? row['checklistId'] ?? ''),
        String(row['normalizedRegistration'] ?? row['opNumber'] ?? ''),
        searchable,
        JSON.stringify(value),
      ],
      transaction,
    });
  }

  private schema(): string {
    return DATABASE_TABLES.map(
      (table) =>
        `CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0, category TEXT NOT NULL DEFAULT '', type TEXT NOT NULL DEFAULT '', adult INTEGER NOT NULL DEFAULT 0, sent INTEGER NOT NULL DEFAULT 0, relation_id TEXT NOT NULL DEFAULT '', normalized_key TEXT NOT NULL DEFAULT '', searchable_text TEXT NOT NULL DEFAULT '', payload TEXT NOT NULL); CREATE INDEX IF NOT EXISTS idx_${table}_created ON ${table}(created_at DESC, id DESC); CREATE INDEX IF NOT EXISTS idx_${table}_updated ON ${table}(updated_at DESC); CREATE INDEX IF NOT EXISTS idx_${table}_category ON ${table}(category); CREATE INDEX IF NOT EXISTS idx_${table}_type ON ${table}(type); CREATE INDEX IF NOT EXISTS idx_${table}_adult ON ${table}(adult); CREATE INDEX IF NOT EXISTS idx_${table}_sent ON ${table}(sent); CREATE INDEX IF NOT EXISTS idx_${table}_relation ON ${table}(relation_id); CREATE INDEX IF NOT EXISTS idx_${table}_normalized ON ${table}(normalized_key);`,
    ).join('\n');
  }

  private readRows<T>(values: readonly unknown[] | undefined): readonly T[] {
    return (values ?? []).flatMap((value) => {
      const payload = (value as SqlitePayloadRow).payload;
      if (typeof payload !== 'string') return [];
      try {
        return [JSON.parse(payload) as T];
      } catch {
        return [];
      }
    });
  }

  private plugin(): CapacitorSQLitePlugin {
    return CapacitorSQLite;
  }
}
