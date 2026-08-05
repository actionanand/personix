import { inject, Injectable } from '@angular/core';
import { DATABASE } from '../database/database.port';
import {
  ContentCategory,
  ContentFilters,
  ContentRecipient,
  ContentTag,
  Page,
  PageCursor,
  SavedContent,
  isVideoContentType,
  newId,
  normalizeText,
  nowIso,
} from '../models/app.models';
import { detectContentUrl } from '../utils/content-url';

export type SavedContentDraft = Omit<
  SavedContent,
  'id' | 'createdAt' | 'updatedAt' | 'normalizedUrl' | 'domain'
> &
  Partial<Pick<SavedContent, 'id' | 'createdAt'>>;

@Injectable({ providedIn: 'root' })
export class ContentRepository {
  private readonly database = inject(DATABASE);

  async list(
    filters: ContentFilters,
    showAdult: boolean,
    limit = 30,
    cursor: PageCursor | null = null,
    offset = 0,
  ): Promise<Page<SavedContent> & { readonly total: number }> {
    const [items, categories, tags, recipients] = await Promise.all([
      this.database.getAll('saved_content'),
      this.database.getAll('content_categories'),
      this.database.getAll('content_tags'),
      this.database.getAll('content_recipients'),
    ]);
    const categoryNames = new Map(categories.map((item) => [item.id, item.name]));
    const tagNames = new Map(tags.map((item) => [item.id, item.name]));
    const recipientNames = new Map(recipients.map((item) => [item.id, item.name]));
    const terms = normalizeText(filters.query).split(/\s+/).filter(Boolean);
    const matches = items
      .filter((item) => showAdult || !item.adult)
      .filter((item) => !showAdult || !filters.excludeAdult || !item.adult)
      .filter((item) =>
        filters.section === 'videos'
          ? isVideoContentType(item.contentType)
          : !isVideoContentType(item.contentType),
      )
      .filter((item) => !showAdult || !filters.adultOnly || item.adult)
      .filter((item) => !filters.contentType || item.contentType === filters.contentType)
      .filter((item) => !filters.platform || item.platform === filters.platform)
      .filter((item) => !filters.categoryId || item.categoryId === filters.categoryId)
      .filter((item) => !filters.tagId || item.tagIds.includes(filters.tagId))
      .filter((item) => !filters.recipientId || item.recipientIds.includes(filters.recipientId))
      .filter((item) => filters.sent === 'all' || item.sent === (filters.sent === 'sent'))
      .filter((item) => !filters.favouriteOnly || item.favourite)
      .filter(
        (item) => filters.consumed === 'all' || item.consumed === (filters.consumed === 'consumed'),
      )
      .filter((item) => !filters.dateFrom || item.createdAt >= filters.dateFrom)
      .filter((item) => !filters.dateTo || item.createdAt <= `${filters.dateTo}T23:59:59.999Z`)
      .filter((item) => {
        if (!terms.length) return true;
        const searchable = normalizeText(
          [
            item.title,
            item.ogTitle,
            item.url,
            item.domain,
            item.description,
            item.ogDescription,
            item.notes,
            item.platform,
            categoryNames.get(item.categoryId) ?? '',
            ...item.tagIds.map((id) => tagNames.get(id) ?? ''),
            ...item.recipientIds.map((id) => recipientNames.get(id) ?? ''),
          ].join(' '),
        );
        return terms.every((term) => searchable.includes(term));
      })
      .sort(this.comparator(filters.sort));
    const afterCursor = cursor
      ? matches.filter(
          (item) =>
            item.createdAt < cursor.createdAt ||
            (item.createdAt === cursor.createdAt && item.id < cursor.id),
        )
      : matches;
    const safeOffset = Math.max(0, offset);
    const pageItems = afterCursor.slice(safeOffset, safeOffset + limit);
    const last = pageItems.at(-1);
    return {
      items: pageItems,
      nextCursor:
        safeOffset + pageItems.length < afterCursor.length && last
          ? { createdAt: last.createdAt, id: last.id }
          : null,
      total: afterCursor.length,
    };
  }

  async save(draft: SavedContentDraft): Promise<SavedContent> {
    const timestamp = nowIso();
    const url = this.normalizeUrl(draft.url);
    const value: SavedContent = {
      ...draft,
      id: draft.id ?? newId(),
      createdAt: draft.createdAt ?? timestamp,
      updatedAt: timestamp,
      url,
      normalizedUrl: normalizeText(url),
      domain: this.domain(url),
    };
    await this.database.put('saved_content', value);
    return value;
  }

  async remove(id: string): Promise<void> {
    await this.database.delete('saved_content', id);
  }

  async deleteAllAdult(): Promise<number> {
    const [items, attachments] = await Promise.all([
      this.database.getAll('saved_content'),
      this.database.getAll('attachments'),
    ]);
    const adultIds = items.filter((item) => item.adult).map((item) => item.id);
    const attachmentIds = attachments
      .filter((item) => adultIds.includes(item.ownerId))
      .map((item) => item.id);
    await this.database.deleteMany({ saved_content: adultIds, attachments: attachmentIds });
    await this.removeOrphans();
    return adultIds.length;
  }

  async adultCount(): Promise<number> {
    return (await this.database.getAll('saved_content')).filter((item) => item.adult).length;
  }

  async missingPostMetadata(limit = 25): Promise<readonly SavedContent[]> {
    return (await this.database.getAll('saved_content'))
      .filter((item) => !isVideoContentType(item.contentType))
      .filter(
        (item) =>
          item.metadataStatus !== 'success' ||
          !(item.ogTitle || item.ogDescription || item.ogImageUrl),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async categories(): Promise<readonly ContentCategory[]> {
    return [...(await this.database.getAll('content_categories'))].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }

  async tags(): Promise<readonly ContentTag[]> {
    return [...(await this.database.getAll('content_tags'))].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }

  async recipients(): Promise<readonly ContentRecipient[]> {
    return [...(await this.database.getAll('content_recipients'))].sort((a, b) =>
      b.lastUsedAt.localeCompare(a.lastUsedAt),
    );
  }

  async findOrCreateCategory(name: string, adult = false): Promise<ContentCategory> {
    const existing = (await this.categories()).find(
      (item) => normalizeText(item.name) === normalizeText(name),
    );
    if (existing) return existing;
    const timestamp = nowIso();
    const category: ContentCategory = {
      id: newId(),
      name: name.trim(),
      colour: adult ? '#8b3149' : '#2f8f65',
      icon: adult ? 'shield-alert' : 'folder',
      isAdult: adult,
      archived: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.database.put('content_categories', category);
    return category;
  }

  async findOrCreateTags(names: readonly string[]): Promise<readonly ContentTag[]> {
    const existing = await this.tags();
    const timestamp = nowIso();
    const result: ContentTag[] = [];
    for (const rawName of names.map((name) => name.trim()).filter(Boolean)) {
      const found = existing.find((item) => normalizeText(item.name) === normalizeText(rawName));
      if (found) result.push(found);
      else {
        const tag: ContentTag = {
          id: newId(),
          name: rawName,
          archived: false,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        await this.database.put('content_tags', tag);
        result.push(tag);
      }
    }
    return result;
  }

  async findOrCreateRecipients(names: readonly string[]): Promise<readonly ContentRecipient[]> {
    const existing = await this.recipients();
    const timestamp = nowIso();
    const result: ContentRecipient[] = [];
    for (const rawName of names.map((name) => name.trim()).filter(Boolean)) {
      const found = existing.find((item) => normalizeText(item.name) === normalizeText(rawName));
      const recipient: ContentRecipient = found
        ? { ...found, lastUsedAt: timestamp }
        : {
            id: newId(),
            name: rawName,
            lastUsedAt: timestamp,
            createdAt: timestamp,
            updatedAt: timestamp,
          };
      await this.database.put('content_recipients', recipient);
      result.push(recipient);
    }
    return result;
  }

  detectContent(url: string): {
    readonly contentType: SavedContent['contentType'];
    readonly platform: string;
    readonly resolvedUrl: string;
    readonly mediaId: string;
    readonly startTimeSeconds: number;
  } {
    const detected = detectContentUrl(url);
    return {
      contentType: detected.contentType,
      platform: detected.platform,
      resolvedUrl: detected.canonicalUrl,
      mediaId: detected.mediaId,
      startTimeSeconds: detected.startTimeSeconds,
    };
  }

  private comparator(sort: ContentFilters['sort']): (a: SavedContent, b: SavedContent) => number {
    switch (sort) {
      case 'oldest':
        return (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
      case 'recently-opened':
        return (a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt) || b.id.localeCompare(a.id);
      case 'title':
        return (a, b) => (a.title || a.ogTitle).localeCompare(b.title || b.ogTitle);
      case 'platform':
        return (a, b) =>
          a.platform.localeCompare(b.platform) || b.createdAt.localeCompare(a.createdAt);
      case 'category':
        return (a, b) =>
          a.categoryId.localeCompare(b.categoryId) || b.createdAt.localeCompare(a.createdAt);
      case 'waiting-to-send':
        return (a, b) => Number(a.sent) - Number(b.sent) || b.createdAt.localeCompare(a.createdAt);
      case 'recent':
        return (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);
    }
  }

  private async removeOrphans(): Promise<void> {
    const [items, tags, recipients] = await Promise.all([
      this.database.getAll('saved_content'),
      this.tags(),
      this.recipients(),
    ]);
    const tagIds = new Set(items.flatMap((item) => item.tagIds));
    const recipientIds = new Set(items.flatMap((item) => item.recipientIds));
    await this.database.deleteMany({
      content_tags: tags.filter((item) => !tagIds.has(item.id)).map((item) => item.id),
      content_recipients: recipients
        .filter((item) => !recipientIds.has(item.id))
        .map((item) => item.id),
    });
  }

  private normalizeUrl(raw: string): string {
    const value = raw.trim();
    if (!value) return '';
    return /^https?:\/\//i.test(value) ? value : `https://${value}`;
  }

  private domain(raw: string): string {
    try {
      return new URL(this.normalizeUrl(raw)).hostname.toLocaleLowerCase();
    } catch {
      return '';
    }
  }
}
