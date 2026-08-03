import { Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { SavedContent } from '../../core/models/app.models';
import {
  buildEmbedUrl,
  isEmbeddableContent,
  isVerticalContent,
} from '../../core/utils/content-url';
import { NativeIntegrationService } from '../../core/services/native-integration.service';

@Component({
  selector: 'app-content-preview',
  template: `
    @if (videoUrl()) {
      <video
        class="preview-media"
        controls
        preload="metadata"
        [src]="videoUrl()"
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
  `,
  styles: `
    :host {
      display: block;
      background: var(--surface-muted);
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
  `,
})
export class ContentPreview {
  readonly item = input.required<SavedContent>();
  private readonly sanitizer = inject(DomSanitizer);
  private readonly native = inject(NativeIntegrationService);
  protected readonly label = computed(
    () => this.item().title || this.item().ogTitle || `${this.item().platform} preview`,
  );
  protected readonly vertical = computed(() => isVerticalContent(this.item().contentType));
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
    const url = buildEmbedUrl(item);
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });
}
