import { inject, Injectable } from '@angular/core';
import { DATABASE } from '../database/database.port';
import { Note, Page, PageCursor, newId, normalizeText, nowIso } from '../models/app.models';

@Injectable({ providedIn: 'root' })
export class NoteRepository {
  private readonly database = inject(DATABASE);

  async list(
    query: string,
    limit = 40,
    cursor: PageCursor | null = null,
    includeArchived = false,
  ): Promise<Page<Note>> {
    const terms = normalizeText(query).split(/\s+/).filter(Boolean);
    const sorted = (await this.database.getAll('notes'))
      .filter((item) => !item.deleted && (includeArchived || !item.archived))
      .filter((item) => terms.every((term) => normalizeText(item.text).includes(term)))
      .sort(
        (a, b) =>
          Number(b.pinned) - Number(a.pinned) ||
          b.createdAt.localeCompare(a.createdAt) ||
          b.id.localeCompare(a.id),
      );
    const remaining = cursor
      ? sorted.filter(
          (item) =>
            item.createdAt < cursor.createdAt ||
            (item.createdAt === cursor.createdAt && item.id < cursor.id),
        )
      : sorted;
    const items = remaining.slice(0, limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        items.length === limit && last ? { createdAt: last.createdAt, id: last.id } : null,
    };
  }

  async save(text: string, existing?: Note): Promise<Note> {
    const timestamp = nowIso();
    const value: Note = existing
      ? { ...existing, text: text.trim(), updatedAt: timestamp }
      : {
          id: newId(),
          text: text.trim(),
          pinned: false,
          favourite: false,
          category: '',
          tagIds: [],
          reminderAt: '',
          attachmentIds: [],
          archived: false,
          deleted: false,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
    await this.database.put('notes', value);
    return value;
  }

  async update(note: Note, patch: Partial<Note>): Promise<void> {
    await this.database.put('notes', { ...note, ...patch, updatedAt: nowIso() });
  }

  async remove(id: string, permanent = false): Promise<void> {
    if (permanent) return this.database.delete('notes', id);
    const note = await this.database.get('notes', id);
    if (note) await this.update(note, { deleted: true });
  }
}
