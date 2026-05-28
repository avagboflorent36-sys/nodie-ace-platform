# Plan : Transformer la plateforme en app mobile Android & iOS

## Décisions validées
- **App ID** : `app.nodieaiacademy`
- **App Name** : Nodie IA Academy
- **Notifications push** : plus tard (pas dans ce lot)
- **Icône** : générée à partir du logo violet "N" actuel
- **Build natif** : couvert dans le guide (options local + cloud Codemagic/EAS pour ceux sans Mac)

## Ce que je vais faire

### 1. Installer Capacitor
- `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/ios`
- `@capacitor/preferences` (stockage natif pour Supabase auth)
- `@capacitor/splash-screen`, `@capacitor/status-bar`, `@capacitor/app`

### 2. Créer `capacitor.config.ts`
- `appId: "app.nodieaiacademy"`
- `appName: "Nodie IA Academy"`
- `webDir: "dist"` (sortie Vite)
- `server.url` pointant vers le preview Lovable → hot reload sur téléphone pendant le dev
- Splash screen violet, status bar style sombre

### 3. Adapter le storage Supabase pour mobile
- Détecter le runtime Capacitor et utiliser `@capacitor/preferences` au lieu de `localStorage` pour persister la session.
- Web inchangé.

### 4. Générer l'icône d'application
- Icône carrée 1024×1024 : "N" blanc sur fond dégradé violet (cohérent avec le logo actuel)
- Sauvegardée dans `public/icon-1024.png` — sera utilisée par `npx capacitor-assets generate`

### 5. Adaptations UX mobile
- Safe-area iOS (notch / Dynamic Island) sur le header `AppShell`
- Status bar violette cohérente

### 6. Créer `MOBILE.md` à la racine
Guide complet avec :
- Étapes pour exporter le projet vers GitHub
- Commandes en local (`npm install`, `npx cap add android`, `npx cap add ios`, `npx cap sync`, `npx cap run android`)
- **Option A** : build local (Android Studio gratuit / Xcode si Mac)
- **Option B** : build cloud sans Mac via Codemagic ou EAS Build pour l'IPA iOS
- Publication Google Play (25 $ unique) + App Store (99 $/an)

## Hors scope (à faire plus tard)
- Notifications push (Firebase + APNs)
- Plugins natifs (caméra, biométrie, partage natif…)
- Splash screen / icône personnalisée raffinée

## Limitation à rappeler
Lovable ne peut pas produire les binaires `.apk` / `.ipa` finaux — cette dernière étape se fait en local ou via Codemagic/EAS (instructions complètes dans `MOBILE.md`). Tout le reste est configuré ici.
