import { TestBed } from '@angular/core/testing';
import { DATABASE, DatabasePort } from '../database/database.port';
import {
  ContentFilters,
  DatabaseTable,
  SavedContent,
  TableRecordMap,
  nowIso,
} from '../models/app.models';
import { ContentRepository } from './content.repository';

class MemoryDatabase implements DatabasePort {
  private readonly records = new Map<DatabaseTable, Map<string, TableRecordMap[DatabaseTable]>>();
  initialize(): Promise<void> {
    return Promise.resolve();
  }
  get<K extends DatabaseTable>(table: K, id: string): Promise<TableRecordMap[K] | null> {
    return Promise.resolve(
      (this.records.get(table)?.get(id) as TableRecordMap[K] | undefined) ?? null,
    );
  }
  getAll<K extends DatabaseTable>(table: K): Promise<readonly TableRecordMap[K][]> {
    return Promise.resolve([
      ...(this.records.get(table)?.values() ?? []),
    ] as unknown as readonly TableRecordMap[K][]);
  }
  put<K extends DatabaseTable>(table: K, value: TableRecordMap[K]): Promise<void> {
    const store = this.records.get(table) ?? new Map();
    store.set(value.id, value);
    this.records.set(table, store);
    return Promise.resolve();
  }
  async putMany<K extends DatabaseTable>(
    table: K,
    values: readonly TableRecordMap[K][],
  ): Promise<void> {
    for (const value of values) await this.put(table, value);
  }
  delete<K extends DatabaseTable>(table: K, id: string): Promise<void> {
    this.records.get(table)?.delete(id);
    return Promise.resolve();
  }
  async deleteMany(
    changes: Partial<Readonly<Record<DatabaseTable, readonly string[]>>>,
  ): Promise<void> {
    for (const [table, ids] of Object.entries(changes) as [DatabaseTable, readonly string[]][])
      for (const id of ids) await this.delete(table, id);
  }
  async replaceTables(
    changes: Partial<Readonly<Record<DatabaseTable, readonly TableRecordMap[DatabaseTable][]>>>,
  ): Promise<void> {
    for (const [table, values] of Object.entries(changes) as [
      DatabaseTable,
      readonly TableRecordMap[DatabaseTable][],
    ][]) {
      this.records.set(table, new Map(values.map((value) => [value.id, value])));
    }
  }
  count<K extends DatabaseTable>(table: K): Promise<number> {
    return Promise.resolve(this.records.get(table)?.size ?? 0);
  }
  clear<K extends DatabaseTable>(table: K): Promise<void> {
    this.records.get(table)?.clear();
    return Promise.resolve();
  }
}

const filters: ContentFilters = {
  section: 'posts',
  query: '',
  contentType: '',
  platform: '',
  categoryId: '',
  tagId: '',
  recipientId: '',
  sent: 'all',
  favouriteOnly: false,
  consumed: 'all',
  adultOnly: false,
  dateFrom: '',
  dateTo: '',
  sort: 'recent',
};

describe('ContentRepository', () => {
  let repository: ContentRepository;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: DATABASE, useClass: MemoryDatabase }],
    });
    repository = TestBed.inject(ContentRepository);
  });

  it('detects Scrollix-compatible video platforms', () => {
    expect(repository.detectContent('https://youtube.com/shorts/abc')).toMatchObject({
      contentType: 'youtube-short',
      platform: 'YouTube',
      mediaId: 'abc',
    });
    expect(repository.detectContent('https://vimeo.com/123')).toMatchObject({
      contentType: 'vimeo',
      platform: 'Vimeo',
      mediaId: '123',
    });
    expect(repository.detectContent('https://www.facebook.com/share/r/example')).toMatchObject({
      contentType: 'facebook-share',
      platform: 'Facebook',
    });
    expect(
      repository.detectContent('https://www.tiktok.com/@person/video/7391234567890123456'),
    ).toMatchObject({ contentType: 'tiktok', mediaId: '7391234567890123456' });
    expect(repository.detectContent('https://www.instagram.com/p/ABC123/')).toMatchObject({
      contentType: 'instagram-post',
      mediaId: 'ABC123',
    });
  });

  it('excludes adult records until visibility is enabled', async () => {
    await repository.save(draft('safe', false));
    await repository.save(draft('adult', true));
    expect((await repository.list(filters, false)).items.map((item) => item.title)).toEqual([
      'safe',
    ]);
    expect((await repository.list(filters, true)).items).toHaveLength(2);
  });

  it('uses a stable timestamp and ID cursor', async () => {
    for (let index = 0; index < 35; index++) await repository.save(draft(`item-${index}`, false));
    const first = await repository.list(filters, false, 30);
    const second = await repository.list(filters, false, 30, first.nextCursor);
    expect(first.items).toHaveLength(30);
    expect(second.items).toHaveLength(5);
    expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(35);
  });
});

function draft(
  title: string,
  adult: boolean,
): Omit<SavedContent, 'id' | 'createdAt' | 'updatedAt' | 'normalizedUrl' | 'domain'> {
  return {
    url: `https://example.com/${title}`,
    contentType: 'article',
    platform: 'Example',
    title,
    adult,
    ogTitle: '',
    description: '',
    ogDescription: '',
    ogImageUrl: '',
    downloadedOgImageRef: '',
    customThumbnail: '',
    websiteName: '',
    favicon: '',
    notes: '',
    categoryId: '',
    tagIds: [],
    recipientIds: [],
    favourite: false,
    consumed: false,
    sent: false,
    sentAt: '',
    sentNote: '',
    lastOpenedAt: '',
    metadataFetchedAt: nowIso(),
    metadataStatus: 'idle',
    metadataError: '',
    metadataSource: 'none',
  };
}
