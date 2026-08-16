# Personix

Personix is a private, offline-first personal organiser built with Angular 22 and Capacitor. It keeps saved links, family and medical references, vehicles, temporary notes and checklists on the device—without a cloud account, analytics or advertising.

## Storage and privacy

- Browser records use a versioned IndexedDB database.
- Android records use one versioned SQLite database through `@capacitor-community/sqlite`.
- Feature components use repositories and never access IndexedDB or SQLite directly.
- Adult content is hidden by default, including from Home, global search and thumbnail loading.
- Browser metadata fetching is off by default and requires explicit privacy consent; when enabled, requests use only `https://api.microlink.io/`.
- Android fetches metadata directly and synchronises missing post previews from the Content screen.
- Backups use PBKDF2-derived AES-256-GCM encryption. Application PINs, biometric credentials and Android Keystore keys are excluded.
- Application PINs are stored only as a salted, versioned PBKDF2 verifier. Android biometric unlock wraps the PIN with a non-exportable authentication-bound Keystore key.

## Features

- Separate Video and Post/Link tabs with Scrollix-compatible YouTube, Instagram, Facebook, TikTok, Dailymotion, Vimeo, share-link and post handling
- Automatically populated OG metadata, categories, tags and intended recipients
- Independent family members, hospital OP, insurance/TPA, medicine, toiletry and blood-group records
- Optional Rasi, Nakshatra (English and Tamil) and Gothram details
- Vehicle registration and expiry references
- Searchable self-chat-style temporary notes with incremental loading
- Multiple lightweight checklists
- Grouped global search that respects adult-content visibility
- Custom confirmation dialogs, destructive confirmation and queued snackbars
- Light, dark and automatic themes with matching Android system bars
- Encrypted selective backup, validation, merge and replace restore
- Generated Android launcher/splash branding from `public/personix.png`

## Development

Use Node 24.16 or a compatible version listed in `package.json`.

```bash
npm ci
npm start
npm run lint
npm test -- --watch=false
npm run build
```

The native packages required by this implementation are already declared in `package.json`:

```bash
npm i @capacitor/core @capacitor/android @capacitor/cli @capacitor/filesystem @capacitor/camera @capacitor/splash-screen @capacitor-community/sqlite
```

Run that command only when updating from an older checkout without the current lock file. The project already uses `@lucide/angular` for all interface icons.

## Restore fixture

Use [`sample-data/personix-sample.pxbackup`](sample-data/personix-sample.pxbackup) to verify restore with passphrase `12345678`. The fixture is encrypted with the same PBKDF2/AES-256-GCM format as application exports and includes 15 safe sample records across the main modules.

Regenerate and verify it with `npm run generate-sample-backup`.

## Android

```bash
npm run android:add
npm run android:sync
npm run android:open
```

`android:sync` builds Angular, synchronises Capacitor, then applies the idempotent Personix patch for the splash, system bars, Keystore biometrics, Android metadata fetching and R8. The generated `android/` directory is intentionally ignored.

See [documentation/ANDROID.md](documentation/ANDROID.md), [documentation/ANDROID_SPECIAL_CASES.md](documentation/ANDROID_SPECIAL_CASES.md), and [documentation/R8-DEOBFUSCATION.md](documentation/R8-DEOBFUSCATION.md).

## GitHub Actions releases

Normal branches produce a debug APK artifact. `main-android` produces APK, AAB, R8 mapping and Play Store icon files under `releases/`, automatically increments `versionCode`, and commits the release files. `v*` tags also create a GitHub Release.

Signed releases use these repository secrets:

| Secret              | Purpose                                                  |
| ------------------- | -------------------------------------------------------- |
| `KEYSTORE_BASE64`   | Base64-encoded release keystore                          |
| `KEYSTORE_PASSWORD` | Keystore password                                        |
| `KEY_ALIAS`         | Signing alias (`personix` for the supplied generator)    |
| `KEY_PASSWORD`      | Key password; for PKCS12, normally the keystore password |

Never commit a keystore, password, PIN or encryption key.

## Personix documentation

- [Android build, versioning and signing](ANDROID.md)
- [Splash, system bars, metadata, biometrics and permissions](ANDROID_SPECIAL_CASES.md)
- [R8 deobfuscation mapping](R8-DEOBFUSCATION.md)
- [YouTube Error 153 and picture-in-picture](YOUTUBE-PIP.md)
- [Facebook share-link resolution](FACEBOOK-SHARE-RESOLUTION.md)
- [Browser User-Agent handling for link previews](BROWSER-USER-AGENT.md)
- [Google Maps URL processing (web & Android)](MAP-URL-PROCESSING.md)
- [OG image (preview) generation (web & Android)](OG-IMAGE-GENERATION.md)
- [Bot-protected shops (Meesho) — why previews failed and the WebView fix](MEESHO-BOT-PROTECTION.md)
