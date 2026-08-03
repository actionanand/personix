import { Component, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { SavedContent, isVideoContentType } from '../../core/models/app.models';
import { NativeIntegrationService } from '../../core/services/native-integration.service';
import {
  buildEmbedUrl,
  isEmbeddableContent,
  isVerticalContent,
} from '../../core/utils/content-url';
import { AppIcon } from '../../shared/components/app-icon';

interface DocumentPictureInPictureApi {
  requestWindow(options: { readonly width: number; readonly height: number }): Promise<Window>;
}

@Component({
  selector: 'app-content-preview',
  imports: [AppIcon],
  host: {
    '[class.native-pip-active]': 'nativePipActive()',
    '(window:personix-native-result)': 'onNativeResult($event)',
  },
  template: `
    @if (nativePipActive()) {
      <button type="button" class="exit-pip" (click)="nativePipActive.set(false)">
        <app-icon name="close" /> Exit PIP view
      </button>
    }
    @if (videoUrl()) {
      <video
        #videoElement
        class="preview-media"
        controls
        preload="metadata"
        [src]="videoUrl()"
        [muted]="muted()"
        [attr.aria-label]="label()"
      ></video>
    } @else if (safeEmbedUrl()) {
      <div class="embed-frame" [class.vertical]="vertical()">
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
        (error)="$any($event.target).hidden = true"
      />
    }
    @if (videoContent()) {
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
        aria-label="Picture in picture player"
      >
        <header>
          <span>{{ label() }}</span
          ><button type="button" aria-label="Close picture in picture" (click)="closeMiniPip()">
            <app-icon name="close" />
          </button>
        </header>
        <iframe
          [src]="miniUrl"
          [title]="label()"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          referrerpolicy="strict-origin-when-cross-origin"
          allowfullscreen
        ></iframe>
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
    .embed-frame.vertical {
      max-height: 34rem;
      aspect-ratio: 9 / 16;
      margin-inline: auto;
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
      width: min(24rem, calc(100vw - 2rem));
      overflow: hidden;
      border: 1px solid #34443c;
      border-radius: 1rem;
      background: #000;
      box-shadow: var(--shadow-lg);
    }
    .mini-pip.vertical {
      width: min(15rem, calc(100vw - 2rem));
    }
    .mini-pip header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      padding: 0.45rem 0.55rem;
      color: #fff;
      background: #0c1712;
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
      aspect-ratio: 16 / 9;
    }
    .mini-pip.vertical iframe {
      aspect-ratio: 9 / 16;
    }
  `,
})
export class ContentPreview {
  readonly item = input.required<SavedContent>();
  private readonly sanitizer = inject(DomSanitizer);
  private readonly native = inject(NativeIntegrationService);
  private readonly videoElement = viewChild<ElementRef<HTMLVideoElement>>('videoElement');
  protected readonly muted = signal(false);
  protected readonly nativePipActive = signal(false);
  protected readonly miniPipUrl = signal<SafeResourceUrl | null>(null);
  protected readonly label = computed(
    () => this.item().title || this.item().ogTitle || `${this.item().platform} preview`,
  );
  protected readonly vertical = computed(() => isVerticalContent(this.item().contentType));
  protected readonly videoContent = computed(() => isVideoContentType(this.item().contentType));
  protected readonly videoUrl = computed(() =>
    this.item().contentType === 'generic-video' ? this.item().resolvedUrl || this.item().url : '',
  );
  protected readonly safeEmbedUrl = computed<SafeResourceUrl | null>(() => {
    const item = this.item();
    if (!isEmbeddableContent(item.contentType)) return null;
    if (
      this.native.isAndroid() &&
      (item.contentType === 'facebook-post' || item.contentType === 'instagram-post')
    )
      return null;
    const url = buildEmbedUrl(item, this.muted());
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });

  protected toggleMute(): void {
    this.muted.update((value) => !value);
    const video = this.videoElement()?.nativeElement;
    if (video) video.muted = this.muted();
  }

  protected async requestPip(): Promise<void> {
    const video = this.videoElement()?.nativeElement;
    if (video?.requestPictureInPicture) {
      try {
        await video.requestPictureInPicture();
        return;
      } catch {
        /* Fall through. */
      }
    }
    const width = this.vertical() ? 360 : 400;
    const height = this.vertical() ? 640 : 225;
    this.nativePipActive.set(true);
    if (await this.native.enterPictureInPicture(width, height)) return;
    this.nativePipActive.set(false);
    const source = buildEmbedUrl(this.item(), this.muted());
    if (!source) return;
    const documentPip = (
      window as unknown as { readonly documentPictureInPicture?: DocumentPictureInPictureApi }
    ).documentPictureInPicture;
    if (documentPip) {
      try {
        const pipWindow = await documentPip.requestWindow({ width, height });
        const iframe = pipWindow.document.createElement('iframe');
        iframe.src = source;
        iframe.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
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
  }
  protected onNativeResult(event: Event): void {
    const detail = (event as CustomEvent<{ readonly action: string; readonly data: string }>)
      .detail;
    if (detail?.action === 'pip-mode') this.nativePipActive.set(detail.data === 'true');
  }
}
