# Facebook (and TikTok) share-link resolution

This document explains how Personix turns a platform _share_ link into a playable
video embed, why the original share URL is kept, and how resolution differs
between Android and the web.

## Symptom

Facebook share links copied from a group, for example
`https://www.facebook.com/share/v/1ByFGRo8FF/`, rendered as:

```text
Video Unavailable
This video may no longer exist, or you don't have permission to view it.
```

The same content played correctly when opened as a canonical reel URL such as
`https://www.facebook.com/reel/1821110698482978`.

## Why share links fail in the embed

A share link (`facebook.com/share/[rv]/<code>`) is an opaque redirect. The short
`<code>` cannot be converted to the numeric video id locally. Facebook's video
plugin (`/plugins/video.php`) cannot render the share URL directly for many posts
(group-shared videos in particular), so it shows "Video Unavailable".

The plugin does render reliably when the `href` points at the canonical
`https://www.facebook.com/reel/{id}` URL. Getting the numeric `{id}` requires
following the redirect once.

## Resolution flow

Resolution happens **once, at save time**, and the result is persisted so no
network resolution is needed when the item is later opened.

1. On save, `detectContentUrl` classifies the link (for example `facebook-share`
   or `tiktok-share`) and attempts a local id extraction.
2. If the numeric id is already known (a canonical URL, or a code present in the
   offline `FACEBOOK_SHARE_ID_OVERRIDES` map), the redirect is skipped, but the
   resolver still runs once when the aspect ratio has not been captured yet.
3. Otherwise `Content.resolveShareUrl` calls `MetadataService.resolveShareUrl`,
   which follows the redirect to the canonical URL, extracts the id, and reads the
   poster dimensions to compute the video aspect ratio.
4. The item is saved with:
   - `url` — the **original share URL**, kept unchanged for reference.
   - `resolvedUrl` — the canonical `https://www.facebook.com/reel/{id}` URL.
   - `mediaId` — the extracted numeric id.
   - `aspectRatio` — the video's width/height, used to size the player frame.
5. When the card is displayed, `buildEmbedUrl` normalizes the source through
   `buildFacebookVideoUrl`, so the embed always uses the canonical reel URL. This
   step is pure and performs no network request.

## Adaptive player size

Facebook videos (including reels) come in different aspect ratios — portrait,
square, and landscape — so a fixed frame letterboxes or crops many of them. The
preview therefore sizes each player from the stored `aspectRatio`, falling back to
a content-type default (9:16 for known-vertical types, otherwise 16:9) until the
real ratio is known. The aspect ratio is captured once, at resolution time, from
the poster dimensions returned by the resolver, so display stays free of network
calls. On Android the native bridge does not yet report dimensions, so those items
use the default frame until dimensions are available.

Existing items saved before resolution are repaired the next time they are edited
and re-saved, or when the per-item "refresh metadata" action is used.

## The share URL is always kept

The original share link is never overwritten. It stays in the `url` field of the
saved content record, while the resolved canonical link is stored separately in
`resolvedUrl`. "Open original" and search continue to use the share URL, and the
embed uses the resolved URL.

## Platform-specific resolution

Resolution is deliberately routed by platform inside
`MetadataService.resolveShareUrl`:

- **Android** — resolves **only** through the native bridge
  (`NativeIntegrationService.fetchMetadata`, backed by the Android `MetadataBridge`
  which follows redirects with `HttpURLConnection` and returns `connection.getURL()`).
  No third-party service is contacted. If native resolution fails, the method
  returns `null` and does **not** fall back to any external API.
- **Web** — resolves through the microlink API
  (`https://api.microlink.io/`), which follows the redirect and returns the final
  URL.

This guarantees that on Android no third-party API or URL (microlink or otherwise)
is used for share-link resolution.

Because a resolved URL is required for playback, `resolveShareUrl` runs regardless
of the `androidMetadataEnabled` / `browserMetadataEnabled` preview-metadata
toggles. Those toggles only govern optional preview metadata (title, description,
image) fetched separately by `MetadataService.fetch`.

## Offline overrides

`FACEBOOK_SHARE_ID_OVERRIDES` in `src/app/core/utils/content-url.ts` maps known
share codes to numeric ids. Entries there resolve instantly with no network call.
The map is an optimization only; unknown codes are resolved via the platform flow
above.

## Related files

- `src/app/core/utils/content-url.ts` — detection, id extraction, canonical URL
  and embed construction.
- `src/app/core/services/metadata.service.ts` — `resolveShareUrl` platform routing.
- `src/app/features/content/content.ts` — `resolveShareUrl` save-time step.
- `scripts/patch-android.mjs` — native `MetadataBridge` that follows redirects.
