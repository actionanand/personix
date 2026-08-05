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

export interface ShareResolution {
  readonly url: string;
  readonly aspectRatio: number | null;
}

interface ThirdPartyResponse {
  readonly status?: string;
  readonly data?: {
    readonly url?: string;
    readonly title?: string;
    readonly description?: string;
    readonly image?: { readonly url?: string; readonly width?: number; readonly height?: number };
    readonly logo?: { readonly url?: string };
    readonly publisher?: string;
  };
}

interface CachedThirdPartyResponse {
  readonly expiresAt: number;
  readonly request: Promise<ThirdPartyResponse>;
}

@Injectable({ providedIn: 'root' })
export class MetadataService {
  private readonly native = inject(NativeIntegrationService);
  private readonly responseCache = new Map<string, CachedThirdPartyResponse>();

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
      const body = await this.browserResponse(url, settings);
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

  // Follows a share-link redirect to its canonical URL. Android resolves only
  // through the native bridge; third-party services are never contacted there.
  // Browsers first ask the destination itself, then use Microlink only after the
  // explicit third-party fetching consent has been enabled.
  async resolveShareUrl(url: string, settings: AppSettings): Promise<ShareResolution | null> {
    if (this.native.isAndroid()) {
      try {
        const result = await this.native.fetchMetadata(
          url,
          settings.metadataTimeoutMs,
          settings.maxMetadataImageBytes,
        );
        const resolved = this.safeUrl(result?.url);
        return resolved ? { url: resolved, aspectRatio: null } : null;
      } catch {
        return null;
      }
    }
    const direct = await this.followBrowserRedirect(url, settings.metadataTimeoutMs);
    if (direct && direct !== this.safeUrl(url)) return { url: direct, aspectRatio: null };
    if (!settings.browserMetadataEnabled) return null;
    try {
      const body = await this.browserResponse(url, settings);
      const resolved = this.safeUrl(body.data?.url);
      if (!resolved) return null;
      return { url: resolved, aspectRatio: this.aspectRatio(body.data?.image) };
    } catch {
      return null;
    }
  }

  private async browserResponse(url: string, settings: AppSettings): Promise<ThirdPartyResponse> {
    const endpoint = new URL(
      settings.browserMetadataServiceUrl.trim() || 'https://api.microlink.io/',
    );
    if (endpoint.protocol !== 'https:') throw new Error('Metadata service must use HTTPS.');
    endpoint.searchParams.set('url', url);
    const key = endpoint.href;
    const cached = this.responseCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.request;

    const request = this.requestBrowserResponse(endpoint, settings.metadataTimeoutMs);
    this.responseCache.set(key, { expiresAt: Date.now() + 60_000, request });
    try {
      return await request;
    } catch (error) {
      this.responseCache.delete(key);
      throw error;
    }
  }

  private async requestBrowserResponse(
    endpoint: URL,
    timeoutMs: number,
  ): Promise<ThirdPartyResponse> {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(endpoint, { signal: controller.signal });
      if (!response.ok) throw new Error(`Metadata service returned ${response.status}.`);
      const body = (await response.json()) as ThirdPartyResponse;
      if (body.status && body.status !== 'success')
        throw new Error('Metadata service could not read this URL.');
      return body;
    } finally {
      window.clearTimeout(timer);
    }
  }

  private async followBrowserRedirect(url: string, timeoutMs: number): Promise<string | null> {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        credentials: 'omit',
        mode: 'no-cors',
        redirect: 'follow',
        signal: controller.signal,
      });
      return this.safeUrl(response.url) ?? null;
    } catch {
      return null;
    } finally {
      window.clearTimeout(timer);
    }
  }

  private aspectRatio(image?: {
    readonly width?: number;
    readonly height?: number;
  }): number | null {
    const width = image?.width;
    const height = image?.height;
    if (!width || !height || width <= 0 || height <= 0) return null;
    const ratio = width / height;
    return Number.isFinite(ratio) ? ratio : null;
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
