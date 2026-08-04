import { inject, Injectable } from '@angular/core';
import { AppSettings, SavedContent, nowIso } from '../models/app.models';
import { NativeIntegrationService, NativeMetadataResult } from './native-integration.service';

export type MetadataPatch = Pick<
  SavedContent,
  | 'ogTitle'
  | 'ogDescription'
  | 'ogImageUrl'
  | 'websiteName'
  | 'favicon'
  | 'metadataFetchedAt'
  | 'metadataStatus'
  | 'metadataError'
  | 'metadataSource'
> & { readonly resolvedUrl?: string };

interface ThirdPartyResponse {
  readonly status?: string;
  readonly data?: {
    readonly url?: string;
    readonly title?: string;
    readonly description?: string;
    readonly image?: { readonly url?: string };
    readonly logo?: { readonly url?: string };
    readonly publisher?: string;
  };
}

@Injectable({ providedIn: 'root' })
export class MetadataService {
  private readonly native = inject(NativeIntegrationService);

  async fetch(url: string, settings: AppSettings): Promise<MetadataPatch> {
    const disabled = (): MetadataPatch => ({
      ogTitle: '',
      ogDescription: '',
      ogImageUrl: '',
      websiteName: '',
      favicon: '',
      metadataFetchedAt: '',
      metadataStatus: 'disabled',
      metadataError: '',
      metadataSource: 'none',
    });
    if (this.native.isAndroid()) {
      if (!settings.androidMetadataEnabled) return disabled();
      try {
        const result = await this.native.fetchMetadata(
          url,
          settings.metadataTimeoutMs,
          settings.maxMetadataImageBytes,
        );
        if (!result) throw new Error('Android metadata service returned no preview.');
        return this.patch(result, 'android-direct');
      } catch (error) {
        return this.failure(error, 'android-direct');
      }
    }
    if (!settings.browserMetadataEnabled) return disabled();
    try {
      const endpoint = new URL('https://api.microlink.io/');
      endpoint.searchParams.set('url', url);
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), settings.metadataTimeoutMs);
      const response = await fetch(endpoint, { signal: controller.signal });
      window.clearTimeout(timer);
      if (!response.ok) throw new Error(`Metadata service returned ${response.status}.`);
      const body = (await response.json()) as ThirdPartyResponse;
      if (body.status && body.status !== 'success')
        throw new Error('Metadata service could not read this URL.');
      return this.patch(
        {
          title: body.data?.title,
          description: body.data?.description,
          image: body.data?.image?.url,
          logo: body.data?.logo?.url,
          siteName: body.data?.publisher,
          url: body.data?.url,
        },
        'browser-third-party',
      );
    } catch (error) {
      return this.failure(error, 'browser-third-party');
    }
  }

  // Follows a share-link redirect to its canonical URL. Runs independently of the
  // metadata toggles because a resolved URL is required for the video to play.
  // Android resolves only through the native bridge; third-party services such as
  // microlink are never contacted on Android.
  async resolveShareUrl(url: string, settings: AppSettings): Promise<string | null> {
    if (this.native.isAndroid()) {
      try {
        const result = await this.native.fetchMetadata(
          url,
          settings.metadataTimeoutMs,
          settings.maxMetadataImageBytes,
        );
        return this.safeUrl(result?.url) ?? null;
      } catch {
        return null;
      }
    }
    try {
      const endpoint = new URL('https://api.microlink.io/');
      endpoint.searchParams.set('url', url);
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), settings.metadataTimeoutMs);
      const response = await fetch(endpoint, { signal: controller.signal });
      window.clearTimeout(timer);
      if (!response.ok) return null;
      const body = (await response.json()) as ThirdPartyResponse;
      if (body.status && body.status !== 'success') return null;
      return this.safeUrl(body.data?.url) ?? null;
    } catch {
      return null;
    }
  }

  private patch(
    result: NativeMetadataResult,
    source: MetadataPatch['metadataSource'],
  ): MetadataPatch {
    return {
      ogTitle: this.clean(result.title),
      ogDescription: this.clean(result.description),
      ogImageUrl: this.safeImage(result.image),
      websiteName: this.clean(result.siteName),
      favicon: this.safeImage(result.logo),
      metadataFetchedAt: nowIso(),
      metadataStatus: 'success',
      metadataError: '',
      metadataSource: source,
      resolvedUrl: this.safeUrl(result.url),
    };
  }

  private failure(error: unknown, source: MetadataPatch['metadataSource']): MetadataPatch {
    return {
      ogTitle: '',
      ogDescription: '',
      ogImageUrl: '',
      websiteName: '',
      favicon: '',
      metadataFetchedAt: nowIso(),
      metadataStatus: 'failed',
      metadataError: error instanceof Error ? error.message : 'Unable to fetch metadata.',
      metadataSource: source,
    };
  }

  private clean(value?: string): string {
    if (!value) return '';
    const element = document.createElement('textarea');
    element.innerHTML = value;
    return element.value.replace(/\s+/g, ' ').trim();
  }

  private safeImage(value?: string): string {
    if (!value) return '';
    try {
      const url = new URL(value);
      return url.protocol === 'https:' ? url.href : '';
    } catch {
      return value.startsWith('data:image/') ? value : '';
    }
  }

  private safeUrl(value?: string): string | undefined {
    if (!value) return undefined;
    try {
      const url = new URL(value);
      return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined;
    } catch {
      return undefined;
    }
  }
}
