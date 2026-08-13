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

## The “Watch on Facebook” poster

Some Facebook videos stream inline through Meta's embedded player and some are
rejected with “This video can't be embedded because it may contain content owned
by someone else”. Two `/share/r/` links can look identical in their crawler HTML
(same `og:type=video.other`, both with `og:image`, neither exposing `og:video`),
so the content type alone cannot tell them apart. The embed decision is made by
Meta's plugin, not the page.

### How embeddability is detected (Android, on-device, no third-party API)

During native metadata fetch, when the resolved URL is a Facebook video the
`MetadataBridge` performs one extra on-device request to Facebook's own embed
endpoint:

```
https://www.facebook.com/plugins/video.php?href=<canonical url>
```

`facebookEmbeddable()` then checks whether that page actually contains a video
stream (markers such as `dash_manifest`, `videoData`, `browser_native_hd_url`, or
`playable_url`). An embeddable reel returns these; a rights-blocked one does not.
The boolean result is stored on the item as `videoEmbeddable`. This uses only the
device's own HTTP stack — no Microlink or other third-party service. The probe is
skipped when the page returned no image (nothing to embed), which avoids a wasted
request on removed reels.

### Live vs. removed reels

Facebook serves a stripped shell (five meta tags, no `og:*` tags,
`<title>Facebook</title>`) for reels that are **removed or gated**, and it
sometimes returns the same shell when it is **rate-limiting the crawler** for a
live reel. Because a single failed fetch cannot tell these apart, the native
fetcher detects the shell with `facebookLoginWall()` and retries the request up to
three times (with a short delay) for `facebook.com`/`fb.com` URLs.

- A **live** reel returns real `og:image`/`og:title` on the first attempt, or on a
  retry once the transient wall clears, so its thumbnail is fetched and inlined.
- A **removed** reel returns the shell on every attempt; the fetch then succeeds
  with no image, so the card simply shows the “Watch on Facebook” poster
  placeholder and still opens the reel in Facebook. Removed reels are left as-is.

### When the poster is shown

`facebookPoster()` renders the poster **only** when a Facebook video's
`videoEmbeddable === false`. When it is `true`, the normal inline iframe player is
used. When the flag is unknown (older saved items, or web fetches that never probe
Facebook), the app keeps the inline player and honours the manual
`CONTENT_CONFIG.facebookPosterFallbackVideoIds` overrides. Re-fetching metadata on
an older item populates the flag.

### The “FB playable” per-item override

The embed probe runs only on Android. On the web (and for any reel that slips past
detection) a video can still show Facebook's “Unavailable / content owned by
someone else” frame. For those cases the item editor exposes an **FB playable**
checkbox on any Facebook video. When it is checked, `item.fbPlayable === true`
forces the poster regardless of the probe result: the saved `og:image` is shown
and the card opens the reel in Facebook. This is a manual, per-item switch the
user controls; leaving it unchecked keeps the automatic behaviour above.

The poster mirrors the Instagram “Watch on Instagram” experience:

- the stored `og:image` (or a video-icon placeholder when no image exists),
- a centered play button,
- a “Watch on Facebook” label,
- the whole card is a button that emits `openRequested`; the parent list's
  `open()` handler opens the canonical URL externally (Facebook app or browser).

Because a poster is not a real player, the Muted/PIP overlay controls are hidden
for it (`playbackControlsAvailable` is false when `facebookPoster()` is true), and
`safeEmbedUrl` returns `null` so no iframe is created.

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
