# YouTube picture-in-picture and Error 153

This document explains why YouTube initially failed in Personix picture-in-picture (PiP), why other embedded providers did not have the same failure, and how the final provider-specific implementation works.

## Symptom

The normal YouTube player rendered correctly inside the content card. Opening the same video in the browser's Document Picture-in-Picture window displayed:

```text
Watch video on YouTube
Error 153
Video player configuration error
```

Adding ordinary iframe permissions did not resolve the failure because the video itself was embeddable. The failure was specific to the identity and referrer context of the second document used for PiP.

## Why Error 153 occurred

YouTube embeds expect the client page to provide an acceptable HTTP referrer or equivalent client identification. Personix originally created a new Document PiP window and then created a second YouTube iframe inside that document.

Although the PiP iframe used `strict-origin-when-cross-origin`, the separate Document PiP context did not provide YouTube with the same acceptable page identity as the main Personix document. The regular player therefore worked while the new PiP player failed with Error 153.

The important distinction is:

- Normal Personix document → YouTube iframe: valid page origin and referrer context.
- Document PiP document → new YouTube iframe: separate context rejected by YouTube.

This is not a video-ID, autoplay, CORS, or general iframe-permission error.

## Scrollix reference behavior

Scrollix previously encountered the same problem. Its working implementation does two things:

1. It supplies the required YouTube embed parameters and page referrer policy.
2. It deliberately avoids Document PiP for YouTube.

For YouTube and YouTube Shorts, Scrollix uses Android activity PiP on Android and an in-app mini-player on the web. Document PiP remains available for providers that work correctly inside a separate PiP document.

Personix now follows the same routing.

## YouTube embed configuration

Personix builds YouTube URLs with these parameters:

| Parameter         | Purpose                                                          |
| ----------------- | ---------------------------------------------------------------- |
| `autoplay=1`      | Starts playback when the PiP/mini-player is opened               |
| `enablejsapi=1`   | Identifies the embed as a JavaScript API-capable player          |
| `origin`          | Supplies the current Personix origin                             |
| `widget_referrer` | Supplies the full Personix page URL                              |
| `playsinline=1`   | Prevents forced fullscreen playback on supported mobile browsers |
| `rel=0`           | Limits unrelated recommendations where YouTube supports it       |
| `start`           | Preserves a configured video start time when present             |
| `mute`            | Reflects the current Personix mute state                         |

The main document also declares:

```html
<meta name="referrer" content="strict-origin-when-cross-origin" />
```

YouTube iframes use the same referrer policy and receive the required autoplay, encrypted-media, picture-in-picture, accelerometer, clipboard, gyroscope, and web-share permissions.

## Final PiP routing

### Android YouTube

Personix keeps the existing YouTube iframe in the main activity, expands the preview host for PiP presentation, and asks Android to place that activity into native PiP mode. It does not create a second YouTube iframe or a second document.

### Web YouTube

Personix opens a fixed in-app mini-player inside the existing Personix document. Because this player remains in the main document, YouTube receives the acceptable origin and referrer context and Error 153 is avoided.

The mini-player supports:

- Dragging from its title bar with mouse, pen, or touch.
- Moving with arrow keys when the title bar is focused.
- Resizing from the lower-right resize control with mouse, pen, or touch.
- Resizing with arrow keys when the resize control is focused.
- `Shift` + arrow keys for larger keyboard movement or resize steps.
- Viewport clamping so the player cannot be dragged completely off-screen.
- Minimum and maximum dimensions suitable for horizontal and vertical videos.

### Other video providers

Native HTML video uses the browser's video PiP API when available. Other supported iframe providers may use Document PiP because they do not exhibit YouTube's referrer rejection. If Document PiP is unavailable or fails, Personix falls back to Android activity PiP or the in-app mini-player as appropriate.

## Files involved

| File                                                  | Responsibility                                      |
| ----------------------------------------------------- | --------------------------------------------------- |
| `src/app/core/utils/content-url.ts`                   | Constructs provider-specific embed URLs             |
| `src/app/features/content/content-preview.ts`         | Selects PiP strategy and implements the mini-player |
| `src/index.html`                                      | Defines the page-level referrer policy              |
| `src/app/core/services/native-integration.service.ts` | Calls the Android PiP bridge                        |
| `scripts/patch-android.mjs`                           | Adds Android activity PiP support                   |

## Maintenance rules

- Do not route YouTube or YouTube Shorts through Document Picture-in-Picture.
- Keep `origin`, `widget_referrer`, `enablejsapi`, and the referrer policy when changing YouTube URLs.
- Do not add `noreferrer` to the YouTube iframe navigation.
- Test normal YouTube videos and Shorts separately.
- Verify both web mini-player behavior and Android native PiP after changing the preview component.
- Preserve the existing iframe while Android is in PiP; recreating it can lose playback state and referrer context.

## Verification checklist

1. Open a normal YouTube video and confirm that the card player loads.
2. Open web PiP and confirm that the in-app mini-player loads without Error 153.
3. Drag the mini-player by its title bar to each side of the viewport.
4. Resize it from the lower-right control and confirm that the iframe fills the new size.
5. Repeat movement and resizing with arrow keys.
6. Repeat with a YouTube Short.
7. On Android, enter PiP and confirm that the existing player remains visible and playable.
8. Confirm that a non-YouTube provider can still use Document PiP or its fallback.
