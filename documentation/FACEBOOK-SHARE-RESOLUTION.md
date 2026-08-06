# Facebook share-link resolution and playback

This document describes the two independent Facebook problems Personix handles:
resolving an opaque share URL and displaying content that Meta does not permit an
embedded player to show.

## Why a resolved reel can still say “Unavailable”

A URL such as `https://www.facebook.com/share/r/1DXv5GFJGw/` is an opaque share
redirect. Personix can resolve and store its canonical URL, for example
`https://www.facebook.com/reel/1461026675781448`.

That does not guarantee that Meta's official embedded player will accept it. Meta
can reject a correctly resolved public-looking URL because of its audience,
ownership, music/content rights, login state, or embedding policy. Rewriting the
URL cannot override that server-side decision. The same item can still show a
preview in WhatsApp because link-preview crawling and iframe playback are
different Facebook endpoints with different rules.

Personix uses Meta's official video iframe for inline playback and PIP, matching
Scrollix. The iframe always receives the saved canonical URL rather than an opaque
share URL. The card's **Open** action remains available when Meta refuses to embed
a particular video; the app cannot read or override an error rendered inside
Meta's cross-origin iframe.

Confirmed rights-blocked video IDs are kept in
`CONTENT_CONFIG.facebookPosterFallbackVideoIds`. Only those IDs render their
stored poster with an explanatory notice; this avoids showing Meta's error frame
without diverting working Facebook reels away from the inline player. The list is
intentionally explicit because the app cannot inspect a cross-origin iframe to
discover the error after it renders.

Facebook reels use a 9:16 fallback until real preview dimensions are available.
Android reads `og:image:width` and `og:image:height` directly and stores the
resulting aspect ratio, so landscape and portrait Facebook videos render in their
actual shape after metadata is fetched.

## Save-time resolution flow

Resolution happens while saving, and its result is persisted:

1. `detectContentUrl` classifies `/share/r/` and `/share/v/` as Facebook video
   shares. This URL-derived type is authoritative over a stale form selection.
2. If the numeric video ID is already available from a canonical URL or an
   offline override, Personix immediately stores the canonical reel URL. This
   succeeds even if the later metadata request is offline.
3. Otherwise Android's native metadata bridge follows the redirect using a
   crawler-compatible request and also inspects Facebook's canonical metadata
   and HTML for `/reel/`, `/videos/`, or `/watch/?v=` URLs.
4. The saved record keeps:
   - `url`: the original share URL, for reference;
   - `resolvedUrl`: the canonical Facebook video URL;
   - `mediaId`: the numeric Facebook video ID;
   - Open/share/copy actions use the canonical URL when it is available.
5. Preview metadata is fetched separately. Failure to fetch a title or poster
   never prevents the record itself from being saved.

Existing records can be repaired with the card's **Refresh metadata** action.

## Android privacy and preview handling

Android never sends Facebook URLs to Microlink or another third-party metadata
service. The generated `PersonixMetadata` bridge:

- follows redirects with `HttpURLConnection`;
- uses a crawler-compatible user agent for Facebook preview metadata;
- prefers `og:url`, then scans for a usable canonical video URL;
- reads Open Graph/Twitter metadata and a useful fallback image;
- downloads supported social preview images and returns them as a local data URL,
  avoiding later Facebook CDN/referrer failures;
- caps HTML and image sizes and treats all metadata errors as non-fatal.

On the browser, Microlink is used only after the user explicitly enables browser
third-party fetching in Settings.

## Offline overrides

`FACEBOOK_SHARE_ID_OVERRIDES` in
`src/app/core/utils/content-url.ts` maps confirmed share codes to numeric video
IDs. These entries are fast/offline fallbacks, not the primary resolution method.
Unknown links continue through the native resolver.

## Related files

- `src/app/core/utils/content-url.ts`: classification, ID extraction and
  canonical URL construction.
- `src/app/core/services/metadata.service.ts`: Android/web metadata routing.
- `src/app/features/content/content.ts`: save-time resolution and persistence.
- `src/app/features/content/content-preview.ts`: inline player, aspect ratio and
  PIP UI.
- `scripts/patch-android.mjs`: generated native resolver and image fetcher.
