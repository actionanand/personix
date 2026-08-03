import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Checklist, ChecklistItem } from '../../core/models/app.models';
import { ChecklistRepository } from '../../core/repositories/checklist.repository';
import { AppStore } from '../../core/services/app-store.service';
import { DialogService } from '../../core/services/dialog.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { AppIcon } from '../../shared/components/app-icon';

@Component({
  selector: 'app-checklists',
  imports: [ReactiveFormsModule, AppIcon],
  templateUrl: './checklists.html',
  styleUrl: './checklists.scss',
})
export class Checklists {
  private readonly repository = inject(ChecklistRepository);
  protected readonly store = inject(AppStore);
  private readonly dialogs = inject(DialogService);
  private readonly feedback = inject(FeedbackService);
  private readonly formBuilder = inject(FormBuilder);
  protected readonly lists = signal<readonly Checklist[]>([]);
  protected readonly selected = signal<Checklist | null>(null);
  protected readonly items = signal<readonly ChecklistItem[]>([]);
  protected readonly listTitle = this.formBuilder.nonNullable.control('', Validators.required);
  protected readonly itemText = this.formBuilder.nonNullable.control('', Validators.required);
  protected readonly visibleItems = computed(() =>
    this.store.settings().hideCompletedChecklistItems
      ? this.items().filter((item) => !item.completed)
      : this.items(),
  );
  protected readonly progress = computed(() => {
    const items = this.items();
    return items.length
      ? Math.round((items.filter((item) => item.completed).length / items.length) * 100)
      : 0;
  });
  constructor() {
    void this.load();
    if (inject(ActivatedRoute).snapshot.queryParamMap.has('add'))
      window.setTimeout(() => this.itemText.markAsTouched(), 0);
  }
  protected async load(): Promise<void> {
    const lists = await this.repository.lists();
    this.lists.set(lists);
    const current = this.selected();
    const selected = lists.find((item) => item.id === current?.id) ?? lists[0] ?? null;
    this.selected.set(selected);
    this.items.set(selected ? await this.repository.items(selected.id) : []);
  }
  protected async select(list: Checklist): Promise<void> {
    this.selected.set(list);
    this.items.set(await this.repository.items(list.id));
  }
  protected async addList(): Promise<void> {
    if (this.listTitle.invalid) return;
    const list = await this.repository.saveList(this.listTitle.value);
    this.listTitle.reset();
    this.selected.set(list);
    this.feedback.notify('Checklist created');
    await this.load();
  }
  protected async addItem(): Promise<void> {
    const list = this.selected();
    if (!list || this.itemText.invalid) return;
    await this.repository.addItem(list.id, this.itemText.value);
    this.itemText.reset();
    this.items.set(await this.repository.items(list.id));
  }
  protected async toggle(item: ChecklistItem): Promise<void> {
    await this.repository.toggle(item);
    const list = this.selected();
    if (list) this.items.set(await this.repository.items(list.id));
  }
  protected async removeItem(item: ChecklistItem): Promise<void> {
    await this.repository.removeItem(item.id);
    const list = this.selected();
    if (list) this.items.set(await this.repository.items(list.id));
    this.feedback.notify('Checklist item deleted');
  }
  protected async clearCompleted(): Promise<void> {
    const list = this.selected();
    if (!list) return;
    const completed = this.items().filter((item) => item.completed).length;
    if (!completed) {
      this.feedback.notify('There are no completed items', 'info');
      return;
    }
    if (this.store.settings().confirmClearCompleted) {
      const result = await this.dialogs.open({
        title: 'Clear completed items?',
        description: `${completed} completed item${completed === 1 ? '' : 's'} will be permanently removed.`,
        confirmText: 'Clear completed',
        destructive: true,
        icon: 'trash',
      });
      if (!result.confirmed) return;
    }
    await this.repository.clearCompleted(list.id);
    this.feedback.notify('Completed items cleared');
    this.items.set(await this.repository.items(list.id));
  }
  protected async duplicate(): Promise<void> {
    const list = this.selected();
    if (!list) return;
    this.selected.set(await this.repository.duplicate(list));
    this.feedback.notify('Checklist duplicated');
    await this.load();
  }
  protected async archive(): Promise<void> {
    const list = this.selected();
    if (!list) return;
    const result = await this.dialogs.open({
      title: 'Archive checklist?',
      description: `${list.title} will leave the active checklist list.`,
      confirmText: 'Archive',
      icon: 'archive',
    });
    if (!result.confirmed) return;
    await this.repository.archive(list);
    this.selected.set(null);
    this.feedback.notify('Checklist archived');
    await this.load();
  }
}
