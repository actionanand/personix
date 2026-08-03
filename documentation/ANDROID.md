# Personix Android build guide

Personix uses Capacitor 8 and a generated Android project. `public/personix.png` is the canonical source for the launcher, splash and Play Store icons.

## Local build from WSL2

```bash
npm ci
npm run android:add
npm run android:sync
```

Open the generated project from an environment with Android Studio:

```bash
npm run android:open
```

The app supports Android API 24 and later and targets API 36 in CI. After every `cap sync`, `scripts/patch-android.mjs` must run; `npm run android:sync` does this automatically.

## Storage

Android selects the SQLite adapter at runtime and stores module-specific tables in the single `personix` database. The browser build selects IndexedDB. Capacitor Filesystem and Camera are declared for file backups and optional record attachments; runtime permissions should be requested only from a user-initiated feature that needs them.

## Versioning

`android-version.json` is the release source of truth:

```bash
npm run android:version
npm run android:version:patch
npm run android:version:minor
npm run android:version:major
```

The plain command increments `versionCode`; the named commands also change the semantic `versionName`. Builds on `main-android` increment `versionCode` automatically before building.

## Signing

Generate a PKCS12 keystore once on a trusted machine:

```bash
npm run generate-keystore
npm run keystore:type
base64 -w 0 release-keystore.jks > keystore.b64.txt
```

Store its Base64 text and passwords in GitHub Actions secrets. Keep an offline copy of the keystore; losing the release key can prevent future Play Store updates.

## CI artifacts

- Normal branches: `personix-<version>-debug.apk`
- `main-android` and `v*` tags: signed APK/AAB when secrets are present, clearly named unsigned artifacts otherwise
- Release builds: the exact `personix-<version>-mapping.txt`
- All builds: `playstore-icon.png`

`main-android` commits release output under `releases/`; tag builds create a GitHub Release.
