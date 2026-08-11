import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CONTENT_CONFIG } from '../../core/config/content.config';
import { SavedContent, isVideoContentType } from '../../core/models/app.models';
import { AppStore } from '../../core/services/app-store.service';
import { NativeIntegrationService } from '../../core/services/native-integration.service';
import {
  buildEmbedUrl,
  detectContentUrl,
  isGenericGoogleMapsPreviewImage,
  isEmbeddableContent,
  isVerticalContent,
} from '../../core/utils/content-url';
import { AppIcon } from '../../shared/components/app-icon';

interface DocumentPictureInPictureApi {
  requestWindow(options: { readonly width: number; readonly height: number }): Promise<Window>;
}

interface PipPosition {
  readonly left: number;
  readonly top: number;
}

interface PipSize {
  readonly width: number;
  readonly height: number;
}

interface PipDragState extends PipPosition {
  readonly pointerId: number;
  readonly pointerX: number;
  readonly pointerY: number;
}

interface PipResizeState extends PipSize {
  readonly pointerId: number;
  readonly pointerX: number;
  readonly pointerY: number;
  readonly left: number;
  readonly top: number;
}

interface InstagramEmbedApi {
  readonly Embeds: { process(): void };
}

interface BlueskyOEmbedResponse {
  readonly html?: string;
}

@Component({
  selector: 'app-content-preview',
  imports: [AppIcon],
  host: {
    '[class.native-pip-active]': 'nativePipActive()',
    '(window:personix-native-result)': 'onNativeResult($event)',
    '(window:resize)': 'keepMiniPipInViewport()',
  },
  template: `
    @if (nativePipActive()) {
      <button type="button" class="exit-pip" (click)="nativePipActive.set(false)">
        <app-icon name="close" /> Exit PIP view
      </button>
    }
    @if (googleMapsPreviewImage() && !previewImageFailed()) {
      <img
        class="preview-media map-photo"
        [src]="googleMapsPreviewImage()"
        [alt]="label()"
        loading="lazy"
        referrerpolicy="no-referrer"
        (error)="previewImageFailed.set(true)"
      />
    } @else if (facebookPosterFallback()) {
      <div
        class="facebook-restricted-preview"
        [style.aspect-ratio]="aspectRatio()"
        role="img"
        [attr.aria-label]="label() + '. Facebook has blocked inline playback for this video.'"
      >
        @if (item().ogImageUrl && !previewImageFailed()) {
          <img
            [src]="item().ogImageUrl"
            [alt]="label()"
            loading="lazy"
            referrerpolicy="no-referrer"
            (error)="previewImageFailed.set(true)"
          />
        } @else {
          <span class="facebook-restricted-placeholder">Facebook Reel</span>
        }
        <span class="facebook-restricted-message">
          <app-icon name="shield-alert" />
          <strong>Facebook blocked inline playback</strong>
          <small>The saved preview is still available. Use Open to watch on Facebook.</small>
        </span>
      </div>
    } @else if (videoUrl()) {
      <video
        #videoElement
        class="preview-media"
        controls
        preload="metadata"
        [src]="videoUrl()"
        [muted]="muted()"
        [attr.aria-label]="label()"
      ></video>
    } @else if (instagramPostPermalink(); as permalink) {
      <div class="instagram-post-frame">
        <blockquote
          class="instagram-media"
          [attr.data-instgrm-permalink]="permalink"
          data-instgrm-version="14"
          aria-label="Instagram post preview"
        ></blockquote>
      </div>
    } @else if (safeEmbedUrl()) {
      <div
        class="embed-frame"
        [class.vertical]="vertical()"
        [class.instagram-video]="instagramVideo()"
        [class.social-post]="socialPost()"
        [style.aspect-ratio]="socialPost() ? null : aspectRatio()"
      >
        <iframe
          [src]="safeEmbedUrl()"
          [title]="label()"
          loading="lazy"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          referrerpolicy="strict-origin-when-cross-origin"
          allowfullscreen
        ></iframe>
      </div>
    } @else if (item().ogImageUrl) {
      <img
        class="preview-media"
        [src]="item().ogImageUrl"
        [alt]="label()"
        loading="lazy"
        referrerpolicy="no-referrer"
        (error)="$any($event.target).hidden = true"
      />
    }
    @if (playbackControlsAvailable()) {
      <div class="preview-controls">
        <button
          type="button"
          [attr.aria-label]="muted() ? 'Unmute video' : 'Mute video'"
          [attr.aria-pressed]="muted()"
          (click)="toggleMute()"
        >
          <app-icon [name]="muted() ? 'volume-off' : 'volume'" />{{ muted() ? 'Muted' : 'Mute' }}
        </button>
        <button type="button" aria-label="Open picture in picture" (click)="requestPip()">
          <app-icon name="pip" />PIP
        </button>
      </div>
    }
    @if (miniPipUrl(); as miniUrl) {
      <section
        class="mini-pip"
        [class.vertical]="vertical()"
        [style.left.px]="miniPipPosition()?.left"
        [style.top.px]="miniPipPosition()?.top"
        [style.right]="miniPipPosition() ? 'auto' : null"
        [style.bottom]="miniPipPosition() ? 'auto' : null"
        [style.width.px]="miniPipSize()?.width"
        [style.height.px]="miniPipSize()?.height"
        aria-label="Picture in picture player"
      >
        <header
          tabindex="0"
          aria-label="Move picture in picture. Drag or use the arrow keys."
          (pointerdown)="startMiniPipDrag($event)"
          (pointermove)="dragMiniPip($event)"
          (pointerup)="finishMiniPipDrag($event)"
          (pointercancel)="finishMiniPipDrag($event)"
          (keydown)="moveMiniPipWithKeyboard($event)"
        >
          <span>{{ label() }}</span
          ><button
            type="button"
            aria-label="Close picture in picture"
            (pointerdown)="$event.stopPropagation()"
            (keydown)="$event.stopPropagation()"
            (click)="closeMiniPip()"
          >
            <app-icon name="close" />
          </button>
        </header>
        <iframe
          [src]="miniUrl"
          [title]="label()"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerpolicy="strict-origin-when-cross-origin"
          allowfullscreen
        ></iframe>
        <button
          type="button"
          class="mini-pip-resize"
          aria-label="Resize picture in picture. Drag or use the arrow keys."
          title="Resize picture in picture"
          (pointerdown)="startMiniPipResize($event)"
          (pointermove)="resizeMiniPip($event)"
          (pointerup)="finishMiniPipResize($event)"
          (pointercancel)="finishMiniPipResize($event)"
          (keydown)="resizeMiniPipWithKeyboard($event)"
        >
          <app-icon name="resize" />
        </button>
      </section>
    }
  `,
  styles: `
    :host {
      display: block;
      background: var(--surface-muted);
    }
    :host.native-pip-active {
      position: fixed;
      z-index: 160;
      inset: 0;
      display: grid;
      align-content: center;
      background: #000;
    }
    :host.native-pip-active .preview-controls {
      display: none;
    }
    .exit-pip {
      position: fixed;
      z-index: 1;
      top: max(0.7rem, env(safe-area-inset-top));
      right: 0.7rem;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.5rem 0.7rem;
      border: 0;
      border-radius: 0.7rem;
      color: #fff;
      background: rgba(5, 15, 10, 0.8);
      font: inherit;
      font-size: 0.75rem;
      font-weight: 700;
    }
    .preview-media,
    .embed-frame {
      display: block;
      width: 100%;
      aspect-ratio: 16 / 9;
      border: 0;
      object-fit: cover;
    }
    .facebook-restricted-preview {
      position: relative;
      display: grid;
      width: 100%;
      min-height: 15rem;
      overflow: hidden;
      place-items: center;
      color: #fff;
      background: #101813;
    }
    .facebook-restricted-preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .facebook-restricted-placeholder {
      font-size: 1rem;
      font-weight: 750;
    }
    .facebook-restricted-message {
      position: absolute;
      inset: auto 0 0;
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.15rem 0.6rem;
      align-items: center;
      padding: 0.8rem 1rem;
      background: linear-gradient(transparent, rgba(3, 12, 7, 0.94) 35%);
      text-shadow: 0 1px 2px #000;
    }
    .facebook-restricted-message app-icon {
      grid-row: 1 / span 2;
      width: 1.35rem;
      height: 1.35rem;
    }
    .facebook-restricted-message small {
      line-height: 1.35;
    }
    .embed-frame.vertical {
      max-height: 34rem;
      aspect-ratio: 9 / 16;
      margin-inline: auto;
    }
    .embed-frame.social-post {
      height: min(36rem, 70dvh);
      max-height: none;
      aspect-ratio: auto;
      background: var(--surface);
    }
    .embed-frame.instagram-video {
      overflow: hidden;
    }
    .embed-frame.instagram-video iframe {
      display: block;
      width: calc(100% + 1.25rem);
      max-width: none;
    }
    .instagram-post-frame {
      width: 100%;
      overflow: hidden;
      padding: 0.5rem;
      background: var(--surface-muted);
    }
    .instagram-post-frame .instagram-media {
      width: calc(100% - 2px) !important;
      min-width: 0 !important;
      max-width: 33.75rem !important;
      margin: 1px auto !important;
    }
    iframe {
      width: 100%;
      height: 100%;
      border: 0;
      background: #000;
    }
    .preview-controls {
      display: flex;
      gap: 0.4rem;
      padding: 0.45rem;
      border-top: 1px solid var(--border);
      background: var(--surface);
    }
    .preview-controls button {
      display: inline-flex;
      min-height: 2.2rem;
      align-items: center;
      gap: 0.35rem;
      padding: 0.35rem 0.65rem;
      border: 1px solid var(--border);
      border-radius: 0.65rem;
      color: var(--text);
      background: var(--surface-muted);
      font: inherit;
      font-size: 0.75rem;
      font-weight: 700;
    }
    .preview-controls app-icon {
      width: 1rem;
      height: 1rem;
    }
    .mini-pip {
      position: fixed;
      z-index: 150;
      right: 1rem;
      bottom: calc(5.8rem + env(safe-area-inset-bottom));
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      width: min(24rem, calc(100vw - 2rem));
      height: min(16.5rem, calc(100dvh - 7rem));
      min-width: min(15rem, calc(100vw - 1rem));
      min-height: min(11rem, calc(100dvh - 1rem));
      max-width: calc(100vw - 1rem);
      max-height: calc(100dvh - 1rem);
      overflow: hidden;
      border: 1px solid #34443c;
      border-radius: 1rem;
      background: #000;
      box-shadow: var(--shadow-lg);
    }
    .mini-pip.vertical {
      width: min(15rem, calc(100vw - 2rem));
      height: min(28rem, calc(100dvh - 7rem));
    }
    .mini-pip header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      padding: 0.45rem 0.55rem;
      color: #fff;
      background: #0c1712;
      cursor: grab;
      touch-action: none;
      user-select: none;
    }
    .mini-pip header:active {
      cursor: grabbing;
    }
    .mini-pip header span {
      min-width: 0;
      overflow: hidden;
      font-size: 0.75rem;
      font-weight: 700;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .mini-pip header button {
      display: grid;
      width: 2rem;
      height: 2rem;
      place-items: center;
      padding: 0;
      border: 0;
      color: #fff;
      background: transparent;
    }
    .mini-pip header app-icon {
      width: 1rem;
      height: 1rem;
    }
    .mini-pip iframe {
      display: block;
      min-height: 0;
    }
    .mini-pip-resize {
      position: absolute;
      right: 0;
      bottom: 0;
      display: grid;
      width: 2.4rem;
      height: 2.4rem;
      place-items: end;
      padding: 0.65rem 0.35rem 0.35rem 0.65rem;
      border: 0;
      border-radius: 1rem 0 0.9rem;
      color: #fff;
      background: linear-gradient(135deg, transparent 20%, rgba(12, 23, 18, 0.88) 55%);
      cursor: nwse-resize;
      touch-action: none;
    }
    .mini-pip-resize app-icon {
      width: 1rem;
      height: 1rem;
    }
  `,
})
export class ContentPreview {
  private static readonly blueskyEmbedCache = new Map<string, Promise<string>>();
  readonly item = input.required<SavedContent>();
  private readonly sanitizer = inject(DomSanitizer);
  private readonly native = inject(NativeIntegrationService);
  private readonly store = inject(AppStore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly videoElement = viewChild<ElementRef<HTMLVideoElement>>('videoElement');
  protected readonly muted = signal(this.store.settings().muteVideosByDefault);
  protected readonly previewImageFailed = signal(false);
  private lastPreviewImage = '';
  protected readonly nativePipActive = signal(false);
  protected readonly miniPipUrl = signal<SafeResourceUrl | null>(null);
  protected readonly miniPipPosition = signal<PipPosition | null>(null);
  protected readonly miniPipSize = signal<PipSize | null>(null);
  private readonly blueskyEmbedUrl = signal<SafeResourceUrl | null>(null);
  private miniPipDragState: PipDragState | null = null;
  private miniPipResizeState: PipResizeState | null = null;
  protected readonly label = computed(
    () => this.item().title || this.item().ogTitle || `${this.item().platform} preview`,
  );
  // Real video aspect ratio when known, otherwise a content-type default.
  protected readonly aspectRatio = computed(() => {
    const item = this.item();
    const stored = item.aspectRatio;
    if (stored && stored > 0 && Number.isFinite(stored)) return stored;
    const facebookReelShare =
      item.contentType === 'facebook-share' && /facebook\.com\/share\/r\//i.test(item.url);
    return isVerticalContent(item.contentType) || facebookReelShare ? 9 / 16 : 16 / 9;
  });
  protected readonly vertical = computed(() => this.aspectRatio() < 1);
  protected readonly instagramVideo = computed(() => this.item().contentType === 'instagram');
  protected readonly googleMapsContent = computed(() => {
    const item = this.item();
    return (
      item.contentType === 'google-maps' ||
      detectContentUrl(item.resolvedUrl || item.url).contentType === 'google-maps'
    );
  });
  protected readonly googleMapsPreviewImage = computed(() => {
    if (!this.googleMapsContent()) return '';
    const image = this.item().ogImageUrl;
    return image && !isGenericGoogleMapsPreviewImage(image) ? image : '';
  });
  protected readonly socialPost = computed(() => {
    const item = this.item();
    const type =
      item.contentType === 'post'
        ? detectContentUrl(item.resolvedUrl || item.url).contentType
        : item.contentType;
    return [
      'twitter-post',
      'reddit-post',
      'threads-post',
      'bluesky-post',
      'mastodon-post',
      'linkedin-post',
    ].includes(type);
  });
  protected readonly videoContent = computed(() => isVideoContentType(this.item().contentType));
  protected readonly facebookPosterFallback = computed(() => {
    const item = this.item();
    if (!['facebook', 'facebook-reel', 'facebook-share'].includes(item.contentType)) return false;
    const mediaId = item.mediaId || detectContentUrl(item.resolvedUrl || item.url).mediaId;
    return CONTENT_CONFIG.facebookPosterFallbackVideoIds.some((id) => id === mediaId);
  });
  protected readonly playbackControlsAvailable = computed(
    () => this.videoContent() && !this.facebookPosterFallback(),
  );
  protected readonly videoUrl = computed(() =>
    this.item().contentType === 'generic-video' ? this.item().resolvedUrl || this.item().url : '',
  );
  protected readonly instagramPostPermalink = computed(() => {
    const item = this.item();
    if (item.contentType !== 'instagram-post') return '';
    const id = item.mediaId || detectContentUrl(item.resolvedUrl || item.url).mediaId;
    return id ? `https://www.instagram.com/p/${id}/` : '';
  });
  private readonly blueskyPostUrl = computed(() => {
    const item = this.item();
    const detected = detectContentUrl(item.resolvedUrl || item.url);
    return item.contentType === 'bluesky-post' || detected.contentType === 'bluesky-post'
      ? detected.canonicalUrl
      : '';
  });
  protected readonly safeEmbedUrl = computed<SafeResourceUrl | null>(() => {
    const item = this.item();
    if (this.facebookPosterFallback()) return null;
    const embedItem = this.googleMapsContent()
      ? { ...item, contentType: 'google-maps' as const }
      : item;
    if (!isEmbeddableContent(embedItem.contentType)) return null;
    const url = buildEmbedUrl(embedItem, this.muted());
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : this.blueskyEmbedUrl();
  });

  constructor() {
    effect(() => {
      const image = this.item().ogImageUrl;
      if (image === this.lastPreviewImage) return;
      this.lastPreviewImage = image;
      this.previewImageFailed.set(false);
    });
    effect(() => {
      if (!this.instagramPostPermalink()) return;
      window.setTimeout(() => this.processInstagramEmbeds(), 0);
    });
    effect(() => {
      const source = this.blueskyPostUrl();
      this.blueskyEmbedUrl.set(null);
      // Android stays on-device: skip the Bluesky oEmbed call and use the native preview.
      if (source && !this.native.isAndroid()) void this.resolveBlueskyEmbed(source);
    });
  }

  private async resolveBlueskyEmbed(source: string): Promise<void> {
    const cached = ContentPreview.blueskyEmbedCache.get(source);
    const request = cached ?? this.fetchBlueskyEmbed(source);
    if (!cached) ContentPreview.blueskyEmbedCache.set(source, request);
    try {
      const embedUrl = await request;
      if (source !== this.blueskyPostUrl() || !embedUrl) return;
      this.blueskyEmbedUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl));
    } catch {
      ContentPreview.blueskyEmbedCache.delete(source);
    }
  }

  private async fetchBlueskyEmbed(source: string): Promise<string> {
    const endpoint = new URL('https://embed.bsky.app/oembed');
    endpoint.searchParams.set('url', source);
    endpoint.searchParams.set('format', 'json');
    endpoint.searchParams.set('maxwidth', '600');
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 10_000);
    try {
      // This is Bluesky's own public embed endpoint. It is intentionally direct
      // and never routed through Personix's optional Microlink integration.
      const response = await fetch(endpoint, { signal: controller.signal });
      if (!response.ok) return '';
      const body = (await response.json()) as BlueskyOEmbedResponse;
      if (!body.html) return '';
      const documentFragment = new DOMParser().parseFromString(body.html, 'text/html');
      const uri = documentFragment
        .querySelector<HTMLElement>('[data-bluesky-uri]')
        ?.getAttribute('data-bluesky-uri');
      if (!uri?.startsWith('at://')) return '';
      return `https://embed.bsky.app/embed/${uri.slice('at://'.length)}`;
    } finally {
      window.clearTimeout(timer);
    }
  }

  private processInstagramEmbeds(): void {
    const instagram = (window as unknown as { readonly instgrm?: InstagramEmbedApi }).instgrm;
    if (instagram) {
      instagram.Embeds.process();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-personix-instagram-embed]',
    );
    if (existing) {
      existing.addEventListener('load', () => this.processInstagramEmbeds(), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.instagram.com/embed.js';
    script.dataset['personixInstagramEmbed'] = 'true';
    script.addEventListener('load', () => this.processInstagramEmbeds(), { once: true });
    document.body.appendChild(script);
  }

  protected toggleMute(): void {
    this.muted.update((value) => !value);
    const video = this.videoElement()?.nativeElement;
    if (video) video.muted = this.muted();
  }

  protected async requestPip(): Promise<void> {
    const pipMuted = this.store.settings().muteVideosByDefault || this.muted();
    const video = this.videoElement()?.nativeElement;
    if (video?.requestPictureInPicture) {
      try {
        video.muted = pipMuted;
        await video.requestPictureInPicture();
        return;
      } catch {
        /* Fall through. */
      }
    }
    const width = this.vertical() ? 360 : 400;
    const height = this.vertical() ? 640 : 225;
    const item = this.item();
    const source = buildEmbedUrl(item, pipMuted, true);
    if (!source) return;
    if (this.native.isAndroid()) {
      // Keep the current, already-playing embed and only enter native PIP.
      // Rebuilding the iframe here made Facebook/Instagram re-check embed rights
      // and fail with "content owned by someone else" inside the PIP window.
      this.nativePipActive.set(true);
      if (await this.native.enterPictureInPicture(width, height, pipMuted)) {
        this.startPipPlayback(pipMuted);
        return;
      }
      this.nativePipActive.set(false);
    }
    if (item.contentType === 'youtube' || item.contentType === 'youtube-short') {
      // YouTube rejects embeds inside a Document PiP window with Error 153 because that
      // separate document does not provide the same acceptable referrer identity.
      this.miniPipUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(source));
      return;
    }
    const documentPip = (
      window as unknown as { readonly documentPictureInPicture?: DocumentPictureInPictureApi }
    ).documentPictureInPicture;
    if (documentPip) {
      try {
        const pipWindow = await documentPip.requestWindow({ width, height });
        const referrer = pipWindow.document.createElement('meta');
        referrer.name = 'referrer';
        referrer.content = 'strict-origin-when-cross-origin';
        pipWindow.document.head.appendChild(referrer);
        const iframe = pipWindow.document.createElement('iframe');
        iframe.src = source;
        iframe.allow =
          'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
        iframe.allowFullscreen = true;
        iframe.referrerPolicy = 'strict-origin-when-cross-origin';
        iframe.style.cssText = 'display:block;width:100%;height:100%;border:0';
        pipWindow.document.documentElement.style.cssText =
          'width:100%;height:100%;margin:0;background:#000';
        pipWindow.document.body.style.cssText =
          'width:100%;height:100%;margin:0;overflow:hidden;background:#000';
        pipWindow.document.body.appendChild(iframe);
        return;
      } catch {
        /* Use the in-app mini-player. */
      }
    }
    this.miniPipUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(source));
  }

  protected closeMiniPip(): void {
    this.miniPipUrl.set(null);
    this.miniPipPosition.set(null);
    this.miniPipSize.set(null);
    this.miniPipDragState = null;
    this.miniPipResizeState = null;
  }

  protected startMiniPipDrag(event: PointerEvent): void {
    if (event.button !== 0) return;
    const handle = event.currentTarget as HTMLElement;
    const player = handle.closest<HTMLElement>('.mini-pip');
    if (!player) return;
    const bounds = player.getBoundingClientRect();
    this.miniPipDragState = {
      pointerId: event.pointerId,
      pointerX: event.clientX,
      pointerY: event.clientY,
      left: bounds.left,
      top: bounds.top,
    };
    handle.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  protected dragMiniPip(event: PointerEvent): void {
    const state = this.miniPipDragState;
    if (!state || state.pointerId !== event.pointerId) return;
    const player = (event.currentTarget as HTMLElement).closest<HTMLElement>('.mini-pip');
    if (!player) return;
    const left = state.left + event.clientX - state.pointerX;
    const top = state.top + event.clientY - state.pointerY;
    this.miniPipPosition.set(
      this.clampPipPosition(left, top, player.offsetWidth, player.offsetHeight),
    );
  }

  protected finishMiniPipDrag(event: PointerEvent): void {
    if (this.miniPipDragState?.pointerId !== event.pointerId) return;
    const handle = event.currentTarget as HTMLElement;
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    this.miniPipDragState = null;
  }

  protected startMiniPipResize(event: PointerEvent): void {
    if (event.button !== 0) return;
    const handle = event.currentTarget as HTMLElement;
    const player = handle.closest<HTMLElement>('.mini-pip');
    if (!player) return;
    const bounds = player.getBoundingClientRect();
    this.miniPipPosition.set({ left: bounds.left, top: bounds.top });
    this.miniPipResizeState = {
      pointerId: event.pointerId,
      pointerX: event.clientX,
      pointerY: event.clientY,
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
    };
    handle.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  }

  protected resizeMiniPip(event: PointerEvent): void {
    const state = this.miniPipResizeState;
    if (!state || state.pointerId !== event.pointerId) return;
    this.setMiniPipSize(
      state.width + event.clientX - state.pointerX,
      state.height + event.clientY - state.pointerY,
      state.left,
      state.top,
    );
  }

  protected finishMiniPipResize(event: PointerEvent): void {
    if (this.miniPipResizeState?.pointerId !== event.pointerId) return;
    const handle = event.currentTarget as HTMLElement;
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    this.miniPipResizeState = null;
  }

  protected moveMiniPipWithKeyboard(event: KeyboardEvent): void {
    const direction = this.arrowDirection(event);
    if (!direction) return;
    const player = (event.currentTarget as HTMLElement).closest<HTMLElement>('.mini-pip');
    if (!player) return;
    const bounds = player.getBoundingClientRect();
    const step = event.shiftKey ? 32 : 12;
    this.miniPipPosition.set(
      this.clampPipPosition(
        bounds.left + direction.x * step,
        bounds.top + direction.y * step,
        bounds.width,
        bounds.height,
      ),
    );
    event.preventDefault();
  }

  protected resizeMiniPipWithKeyboard(event: KeyboardEvent): void {
    const direction = this.arrowDirection(event);
    if (!direction) return;
    const player = (event.currentTarget as HTMLElement).closest<HTMLElement>('.mini-pip');
    if (!player) return;
    const bounds = player.getBoundingClientRect();
    const step = event.shiftKey ? 32 : 12;
    this.miniPipPosition.set({ left: bounds.left, top: bounds.top });
    this.setMiniPipSize(
      bounds.width + direction.x * step,
      bounds.height + direction.y * step,
      bounds.left,
      bounds.top,
    );
    event.preventDefault();
  }

  protected keepMiniPipInViewport(): void {
    const position = this.miniPipPosition();
    if (!position) return;
    const size = this.miniPipSize();
    const width = Math.min(size?.width ?? 384, Math.max(1, window.innerWidth - 8));
    const height = Math.min(size?.height ?? 264, Math.max(1, window.innerHeight - 8));
    if (size) this.miniPipSize.set({ width, height });
    this.miniPipPosition.set(this.clampPipPosition(position.left, position.top, width, height));
  }

  private setMiniPipSize(width: number, height: number, left: number, top: number): void {
    const minimumWidth = Math.min(this.vertical() ? 180 : 240, window.innerWidth - 8);
    const minimumHeight = Math.min(160, window.innerHeight - 8);
    this.miniPipSize.set({
      width: Math.max(minimumWidth, Math.min(width, window.innerWidth - left - 8)),
      height: Math.max(minimumHeight, Math.min(height, window.innerHeight - top - 8)),
    });
  }

  private clampPipPosition(left: number, top: number, width: number, height: number): PipPosition {
    return {
      left: Math.max(0, Math.min(left, window.innerWidth - width)),
      top: Math.max(0, Math.min(top, window.innerHeight - height)),
    };
  }

  private arrowDirection(event: KeyboardEvent): { readonly x: number; readonly y: number } | null {
    switch (event.key) {
      case 'ArrowLeft':
        return { x: -1, y: 0 };
      case 'ArrowRight':
        return { x: 1, y: 0 };
      case 'ArrowUp':
        return { x: 0, y: -1 };
      case 'ArrowDown':
        return { x: 0, y: 1 };
      default:
        return null;
    }
  }
  protected onNativeResult(event: Event): void {
    const detail = (event as CustomEvent<{ readonly action: string; readonly data: string }>)
      .detail;
    if (detail?.action === 'pip-playback') {
      this.togglePipPlayback(detail.data === 'play');
      return;
    }
    if (detail?.action === 'pip-mute') {
      this.togglePipMute(detail.data === 'muted');
      return;
    }
    if (detail?.action !== 'pip-mode') return;
    this.nativePipActive.set(detail.data === 'true');
  }

  // Starts playback when native PIP opens (the PIP tap is a user gesture). Direct
  // <video> plays immediately; YouTube honors the IFrame API command. Cross-origin
  // Facebook/Instagram frames cannot be started without reloading (which breaks
  // their embed rights), so they keep whatever state they had.
  private startPipPlayback(muted: boolean): void {
    const video = this.videoElement()?.nativeElement;
    if (video) {
      video.muted = muted;
      void video.play().catch(() => undefined);
      return;
    }
    this.postToEmbed('playVideo');
    this.postToEmbed(muted ? 'mute' : 'unMute');
  }

  private togglePipPlayback(play: boolean): void {
    const video = this.videoElement()?.nativeElement;
    if (video) {
      if (play) void video.play().catch(() => undefined);
      else video.pause();
      return;
    }
    this.postToEmbed(play ? 'playVideo' : 'pauseVideo');
  }

  private togglePipMute(mute: boolean): void {
    const video = this.videoElement()?.nativeElement;
    if (video) {
      video.muted = mute;
      this.muted.set(mute);
      return;
    }
    this.postToEmbed(mute ? 'mute' : 'unMute');
  }

  private postToEmbed(func: string): void {
    const frame = this.host.nativeElement.querySelector('iframe');
    frame?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args: [] }), '*');
  }
}
