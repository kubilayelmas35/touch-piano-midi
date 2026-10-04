import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.sonatrio.app",
  appName: "Sonatrio",
  webDir: "docs",
  backgroundColor: "#0a0d1f",
  android: {
    // Gestures on the instrument must never scroll or zoom the page.
    allowMixedContent: false,
    captureInput: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      launchAutoHide: true,
      backgroundColor: "#0a0d1f",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
  },
};

export default config;
