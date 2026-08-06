import { ContentType, SavedContent, isVideoContentType } from '../models/app.models';

// Facebook share links (facebook.com/share/[rv]/CODE) only expose the numeric
// video id after following a redirect. These overrides resolve known share
// codes offline, without a network round-trip.
const FACEBOOK_SHARE_ID_OVERRIDES: Record<string, string> = {
  '1HXy5sTsvb': '1646510169815130',
  '1DXv5GFJGw': '1461026675781448',
};

// Facebook does not expose the destination of a short /share/p/ link in the
// URL itself. Keep confirmed mappings as an offline fallback; unknown links
// are resolved through the native redirect handler (or the opted-in browser
// metadata service) before they are stored.
const FACEBOOK_SHARE_POST_ID_OVERRIDES: Record<string, string> = {
  '1BeSAMZdzs': '1386376463681135',
};

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
        /^\/share\/r\//i.test(path) ? 'Facebook Reel' : 'Facebook Video',
        canonicalUrl,
        extractFacebookVideoId(canonicalUrl) ?? '',
      );
    if (isFacebookPostShareUrl(canonicalUrl)) {
      const mediaId = extractFacebookPostId(canonicalUrl) ?? '';
      return result(
        'facebook-post',
        'Facebook',
        mediaId ? buildFacebookPostUrl(canonicalUrl) : canonicalUrl,
        mediaId,
      );
    }
    if (/\/(reel|watch|videos)\//i.test(path) || url.searchParams.has('v')) {
      return result(
        path.toLocaleLowerCase().includes('/reel/') ? 'facebook-reel' : 'facebook',
        path.toLocaleLowerCase().includes('/reel/') ? 'Facebook Reel' : 'Facebook Video',
        canonicalUrl,
        extractFacebookVideoId(canonicalUrl) ?? '',
      );
    }
    const mediaId = extractFacebookPostId(canonicalUrl) ?? '';
    return result('facebook-post', 'Facebook', canonicalUrl, mediaId);
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
  const peerTubeId = extractPeerTubeVideoId(url);
  if (peerTubeId) return result('peertube', 'PeerTube', canonicalUrl, peerTubeId, sharedStart(url));
  if (host === 'twitch.tv' || host.endsWith('.twitch.tv')) {
    const twitchMedia = extractTwitchMedia(url);
    return twitchMedia
      ? result('twitch', 'Twitch', canonicalUrl, twitchMedia, sharedStart(url))
      : result('website', 'Twitch', canonicalUrl);
  }
  if (host.endsWith('wistia.com') || host.endsWith('wistia.net')) {
    const wistiaId = extractWistiaMediaId(url);
    return wistiaId
      ? result('wistia', 'Wistia', canonicalUrl, wistiaId)
      : result('website', 'Wistia', canonicalUrl);
  }
  if (isGoogleMapsUrl(canonicalUrl)) return result('google-maps', 'Google Maps', canonicalUrl);
  if (/\.(mp4|webm|m3u8|mov)(?:$|\?)/i.test(canonicalUrl))
    return result('generic-video', host, canonicalUrl);
  if (host.endsWith('x.com') || host.endsWith('twitter.com')) {
    const id = path.match(/^\/[^/]+\/status\/(\d+)/i)?.[1] ?? '';
    return id
      ? result('twitter-post', 'X / Twitter', canonicalUrl, id)
      : result('website', 'X / Twitter', canonicalUrl);
  }
  if (host.endsWith('reddit.com') || host === 'redd.it') {
    const id =
      (host === 'redd.it' ? path.match(/^\/([^/?#]+)/)?.[1] : undefined) ??
      path.match(/\/comments\/([a-z0-9]+)/i)?.[1] ??
      '';
    return id
      ? result('reddit-post', 'Reddit', canonicalUrl, id)
      : result('website', 'Reddit', canonicalUrl);
  }
  if (host.endsWith('threads.net') || host.endsWith('threads.com')) {
    const id = path.match(/^\/@[^/]+\/post\/([^/?#]+)/i)?.[1] ?? '';
    return id
      ? result('threads-post', 'Threads', canonicalUrl, id)
      : result('website', 'Threads', canonicalUrl);
  }
  if (host === 'bsky.app') {
    const id = path.match(/^\/profile\/[^/]+\/post\/([^/?#]+)/i)?.[1] ?? '';
    return id
      ? result('bluesky-post', 'Bluesky', canonicalUrl, id)
      : result('website', 'Bluesky', canonicalUrl);
  }
  if (host.endsWith('linkedin.com')) {
    const id =
      path.match(/urn:li:activity:(\d+)/i)?.[1] ??
      path.match(/activity-(\d+)(?:-|\/|$)/i)?.[1] ??
      '';
    return id
      ? result('linkedin-post', 'LinkedIn', canonicalUrl, id)
      : result('website', 'LinkedIn', canonicalUrl);
  }
  const mastodonId = extractMastodonStatusId(url);
  if (mastodonId) return result('mastodon-post', 'Mastodon', canonicalUrl, mastodonId);
  return result('website', host || 'Website', canonicalUrl);
}

export function buildEmbedUrl(
  item: Pick<SavedContent, 'contentType' | 'url' | 'resolvedUrl' | 'mediaId' | 'startTimeSeconds'> &
    Partial<Pick<SavedContent, 'title' | 'ogTitle'>>,
  muted = false,
  autoplay = false,
): string {
  const source = item.resolvedUrl || item.url;
  const detected = detectContentUrl(source);
  const id = item.mediaId || detected.mediaId;
  const start = item.startTimeSeconds ?? detected.startTimeSeconds;
  switch (item.contentType) {
    case 'youtube':
    case 'youtube-short': {
      if (!id) return '';
      const context = typeof window === 'undefined' ? null : window.location;
      const params = new URLSearchParams({
        autoplay: autoplay ? '1' : '0',
        enablejsapi: '1',
        mute: muted ? '1' : '0',
        playsinline: '1',
        rel: '0',
      });
      if (context?.origin) params.set('origin', context.origin);
      if (context?.href) params.set('widget_referrer', context.href);
      if (start) params.set('start', String(start));
      return `https://www.youtube.com/embed/${id}?${params.toString()}`;
    }
    case 'instagram':
    case 'instagram-post': {
      const match = new URL(source).pathname.match(/^\/(reel|reels|p|tv)\/([^/?#]+)/i);
      if (!match) return '';
      const embed = new URL(`https://www.instagram.com/${match[1]}/${match[2]}/embed/`);
      embed.searchParams.set('autoplay', autoplay ? '1' : '0');
      embed.searchParams.set('muted', muted ? '1' : '0');
      return embed.href;
    }
    case 'facebook-share': {
      // Group-shared videos fail in the video plugin unless the href points at
      // the canonical /reel/{id} URL, so normalize the resolved/share source.
      const href = buildFacebookVideoUrl(source);
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(href)}&show_text=false&mute=${muted ? 1 : 0}`;
    }
    case 'facebook':
    case 'facebook-reel':
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(source)}&show_text=false&mute=${muted ? 1 : 0}`;
    case 'facebook-post':
      return `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(buildFacebookPostUrl(source))}&show_text=true&width=500`;
    case 'twitter-post':
      return id ? `https://platform.twitter.com/embed/Tweet.html?dnt=true&id=${id}` : '';
    case 'reddit-post':
      return buildRedditEmbedUrl(source, id);
    case 'threads-post':
      return buildThreadsEmbedUrl(source);
    case 'mastodon-post':
      return buildMastodonEmbedUrl(source);
    case 'linkedin-post':
      return id ? `https://www.linkedin.com/embed/feed/update/urn:li:activity:${id}` : '';
    case 'google-maps':
      return buildGoogleMapsEmbedUrl(source, item.title || item.ogTitle || '');
    case 'post':
      return buildLegacySocialPostEmbedUrl(detected, source);
    case 'tiktok':
    case 'tiktok-share':
      return id
        ? `https://www.tiktok.com/player/v1/${id}?autoplay=${autoplay ? 1 : 0}&controls=1&loop=0&music_info=0&rel=0&muted=${muted ? 1 : 0}`
        : '';
    case 'dailymotion':
      return id
        ? `https://www.dailymotion.com/embed/video/${id}?autoplay=0&queue-enable=false&mute=${muted ? 1 : 0}`
        : '';
    case 'vimeo':
      return id
        ? `https://player.vimeo.com/video/${id}?autoplay=0&dnt=1&muted=${muted ? 1 : 0}`
        : '';
    case 'peertube': {
      if (!id) return '';
      const peerTubeUrl = new URL(source);
      peerTubeUrl.pathname = `/videos/embed/${id}`;
      peerTubeUrl.search = '';
      peerTubeUrl.hash = '';
      peerTubeUrl.searchParams.set('autoplay', autoplay ? '1' : '0');
      peerTubeUrl.searchParams.set('muted', muted ? '1' : '0');
      if (start) peerTubeUrl.searchParams.set('start', String(start));
      return peerTubeUrl.href;
    }
    case 'twitch':
      return buildTwitchEmbedUrl(id, muted, autoplay, start);
    case 'wistia':
      return id
        ? `https://fast.wistia.net/embed/iframe/${id}?web_component=true&seo=true&videoFoam=true&autoPlay=${autoplay ? 'true' : 'false'}&muted=${muted ? 'true' : 'false'}`
        : '';
    case 'generic-video':
      return source;
    default:
      return '';
  }
}

export function isVerticalContent(type: ContentType): boolean {
  return ['youtube-short', 'instagram', 'facebook-reel', 'tiktok', 'tiktok-share'].includes(type);
}

export function isEmbeddableContent(type: ContentType): boolean {
  return (
    isVideoContentType(type) ||
    [
      'facebook-post',
      'instagram-post',
      'twitter-post',
      'reddit-post',
      'threads-post',
      'bluesky-post',
      'mastodon-post',
      'linkedin-post',
      'google-maps',
      'post',
    ].includes(type)
  );
}

export function isGoogleMapsUrl(raw: string): boolean {
  try {
    const url = new URL(ensureUrl(raw));
    const host = url.hostname.toLocaleLowerCase().replace(/^www\./, '');
    return (
      host === 'maps.app.goo.gl' ||
      host === 'maps.google.com' ||
      ((host === 'google.com' || host.endsWith('.google.com')) &&
        (url.pathname.startsWith('/maps') || url.searchParams.has('q')))
    );
  } catch {
    return false;
  }
}

export function isGoogleMapsShortUrl(raw: string): boolean {
  try {
    return new URL(ensureUrl(raw)).hostname.toLocaleLowerCase() === 'maps.app.goo.gl';
  } catch {
    return false;
  }
}

function buildGoogleMapsEmbedUrl(source: string, placeName: string): string {
  try {
    const url = new URL(source);
    const query = googleMapsQuery(url, placeName);
    if (query) {
      const embed = new URL('https://maps.google.com/maps');
      embed.searchParams.set('q', query);
      embed.searchParams.set('output', 'embed');
      return embed.href;
    }
    if (url.hostname.toLocaleLowerCase() === 'maps.app.goo.gl') return '';
    if (!isGoogleMapsUrl(url.href)) return '';
    url.searchParams.set('output', 'embed');
    return url.href;
  } catch {
    return '';
  }
}

export function isGenericGoogleMapsPreviewImage(raw: string): boolean {
  if (!raw) return false;
  try {
    const url = new URL(raw);
    const value = `${url.hostname}${url.pathname}`.toLocaleLowerCase();
    return (
      value.includes('/branding/product/') ||
      value.includes('google_maps') ||
      value.includes('maps_96in128dp') ||
      value.includes('maps_64dp') ||
      value.includes('maps_app_icon')
    );
  } catch {
    return false;
  }
}

function googleMapsQuery(url: URL, suppliedName: string): string {
  const name = suppliedName.trim();
  if (name && !/^(google maps|maps\.app\.goo\.gl)$/i.test(name)) return name;
  const place = url.pathname.match(/\/maps\/place\/([^/]+)/i)?.[1];
  if (place) return decodeURIComponent(place.replaceAll('+', ' '));
  const query = url.searchParams.get('q') || url.searchParams.get('query');
  if (query) return query;
  const coordinates = url.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  return coordinates ? `${coordinates[1]},${coordinates[2]}` : '';
}

export function extractFacebookVideoId(raw: string): string | null {
  try {
    const url = new URL(ensureUrl(raw));
    const watch = url.searchParams.get('v');
    if (watch && /^\d+$/.test(watch)) return watch;
    const direct = url.pathname.match(/\/(?:reel|videos|watch)\/(\d+)/i)?.[1];
    if (direct) return direct;
    const shareCode = url.pathname.match(/\/share\/[rv]\/([^/?#]+)/i)?.[1];
    if (shareCode) return FACEBOOK_SHARE_ID_OVERRIDES[shareCode] ?? null;
    return [...url.pathname.matchAll(/\/(\d+)/g)].at(-1)?.[1] ?? null;
  } catch {
    return /^\d+$/.test(raw.trim()) ? raw.trim() : null;
  }
}

export function buildFacebookVideoUrl(raw: string): string {
  const id = extractFacebookVideoId(raw);
  return id ? `https://www.facebook.com/reel/${id}` : ensureUrl(raw);
}

export function isFacebookPostShareUrl(raw: string): boolean {
  try {
    return /^\/share\/p\/[^/?#]+/i.test(new URL(ensureUrl(raw)).pathname);
  } catch {
    return false;
  }
}

export function extractFacebookPostId(raw: string): string | null {
  try {
    const url = new URL(ensureUrl(raw));
    const fbid = url.searchParams.get('fbid') ?? url.searchParams.get('story_fbid');
    if (fbid && /^\d+$/.test(fbid)) return fbid;
    const shareCode = url.pathname.match(/\/share\/p\/([^/?#]+)/i)?.[1];
    if (shareCode) return FACEBOOK_SHARE_POST_ID_OVERRIDES[shareCode] ?? null;
    const photoPath = url.pathname.match(/\/(?:photos|photo)\/[^/]*\/?(\d+)(?:\/|$)/i)?.[1];
    return photoPath ?? null;
  } catch {
    return /^\d+$/.test(raw.trim()) ? raw.trim() : null;
  }
}

export function buildFacebookPostUrl(raw: string): string {
  const id = extractFacebookPostId(raw);
  return id ? `https://www.facebook.com/photo/?fbid=${id}` : ensureUrl(raw);
}

export function extractTikTokVideoId(raw: string): string | null {
  try {
    return new URL(ensureUrl(raw)).pathname.match(/\/video\/(\d+)/i)?.[1] ?? null;
  } catch {
    return /^\d+$/.test(raw.trim()) ? raw.trim() : null;
  }
}

function extractPeerTubeVideoId(url: URL): string | null {
  const short = url.pathname.match(/^\/w\/([a-z0-9]{22})(?:\/|$)/i)?.[1];
  if (short) return short;
  return url.pathname.match(/^\/videos\/(?:watch|embed)\/([a-z0-9-]+)(?:\/|$)/i)?.[1] ?? null;
}

function extractTwitchMedia(url: URL): string | null {
  const host = url.hostname.toLocaleLowerCase().replace(/^www\./, '');
  if (host === 'clips.twitch.tv') {
    const clip = url.pathname.split('/').filter(Boolean)[0];
    return clip ? `clip:${clip}` : null;
  }
  const clip = url.pathname.match(/^\/[^/]+\/clip\/([^/?#]+)/i)?.[1];
  if (clip) return `clip:${clip}`;
  const video = url.pathname.match(/^\/videos\/(\d+)/i)?.[1];
  if (video) return `video:${video}`;
  const segments = url.pathname.split('/').filter(Boolean);
  const channel = segments.length === 1 ? segments[0] : '';
  return channel && !TWITCH_RESERVED_PATHS.has(channel.toLocaleLowerCase())
    ? `channel:${channel}`
    : null;
}

function buildTwitchEmbedUrl(
  media: string,
  muted: boolean,
  autoplay: boolean,
  start: number,
): string {
  const separator = media.indexOf(':');
  if (separator < 1) return '';
  const kind = media.slice(0, separator);
  const value = media.slice(separator + 1);
  if (!value) return '';
  const parent =
    typeof window === 'undefined' ? 'localhost' : window.location.hostname || 'localhost';
  const embed = new URL(
    kind === 'clip' ? 'https://clips.twitch.tv/embed' : 'https://player.twitch.tv/',
  );
  embed.searchParams.set(kind, kind === 'video' ? `v${value}` : value);
  embed.searchParams.set('parent', parent);
  embed.searchParams.set('autoplay', autoplay ? 'true' : 'false');
  embed.searchParams.set('muted', muted ? 'true' : 'false');
  if (kind === 'video' && start) embed.searchParams.set('time', secondsToTwitchTime(start));
  return embed.href;
}

function extractWistiaMediaId(url: URL): string | null {
  return (
    url.pathname.match(/\/medias\/([a-z0-9]+)(?:\/|$)/i)?.[1] ??
    url.pathname.match(/\/embed\/(?:iframe|medias)\/([a-z0-9]+)(?:\/|$)/i)?.[1] ??
    null
  );
}

function extractMastodonStatusId(url: URL): string | null {
  return (
    url.pathname.match(/^\/@[^/]+\/(\d+)(?:\/|$)/i)?.[1] ??
    url.pathname.match(/^\/users\/[^/]+\/statuses\/(\d+)(?:\/|$)/i)?.[1] ??
    null
  );
}

function buildRedditEmbedUrl(source: string, id: string): string {
  try {
    const url = new URL(source);
    const path = url.hostname.toLocaleLowerCase() === 'redd.it' ? `/comments/${id}/` : url.pathname;
    const embed = new URL(`https://www.redditmedia.com${path}`);
    embed.searchParams.set('ref_source', 'embed');
    embed.searchParams.set('ref', 'share');
    embed.searchParams.set('embed', 'true');
    embed.searchParams.set('showmedia', 'true');
    return embed.href;
  } catch {
    return '';
  }
}

function buildThreadsEmbedUrl(source: string): string {
  try {
    const url = new URL(source);
    url.search = '';
    url.hash = '';
    url.pathname = `${url.pathname.replace(/\/$/, '')}/embed/`;
    return url.href;
  } catch {
    return '';
  }
}

function buildMastodonEmbedUrl(source: string): string {
  try {
    const url = new URL(source);
    url.search = '';
    url.hash = '';
    url.pathname = `${url.pathname.replace(/\/$/, '')}/embed`;
    return url.href;
  } catch {
    return '';
  }
}

function buildLegacySocialPostEmbedUrl(detected: ContentDetection, source: string): string {
  switch (detected.contentType) {
    case 'twitter-post':
      return detected.mediaId
        ? `https://platform.twitter.com/embed/Tweet.html?dnt=true&id=${detected.mediaId}`
        : '';
    case 'reddit-post':
      return buildRedditEmbedUrl(source, detected.mediaId);
    case 'threads-post':
      return buildThreadsEmbedUrl(source);
    case 'mastodon-post':
      return buildMastodonEmbedUrl(source);
    case 'linkedin-post':
      return detected.mediaId
        ? `https://www.linkedin.com/embed/feed/update/urn:li:activity:${detected.mediaId}`
        : '';
    default:
      return '';
  }
}

const TWITCH_RESERVED_PATHS = new Set([
  'directory',
  'downloads',
  'jobs',
  'p',
  'search',
  'settings',
  'subscriptions',
  'turbo',
  'wallet',
]);

function youtubeStart(url: URL): number {
  const raw = url.searchParams.get('t') ?? url.searchParams.get('start') ?? '';
  if (/^\d+$/.test(raw)) return Number(raw);
  const match = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  return match
    ? Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0)
    : 0;
}

function sharedStart(url: URL): number {
  const raw = url.searchParams.get('t') ?? url.searchParams.get('start') ?? '';
  if (/^\d+$/.test(raw)) return Number(raw);
  const match = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  return match
    ? Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0)
    : 0;
}

function secondsToTwitchTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h${minutes}m${seconds}s`;
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
