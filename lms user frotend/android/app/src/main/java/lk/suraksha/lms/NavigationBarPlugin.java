package lk.suraksha.lms;

import android.graphics.Color;
import android.os.Build;
import android.view.View;
import android.view.Window;
import android.view.WindowInsetsController;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Tiny Capacitor plugin that sets the Android system navigation bar color
 * and icon brightness at runtime, matching the in-app dark/light theme.
 */
@CapacitorPlugin(name = "NavigationBar")
public class NavigationBarPlugin extends Plugin {

    @SuppressWarnings("deprecation") // View.SYSTEM_UI_FLAG_* deprecated in API 30; kept for API 26–29 (O–Q) fallback path
    @PluginMethod
    public void setColor(PluginCall call) {
        String color = call.getString("color", "#ffffff");
        boolean darkButtons = call.getBoolean("darkButtons", false);

        getActivity().runOnUiThread(() -> {
            Window window = getActivity().getWindow();
            try {
                window.setNavigationBarColor(Color.parseColor(color));
            } catch (IllegalArgumentException ignored) {
                // bad colour string — skip
            }

            // Set button / icon contrast (light icons on dark bg, dark icons on light bg)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                WindowInsetsController wic = window.getInsetsController();
                if (wic != null) {
                    if (darkButtons) {
                        wic.setSystemBarsAppearance(
                                WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS,
                                WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
                    } else {
                        wic.setSystemBarsAppearance(
                                0,
                                WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
                    }
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                View decorView = window.getDecorView();
                int flags = decorView.getSystemUiVisibility();
                if (darkButtons) {
                    flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                } else {
                    flags &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                }
                decorView.setSystemUiVisibility(flags);
            }
        });

        call.resolve();
    }
}
