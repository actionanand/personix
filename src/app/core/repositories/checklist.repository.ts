import { inject, Injectable } from '@angular/core';
import { DATABASE } from '../database/database.port';
import { Checklist, ChecklistItem, newId, nowIso } from '../models/app.models';

@Injectable({ providedIn: 'root' })
export class ChecklistRepository {
  private readonly database = inject(DATABASE);

  async lists(): Promise<readonly Checklist[]> {
    return (await this.database.getAll('checklists'))
      .filter((item) => !item.archived)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async items(checklistId: string): Promise<readonly ChecklistItem[]> {
    return (await this.database.getAll('checklist_items'))
      .filter((item) => item.checklistId === checklistId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async saveList(title: string, description = '', existing?: Checklist): Promise<Checklist> {
    const timestamp = nowIso();
    const value: Checklist = existing
      ? { ...existing, title, description, updatedAt: timestamp }
      : {
          id: newId(),
          title,
          description,
          archived: false,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
    await this.database.put('checklists', value);
    return value;
  }

  async addItem(checklistId: string, text: string): Promise<void> {
    const items = await this.items(checklistId);
    const timestamp = nowIso();
    await this.database.put('checklist_items', {
      id: newId(),
      checklistId,
      text: text.trim(),
      completed: false,
      sortOrder: (items.at(-1)?.sortOrder ?? -1) + 1,
      dueDate: '',
      note: '',
      completedAt: '',
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  async toggle(item: ChecklistItem): Promise<void> {
    const completed = !item.completed;
    await this.database.put('checklist_items', {
      ...item,
      completed,
      completedAt: completed ? nowIso() : '',
      updatedAt: nowIso(),
    });
  }

  async removeItem(id: string): Promise<void> {
    await this.database.delete('checklist_items', id);
  }

  async archive(list: Checklist, archived = true): Promise<void> {
    await this.database.put('checklists', { ...list, archived, updatedAt: nowIso() });
  }

  async duplicate(list: Checklist): Promise<Checklist> {
    const copy = await this.saveList(`${list.title} copy`, list.description);
    const items = await this.items(list.id);
    for (const item of items) {
      await this.addItem(copy.id, item.text);
    }
    return copy;
  }

  async clearCompleted(checklistId: string): Promise<number> {
    const ids = (await this.items(checklistId))
      .filter((item) => item.completed)
      .map((item) => item.id);
    await this.database.deleteMany({ checklist_items: ids });
    return ids.length;
  }
}
