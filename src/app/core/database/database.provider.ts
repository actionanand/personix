import { Provider } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { DATABASE } from './database.port';
import { IndexedDbDatabase } from './indexed-db.database';
import { SqliteDatabase } from './sqlite.database';

export function providePersonixDatabase(): Provider {
  return {
    provide: DATABASE,
    deps: [IndexedDbDatabase, SqliteDatabase],
    useFactory: (indexedDb: IndexedDbDatabase, sqlite: SqliteDatabase) =>
      Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android' ? sqlite : indexedDb,
  };
}
