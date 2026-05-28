/**
 * Initialisation native pour Capacitor (Android/iOS).
 * Sur le web, c'est un no-op silencieux.
 */
import { Capacitor } from "@capacitor/core";

export const isNative = () => Capacitor.isNativePlatform();

export async function initMobile() {
  if (!isNative()) return;

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#1a0b2e" }).catch(() => {});
  } catch (e) {
    console.warn("[mobile] StatusBar init failed", e);
  }

  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch (e) {
    console.warn("[mobile] SplashScreen hide failed", e);
  }
}
