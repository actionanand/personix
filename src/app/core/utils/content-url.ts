import { ContentType, SavedContent, isVideoContentType } from '../models/app.models';

export interface ContentDetection {
  readonly contentType: ContentType;
  readonly platform: string;
  readonly canonicalUrl: string;
  readonly mediaId: string;
  readonly startTimeSeconds: number;
}

export function detectContentUrl(raw: string): ContentDetection {
  const canonicalUrl = ensureUrl(raw);
  let url: URL;
  try {
    url = new URL(canonicalUrl);
  } catch {
    return result('other-link', 'Other', canonicalUrl);
  }
  const host = url.hostname.toLocaleLowerCase().replace(/^www\./, '');
  const path = url.pathname;

  if (host === 'youtu.be' || host.endsWith('youtube.com')) {
    const short = path.match(/^\/shorts\/([^/?#]+)/i);
    const mediaId =
      short?.[1] ??
      url.searchParams.get('v') ??
      (host === 'youtu.be' ? (path.split('/').filter(Boolean)[0] ?? '') : '');
    return result(
      short ? 'youtube-short' : 'youtube',
      'YouTube',
      canonicalUrl,
      mediaId,
      youtubeStart(url),
    );
  }
  if (host.endsWith('instagram.com')) {
    const match = path.match(/^\/(reel|reels|p|tv)\/([^/?#]+)/i);
    const kind = match?.[1]?.toLocaleLowerCase();
    return result(
      kind === 'p' ? 'instagram-post' : 'instagram',
      'Instagram',
      canonicalUrl,
      match?.[2] ?? '',
    );
  }
  if (host.endsWith('facebook.com') || host === 'fb.watch' || host === 'fb.com') {
    if (/^\/share\/[rv]\//i.test(path) || host === 'fb.watch')
      return result(
        'facebook-share',
        'Facebook',
        canonicalUrl,
        extractFacebookVideoId(canonicalUrl) ?? '',
      );
    if (/\/(reel|watch|videos)\//i.test(path) || url.searchParams.has('v')) {
      return result(
        path.toLocaleLowerCase().includes('/reel/') ? 'facebook-reel' : 'facebook',
        'Facebook',
        canonicalUrl,
        extractFacebookVideoId(canonicalUrl) ?? '',
      );
    }
    return result('facebook-post', 'Facebook', canonicalUrl);
  }
  if (host.endsWith('tiktok.com')) {
    const id = extractTikTokVideoId(canonicalUrl) ?? '';
    return result(
      /^v[tm]\.tiktok\.com$/i.test(url.hostname) ? 'tiktok-share' : 'tiktok',
      'TikTok',
      canonicalUrl,
      id,
    );
  }
  if (host === 'dai.ly' || host.endsWith('dailymotion.com')) {
    const id =
      host === 'dai.ly'
        ? (path.split('/').filter(Boolean)[0] ?? '')
        : (path.match(/\/video\/([^_/?#]+)/i)?.[1] ?? '');
    return result('dailymotion', 'Dailymotion', canonicalUrl, id);
  }
  if (host.endsWith('vimeo.com'))
    return result('vimeo', 'Vimeo', canonicalUrl, [...path.matchAll(/\/(\d+)/g)].at(-1)?.[1] ?? '');
  if (/\.(mp4|webm|m3u8|mov)(?:$|\?)/i.test(canonicalUrl))
    return result('generic-video', host, canonicalUrl);
  if (
    host.endsWith('reddit.com') ||
    host === 'redd.it' ||
    host.endsWith('threads.net') ||
    host.endsWith('x.com') ||
    host.endsWith('twitter.com')
  )
    return result('post', host.replace(/^www\./, ''), canonicalUrl);
  return result('website', host || 'Website', canonicalUrl);
}

export function buildEmbedUrl(
  item: Pick<SavedContent, 'contentType' | 'url' | 'resolvedUrl' | 'mediaId' | 'startTimeSeconds'>,
): string {
  const source = item.resolvedUrl || item.url;
  const detected = detectContentUrl(source);
  const id = item.mediaId || detected.mediaId;
  const start = item.startTimeSeconds ?? detected.startTimeSeconds;
  switch (item.contentType) {
    case 'youtube':
    case 'youtube-short':
      return id
        ? `https://www.youtube.com/embed/${id}?rel=0&playsinline=1${start ? `&start=${start}` : ''}`
        : '';
    case 'instagram':
    case 'instagram-post': {
      const match = new URL(source).pathname.match(/^\/(reel|reels|p|tv)\/([^/?#]+)/i);
      return match ? `https://www.instagram.com/${match[1]}/${match[2]}/embed/` : '';
    }
    case 'facebook':
    case 'facebook-reel':
    case 'facebook-share':
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(source)}&show_text=false`;
    case 'facebook-post':
      return `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(source)}&show_text=true&width=500`;
    case 'tiktok':
    case 'tiktok-share':
      return id
        ? `https://www.tiktok.com/player/v1/${id}?autoplay=0&controls=1&loop=0&music_info=0&rel=0`
        : '';
    case 'dailymotion':
      return id
        ? `https://www.dailymotion.com/embed/video/${id}?autoplay=0&queue-enable=false`
        : '';
    case 'vimeo':
      return id ? `https://player.vimeo.com/video/${id}?autoplay=0&dnt=1` : '';
    case 'generic-video':
      return source;
    default:
      return '';
  }
}

export function isVerticalContent(type: ContentType): boolean {
  return [
    'youtube-short',
    'instagram',
    'facebook-reel',
    'facebook-share',
    'tiktok',
    'tiktok-share',
  ].includes(type);
}

export function isEmbeddableContent(type: ContentType): boolean {
  return isVideoContentType(type) || type === 'facebook-post' || type === 'instagram-post';
}

export function extractFacebookVideoId(raw: string): string | null {
  try {
    const url = new URL(ensureUrl(raw));
    const watch = url.searchParams.get('v');
    if (watch && /^\d+$/.test(watch)) return watch;
    return (
      url.pathname.match(/\/(?:reel|videos|watch)\/(\d+)/i)?.[1] ??
      [...url.pathname.matchAll(/\/(\d+)/g)].at(-1)?.[1] ??
      null
    );
  } catch {
    return /^\d+$/.test(raw.trim()) ? raw.trim() : null;
  }
}

export function extractTikTokVideoId(raw: string): string | null {
  try {
    return new URL(ensureUrl(raw)).pathname.match(/\/video\/(\d+)/i)?.[1] ?? null;
  } catch {
    return /^\d+$/.test(raw.trim()) ? raw.trim() : null;
  }
}

function youtubeStart(url: URL): number {
  const raw = url.searchParams.get('t') ?? url.searchParams.get('start') ?? '';
  if (/^\d+$/.test(raw)) return Number(raw);
  const match = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  return match
    ? Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0)
    : 0;
}

function ensureUrl(raw: string): string {
  const value = raw.trim();
  return /^https?:\/\//i.test(value) ? value : `https://${value.replace(/^\/+/, '')}`;
}

function result(
  contentType: ContentType,
  platform: string,
  canonicalUrl: string,
  mediaId = '',
  startTimeSeconds = 0,
): ContentDetection {
  return { contentType, platform, canonicalUrl, mediaId, startTimeSeconds };
}
