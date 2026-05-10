    package lk.suraksha.lms;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.content.res.Configuration;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private long lastPauseTime = 0;
    private static final long RELOAD_THRESHOLD_MS = 30 * 60 * 1000L;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NavigationBarPlugin.class);
        super.onCreate(savedInstanceState);

        if (getBridge() != null && getBridge().getWebView() != null) {
            // ── Cold-start: always wipe the entire WebView disk cache ─────────────
            // clearCache(true) deletes ALL cached resources regardless of expiry,
            // so the WebView must re-fetch index.html and every bundle from
            // lms.suraksha.lk on every fresh app open.
            //
            // Why true, not false?
            //   clearCache(false) only removes EXPIRED entries — if the CDN sent
            //   Cache-Control: max-age=300 for index.html, clearCache(false) keeps
            //   that entry alive for 5 min and the user sees stale content.
            //   clearCache(true) nukes everything unconditionally on cold start.
            //
            // Hashed JS/CSS bundles (e.g. app.a1b2c3.js immutable) are also cleared
            // here, but they are small (~100-500 KB compressed) and are immediately
            // re-cached for the rest of the session via LOAD_DEFAULT below.
            getBridge().getWebView().clearCache(true);

            // ── Use browser-default HTTP caching within the session ───────────────
            // LOAD_DEFAULT respects Cache-Control / ETag headers for all subsequent
            // navigations and asset requests within this session, so hashed bundles
            // are not re-downloaded on every click — only on the next cold start.
            WebSettings settings = getBridge().getWebView().getSettings();
            settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        // Record when the app goes to background so onResume can decide
        // whether enough time has passed to justify a full reload.
        lastPauseTime = System.currentTimeMillis();
    }

    @Override
    public void onResume() {
        super.onResume();
        if (getBridge() != null && getBridge().getWebView() != null) {
            // Remove expired cache entries (harmless; leaves valid hashed bundles intact).
            getBridge().getWebView().clearCache(false);

            // Only do a full reload when the app was in the background long enough
            // that a new frontend deployment may have happened.
            // Short resumes (camera return, OAuth redirect, notification tap, QR scan,
            // gallery picker) are intentionally skipped to preserve page state.
            if (lastPauseTime > 0
                    && (System.currentTimeMillis() - lastPauseTime) > RELOAD_THRESHOLD_MS) {
                getBridge().getWebView().reload();
            }
        }
    }
}
