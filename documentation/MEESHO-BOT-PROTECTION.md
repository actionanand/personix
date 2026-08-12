# Bot-protected shops (Meesho) — why previews failed and how they're fixed

Some marketplaces — most notably **Meesho** — sit behind an enterprise bot
manager (**Akamai Bot Manager**). Their share links (`meesho.com/s/p/…`) returned
**HTTP 403 "Access Denied"** to Personix's link-preview fetch, so cards showed
only the URL (or, on the web build via Microlink, the literal title
"Access Denied").

## Why it happened

Personix's on-device fetcher uses Java's `HttpURLConnection`. A bot manager does
**not** decide by `User-Agent` alone — it fingerprints the whole client:

- **TLS fingerprint (JA3)** — the exact cipher/extension ordering of the TLS
  handshake. Java's TLS stack looks nothing like Chrome's, so the request is
  flagged before a single byte of HTML is sent.
- **HTTP/2 fingerprint** — frame/settings/header ordering. `HttpURLConnection`
  speaks HTTP/1.1 with a non-browser signature.
- **JavaScript sensor** — Akamai serves a `_abck` sensor script that must execute
  in a real DOM/JS engine and post back a token. A plain HTTP client runs no JS,
  so it never clears the challenge.
- **IP reputation** — datacenter ranges are pre-blocked. (During diagnosis every
  User-Agent — Chrome desktop, Chrome mobile, `facebookexternalhit`, even
  `WhatsApp` — got 403 from a datacenter IP.)

So changing the User-Agent, the headers, or the IP does **not** help. This is
why the same link previews fine when shared into WhatsApp (WhatsApp's crawler is
allow-listed by many sites) but not from a generic HTTP client.

### Why a third-party API, WASM, or Rust/C++ cannot fix it

- **Third-party preview APIs** (Microlink, etc.) are explicitly out of scope on
  Android: they add a network dependency, rate limits, and send every saved URL
  to an outside service. Personix on Android must stay fully on-device.
- **WebAssembly / Rust / C++** run inside the same app sandbox. They cannot forge
  a browser's TLS/HTTP2 fingerprint or execute Akamai's DOM-based sensor any
  better than Java can — the sensor needs a genuine browser engine. Adding a
  native HTTP/TLS library would just produce a _different_ non-browser
  fingerprint that the bot manager still rejects.

The only thing on the device that is indistinguishable from a real browser is a
**real browser** — and Android already ships one: the system **WebView**
(Chromium).

## How it's fixed (on-device, no API)

Implemented in `scripts/patch-android.mjs` (`MetadataBridge.fetchViaWebView`).

1. The normal `HttpURLConnection` fetch runs first (fast, works for most sites).
2. If it **fails or is blocked** for a shopping URL (`isShoppingUrl`), Personix
   falls back to an **off-screen WebView**:
   - A real `WebView` (full Chromium) is created and **attached off-screen at the
     real screen size**, so `window.innerWidth/innerHeight` and layout are those
     of a genuine viewport (bot sensors check this). It is translated off-screen,
     so it is never visible and never intercepts touches.
   - JavaScript + DOM storage are enabled and a normal mobile-Chrome User-Agent is
     set. The WebView performs a real TLS/HTTP2 handshake and executes the Akamai
     sensor, which clears the challenge and loads the real page.
   - Personix **polls** the page (every ~700 ms until a timeout) with a small
     script that reads the Open Graph tags
     (`og:title` / `og:description` / `og:image`, falling back to `document.title`).
     Polling handles the challenge → content transition and single-page-app
     hydration, so it waits until the product data actually appears.
   - Once tags are found, the WebView is destroyed, the image is downloaded and
     base64-inlined natively (bypassing CDN referer rules — see
     [OG-IMAGE-GENERATION.md](OG-IMAGE-GENERATION.md)), and the result is handed to
     the app exactly like a normal fetch.
3. If the page never yields tags (or is a genuine block page), it fails
   gracefully — `isBlockedPreview` suppresses "Access Denied"/challenge titles, so
   the card just shows the platform badge + Open (which opens the Meesho app; see
   `content.config.ts`). No garbage is ever stored.

Everything is local: no external preview API, no rate limits, and saved URLs
never leave the device.

## Trade-offs

- The WebView fallback is slower than a plain HTTP fetch (it renders a full page),
  so it only runs for shopping URLs that the fast path can't handle.
- It relies on the system WebView being present and up to date (standard on
  Android). If a shop deploys an even stricter interactive challenge (e.g. a
  visible CAPTCHA), no automated on-device method can solve it and the card falls
  back to badge + Open.
