/**
 * Content behavior that is intentionally easy to tune without changing components.
 */
export const CONTENT_CONFIG = {
  androidExternalPostApps: [
    'facebook',
    'instagram',
    'google-maps',
    'amazon',
    'flipkart',
    'meesho',
    'myntra',
    'ajio',
    'nykaa',
    'snapdeal',
    'tatacliq',
    // Other supported app names you can add later:
    // 'twitter', 'reddit', 'threads', 'bluesky', 'mastodon', 'linkedin', 'google-maps'
  ],
  itemsPerPage: {
    videos: 12,
    posts: 10,
  },
  filterPillPreviewLimit: 20,
  // Meta's official video player rejects these otherwise-public videos because
  // of owner/content-rights restrictions. Keep this list narrow: all other
  // Facebook videos continue to use the normal inline player.
  facebookPosterFallbackVideoIds: ['1461026675781448'],
} as const;

const ANDROID_POST_APP_HOSTS: Readonly<Record<string, readonly string[]>> = {
  facebook: ['facebook.com', 'fb.com', 'fb.watch'],
  instagram: ['instagram.com', 'instagr.am'],
  twitter: ['x.com', 'twitter.com'],
  reddit: ['reddit.com', 'redd.it'],
  threads: ['threads.net', 'threads.com'],
  bluesky: ['bsky.app'],
  mastodon: ['mastodon.social'],
  linkedin: ['linkedin.com'],
  amazon: ['amazon.in', 'amazon.com', 'amzn.to', 'amzn.in', 'amzn.eu', 'amzn.asia', 'a.co'],
  flipkart: ['flipkart.com', 'dl.flipkart.com', 'fkrt.cc', 'fkrt.it', 'fkrt.to'],
  meesho: ['meesho.com'],
  myntra: ['myntra.com'],
  ajio: ['ajio.com'],
  nykaa: ['nykaa.com'],
  snapdeal: ['snapdeal.com'],
  tatacliq: ['tatacliq.com'],
  'google-maps': ['maps.app.goo.gl', 'maps.google.com', 'google.com'],
};

export function isAndroidExternalPostUrl(rawUrl: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(rawUrl).hostname.toLocaleLowerCase().replace(/^www\./, '');
  } catch {
    return false;
  }
  return CONTENT_CONFIG.androidExternalPostApps.some((app) =>
    (ANDROID_POST_APP_HOSTS[app] ?? []).some(
      (host) => hostname === host || hostname.endsWith(`.${host}`),
    ),
  );
}
