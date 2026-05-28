
## Diagnostic

Le symptôme « les pages disparaissent et réapparaissent » est causé par des **re-renders en boucle** déclenchés par 3 problèmes structurels, pas par un bug isolé d'une page :

### 1. `AuthProvider` réinitialise l'état à chaque event Supabase
Dans `src/hooks/useAuth.tsx`, l'event `onAuthStateChange` se déclenche aussi sur `TOKEN_REFRESHED`, `INITIAL_SESSION`, focus d'onglet, etc. Chaque appel fait :
- `setSession(newSession)` même si le token est identique → nouvelle référence d'objet → tous les consommateurs `useAuth()` re-rendent
- `setRolesLoaded(false)` puis re-fetch des rôles → les gardes basés sur `rolesLoaded` (ex: admin/étudiant) **démontent leur contenu** pendant le re-fetch → page blanche → réapparition. C'est exactement le « disparaît et réapparaît ».

### 2. `_authenticated` AuthGate dépend de `loading` mais pas de `rolesLoaded`
`AuthGate` rend `<Outlet />` dès que `loading` est false. Les pages enfants (admin/étudiant) ont leur propre garde sur `isAdmin`/`isStudent` qui est `false` pendant le re-fetch des rôles → redirection ou écran vide transitoire → flash.

### 3. `useServerFn` refs dans les deps de `useEffect`
Dans `inscription.$slug.tsx` (PostPaymentStep) et `etudiant/paiements.tsx`, les fonctions retournées par `useServerFn` sont passées dans les `deps` de `useEffect`. Si la ref change à chaque render, l'effet de polling **redémarre en boucle** → setStates → re-render → nouveau poll.

---

## Plan de correction

### A. `src/hooks/useAuth.tsx` — éviter les re-renders inutiles
1. Comparer `newSession?.access_token` au token courant avant `setSession`. Pas de setState si identique.
2. Ne re-fetcher les rôles que si **l'user id change**, pas à chaque refresh de token. Garder l'ancienne liste de rôles affichée pendant un éventuel refresh (pas de `setRolesLoaded(false)`).
3. Ajouter un flag `initialized` pour distinguer le tout premier chargement des events suivants.

### B. `src/routes/_authenticated.tsx` — garde plus stricte
- Attendre `rolesLoaded` avant de rendre `<Outlet />` (même écran de chargement). Évite que les sous-routes voient un état « connecté sans rôle » transitoire.

### C. Stabiliser les effets de polling paiement
- `src/routes/inscription.$slug.tsx` (PostPaymentStep) : retirer `fetchStatus` / `checkAttempt` des deps du `useEffect` (ils ne changent pas la logique) et n'y garder que `[saleId, attemptToken, hasRemoteCheck]`. Idem pour tout `useEffect` similaire.
- `src/routes/_authenticated/etudiant/paiements.tsx` : vérifier qu'aucun `useEffect` ne dépend d'un `useServerFn` non stabilisé.

### D. Fiabilité du formulaire d'inscription (`inscription.$slug.tsx`)
1. **Validation Zod** centralisée pour les champs Étape 1 (firstName/lastName ≥ 2 et ≤ 100, email valide, phone regex international `^\+?[0-9 ]{6,20}$`). Messages d'erreur sous chaque champ au lieu d'un toast unique.
2. **Idempotence** du clic « Payer » : désactiver le bouton dès le premier clic (déjà partiellement fait via `loading`), mais **garder désactivé** même en cas d'erreur réseau pendant 2s pour éviter la double création de sale Chariow.
3. **Trim + normalisation** systématique (email lowercase, phone sans espaces) côté client + côté serverFn (déjà partiellement présent dans `startChariowCheckout` — à vérifier et compléter).
4. **Gestion explicite de l'erreur réseau** : try/catch autour de `startCheckout` qui affiche un message dédié si `fetch` échoue (offline / timeout) plutôt qu'un toast générique.
5. **Validation Étape 2** (post-paiement) : mot de passe ≥ 8 caractères + au moins 1 chiffre, country obligatoire, réponses aux `form_fields.required` vérifiées.

### E. Boundary global anti-flash
- Dans `__root.tsx`, conserver `ErrorComponent` mais ajouter une vérification : ne pas démonter le `QueryClientProvider` lors d'un re-render du root. Vérifier que `QueryClient` est bien instancié dans `getRouter()` (déjà le cas d'après la doc).

### F. Audit ciblé des autres zones citées
- `etudiant/formation`, `etudiant/ressources`, `etudiant/paiements` : repérer tout `useEffect([...serverFn])` ou tout `useState` initialisé depuis `useAuth()` qui causerait un démontage.
- `admin/cohortes.$id`, `admin/etudiants`, `admin/paiements` : même audit + s'assurer que les `Route.loader` n'appellent pas de serverFn protégée sur des routes publiques (déjà documenté dans les knowledge files).
- Login/Signup/Reset : vérifier que `signUp` / `signIn` ne déclenchent pas une navigation **avant** que `onAuthStateChange` ait propagé l'état (sinon flash login → home → login). Si besoin, naviguer dans le callback `onAuthStateChange` plutôt que juste après l'appel.

---

## Fichiers modifiés

- `src/hooks/useAuth.tsx`
- `src/routes/_authenticated.tsx`
- `src/routes/inscription.$slug.tsx`
- `src/routes/_authenticated/etudiant/paiements.tsx` (vérif effets)
- `src/routes/_authenticated/etudiant/formation.tsx` (vérif effets)
- `src/routes/login.tsx`, `src/routes/signup.tsx` (navigation post-auth si nécessaire)

Aucune migration DB nécessaire. Aucun changement fonctionnel visible — purement stabilité et fiabilité.

---

## Validation après implémentation

1. Recharger `/inscription/<slug>` plusieurs fois → plus de flash.
2. Naviguer entre `/admin/cohortes` et `/admin/etudiants` rapidement → pas de page blanche transitoire.
3. Remplir le formulaire avec champs invalides → erreurs affichées sous chaque champ.
4. Cliquer 3× rapidement sur « Payer » → un seul appel `startChariowCheckout`.
5. Laisser un onglet ouvert 1h (token refresh Supabase) → la page ne se recharge pas / ne flash pas.
