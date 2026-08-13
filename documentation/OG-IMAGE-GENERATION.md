# OG image (preview) generation (web & Android)

How the preview image shown on each saved-content card is produced.

## Browser / PWA — `src/app/core/services/metadata.service.ts`

- Metadata is fetched from the configured preview service (Microlink by
  default). The response's `data.image.url` becomes `ogImageUrl`, and
  `data.image.width` / `height` become the `aspectRatio`.
- `safeImage()` keeps only `https:` URLs (or inline `data:image/...`).
- The card renders `<img [src]="ogImageUrl" referrerpolicy="no-referrer">`; the
  `no-referrer` policy is what lets social CDNs serve the image to the page.
- Requires `settings.browserMetadataEnabled`. UA constraints are covered in
  [BROWSER-USER-AGENT.md](BROWSER-USER-AGENT.md).

## Android — `scripts/patch-android.mjs` (`MetadataBridge`)

Image candidates are parsed from the fetched HTML in priority order:
`og:image` → `og:image:url` → `twitter:image` → first meaningful `<img>`
(emoji/`rsrc.php` sprites are skipped). Dimensions come from
`og:image:width` / `og:image:height` (or the `twitter:` equivalents) and set the
`aspectRatio`.

The image is then resolved by `previewImage()`:

- For **crawler-preferred hosts** (Facebook, Instagram, Reddit, Google Maps),
  the image is **downloaded natively** with the `facebookexternalhit` UA and
  **inlined as a `data:<mime>;base64,...` URI** (`inlineImage()`, capped at
  3&nbsp;MB). This bypasses the CDN `Referer` blocking that would otherwise show
  a broken image in the WebView.
- For all other hosts the resolved absolute image URL is used as-is.
- Google Maps generic branding icons are dropped (see
  [MAP-URL-PROCESSING.md](MAP-URL-PROCESSING.md)).

The result is delivered to the web layer as the `image` field and stored in
`ogImageUrl` exactly like the browser path, so the card rendering is identical.

## Where the aspect ratio is used

`aspectRatio` (from the image dimensions) is stored on the item and reused by the
content preview to size embeds/thumbnails without layout shift.

## Manual aspect ratio override

Some Facebook and Instagram videos report the wrong dimensions (for example a
portrait reel whose `og:image` is a square or landscape frame), so the automatic
`aspectRatio` is incorrect. The item editor therefore exposes an **Aspect ratio**
control for every video type:

- **Automatic** (default) uses the fetched `aspectRatio` and the content-type
  fallback, exactly as before.
- **Manual** lets the user pick a preset from `ASPECT_RATIO_PRESETS` (9:16, 4:5,
  3:4, 1:1, 4:3, 16:9). The chosen ratio is stored separately on the item as
  `manualAspectRatio`.

The preview's `aspectRatio()` computed prefers `manualAspectRatio` when present,
then the fetched `aspectRatio`, then the content-type default. Because the manual
value lives in its own field, a later metadata fetch (which only writes
`aspectRatio`) never overrides the user's choice. Switching back to Automatic
clears `manualAspectRatio`.
