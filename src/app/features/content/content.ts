import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  AppSettings,
  CONTENT_TYPES,
  ContentFilters,
  ContentType,
  PageCursor,
  SavedContent,
  isVideoContentType,
} from '../../core/models/app.models';
import { ContentRepository } from '../../core/repositories/content.repository';
import { AppStore } from '../../core/services/app-store.service';
import { DialogService } from '../../core/services/dialog.service';
import { FeedbackService } from '../../core/services/feedback.service';
import { MetadataService } from '../../core/services/metadata.service';
import { NativeIntegrationService } from '../../core/services/native-integration.service';
import {
  buildFacebookVideoUrl,
  extractFacebookVideoId,
  extractTikTokVideoId,
} from '../../core/utils/content-url';
import { AppIcon } from '../../shared/components/app-icon';
import { SelectPicker, SelectPickerOption } from '../../shared/components/select-picker';
import { ContentPreview } from './content-preview';

const DEFAULT_FILTERS: ContentFilters = {
  section: 'videos',
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

@Component({
  selector: 'app-content',
  imports: [ReactiveFormsModule, AppIcon, SelectPicker, ContentPreview],
  templateUrl: './content.html',
  styleUrl: './content.scss',
})
export class Content {
  private readonly repository = inject(ContentRepository);
  private readonly metadata = inject(MetadataService);
  protected readonly native = inject(NativeIntegrationService);
  protected readonly store = inject(AppStore);
  private readonly feedback = inject(FeedbackService);
  private readonly dialogs = inject(DialogService);
  private readonly route = inject(ActivatedRoute);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly activeSection = signal<'videos' | 'posts'>('videos');
  protected readonly contentTypes = computed(() =>
    CONTENT_TYPES.filter(
      (type) => isVideoContentType(type.value) === (this.activeSection() === 'videos'),
    ),
  );
  protected readonly contentTypeOptions = computed<readonly SelectPickerOption[]>(() => [
    { value: '', label: `All ${this.activeSection()}` },
    ...this.contentTypes(),
  ]);
  protected readonly formContentTypeOptions = computed<readonly SelectPickerOption[]>(() =>
    this.contentTypes(),
  );
  protected readonly items = signal<readonly SavedContent[]>([]);
  protected readonly categories = signal<Awaited<ReturnType<ContentRepository['categories']>>>([]);
  protected readonly tags = signal<Awaited<ReturnType<ContentRepository['tags']>>>([]);
  protected readonly recipients = signal<Awaited<ReturnType<ContentRepository['recipients']>>>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly syncingMetadata = signal(false);
  protected readonly panelOpen = signal(false);
  protected readonly filterOpen = signal(false);
  protected readonly nextCursor = signal<PageCursor | null>(null);
  protected readonly editing = signal<SavedContent | null>(null);
  protected readonly filters = signal<ContentFilters>(DEFAULT_FILTERS);
  protected readonly categoryOptions = computed<readonly SelectPickerOption[]>(() => [
    { value: '', label: 'All categories' },
    ...this.categories()
      .filter((item) => !item.isAdult || this.store.settings().showAdultContent)
      .map((item) => ({ value: item.id, label: item.name })),
  ]);
  protected readonly tagOptions = computed<readonly SelectPickerOption[]>(() => [
    { value: '', label: 'All tags' },
    ...this.tags().map((item) => ({ value: item.id, label: item.name })),
  ]);
  protected readonly recipientOptions = computed<readonly SelectPickerOption[]>(() => [
    { value: '', label: 'Anyone' },
    ...this.recipients().map((item) => ({ value: item.id, label: item.name })),
  ]);
  protected readonly sentOptions: readonly SelectPickerOption[] = [
    { value: 'all', label: 'All' },
    { value: 'unsent', label: 'Waiting to send' },
    { value: 'sent', label: 'Sent' },
  ];
  protected readonly consumedOptions: readonly SelectPickerOption[] = [
    { value: 'all', label: 'All' },
    { value: 'unconsumed', label: 'Not yet' },
    { value: 'consumed', label: 'Completed' },
  ];
  protected readonly sortOptions: readonly SelectPickerOption[] = [
    { value: 'recent', label: 'Recently added' },
    { value: 'oldest', label: 'Oldest' },
    { value: 'recently-opened', label: 'Recently opened' },
    { value: 'title', label: 'Title' },
    { value: 'platform', label: 'Platform' },
    { value: 'category', label: 'Category' },
    { value: 'waiting-to-send', label: 'Waiting to send' },
  ];

  protected readonly searchControl = this.formBuilder.nonNullable.control('');
  protected readonly contentForm = this.formBuilder.nonNullable.group({
    url: ['', [Validators.required]],
    contentType: ['website' as SavedContent['contentType'], Validators.required],
    platform: [''],
    title: [''],
    description: [''],
    notes: [''],
    category: [''],
    tags: [''],
    recipients: [''],
    favourite: [false],
    adult: [false],
    consumed: [false],
    sent: [false],
    sentNote: [''],
  });

  constructor() {
    void this.initialize();
    if (this.route.snapshot.queryParamMap.has('add')) window.setTimeout(() => this.openAdd(), 0);
  }

  private async initialize(): Promise<void> {
    await this.refresh();
    await this.syncMissingMetadata(false);
  }

  protected async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      const [page, categories, tags, recipients] = await Promise.all([
        this.repository.list(this.filters(), this.store.settings().showAdultContent),
        this.repository.categories(),
        this.repository.tags(),
        this.repository.recipients(),
      ]);
      this.items.set(page.items);
      this.nextCursor.set(page.nextCursor);
      this.categories.set(categories);
      this.tags.set(tags);
      this.recipients.set(recipients);
    } finally {
      this.loading.set(false);
    }
  }

  protected async loadMore(): Promise<void> {
    const cursor = this.nextCursor();
    if (!cursor || this.loading()) return;
    this.loading.set(true);
    try {
      const page = await this.repository.list(
        this.filters(),
        this.store.settings().showAdultContent,
        30,
        cursor,
      );
      this.items.update((items) => [...items, ...page.items]);
      this.nextCursor.set(page.nextCursor);
    } finally {
      this.loading.set(false);
    }
  }

  protected search(): void {
    this.filters.update((value) => ({ ...value, query: this.searchControl.value }));
    void this.refresh();
  }

  protected updateFilter<K extends keyof ContentFilters>(key: K, value: ContentFilters[K]): void {
    this.filters.update((filters) => ({ ...filters, [key]: value }));
    void this.refresh();
  }

  protected resetFilters(): void {
    this.filters.set({
      ...DEFAULT_FILTERS,
      section: this.activeSection(),
      query: this.searchControl.value,
    });
    void this.refresh();
  }

  protected selectSection(section: 'videos' | 'posts'): void {
    if (section === this.activeSection()) return;
    this.activeSection.set(section);
    this.filters.update((value) => ({ ...value, section, contentType: '' }));
    void this.refresh();
  }

  protected openAdd(): void {
    this.editing.set(null);
    this.contentForm.reset({
      url: '',
      contentType: this.defaultTypeForSection(),
      platform: '',
      title: '',
      description: '',
      notes: '',
      category: '',
      tags: '',
      recipients: '',
      favourite: false,
      adult: false,
      consumed: false,
      sent: false,
      sentNote: '',
    });
    this.panelOpen.set(true);
  }

  protected edit(item: SavedContent): void {
    this.editing.set(item);
    const category = this.categories().find((value) => value.id === item.categoryId)?.name ?? '';
    this.contentForm.reset({
      url: item.url,
      contentType: item.contentType,
      platform: item.platform,
      title: item.title,
      description: item.description,
      notes: item.notes,
      category,
      tags: item.tagIds
        .map((id) => this.tags().find((value) => value.id === id)?.name ?? '')
        .filter(Boolean)
        .join(', '),
      recipients: item.recipientIds
        .map((id) => this.recipients().find((value) => value.id === id)?.name ?? '')
        .filter(Boolean)
        .join(', '),
      favourite: item.favourite,
      adult: item.adult,
      consumed: item.consumed,
      sent: item.sent,
      sentNote: item.sentNote,
    });
    this.panelOpen.set(true);
  }

  protected detectFromUrl(): void {
    const detected = this.repository.detectContent(this.contentForm.controls.url.value);
    this.contentForm.patchValue(detected);
    const section = isVideoContentType(detected.contentType) ? 'videos' : 'posts';
    if (section !== this.activeSection()) this.selectSection(section);
  }

  protected async save(): Promise<void> {
    if (this.contentForm.invalid || this.saving()) {
      this.contentForm.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    try {
      const form = this.contentForm.getRawValue();
      const category = form.category.trim()
        ? await this.repository.findOrCreateCategory(
            form.category,
            form.category.trim().toLocaleLowerCase() === 'adult',
          )
        : null;
      const [tags, recipients] = await Promise.all([
        this.repository.findOrCreateTags(form.tags.split(',')),
        this.repository.findOrCreateRecipients(form.recipients.split(',')),
      ]);
      const previous = this.editing();
      const timestamp = previous?.createdAt;
      const detectedFromUrl = this.repository.detectContent(form.url);
      const detected = {
        ...detectedFromUrl,
        contentType: form.contentType,
        platform: form.platform.trim() || detectedFromUrl.platform,
      };
      let item = await this.repository.save({
        id: previous?.id,
        createdAt: timestamp,
        url: form.url,
        ...detected,
        title: form.title.trim(),
        ogTitle: previous?.ogTitle ?? '',
        description: form.description.trim(),
        ogDescription: previous?.ogDescription ?? '',
        ogImageUrl: previous?.ogImageUrl ?? '',
        downloadedOgImageRef: previous?.downloadedOgImageRef ?? '',
        customThumbnail: previous?.customThumbnail ?? '',
        websiteName: previous?.websiteName ?? '',
        favicon: previous?.favicon ?? '',
        notes: form.notes.trim(),
        categoryId: category?.id ?? '',
        tagIds: tags.map((value) => value.id),
        recipientIds: recipients.map((value) => value.id),
        favourite: form.favourite,
        adult: form.adult || category?.isAdult === true,
        consumed: form.consumed,
        sent: form.sent,
        sentAt: form.sent ? previous?.sentAt || new Date().toISOString() : '',
        sentNote: form.sentNote.trim(),
        lastOpenedAt: previous?.lastOpenedAt ?? '',
        metadataFetchedAt: previous?.metadataFetchedAt ?? '',
        metadataStatus: previous?.metadataStatus ?? 'idle',
        metadataError: previous?.metadataError ?? '',
        metadataSource: previous?.metadataSource ?? 'none',
      });
      item = await this.resolveShareUrl(item);
      this.panelOpen.set(false);
      this.feedback.notify(previous ? 'Content updated' : 'Content saved');
      await this.refresh();
      if (!previous || this.store.settings().autoRefreshMetadata) {
        const patch = await this.metadata.fetch(item.url, this.store.settings());
        if (patch.metadataStatus !== 'disabled') {
          const resolved = this.repository.detectContent(
            patch.resolvedUrl || item.resolvedUrl || item.url,
          );
          item = await this.repository.save({
            ...item,
            ...patch,
            resolvedUrl: patch.resolvedUrl || item.resolvedUrl,
            mediaId: resolved.mediaId || item.mediaId,
            startTimeSeconds: resolved.startTimeSeconds || item.startTimeSeconds,
          });
          if (patch.metadataStatus === 'success') this.feedback.notify('Metadata fetched', 'info');
          else this.feedback.notify(patch.metadataError || 'Unable to fetch metadata', 'warning');
          await this.refresh();
        }
      }
    } catch (error) {
      this.feedback.notify(
        error instanceof Error ? error.message : 'Content could not be saved.',
        'error',
      );
    } finally {
      this.saving.set(false);
    }
  }

  private async resolveShareUrl(item: SavedContent): Promise<SavedContent> {
    const isShare = item.contentType === 'facebook-share' || item.contentType === 'tiktok-share';
    if (!isShare) return item;
    const source = item.resolvedUrl || item.url;
    const existingId =
      item.contentType === 'facebook-share'
        ? extractFacebookVideoId(source)
        : extractTikTokVideoId(source);
    if (existingId && item.aspectRatio) return item;
    const resolution = await this.metadata.resolveShareUrl(item.url, this.store.settings());
    if (!resolution) return item;
    const detected = this.repository.detectContent(resolution.url);
    const mediaId = existingId ?? detected.mediaId;
    if (!mediaId) return item;
    const resolvedUrl =
      item.resolvedUrl && existingId
        ? item.resolvedUrl
        : item.contentType === 'facebook-share'
          ? buildFacebookVideoUrl(resolution.url)
          : resolution.url;
    return this.repository.save({
      ...item,
      resolvedUrl,
      mediaId,
      aspectRatio: resolution.aspectRatio ?? item.aspectRatio,
    });
  }

  protected async refreshMetadata(item: SavedContent): Promise<void> {
    item = await this.resolveShareUrl(item);
    const patch = await this.metadata.fetch(item.url, this.store.settings());
    const resolved = this.repository.detectContent(
      patch.resolvedUrl || item.resolvedUrl || item.url,
    );
    await this.repository.save({
      ...item,
      ...patch,
      resolvedUrl: patch.resolvedUrl || item.resolvedUrl,
      mediaId: resolved.mediaId || item.mediaId,
      startTimeSeconds: resolved.startTimeSeconds || item.startTimeSeconds,
    });
    this.feedback.notify(
      patch.metadataStatus === 'success'
        ? 'Metadata refreshed'
        : patch.metadataError || 'Unable to fetch metadata',
      patch.metadataStatus === 'success' ? 'success' : 'warning',
    );
    await this.refresh();
  }

  protected async syncMissingMetadata(showFeedback = true): Promise<void> {
    if (
      !this.native.isAndroid() ||
      !this.store.settings().androidMetadataEnabled ||
      this.syncingMetadata()
    )
      return;
    this.syncingMetadata.set(true);
    let updated = 0;
    try {
      for (const item of await this.repository.missingPostMetadata()) {
        const patch = await this.metadata.fetch(item.url, this.store.settings());
        if (patch.metadataStatus !== 'success') continue;
        const resolved = this.repository.detectContent(
          patch.resolvedUrl || item.resolvedUrl || item.url,
        );
        await this.repository.save({
          ...item,
          ...patch,
          resolvedUrl: patch.resolvedUrl || item.resolvedUrl,
          mediaId: resolved.mediaId || item.mediaId,
          startTimeSeconds: resolved.startTimeSeconds || item.startTimeSeconds,
        });
        updated++;
      }
      if (updated) await this.refresh();
      if (showFeedback)
        this.feedback.notify(
          updated
            ? `${updated} missing preview${updated === 1 ? '' : 's'} synced`
            : 'Post previews are up to date',
          'info',
        );
    } catch (error) {
      if (showFeedback)
        this.feedback.notify(
          error instanceof Error ? error.message : 'Missing previews could not be synced.',
          'warning',
        );
    } finally {
      this.syncingMetadata.set(false);
    }
  }

  protected async open(item: SavedContent): Promise<void> {
    await this.repository.save({ ...item, lastOpenedAt: new Date().toISOString() });
    window.open(item.url, '_blank', 'noopener,noreferrer');
  }

  protected async remove(item: SavedContent): Promise<void> {
    const result = await this.dialogs.open({
      title: 'Delete saved content?',
      description: `“${item.title || item.ogTitle || item.domain}” will be removed from this device.`,
      confirmText: 'Delete',
      destructive: true,
      icon: 'trash',
    });
    if (!result.confirmed) return;
    await this.repository.remove(item.id);
    this.feedback.notify('Record deleted');
    await this.refresh();
  }

  protected categoryName(id: string): string {
    return this.categories().find((item) => item.id === id)?.name ?? '';
  }
  protected tagName(id: string): string {
    return this.tags().find((item) => item.id === id)?.name ?? '';
  }
  protected recipientName(id: string): string {
    return this.recipients().find((item) => item.id === id)?.name ?? '';
  }
  protected metadataEnabled(settings: AppSettings): boolean {
    return settings.androidMetadataEnabled || settings.browserMetadataEnabled;
  }
  private defaultTypeForSection(): ContentType {
    const configured = this.store.settings().defaultContentType;
    return isVideoContentType(configured) === (this.activeSection() === 'videos')
      ? configured
      : this.activeSection() === 'videos'
        ? 'youtube'
        : 'article';
  }
}
