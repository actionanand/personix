import { Provider } from '@angular/core';
import { DATABASE } from './database.port';
import { IndexedDbDatabase } from './indexed-db.database';
import { SqliteDatabase } from './sqlite.database';

export function providePersonixDatabase(): Provider {
  return {
    provide: DATABASE,
    deps: [IndexedDbDatabase, SqliteDatabase],
    useFactory: (indexedDb: IndexedDbDatabase, sqlite: SqliteDatabase) =>
      window.Capacitor?.isNativePlatform?.() === true &&
      window.Capacitor.getPlatform?.() === 'android'
        ? sqlite
        : indexedDb,
  };
}
