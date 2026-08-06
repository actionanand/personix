import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { CONTENT_CONFIG, isAndroidExternalPostUrl } from '../../core/config/content.config';
import {
  AppSettings,
  CONTENT_TYPES,
  ContentFilters,
  ContentType,
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
  buildFacebookPostUrl,
  buildFacebookVideoUrl,
  detectContentUrl,
  extractFacebookPostId,
  extractFacebookVideoId,
  extractTikTokVideoId,
  isFacebookPostShareUrl,
  isGoogleMapsShortUrl,
} from '../../core/utils/content-url';
import { AppIcon } from '../../shared/components/app-icon';
import { SelectPicker, SelectPickerOption } from '../../shared/components/select-picker';
import { TokenInput } from '../../shared/components/token-input';
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
  excludeAdult: false,
  dateFrom: '',
  dateTo: '',
  sort: 'recent',
};

interface PaginationToken {
  readonly key: string;
  readonly page: number | null;
}

@Component({
  selector: 'app-content',
  imports: [ReactiveFormsModule, AppIcon, SelectPicker, TokenInput, ContentPreview],
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
  protected readonly expandedFilter = signal<'none' | 'tags' | 'recipients'>('none');
  protected readonly currentPage = signal(1);
  protected readonly totalItems = signal(0);
  protected readonly totalPages = computed(() => Math.ceil(this.totalItems() / this.pageSize()));
  protected readonly paginationItemLabel = computed(() =>
    this.activeSection() === 'videos' ? 'video' : 'post',
  );
  protected readonly paginationTokens = computed<readonly PaginationToken[]>(() => {
    const total = this.totalPages();
    if (!total) return [];
    const pages = new Set([1, 2, this.currentPage(), this.currentPage() + 1, total - 1, total]);
    const visiblePages = [...pages]
      .filter((page) => page >= 1 && page <= total)
      .sort((left, right) => left - right);
    const tokens: PaginationToken[] = [];
    for (const page of visiblePages) {
      const previous = tokens.at(-1)?.page;
      if (previous && page - previous > 1)
        tokens.push({ key: `ellipsis-${previous}-${page}`, page: null });
      tokens.push({ key: `page-${page}`, page });
    }
    return tokens;
  });
  protected readonly editing = signal<SavedContent | null>(null);
  protected readonly filters = signal<ContentFilters>(DEFAULT_FILTERS);
  protected readonly tagSuggestions = computed(() => this.tags().map((item) => item.name));
  protected readonly recipientSuggestions = computed(() =>
    this.recipients().map((item) => item.name),
  );
  protected readonly visibleFilterTags = computed(() =>
    this.tags().slice(0, CONTENT_CONFIG.filterPillPreviewLimit),
  );
  protected readonly visibleFilterRecipients = computed(() =>
    this.recipients().slice(0, CONTENT_CONFIG.filterPillPreviewLimit),
  );
  protected readonly hiddenFilterTagCount = computed(() =>
    Math.max(0, this.tags().length - CONTENT_CONFIG.filterPillPreviewLimit),
  );
  protected readonly hiddenFilterRecipientCount = computed(() =>
    Math.max(0, this.recipients().length - CONTENT_CONFIG.filterPillPreviewLimit),
  );
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
    { value: 'waiting-to-send', label: 'Waiting to send' },
  ];
  protected readonly adultFilterMode = computed<'all' | 'exclude' | 'only'>(() => {
    if (this.filters().adultOnly) return 'only';
    if (this.filters().excludeAdult) return 'exclude';
    return 'all';
  });

  protected readonly searchControl = this.formBuilder.nonNullable.control('');
  protected readonly contentForm = this.formBuilder.nonNullable.group({
    url: ['', [Validators.required]],
    contentType: ['website' as SavedContent['contentType'], Validators.required],
    platform: [''],
    title: [''],
    description: [''],
    notes: [''],
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

  protected async refresh(resetPage = true): Promise<void> {
    if (resetPage) this.currentPage.set(1);
    this.loading.set(true);
    try {
      const pageSize = this.pageSize();
      const requestedPage = this.currentPage();
      const [page, categories, tags, recipients] = await Promise.all([
        this.repository.list(
          this.filters(),
          this.store.settings().showAdultContent,
          pageSize,
          null,
          (requestedPage - 1) * pageSize,
        ),
        this.repository.categories(),
        this.repository.tags(),
        this.repository.recipients(),
      ]);
      const lastPage = Math.ceil(page.total / pageSize);
      if (lastPage && requestedPage > lastPage) {
        this.currentPage.set(lastPage);
        await this.refresh(false);
        return;
      }
      this.items.set(page.items);
      this.totalItems.set(page.total);
      this.categories.set(categories);
      this.tags.set(tags);
      this.recipients.set(recipients);
    } finally {
      this.loading.set(false);
    }
  }

  protected goToPage(page: number): void {
    if (this.loading() || page < 1 || page > this.totalPages() || page === this.currentPage())
      return;
    this.currentPage.set(page);
    void this.refresh(false);
  }

  protected search(): void {
    this.filters.update((value) => ({ ...value, query: this.searchControl.value }));
    void this.refresh();
  }

  protected updateFilter<K extends keyof ContentFilters>(key: K, value: ContentFilters[K]): void {
    this.filters.update((filters) => ({ ...filters, [key]: value }));
    void this.refresh();
  }

  protected setAdultFilter(mode: 'all' | 'exclude' | 'only'): void {
    this.filters.update((filters) => ({
      ...filters,
      adultOnly: mode === 'only',
      excludeAdult: mode === 'exclude',
    }));
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
    this.contentForm.reset({
      url: item.url,
      contentType: item.contentType,
      platform: item.platform,
      title: item.title,
      description: item.description,
      notes: item.notes,
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
      const previous = this.editing();
      const [tags, recipients] = await Promise.all([
        this.repository.findOrCreateTags(form.tags.split(',')),
        this.repository.findOrCreateRecipients(form.recipients.split(',')),
      ]);
      const timestamp = previous?.createdAt;
      const detectedFromUrl = this.repository.detectContent(form.url);
      const detectedTypeIsAuthoritative = !['website', 'other-link'].includes(
        detectedFromUrl.contentType,
      );
      const detected = {
        ...detectedFromUrl,
        contentType: detectedTypeIsAuthoritative ? detectedFromUrl.contentType : form.contentType,
        platform: detectedTypeIsAuthoritative
          ? detectedFromUrl.platform
          : form.platform.trim() || detectedFromUrl.platform,
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
        categoryId: previous?.categoryId ?? this.store.settings().defaultCategoryId,
        tagIds: tags.map((value) => value.id),
        recipientIds: recipients.map((value) => value.id),
        favourite: form.favourite,
        adult: form.adult,
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
          const resolvedUrl = this.metadataResolvedUrl(item, patch.resolvedUrl);
          const resolved = this.repository.detectContent(resolvedUrl);
          item = await this.repository.save({
            ...item,
            ...patch,
            resolvedUrl,
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
    if (item.contentType === 'google-maps' && isGoogleMapsShortUrl(item.url)) {
      const resolution = await this.metadata.resolveShareUrl(item.url, this.store.settings());
      if (!resolution?.url || resolution.url === item.url) return item;
      return this.repository.save({ ...item, resolvedUrl: resolution.url });
    }
    const isFacebookPostShare =
      item.contentType === 'facebook-post' && isFacebookPostShareUrl(item.url);
    const isShare =
      item.contentType === 'facebook-share' ||
      item.contentType === 'tiktok-share' ||
      isFacebookPostShare;
    if (!isShare) return item;
    const source = item.resolvedUrl || item.url;
    const existingId =
      item.contentType === 'facebook-share'
        ? extractFacebookVideoId(source)
        : isFacebookPostShare
          ? extractFacebookPostId(source)
          : extractTikTokVideoId(source);
    if (isFacebookPostShare && existingId) {
      const resolvedUrl = buildFacebookPostUrl(source);
      if (item.resolvedUrl === resolvedUrl && item.mediaId === existingId) return item;
      return this.repository.save({ ...item, resolvedUrl, mediaId: existingId });
    }
    let current = item;
    if (item.contentType === 'facebook-share' && existingId) {
      const canonicalUrl = buildFacebookVideoUrl(source);
      if (item.resolvedUrl !== canonicalUrl || item.mediaId !== existingId) {
        current = await this.repository.save({
          ...item,
          resolvedUrl: canonicalUrl,
          mediaId: existingId,
        });
      }
      if (current.aspectRatio) return current;
    } else if (existingId && item.aspectRatio) {
      return item;
    }
    const resolution = await this.metadata.resolveShareUrl(item.url, this.store.settings());
    if (!resolution) return current;
    const detected = this.repository.detectContent(resolution.url);
    const mediaId =
      existingId ??
      (isFacebookPostShare ? extractFacebookPostId(resolution.url) : detected.mediaId);
    if (!mediaId && !isFacebookPostShare) return current;
    const resolvedUrl =
      current.resolvedUrl && existingId
        ? current.resolvedUrl
        : item.contentType === 'facebook-share'
          ? buildFacebookVideoUrl(resolution.url)
          : isFacebookPostShare
            ? buildFacebookPostUrl(resolution.url)
            : resolution.url;
    return this.repository.save({
      ...current,
      resolvedUrl,
      mediaId: mediaId ?? current.mediaId,
      aspectRatio: resolution.aspectRatio ?? current.aspectRatio,
    });
  }

  protected async refreshMetadata(item: SavedContent): Promise<void> {
    item = await this.resolveShareUrl(item);
    const patch = await this.metadata.fetch(item.url, this.store.settings());
    const resolvedUrl = this.metadataResolvedUrl(item, patch.resolvedUrl);
    const resolved = this.repository.detectContent(resolvedUrl);
    await this.repository.save({
      ...item,
      ...patch,
      resolvedUrl,
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

  protected platformLabel(item: SavedContent): string {
    if (['facebook', 'facebook-reel', 'facebook-share'].includes(item.contentType)) {
      return detectContentUrl(item.resolvedUrl || item.url).platform;
    }
    return item.platform || item.domain;
  }

  protected async syncMissingMetadata(showFeedback = true): Promise<void> {
    const settings = this.store.settings();
    const metadataEnabled = this.native.isAndroid()
      ? settings.androidMetadataEnabled
      : settings.browserMetadataEnabled;
    if (!metadataEnabled || this.syncingMetadata()) return;
    this.syncingMetadata.set(true);
    let updated = 0;
    try {
      for (const item of await this.repository.missingPostMetadata()) {
        const patch = await this.metadata.fetch(item.url, this.store.settings());
        if (patch.metadataStatus !== 'success') continue;
        const resolvedUrl = this.metadataResolvedUrl(item, patch.resolvedUrl);
        const resolved = this.repository.detectContent(resolvedUrl);
        await this.repository.save({
          ...item,
          ...patch,
          resolvedUrl,
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

  private metadataResolvedUrl(item: SavedContent, candidate?: string): string {
    if (item.contentType === 'facebook-post' && item.mediaId) {
      return buildFacebookPostUrl(item.resolvedUrl || candidate || item.url);
    }
    return candidate || item.resolvedUrl || item.url;
  }

  protected async open(item: SavedContent): Promise<void> {
    await this.repository.save({ ...item, lastOpenedAt: new Date().toISOString() });
    const url = item.resolvedUrl || item.url;
    if (this.native.isAndroid()) {
      const shouldOpenInApp =
        !isVideoContentType(item.contentType) &&
        this.store.settings().openPostsInApp &&
        !isAndroidExternalPostUrl(url);
      if (shouldOpenInApp) {
        const title = item.title || item.ogTitle || item.platform || item.domain;
        if (this.native.openInAppBrowser(url, title)) return;
      }
      if (this.native.openExternal(url)) return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  protected async shareOriginalUrl(item: SavedContent): Promise<void> {
    if (navigator.share) {
      try {
        await navigator.share({
          title: item.title || item.ogTitle || item.platform,
          url: item.url,
        });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    await this.copyOriginalUrl(item);
  }

  protected async copyOriginalUrl(item: SavedContent): Promise<void> {
    try {
      await navigator.clipboard.writeText(item.url);
      this.feedback.notify('Original URL copied', 'info');
    } catch {
      const input = document.createElement('textarea');
      input.value = item.url;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      const copied = document.execCommand('copy');
      input.remove();
      this.feedback.notify(
        copied ? 'Original URL copied' : 'URL could not be copied',
        copied ? 'info' : 'error',
      );
    }
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

  private pageSize(): number {
    return CONTENT_CONFIG.itemsPerPage[this.activeSection()];
  }
}
