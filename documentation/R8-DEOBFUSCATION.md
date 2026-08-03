# R8 optimisation and deobfuscation

`scripts/patch-android.mjs` enables `minifyEnabled true`, `shrinkResources true` and `proguard-android-optimize.txt` for release builds. Obfuscation is an optimisation, not an encryption or privacy boundary.

Personix native bridge methods are invoked from the WebView by name, so the generated ProGuard rules keep members annotated with `@android.webkit.JavascriptInterface`. Narrow `dontwarn` rules cover annotation-only references used by native cryptography/database dependencies.

Every release build creates:

```text
android/app/build/outputs/mapping/release/mapping.txt
```

CI requires that file and preserves it as:

```text
releases/personix-<version>-mapping.txt
```

Use only the mapping created for the exact published `versionCode`. In Google Play Console, open the matching version in App Bundle Explorer and upload this file as the ReTrace/deobfuscation mapping if Play has not associated the mapping embedded in the AAB. Retain mappings for every supported release.
