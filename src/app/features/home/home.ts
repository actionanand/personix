import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SavedContent, Note, ChecklistItem, FamilyMember } from '../../core/models/app.models';
import { ChecklistRepository } from '../../core/repositories/checklist.repository';
import { ContentRepository } from '../../core/repositories/content.repository';
import { FamilyRepository } from '../../core/repositories/family.repository';
import { NoteRepository } from '../../core/repositories/note.repository';
import { AppStore } from '../../core/services/app-store.service';
import { AppIcon } from '../../shared/components/app-icon';

@Component({
  selector: 'app-home',
  imports: [RouterLink, DatePipe, AppIcon],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private readonly contentRepository = inject(ContentRepository);
  private readonly notesRepository = inject(NoteRepository);
  private readonly familyRepository = inject(FamilyRepository);
  private readonly checklistRepository = inject(ChecklistRepository);
  private readonly store = inject(AppStore);

  protected readonly recentContent = signal<readonly SavedContent[]>([]);
  protected readonly waitingToSend = signal<readonly SavedContent[]>([]);
  protected readonly recentNotes = signal<readonly Note[]>([]);
  protected readonly pendingItems = signal<readonly ChecklistItem[]>([]);
  protected readonly importantFamily = signal<readonly FamilyMember[]>([]);
  protected readonly loading = signal(true);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    const showAdult = this.store.settings().showAdultContent;
    const [recent, waiting, notes, members, lists] = await Promise.all([
      this.contentRepository.list(this.filters(), showAdult, 4),
      this.contentRepository.list(
        { ...this.filters(), sent: 'unsent', sort: 'waiting-to-send' },
        showAdult,
        4,
      ),
      this.notesRepository.list('', 4),
      this.familyRepository.members(),
      this.checklistRepository.lists(),
    ]);
    const allItems = (
      await Promise.all(lists.map((list) => this.checklistRepository.items(list.id)))
    ).flat();
    this.recentContent.set(recent.items);
    this.waitingToSend.set(waiting.items.filter((item) => item.recipientIds.length));
    this.recentNotes.set(notes.items);
    this.importantFamily.set(members.filter((item) => item.important).slice(0, 4));
    this.pendingItems.set(allItems.filter((item) => !item.completed).slice(0, 5));
    this.loading.set(false);
  }

  private filters() {
    return {
      section: 'videos' as const,
      query: '',
      contentType: '' as const,
      platform: '',
      categoryId: '',
      tagId: '',
      recipientId: '',
      sent: 'all' as const,
      favouriteOnly: false,
      consumed: 'all' as const,
      adultOnly: false,
      dateFrom: '',
      dateTo: '',
      sort: 'recent' as const,
    };
  }
}
