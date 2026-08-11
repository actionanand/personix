# Browser User-Agent (UA) handling for link previews

Personix fetches Open Graph (OG) metadata to render previews for saved links.
Many sites decide _what HTML to return_ based on the requester's `User-Agent`
(UA) string, so the UA we present directly controls whether a preview works.

## Why the UA matters

- **Crawler-only OG tags** — Facebook, Instagram, Reddit and Google Maps hide
  their real page behind a login/app wall for ordinary browsers, but return
  clean `og:title` / `og:image` tags to recognised link-preview crawlers such as
  `facebookexternalhit`.
- **Crawler-hostile sites** — Some shops do the opposite of the social sites:
  - **Amazon / Flipkart** return product OG tags to the `facebookexternalhit`
    crawler (the same way WhatsApp shows their previews), but only for a clean
    product URL — see [OG-IMAGE-GENERATION.md](OG-IMAGE-GENERATION.md) and the
    shopping-link canonicalisation in `content-url.ts`.
  - **Meesho** (and Myntra/Ajio/Snapdeal/Nykaa/Tata CLiQ) sit behind an Akamai
    bot manager that answers **HTTP 403 "Access Denied"** to the
    `facebookexternalhit` UA (a well-known bot signature). They must be fetched
    with a normal mobile-browser UA instead. See
    [Shopping / marketplace links](#shopping--marketplace-links).
- **CDN referer blocking** — Even when the OG image URL is found, image CDNs for
  Facebook/Instagram/Reddit reject requests whose `Referer` is the app origin
  (`https://localhost`). See [OG-IMAGE-GENERATION.md](OG-IMAGE-GENERATION.md).

So there is no single "correct" UA — it is chosen **per host**.

## Android (native crawler)

Implemented in the `MetadataBridge` that `scripts/patch-android.mjs` writes into
`MainActivity.java`. It fetches over `HttpURLConnection`, so it can freely set the
UA:

| Host group                                                                             | UA used                                                                                                                             |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `facebook.com`, `fb.com`, `instagram.com`, `reddit.com`, Google Maps, Amazon, Flipkart | `facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)`                                                         |
| Everything else (Meesho, Myntra, Ajio and other shops, generic sites)                  | `Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36 Personix/1.0` |

The host test is `prefersPreviewCrawler(url)` (social sites + Google Maps +
`isCrawlerFriendlyShop(url)`, which is Amazon/Flipkart only). Requests also send
`Accept: text/html,application/xhtml+xml`, `Accept-Language: en-US`,
`Accept-Encoding: identity`, and follow redirects
(`setInstanceFollowRedirects(true)`). The HTML body is capped at 1&nbsp;MB before
the OG tags are parsed.

## Shopping / marketplace links

Shops are split into two groups in the `MetadataBridge`:

- `isCrawlerFriendlyShop(url)` — **Amazon, Flipkart** (and their short domains
  `amzn.*`, `a.co`, `fkrt.*`). These are added to `prefersPreviewCrawler`, so they
  use the `facebookexternalhit` crawler UA and reliably return OG tags.
- `isShoppingUrl(url)` — **all** marketplaces (the two above **plus** Meesho,
  Myntra, Ajio, Snapdeal, Nykaa, Tata CLiQ). This wider set is used for two
  things:
  1. **Image inlining** — `previewImage()` inlines the OG image for every shop
     (`prefersPreviewCrawler(url) || isShoppingUrl(url)`), downloading it natively
     and returning a `data:` URI so CDN referer/hotlink rules can't blank it. The
     inline download itself now uses the **normal Chrome UA** (not the crawler
     UA), which more image CDNs accept.
  2. Everything in `isShoppingUrl` but **not** in `isCrawlerFriendlyShop`
     (Meesho, Myntra, …) therefore falls through to the normal mobile-browser UA
     for the HTML fetch, avoiding Meesho's `facebookexternalhit` 403.

Meesho share links (`meesho.com/s/…`) are also registered in
`isShoppingShortLink()`, so `resolveShareUrl()` follows the redirect to the
canonical product page before fetching metadata, and `canonicalizeShoppingUrl()`
strips tracking query parameters.

> **Caveat:** if a shop's share page is a pure JavaScript SPA (no server-rendered
> OG tags) or blocks residential IPs as well, then no server-side fetch — ours,
> WhatsApp's, or Microlink's — can extract a title/image. Such links save without
> a preview and are best opened in the shop's own app.

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

- **Blocking UAs** are handled by _choosing the UA per host_: the crawler UA for
  walled social sites and crawler-friendly shops (Amazon/Flipkart), and a real
  mobile-browser UA for shops that reject the crawler (Meesho and friends).
- Marketplace **images are always inlined** natively so CDN referer rules can't
  blank them, and shopping links are redirect-resolved and stripped of tracking
  parameters first.
- **On Android** we control the UA directly on `HttpURLConnection`.
- **In the browser** we cannot set the UA, so we route through a server-side
  preview service that presents the right UA for us.
