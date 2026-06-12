    package lk.suraksha.lms;

import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NavigationBarPlugin.class);
        super.onCreate(savedInstanceState);

        if (getBridge() != null && getBridge().getWebView() != null) {
            // Remove only expired entries — hashed immutable bundles in the local
            // bundle are served from capacitor://localhost and stay cached indefinitely.
            // clearCache(true) would wipe them on every launch and force a slow re-parse.
            getBridge().getWebView().clearCache(false);

            WebSettings settings = getBridge().getWebView().getSettings();
            settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        }
    }

}
