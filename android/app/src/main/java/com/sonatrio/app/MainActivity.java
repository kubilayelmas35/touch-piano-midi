package com.sonatrio.app;

import android.graphics.Color;
import android.graphics.Rect;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

import java.util.Arrays;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Practising with both hands on the screen: never dim or lock while the app is open.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        fillCutout();
        // Shown behind the system bars while a swipe brings them back.
        getWindow().getDecorView().setBackgroundColor(Color.rgb(0x0a, 0x0d, 0x1f));
        WebView web = getBridge().getWebView();
        WebSettings settings = web.getSettings();
        // Samples start on the first tap; no extra gesture needed for audio.
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setTextZoom(100);
        web.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        web.addOnLayoutChangeListener((v, l, t, r, b, ol, ot, or, ob) -> keepEdgesForKeys(v));
        immersive();
    }

    @Override
    public void onResume() {
        super.onResume();
        immersive();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) immersive();
    }

    /**
     * The keys sit at the bottom: a finger sliding off them sideways must not trigger the back gesture.
     * Android allows at most 200dp per edge; the home swipe can't be excluded, immersive mode makes it need two swipes.
     */
    private void keepEdgesForKeys(View v) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return;
        float dp = getResources().getDisplayMetrics().density;
        int w = v.getWidth();
        int h = v.getHeight();
        int edge = Math.round(40 * dp);
        int tall = Math.min(h, Math.round(200 * dp));
        v.setSystemGestureExclusionRects(Arrays.asList(
            new Rect(0, h - tall, edge, h),
            new Rect(w - edge, h - tall, w, h)));
    }

    /** Hide status and navigation bars; a swipe from the edge shows them briefly. */
    private void immersive() {
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        c.hide(WindowInsetsCompat.Type.systemBars());
    }

    /**
     * Draw the page edge to edge, camera cutout included, with no safe-area padding (SystemBars insetsHandling is
     * "disable"). Only the keyboard still pushes the page up.
     */
    private void fillCutout() {
        WindowManager.LayoutParams attrs = getWindow().getAttributes();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            attrs.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS;
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            attrs.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
        getWindow().setAttributes(attrs);

        ViewCompat.setOnApplyWindowInsetsListener(getWindow().getDecorView(), (v, insets) -> {
            boolean keyboard = insets.isVisible(WindowInsetsCompat.Type.ime());
            // The SystemBars plugin shows the bars once it loads (after onCreate); without the navigation bar
            // hidden, a single swipe from the bottom leaves the app.
            if (!keyboard && insets.isVisible(WindowInsetsCompat.Type.navigationBars())) v.post(this::immersive);
            v.setPadding(0, 0, 0, keyboard ? insets.getInsets(WindowInsetsCompat.Type.ime()).bottom : 0);
            return new WindowInsetsCompat.Builder(insets)
                .setInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout(), Insets.NONE)
                .setDisplayCutout(null)
                .build();
        });
    }
}
