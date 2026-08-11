# Google Maps URL processing (web & Android)

How a pasted Google Maps link becomes a saved place with an embedded map.

## Detection (shared) — `src/app/core/utils/content-url.ts`

- `isGoogleMapsUrl(raw)` matches `maps.app.goo.gl`, `maps.google.com`, or
  `google.com` with a `/maps` path or a `?q=` query.
- `isGoogleMapsShortUrl(raw)` matches only `maps.app.goo.gl` (the share/short
  form that hides the real destination until it is followed).
- `detectContentUrl()` returns `contentType: 'google-maps'`, `platform: 'Google Maps'`.

## Short-link resolution — `src/app/features/content/content.ts`

`resolveShareUrl()` special-cases Maps: when the URL is a `maps.app.goo.gl`
short link it calls `MetadataService.resolveShareUrl()` to follow the redirect
and stores the expanded destination as `resolvedUrl`. Android follows the
redirect natively; the browser follows it directly (or via Microlink). See
[BROWSER-USER-AGENT.md](BROWSER-USER-AGENT.md).

## Embed URL — `content-url.ts` → `buildGoogleMapsEmbedUrl()`

The embedded map is built from a **query**, not the raw URL, via
`googleMapsQuery()`, which prefers, in order:

1. the saved place title (unless it is just "Google Maps" / the short host),
2. the `/maps/place/<name>` path segment,
3. a `q` / `query` parameter,
4. `@lat,lng` coordinates from the path.

It then produces `https://maps.google.com/maps?q=<query>&output=embed`. If no
query can be derived, a non-short Maps URL is embedded directly by appending
`output=embed`; `maps.app.goo.gl` links return an empty embed (they must be
resolved first).

## Rendering — `src/app/features/content/content-preview.ts`

- `googleMapsContent` is true when the item (or its resolved URL) is a Maps link.
- `googleMapsPreviewImage` returns the OG image **only if it is a real place
  photo**; generic Google Maps branding icons are filtered out with
  `isGenericGoogleMapsPreviewImage()` (matches `/branding/product/`,
  `google_maps`, `maps_96in128dp`, `maps_64dp`, `maps_app_icon`).
- The template shows the place photo when available, otherwise the embedded
  `output=embed` map iframe.

## Android specifics — `scripts/patch-android.mjs` (`MetadataBridge`)

- `isGoogleMapsUrl()` mirrors the web check and makes Maps a crawler-preferred
  host (`prefersPreviewCrawler`), so it uses the `facebookexternalhit` UA and
  inlines the preview image (see [OG-IMAGE-GENERATION.md](OG-IMAGE-GENERATION.md)).
- `genericGoogleMapsImage()` drops the same generic branding icons natively so a
  useless logo is never stored as the place photo.
- `maps.app.goo.gl` links are expanded through the native redirect follow before
  the metadata is parsed.
