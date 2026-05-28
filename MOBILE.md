# 📱 Nodie IA Academy — App mobile Android & iOS

Ce projet est configuré avec **Capacitor** : la même base React tourne dans un conteneur natif Android et iOS, sans réécriture.

## ✅ Déjà fait dans Lovable

- Capacitor + plugins installés (`@capacitor/core`, `android`, `ios`, `preferences`, `splash-screen`, `status-bar`, `app`)
- `capacitor.config.ts` configuré (app ID, nom, hot-reload depuis Lovable)
- Initialisation native dans l'app (`src/lib/mobile.ts`)
- Safe-area iOS/Android (notch, Dynamic Island) gérée dans `src/styles.css`
- Icône d'application générée : `public/icon-1024.png`

---

## 🚀 Étapes pour générer l'app

Lovable ne peut pas produire les binaires `.apk` / `.ipa` finaux — ces builds nécessitent **Android Studio** et **Xcode** (Apple). À faire en local :

### 1. Exporter le projet vers GitHub
Depuis Lovable : **GitHub → Connect to GitHub → Create Repository**. Puis cloner :
```bash
git clone https://github.com/<ton-user>/<ton-repo>.git
cd <ton-repo>
npm install
```

### 2. Ajouter les plateformes natives
```bash
npx cap add android
npx cap add ios          # nécessite un Mac
npx cap sync
```

### 3. Générer les icônes & splash screens depuis `public/icon-1024.png`
```bash
npm install -D @capacitor/assets
npx capacitor-assets generate --iconPath public/icon-1024.png
```

### 4. Lancer en développement (hot-reload depuis Lovable)
Le `capacitor.config.ts` pointe vers le preview Lovable → toute modification dans Lovable s'affiche **instantanément** sur ton téléphone.

**Android** (Android Studio installé) :
```bash
npx cap run android
```

**iOS** (Mac + Xcode requis) :
```bash
npx cap run ios
```

### 5. Build de production (app autonome, hors-ligne)
1. Dans `capacitor.config.ts`, **commenter le bloc `server: { url: ... }`**
2. Builder le web :
   ```bash
   npm run build
   npx cap sync
   ```
3. Ouvrir le projet natif :
   ```bash
   npx cap open android       # Android Studio
   npx cap open ios           # Xcode
   ```
4. Dans Android Studio : **Build → Generate Signed Bundle / APK**
5. Dans Xcode : **Product → Archive → Distribute App**

---

## 💻 Pas de Mac ? Build iOS dans le cloud

Pour générer l'IPA iOS sans Mac, utilise un service cloud :

### Option A : Codemagic (recommandé, gratuit jusqu'à 500 min/mois)
1. Crée un compte sur [codemagic.io](https://codemagic.io)
2. Connecte ton repo GitHub
3. Sélectionne **Capacitor → iOS**, ajoute ton compte Apple Developer
4. Lance le build → tu récupères un `.ipa` signé

### Option B : EAS Build (Expo)
Bien que pensé pour Expo, EAS Build supporte aussi les projets Capacitor via configuration custom. Voir [docs Expo EAS](https://docs.expo.dev/build/introduction/).

---

## 🏪 Publication sur les stores

### Google Play Store
- Compte développeur : **25 $ une seule fois** ([play.google.com/console](https://play.google.com/console))
- Uploader l'AAB généré (Android Studio → Build → Generate Signed Bundle)
- Délai de validation : ~24–48h

### Apple App Store
- Compte Apple Developer : **99 $/an** ([developer.apple.com](https://developer.apple.com))
- Uploader l'IPA via Xcode ou Transporter
- Délai de validation : 1–7 jours

---

## 🔄 Workflow quotidien

À chaque changement de code dans Lovable :
1. **Pendant le dev** : aucun re-build nécessaire — le hot-reload affiche les changements en direct dans l'app
2. **Pour un nouveau release** : `git pull` en local → `npm run build` → `npx cap sync` → re-build dans Android Studio/Xcode → upload aux stores

---

## 📌 Infos clés

- **App ID** : `app.nodieaiacademy` ⚠️ **définitif** une fois publié sur les stores
- **Nom** : Nodie IA Academy
- **Backend** : Lovable Cloud (HTTPS) — aucun changement, l'app mobile appelle les mêmes API
- **Auth** : Supabase, sessions persistantes via WebView localStorage (équivalent natif)

## 🔜 À ajouter plus tard (sur demande)
- 🔔 Notifications push (Firebase Android + APNs iOS)
- 📷 Plugins natifs (caméra, biométrie, partage)
- 📦 Deep links (`nodieaiacademy://`)
