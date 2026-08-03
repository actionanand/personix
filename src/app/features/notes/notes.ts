import { DatePipe } from '@angular/common';
import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Note, PageCursor, normalizeText } from '../../core/models/app.models';
import { NoteRepository } from '../../core/repositories/note.repository';
import { AppStore } from '../../core/services/app-store.service';
import { DialogService } from '../../core/services/dialog.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { AppIcon } from '../../shared/components/app-icon';

interface TextSegment {
  readonly text: string;
  readonly match: boolean;
}

@Component({
  selector: 'app-notes',
  imports: [ReactiveFormsModule, DatePipe, AppIcon],
  templateUrl: './notes.html',
  styleUrl: './notes.scss',
})
export class Notes {
  private readonly repository = inject(NoteRepository);
  private readonly store = inject(AppStore);
  private readonly dialogs = inject(DialogService);
  private readonly feedback = inject(FeedbackService);
  private readonly formBuilder = inject(FormBuilder);
  protected readonly notes = signal<readonly Note[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly nextCursor = signal<PageCursor | null>(null);
  protected readonly searchControl = this.formBuilder.nonNullable.control('');
  protected readonly composer = this.formBuilder.nonNullable.control('', Validators.required);
  private readonly composerElement = viewChild<ElementRef<HTMLTextAreaElement>>('composerElement');
  constructor() {
    void this.load(true);
    if (inject(ActivatedRoute).snapshot.queryParamMap.has('compose'))
      window.setTimeout(() => this.composerElement()?.nativeElement.focus(), 80);
  }
  protected async load(reset: boolean): Promise<void> {
    this.loading.set(true);
    const cursor = reset ? null : this.nextCursor();
    const page = await this.repository.list(
      this.searchControl.value,
      this.store.settings().notePageSize,
      cursor,
      this.store.settings().showArchivedNotes,
    );
    this.notes.update((items) => (reset ? page.items : [...items, ...page.items]));
    this.nextCursor.set(page.nextCursor);
    this.loading.set(false);
  }
  protected async save(): Promise<void> {
    if (this.composer.invalid || this.saving()) return;
    this.saving.set(true);
    try {
      await this.repository.save(this.composer.value);
      this.composer.reset();
      this.feedback.notify('Note saved');
      await this.load(true);
      window.setTimeout(() => this.composerElement()?.nativeElement.focus(), 0);
    } catch (error) {
      this.feedback.notify(
        error instanceof Error ? error.message : 'Note could not be saved.',
        'error',
      );
    } finally {
      this.saving.set(false);
    }
  }
  protected async edit(note: Note): Promise<void> {
    const result = await this.dialogs.open({
      title: 'Edit note',
      description: 'Update this note without creating a title.',
      confirmText: 'Save',
      promptLabel: 'Note text',
      promptType: 'text',
    });
    if (!result.confirmed || !result.value.trim()) return;
    await this.repository.save(result.value, note);
    this.feedback.notify('Note updated');
    await this.load(true);
  }
  protected async togglePin(note: Note): Promise<void> {
    await this.repository.update(note, { pinned: !note.pinned });
    this.feedback.notify(note.pinned ? 'Note unpinned' : 'Note pinned', 'info');
    await this.load(true);
  }
  protected async archive(note: Note): Promise<void> {
    await this.repository.update(note, { archived: !note.archived });
    this.feedback.notify(note.archived ? 'Note restored' : 'Note archived');
    await this.load(true);
  }
  protected copy(note: Note): void {
    void navigator.clipboard.writeText(note.text).then(() => this.feedback.notify('Note copied'));
  }
  protected async remove(note: Note): Promise<void> {
    const result = await this.dialogs.open({
      title: 'Move note to deleted?',
      description: 'The note can be permanently removed later.',
      confirmText: 'Delete',
      destructive: true,
      icon: 'trash',
    });
    if (!result.confirmed) return;
    await this.repository.remove(note.id);
    this.feedback.notify('Note deleted');
    await this.load(true);
  }
  protected showDate(index: number): boolean {
    if (index === 0) return true;
    return (
      this.notes()[index - 1]?.createdAt.slice(0, 10) !==
      this.notes()[index]?.createdAt.slice(0, 10)
    );
  }
  protected segments(text: string): readonly TextSegment[] {
    const terms = normalizeText(this.searchControl.value).split(/\s+/).filter(Boolean);
    if (!terms.length) return [{ text, match: false }];
    const escaped = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const expression = new RegExp(`(${escaped})`, 'gi');
    return text
      .split(expression)
      .filter(Boolean)
      .map((part) => ({ text: part, match: terms.includes(normalizeText(part)) }));
  }
}
