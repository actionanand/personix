/**
 * Content behavior that is intentionally easy to tune without changing components.
 */
export const CONTENT_CONFIG = {
  androidExternalPostApps: [
    'facebook',
    'instagram',
    'google-maps',
    // Other supported app names you can add later:
    // 'twitter', 'reddit', 'threads', 'bluesky', 'mastodon', 'linkedin', 'google-maps'
  ],
  itemsPerPage: {
    videos: 12,
    posts: 10,
  },
  filterPillPreviewLimit: 20,
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
