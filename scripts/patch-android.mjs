import { access, copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const configPath = resolve('android/app/src/main/assets/capacitor.config.json');
const config = JSON.parse(await readFile(configPath, 'utf8'));
const appId = config.appId;
if (typeof appId !== 'string' || !appId.trim())
  throw new Error(`Android appId is missing from ${configPath}.`);

const exists = async (path) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};
const javaPath = resolve('android/app/src/main/java', ...appId.split('.'), 'MainActivity.java');
const postActivityPath = resolve(
  'android/app/src/main/java',
  ...appId.split('.'),
  'PersonixPostActivity.java',
);
const manifestPath = resolve('android/app/src/main/AndroidManifest.xml');
const gradlePath = resolve('android/app/build.gradle');
const proguardPath = resolve('android/app/proguard-rules.pro');
const resPath = resolve('android/app/src/main/res');
const logoSource = resolve('public/personix.png');
const logoTarget = resolve(resPath, 'drawable-nodpi/personix_splash_logo.png');
const splashIcon = resolve(resPath, 'drawable/personix_splash_icon.xml');
const splashDrawable = resolve(resPath, 'drawable/splash.xml');

await access(javaPath).catch(() => {
  throw new Error(`Android project not found. Run "npm run android:add" first.`);
});

let manifest = await readFile(manifestPath, 'utf8');
for (const permission of [
  'android.permission.USE_BIOMETRIC',
  'android.permission.USE_FINGERPRINT',
]) {
  if (!manifest.includes(permission))
    manifest = manifest.replace(
      /(<manifest[^>]*>)/,
      `$1\n    <uses-permission android:name="${permission}" />`,
    );
}
manifest = manifest.replace(
  /<activity\b(?=[^>]*android:name="\.MainActivity")[^>]*>/,
  (activity) => {
    let patched = activity.includes('android:theme=')
      ? activity.replace(
          /android:theme="[^"]*"/,
          'android:theme="@style/AppTheme.NoActionBarLaunch"',
        )
      : activity.replace(/>$/, '\n            android:theme="@style/AppTheme.NoActionBarLaunch">');
    if (!patched.includes('android:supportsPictureInPicture='))
      patched = patched.replace(/>$/, '\n            android:supportsPictureInPicture="true">');
    if (!patched.includes('android:resizeableActivity='))
      patched = patched.replace(/>$/, '\n            android:resizeableActivity="true">');
    return patched;
  },
);
if (!manifest.includes('android:name=".PersonixPostActivity"'))
  manifest = manifest.replace(
    '</application>',
    `        <activity
            android:name=".PersonixPostActivity"
            android:exported="false"
            android:theme="@style/AppTheme.NoActionBar" />
    </application>`,
  );
await writeFile(manifestPath, manifest, 'utf8');

let gradle = await readFile(gradlePath, 'utf8');
gradle = gradle
  .replace(/minifyEnabled\s+false/, 'minifyEnabled true')
  .replace(
    /getDefaultProguardFile\(['"]proguard-android\.txt['"]\)/g,
    "getDefaultProguardFile('proguard-android-optimize.txt')",
  );
if (!gradle.includes('shrinkResources true'))
  gradle = gradle.replace(
    /minifyEnabled\s+true/,
    'minifyEnabled true\n            shrinkResources true',
  );
if (!gradle.includes('androidx.biometric:biometric'))
  gradle = gradle.replace(
    /dependencies\s*\{/,
    "dependencies {\n    implementation 'androidx.biometric:biometric:1.1.0'",
  );
await writeFile(gradlePath, gradle, 'utf8');
if (!/minifyEnabled\s+true/.test(gradle) || !gradle.includes('shrinkResources true'))
  throw new Error('Could not enable R8 resource shrinking.');

let proguard = (await exists(proguardPath)) ? await readFile(proguardPath, 'utf8') : '';
const rules = `
# Personix native bridges are invoked by name from the Angular WebView.
-keepclassmembers class * { @android.webkit.JavascriptInterface <methods>; }
-dontwarn javax.annotation.Nullable
-dontwarn javax.annotation.concurrent.GuardedBy
-dontwarn com.google.errorprone.annotations.**
`;
if (!proguard.includes('@android.webkit.JavascriptInterface <methods>'))
  proguard = `${proguard.trimEnd()}\n${rules}`;
await writeFile(proguardPath, `${proguard.trimEnd()}\n`, 'utf8');

for (const directory of await readdir(resPath)) {
  if (!directory.startsWith('drawable')) continue;
  for (const name of ['splash.png', ...(directory === 'drawable' ? [] : ['splash.xml'])]) {
    const file = resolve(resPath, directory, name);
    if (await exists(file)) await rm(file);
  }
}
await mkdir(dirname(logoTarget), { recursive: true });
await copyFile(logoSource, logoTarget);
await writeFile(
  splashIcon,
  `<?xml version="1.0" encoding="utf-8"?>
<inset xmlns:android="http://schemas.android.com/apk/res/android" android:drawable="@drawable/personix_splash_logo" android:inset="22%" />\n`,
  'utf8',
);
await writeFile(
  splashDrawable,
  `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
  <item><shape android:shape="rectangle"><solid android:color="#07140F" /></shape></item>
  <item android:gravity="center"><inset android:drawable="@drawable/personix_splash_icon" android:inset="34%" /></item>
</layer-list>\n`,
  'utf8',
);

const writeTheme = async (path, dark) => {
  await mkdir(dirname(path), { recursive: true });
  let xml = (await exists(path))
    ? await readFile(path, 'utf8')
    : '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n</resources>\n';
  xml = xml
    .replace(/\s*<style name="AppTheme\.NoActionBar"[\s\S]*?<\/style>/g, '')
    .replace(/\s*<style name="AppTheme\.NoActionBarLaunch"[\s\S]*?<\/style>/g, '');
  const background = dark ? '#07140F' : '#F3F8F5';
  const lightIcons = dark ? 'false' : 'true';
  const themes = `
  <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
    <item name="android:statusBarColor">${background}</item><item name="android:navigationBarColor">${background}</item>
    <item name="android:windowLightStatusBar">${lightIcons}</item><item name="android:windowLightNavigationBar">${lightIcons}</item>
  </style>
  <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
    <item name="windowSplashScreenBackground">#07140F</item><item name="windowSplashScreenAnimatedIcon">@drawable/personix_splash_icon</item>
    <item name="windowSplashScreenIconBackgroundColor">@android:color/transparent</item><item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
    <item name="android:statusBarColor">#07140F</item><item name="android:navigationBarColor">#07140F</item>
    <item name="android:windowLightStatusBar">false</item><item name="android:windowLightNavigationBar">false</item>
  </style>`;
  await writeFile(path, xml.replace('</resources>', `${themes}\n</resources>`), 'utf8');
};
await writeTheme(resolve(resPath, 'values/styles.xml'), false);
await writeTheme(resolve(resPath, 'values-night/styles.xml'), true);

const java = `package ${appId};

import android.app.PictureInPictureParams;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.util.Rational;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsetsController;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.webkit.JavascriptInterface;

import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.concurrent.Executor;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

public class MainActivity extends BridgeActivity {
  private static final String KEY_ALIAS = "personix_biometric_key";
  private static final String SECURITY_PREFS = "personix_security";
  private final Handler mainHandler = new Handler(Looper.getMainLooper());
  private final ExecutorService networkExecutor = Executors.newSingleThreadExecutor();
  private BiometricPrompt biometricPrompt;
  private boolean darkMode;
  private View launchOverlay;
  private long overlayShownAt;

  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    darkMode = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
    showLaunchOverlay();
    getBridge().getWebView().addJavascriptInterface(new NativeBridge(), "PersonixNative");
    getBridge().getWebView().addJavascriptInterface(new SystemBarsBridge(), "PersonixSystemBars");
    getBridge().getWebView().addJavascriptInterface(new BiometricBridge(), "PersonixBiometric");
    getBridge().getWebView().addJavascriptInterface(new MetadataBridge(), "PersonixMetadata");
    getBridge().getWebView().addJavascriptInterface(new PipBridge(), "PersonixPip");
    getBridge().getWebView().addJavascriptInterface(new BrowserBridge(), "PersonixBrowser");
    getBridge().getWebView().setBackgroundColor(Color.parseColor(darkMode ? "#07140F" : "#F3F8F5"));
    applyLaunchBars();
  }

  @Override public void onResume() { super.onResume(); if (launchOverlay == null) applySystemBars(darkMode); }
  @Override public void onPictureInPictureModeChanged(boolean active, Configuration configuration) { super.onPictureInPictureModeChanged(active, configuration); dispatch("pip-mode", true, active ? "true" : "false", ""); }
  @Override public void onWindowFocusChanged(boolean focus) { super.onWindowFocusChanged(focus); if (focus && launchOverlay == null) applySystemBars(darkMode); }
  @Override public void onDestroy() { if (biometricPrompt != null) biometricPrompt.cancelAuthentication(); networkExecutor.shutdownNow(); mainHandler.removeCallbacksAndMessages(null); super.onDestroy(); }

  public class NativeBridge { @JavascriptInterface public void hideSplash() { runOnUiThread(() -> hideLaunchOverlay()); } }
  public class SystemBarsBridge { @JavascriptInterface public void setDarkMode(boolean value) { darkMode = value; runOnUiThread(() -> applySystemBars(value)); } }
  public class PipBridge {
    @JavascriptInterface public boolean isSupported() { return Build.VERSION.SDK_INT >= Build.VERSION_CODES.O; }
    @JavascriptInterface public void enter(int width, int height) { if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return; runOnUiThread(() -> { PictureInPictureParams params = new PictureInPictureParams.Builder().setAspectRatio(new Rational(Math.max(1, width), Math.max(1, height))).build(); enterPictureInPictureMode(params); }); }
  }

  public class BrowserBridge {
    @JavascriptInterface public void openInApp(String rawUrl, String title) { runOnUiThread(() -> {
      try {
        Uri uri = requireWebUri(rawUrl); Intent intent = new Intent(MainActivity.this, PersonixPostActivity.class);
        intent.putExtra(PersonixPostActivity.EXTRA_URL, uri.toString()); intent.putExtra(PersonixPostActivity.EXTRA_TITLE, title == null ? "" : title); startActivity(intent);
      } catch (Exception ignored) { openWebUri(rawUrl); }
    }); }
    @JavascriptInterface public void openExternal(String rawUrl) { runOnUiThread(() -> openWebUri(rawUrl)); }
  }

  public class BiometricBridge {
    @JavascriptInterface public boolean isAvailable() { return BiometricManager.from(MainActivity.this).canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) == BiometricManager.BIOMETRIC_SUCCESS; }
    @JavascriptInterface public void enable(String secret) { runOnUiThread(() -> {
      try {
        byte[] plaintext = secret.getBytes(StandardCharsets.UTF_8); Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, createBiometricKey());
        showBiometricPrompt("Enable Personix biometric unlock", cipher, () -> {
          try { byte[] encrypted = cipher.doFinal(plaintext); getSharedPreferences(SECURITY_PREFS, MODE_PRIVATE).edit().putString("secret", Base64.encodeToString(encrypted, Base64.NO_WRAP)).putString("iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP)).apply(); java.util.Arrays.fill(plaintext, (byte) 0); dispatch("biometric-enabled", true, "", ""); }
          catch (Exception error) { dispatch("biometric-enabled", false, "", message(error)); }
        }, "biometric-enabled");
      } catch (Exception error) { dispatch("biometric-enabled", false, "", message(error)); }
    }); }
    @JavascriptInterface public void authenticate() { runOnUiThread(() -> {
      try {
        String wrapped = getSharedPreferences(SECURITY_PREFS, MODE_PRIVATE).getString("secret", null); String iv = getSharedPreferences(SECURITY_PREFS, MODE_PRIVATE).getString("iv", null);
        if (wrapped == null || iv == null) throw new IllegalStateException("Biometric unlock is not configured.");
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null); SecretKey key = (SecretKey) store.getKey(KEY_ALIAS, null);
        if (key == null) throw new IllegalStateException("Enable biometric unlock again.");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, Base64.decode(iv, Base64.DEFAULT)));
        showBiometricPrompt("Unlock Personix", cipher, () -> {
          try { byte[] raw = cipher.doFinal(Base64.decode(wrapped, Base64.DEFAULT)); String secret = new String(raw, StandardCharsets.UTF_8); java.util.Arrays.fill(raw, (byte) 0); dispatch("biometric-unlock", true, secret, ""); }
          catch (Exception error) { dispatch("biometric-unlock", false, "", message(error)); }
        }, "biometric-unlock");
      } catch (Exception error) { dispatch("biometric-unlock", false, "", message(error)); }
    }); }
    @JavascriptInterface public void disable() { try { getSharedPreferences(SECURITY_PREFS, MODE_PRIVATE).edit().clear().apply(); KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null); if (store.containsAlias(KEY_ALIAS)) store.deleteEntry(KEY_ALIAS); } catch (Exception ignored) { } }
  }

  public class MetadataBridge {
    @JavascriptInterface public void fetch(String rawUrl, int timeoutMs, int maxImageBytes) {
      networkExecutor.execute(() -> {
        HttpURLConnection connection = null;
        try {
          URL url = new URL(rawUrl); String protocol = url.getProtocol();
          if (!"https".equals(protocol) && !"http".equals(protocol)) throw new IllegalArgumentException("Only HTTP and HTTPS URLs are supported.");
          connection = (HttpURLConnection) url.openConnection(); connection.setConnectTimeout(Math.max(1000, timeoutMs)); connection.setReadTimeout(Math.max(1000, timeoutMs));
          connection.setInstanceFollowRedirects(true); connection.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36 Personix/1.0"); connection.setRequestProperty("Accept", "text/html,application/xhtml+xml"); connection.setRequestProperty("Accept-Language", "en-US,en;q=0.9"); connection.setRequestProperty("Accept-Encoding", "identity");
          int status = connection.getResponseCode(); if (status < 200 || status >= 400) throw new IllegalStateException("Website returned " + status + ".");
          String contentType = connection.getContentType(); if (contentType != null && !contentType.toLowerCase().contains("text/html")) throw new IllegalStateException("The URL did not return an HTML page.");
          int maxHtml = 1024 * 1024; byte[] bytes = readLimited(connection.getInputStream(), maxHtml); String html = new String(bytes, StandardCharsets.UTF_8);
          JSONObject result = new JSONObject(); result.put("title", first(meta(html, "og:title"), first(meta(html, "twitter:title"), title(html)))); result.put("description", first(meta(html, "og:description"), first(meta(html, "twitter:description"), meta(html, "description"))));
          URL resolvedUrl = connection.getURL(); result.put("image", resolveUrl(resolvedUrl, first(meta(html, "og:image"), meta(html, "twitter:image")))); result.put("siteName", meta(html, "og:site_name")); result.put("url", resolvedUrl.toString());
          result.put("logo", resolveUrl(url, icon(html))); result.put("maxImageBytes", maxImageBytes);
          dispatch("metadata-fetch", true, result.toString(), "");
        } catch (Exception error) { dispatch("metadata-fetch", false, "", message(error)); }
        finally { if (connection != null) connection.disconnect(); }
      });
    }
  }

  private byte[] readLimited(InputStream input, int maximum) throws Exception {
    try (InputStream source = input; ByteArrayOutputStream output = new ByteArrayOutputStream()) { byte[] buffer = new byte[8192]; int count; int total = 0; while ((count = source.read(buffer)) != -1 && total < maximum) { int allowed = Math.min(count, maximum - total); output.write(buffer, 0, allowed); total += allowed; } return output.toByteArray(); }
  }
  private String meta(String html, String property) { String quoted = Pattern.quote(property); String[] expressions = { "<meta[^>]+(?:property|name)=[\\\"']" + quoted + "[\\\"'][^>]+content=[\\\"']([^\\\"']*)[\\\"']", "<meta[^>]+content=[\\\"']([^\\\"']*)[\\\"'][^>]+(?:property|name)=[\\\"']" + quoted + "[\\\"']" }; for (String expression : expressions) { Matcher match = Pattern.compile(expression, Pattern.CASE_INSENSITIVE).matcher(html); if (match.find()) return decode(match.group(1)); } return ""; }
  private String title(String html) { Matcher match = Pattern.compile("<title[^>]*>(.*?)</title>", Pattern.CASE_INSENSITIVE | Pattern.DOTALL).matcher(html); return match.find() ? decode(match.group(1)) : ""; }
  private String icon(String html) { Matcher match = Pattern.compile("<link[^>]+rel=[\\\"'][^\\\"']*icon[^\\\"']*[\\\"'][^>]+href=[\\\"']([^\\\"']+)[\\\"']", Pattern.CASE_INSENSITIVE).matcher(html); return match.find() ? decode(match.group(1)) : ""; }
  private String decode(String value) { return value.replace("&amp;", "&").replace("&quot;", "\\\"").replace("&#39;", "'").replaceAll("\\\\s+", " ").trim(); }
  private String resolveUrl(URL base, String value) { if (value == null || value.isEmpty()) return ""; try { return new URL(base, value).toString(); } catch (Exception ignored) { return ""; } }
  private String first(String left, String right) { return left == null || left.isEmpty() ? right : left; }
  private Uri requireWebUri(String rawUrl) { Uri uri = Uri.parse(rawUrl); String scheme = uri.getScheme(); if (!"https".equalsIgnoreCase(scheme) && !"http".equalsIgnoreCase(scheme)) throw new IllegalArgumentException("Only web URLs can be opened."); return uri; }
  private void openWebUri(String rawUrl) { try { startActivity(new Intent(Intent.ACTION_VIEW, requireWebUri(rawUrl))); } catch (Exception ignored) { } }

  private SecretKey createBiometricKey() throws Exception {
    KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
    KeyGenParameterSpec.Builder builder = new KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setUserAuthenticationRequired(true).setInvalidatedByBiometricEnrollment(true);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) builder.setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG); else builder.setUserAuthenticationValidityDurationSeconds(-1);
    generator.init(builder.build()); return generator.generateKey();
  }
  private void showBiometricPrompt(String title, Cipher cipher, Runnable success, String action) {
    if (biometricPrompt != null) { dispatch(action, false, "", "Biometric authentication is already active."); return; }
    Executor executor = ContextCompat.getMainExecutor(this);
    biometricPrompt = new BiometricPrompt(this, executor, new BiometricPrompt.AuthenticationCallback() {
      @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) { biometricPrompt = null; success.run(); }
      @Override public void onAuthenticationError(int code, CharSequence text) { biometricPrompt = null; dispatch(action, false, "", text.toString()); }
    });
    BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder().setTitle(title).setSubtitle("Confirm your identity on this device").setNegativeButtonText("Cancel").setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG).build();
    biometricPrompt.authenticate(info, new BiometricPrompt.CryptoObject(cipher));
  }

  private void showLaunchOverlay() { FrameLayout overlay = new FrameLayout(this); overlay.setBackgroundColor(Color.parseColor("#07140F")); ImageView icon = new ImageView(this); icon.setImageResource(R.drawable.personix_splash_logo); icon.setScaleType(ImageView.ScaleType.FIT_CENTER); FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(dp(148), dp(148)); params.gravity = Gravity.CENTER; overlay.addView(icon, params); addContentView(overlay, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)); launchOverlay = overlay; overlayShownAt = System.currentTimeMillis(); }
  private void hideLaunchOverlay() { View overlay = launchOverlay; if (overlay == null) return; long wait = Math.max(0L, 900L - (System.currentTimeMillis() - overlayShownAt)); if (wait > 0) { mainHandler.postDelayed(this::hideLaunchOverlay, wait); return; } launchOverlay = null; overlay.animate().alpha(0f).setDuration(180).withEndAction(() -> { if (overlay.getParent() instanceof ViewGroup) ((ViewGroup) overlay.getParent()).removeView(overlay); applySystemBars(darkMode); }).start(); }
  private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }

  private void dispatch(String action, boolean success, String data, String error) { runOnUiThread(() -> { if (isFinishing() || getBridge() == null) return; String script = "window.dispatchEvent(new CustomEvent('personix-native-result',{detail:{action:" + JSONObject.quote(action) + ",success:" + success + ",data:" + JSONObject.quote(data == null ? "" : data) + ",message:" + JSONObject.quote(error == null ? "" : error) + "}}));"; getBridge().getWebView().evaluateJavascript(script, null); }); }
  private String message(Exception error) { return error.getMessage() == null ? "Android request failed." : error.getMessage(); }

  @SuppressWarnings("deprecation") private void applySystemBars(boolean dark) {
    Window window = getWindow(); int background = Color.parseColor(dark ? "#07140F" : "#F3F8F5"); window.setStatusBarColor(background); window.setNavigationBarColor(background); window.getDecorView().setBackgroundColor(background); getBridge().getWebView().setBackgroundColor(background);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) { window.setStatusBarContrastEnforced(false); window.setNavigationBarContrastEnforced(false); }
    View decor = window.getDecorView(); if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) { WindowInsetsController controller = decor.getWindowInsetsController(); if (controller != null) controller.setSystemBarsAppearance(dark ? 0 : WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS, WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS); return; }
    int flags = decor.getSystemUiVisibility(); flags = dark ? flags & ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR : flags | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR; if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) flags = dark ? flags & ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR : flags | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR; decor.setSystemUiVisibility(flags);
  }
  @SuppressWarnings("deprecation") private void applyLaunchBars() { Window window = getWindow(); int color = Color.parseColor("#07140F"); window.setStatusBarColor(color); window.setNavigationBarColor(color); }
}
`;

await writeFile(javaPath, java, 'utf8');
const postActivityJava = `package ${appId};

import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

public class PersonixPostActivity extends AppCompatActivity {
  public static final String EXTRA_URL = "personix.url";
  public static final String EXTRA_TITLE = "personix.title";
  private WebView webView;
  private String sourceUrl;

  @Override protected void onCreate(Bundle state) {
    super.onCreate(state);
    sourceUrl = getIntent().getStringExtra(EXTRA_URL);
    if (!isWebUrl(sourceUrl)) { finish(); return; }
    boolean dark = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
    int background = Color.parseColor(dark ? "#07140F" : "#F3F8F5");
    int foreground = Color.parseColor(dark ? "#F4FBF7" : "#0A2118");
    getWindow().setStatusBarColor(background); getWindow().setNavigationBarColor(background);

    LinearLayout root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setBackgroundColor(background);
    LinearLayout toolbar = new LinearLayout(this); toolbar.setGravity(Gravity.CENTER_VERTICAL); toolbar.setPadding(dp(8), dp(6), dp(8), dp(6)); toolbar.setBackgroundColor(background);
    Button close = toolbarButton("Close", foreground); close.setContentDescription("Close in-app post viewer"); close.setOnClickListener(view -> finish()); toolbar.addView(close);
    LinearLayout labels = new LinearLayout(this); labels.setOrientation(LinearLayout.VERTICAL); labels.setPadding(dp(8), 0, dp(8), 0);
    TextView title = new TextView(this); title.setTextColor(foreground); title.setTextSize(16); title.setMaxLines(1); title.setText(getIntent().getStringExtra(EXTRA_TITLE)); labels.addView(title);
    TextView domain = new TextView(this); domain.setTextColor(Color.parseColor(dark ? "#A8C0B5" : "#5F756B")); domain.setTextSize(12); domain.setMaxLines(1); domain.setText(Uri.parse(sourceUrl).getHost()); labels.addView(domain);
    toolbar.addView(labels, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
    Button browser = toolbarButton("Browser", foreground); browser.setContentDescription("Open post in browser"); browser.setOnClickListener(view -> openExternal(sourceUrl)); toolbar.addView(browser);
    root.addView(toolbar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

    webView = new WebView(this); webView.setBackgroundColor(background);
    WebSettings settings = webView.getSettings(); settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true); settings.setMediaPlaybackRequiresUserGesture(true); settings.setLoadWithOverviewMode(true); settings.setUseWideViewPort(true); settings.setSupportMultipleWindows(false);
    webView.setWebChromeClient(new WebChromeClient() { @Override public void onReceivedTitle(WebView view, String pageTitle) { if (pageTitle != null && !pageTitle.isEmpty()) title.setText(pageTitle); } });
    webView.setWebViewClient(new WebViewClient() {
      @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return handleNavigation(request.getUrl()); }
      @SuppressWarnings("deprecation") @Override public boolean shouldOverrideUrlLoading(WebView view, String url) { return handleNavigation(Uri.parse(url)); }
    });
    root.addView(webView, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1)); setContentView(root); webView.loadUrl(sourceUrl);
  }

  private Button toolbarButton(String text, int colour) { Button button = new Button(this); button.setAllCaps(false); button.setText(text); button.setTextColor(colour); button.setBackgroundColor(Color.TRANSPARENT); button.setMinWidth(0); button.setMinimumWidth(0); return button; }
  private boolean handleNavigation(Uri uri) { String scheme = uri.getScheme(); if ("https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme)) return false; try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) { } return true; }
  private void openExternal(String url) { try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception ignored) { } }
  private boolean isWebUrl(String url) { if (url == null) return false; String scheme = Uri.parse(url).getScheme(); return "https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme); }
  private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
  @Override public void onBackPressed() { if (webView != null && webView.canGoBack()) webView.goBack(); else super.onBackPressed(); }
  @Override protected void onDestroy() { if (webView != null) { webView.stopLoading(); webView.loadUrl("about:blank"); webView.clearHistory(); webView.removeAllViews(); webView.destroy(); webView = null; } super.onDestroy(); }
}
`;
await writeFile(postActivityPath, postActivityJava, 'utf8');
console.log(
  'Applied Personix branded splash, system bars, Keystore biometrics, direct metadata, in-app post browser, picture-in-picture and R8 patches.',
);
