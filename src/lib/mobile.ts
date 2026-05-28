/**
 * Initialisation native pour Capacitor (Android/iOS).
 * Tous les imports sont dynamiques pour éviter de toucher `window` durant le SSR.
 * Sur le web, c'est un no-op silencieux.
 */
export async function initMobile() {
  if (typeof window === "undefined") return;

  let isNative = false;
  try {
    const { Capacitor } = await import("@capacitor/core");
    isNative = Capacitor.isNativePlatform();
  } catch {
    return;
  }
  if (!isNative) return;

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
