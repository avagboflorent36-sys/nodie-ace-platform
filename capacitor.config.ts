import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.nodieaiacademy",
  appName: "Nodie IA Academy",
  webDir: "dist",
  // Hot-reload depuis le preview Lovable pendant le développement.
  // Pour un build de production autonome (hors-ligne), commentez ce bloc
  // puis lancez `npm run build && npx cap sync`.
  server: {
    url: "https://id-preview--66439da9-0337-4213-a275-40cffeef22c6.lovable.app",
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#1a0b2e",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#1a0b2e",
      overlaysWebView: false,
    },
  },
};

export default config;
