# Browser User-Agent (UA) handling for link previews

Personix fetches Open Graph (OG) metadata to render previews for saved links.
Many sites decide _what HTML to return_ based on the requester's `User-Agent`
(UA) string, so the UA we present directly controls whether a preview works.

## Why the UA matters

- **Crawler-only OG tags** — Facebook, Instagram, Reddit and Google Maps hide
  their real page behind a login/app wall for ordinary browsers, but return
  clean `og:title` / `og:image` tags to recognised link-preview crawlers such as
  `facebookexternalhit`.
- **Crawler-hostile sites** — Amazon (and some others) do the opposite: they
  serve a bot/verification wall to crawler UAs and only return product OG tags to
  a normal mobile-browser UA (and only for a clean product URL — see
  [OG-IMAGE-GENERATION.md](OG-IMAGE-GENERATION.md) and the shopping-link
  canonicalisation in `content-url.ts`).
- **CDN referer blocking** — Even when the OG image URL is found, image CDNs for
  Facebook/Instagram/Reddit reject requests whose `Referer` is the app origin
  (`https://localhost`). See [OG-IMAGE-GENERATION.md](OG-IMAGE-GENERATION.md).

So there is no single "correct" UA — it is chosen **per host**.

## Android (native crawler)

Implemented in the `MetadataBridge` that `scripts/patch-android.mjs` writes into
`MainActivity.java`. It fetches over `HttpURLConnection`, so it can freely set the
UA:

| Host group                                                           | UA used                                                                                                                             |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `facebook.com`, `fb.com`, `instagram.com`, `reddit.com`, Google Maps | `facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)`                                                         |
| Everything else (incl. Amazon/Flipkart/other shops)                  | `Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36 Personix/1.0` |

The host test is `prefersPreviewCrawler(url)`. Requests also send
`Accept: text/html,application/xhtml+xml`, `Accept-Language: en-US`,
`Accept-Encoding: identity`, and follow redirects
(`setInstanceFollowRedirects(true)`). The HTML body is capped at 1&nbsp;MB before
the OG tags are parsed.

## Browser / PWA

Implemented in `MetadataService` (`src/app/core/services/metadata.service.ts`).

- **Browsers forbid setting the `User-Agent` header on `fetch`.** We therefore
  cannot present a crawler UA ourselves.
- Instead the browser build delegates to a third-party preview service
  (Microlink, `https://api.microlink.io/` by default, configurable via
  `settings.browserMetadataServiceUrl`, HTTPS only). Microlink runs the crawler
  server-side and returns normalised `{ title, description, image, url }`.
- This only runs after the user opts in (`settings.browserMetadataEnabled`).
- For share/short links, `resolveShareUrl()` first tries a direct
  `fetch(url, { mode: 'no-cors', redirect: 'follow' })` to read `response.url`,
  then falls back to Microlink's resolved `data.url`.
- Responses are cached in-memory for 60 seconds.

## Summary of the solution

- **Blocking UAs** are handled by _choosing the UA per host_: crawler UA for
  walled social sites, a real mobile-browser UA for shops that reject crawlers.
- **On Android** we control the UA directly on `HttpURLConnection`.
- **In the browser** we cannot set the UA, so we route through a server-side
  preview service that presents the right UA for us.
