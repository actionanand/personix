# Personix Android build guide

Personix uses Capacitor 8 and GitHub Actions to package the Angular application as an Android APK and AAB. CI generates the `android/` directory, so it is not committed.

The workflow supports both release outcomes:

- When all signing secrets are configured and signing succeeds, it creates a signed APK and signed AAB.
- When the keystore is missing, secrets are incomplete, or signing fails, it creates clearly named unsigned APK and AAB files.

Android release-signing passwords are used only by the signing tools during CI. They are not compiled into Personix or exposed to the web application.

## Build files

| File                                  | Purpose                                                                                               |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `capacitor.config.ts`                 | App ID, app name, web output directory, Android scheme, background, and splash configuration          |
| `.github/workflows/android-build.yml` | Builds, optionally signs, verifies, versions, and uploads APK/AAB files                               |
| `android-version.json`                | Stores Android `versionCode` and `versionName`                                                        |
| `scripts/bump-android-version.js`     | Updates Android version values                                                                        |
| `scripts/patch-android.mjs`           | Applies the branded splash, system bars, biometrics, metadata bridge, PiP, launcher resources, and R8 |
| `scripts/generate-keystore.mjs`       | Generates the PKCS12 release keystore                                                                 |
| `scripts/detect-keystore-format.mjs`  | Displays the keystore type                                                                            |
| `public/personix.png`                 | Canonical source for launcher, splash, application brand, and Play Store icons                        |

## GitHub signing secrets

Add these under **Repository Settings → Secrets and variables → Actions**:

| Secret              | Purpose                                                                    |
| ------------------- | -------------------------------------------------------------------------- |
| `KEYSTORE_BASE64`   | Base64 text containing the complete release keystore                       |
| `KEYSTORE_PASSWORD` | Password used to open the keystore                                         |
| `KEY_ALIAS`         | Alias of the signing key; the included generator uses `personix`           |
| `KEY_PASSWORD`      | Private-key password; for PKCS12 use the same value as `KEYSTORE_PASSWORD` |

CI attempts signing only when the required keystore values are present. The decoded keystore and temporary password files are removed in the workflow's `always()` cleanup step.

## Generate `KEYSTORE_BASE64`

Generate a PKCS12 keystore interactively on a trusted machine:

```bash
npm run generate-keystore
```

Or provide the password non-interactively in a trusted local shell:

```bash
npm run generate-keystore -- --password 'YOUR_STRONG_PASSWORD'
```

Always enclose a command-line password in single quotes. This prevents spaces and most shell-special characters from being interpreted. Do not commit or paste the real command into logs or shell scripts.

You may alternatively provide `KEYSTORE_PASSWORD` through the environment. Password precedence is `--password`, then `KEYSTORE_PASSWORD`, then the interactive prompt.

The output is `release-keystore.jks` with alias `personix`. Despite the `.jks` filename, its internal format is PKCS12.

Verify it:

```bash
npm run keystore:type
keytool -list -v -keystore release-keystore.jks
```

Generate the GitHub secret value in WSL/Linux:

```bash
base64 -w 0 release-keystore.jks > keystore.b64.txt
```

On macOS:

```bash
base64 < release-keystore.jks | tr -d '\n' > keystore.b64.txt
```

Copy the single-line content of `keystore.b64.txt` into `KEYSTORE_BASE64`. Store the original keystore and password in a secure offline backup. Never commit the keystore, Base64 text, password, application PIN, or encryption keys. Losing the release key can prevent future Play Store updates.

## Build flow

1. GitHub installs Node 24.16, Java 21, and the Android SDK.
2. npm installs the locked dependencies and runs lint.
3. Angular creates the production web build.
4. Capacitor generates and synchronizes the Android project.
5. `scripts/patch-android.mjs` applies the native Personix integrations and R8 configuration.
6. CI applies the Android version, minimum SDK 24, and target SDK 36.
7. ImageMagick generates launcher and Play Store icons from `public/personix.png`.
8. Normal branches build a debug APK. `main-android` and `v*` tags build optimized release APK/AAB inputs.
9. Release builds preserve the exact R8 `mapping.txt` file.
10. If signing secrets exist, CI signs and verifies the APK and AAB; otherwise it retains clearly named unsigned artifacts.
11. Artifacts are uploaded for 30 days. `main-android` also commits release files under `releases/`.
12. A `v*` tag creates a GitHub Release containing the Android artifacts, mapping, and Play Store icon.

Artifact names include the Personix version, for example:

```text
releases/personix-1-0-0.apk
releases/personix-1-0-0.aab
releases/personix-1-0-0-mapping.txt
```

Unsigned fallbacks add `-unsigned` before the file extension. Normal branches produce a `-debug.apk`.

## Local Android workflow

From WSL/Linux, ensure the Android SDK, Java 21, OpenSSL, and a supported Node version are available. First setup:

```bash
npm install
npm run android:add
npm run android:sync
```

Open the generated project from an environment with Android Studio:

```bash
npm run android:open
```

After the Android project exists, `npm run android:sync` rebuilds Angular, synchronizes Capacitor, and reapplies the idempotent native patch. Run it whenever web code, Capacitor configuration, or `scripts/patch-android.mjs` changes.

## Storage and native integrations

- Android stores module-specific tables in the local SQLite `personix` database; the browser build uses IndexedDB.
- Encrypted backups use Android's Storage Access Framework. The native Create Document picker lets
  the user choose the destination, and success is reported only after Android writes the complete
  `.pxbackup` file. No broad storage permission is required.
- Camera supports optional user-selected attachments.
- Android metadata fetching runs on-device only when enabled and synchronizes missing previews without asking users to enter OG fields.
- Application PIN verification remains local. Android biometric secrets use the Android Keystore.
- Android activity PiP and browser Document PiP are patched from the same content preview flow.
- Runtime permissions are requested only from a user-initiated feature that needs them.

## Versioning

`android-version.json` is the release source of truth:

```bash
npm run android:version
npm run android:version:patch
npm run android:version:minor
npm run android:version:major
```

The plain command increments only `versionCode`; patch/minor/major commands also update `versionName`. Builds on `main-android` automatically increment and commit `versionCode` before building.

## Trigger the workflow

Push `main-android`, push a `v*` tag, or use **Actions → Personix Android APK and AAB → Run workflow**.

```bash
git checkout main-android
git merge main
git push origin main-android
```

## SDK versions

```yaml
MIN_SDK_VERSION: 24
TARGET_SDK_VERSION: 36
```

Raise the target when Google Play requirements change and verify Capacitor compatibility before merging.
