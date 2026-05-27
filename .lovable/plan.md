## Problèmes identifiés

### 1. Page "Forbidden" après paiement Chariow
Dans `src/lib/chariow.functions.ts`, l'URL de redirection passée à Chariow est construite à partir de `SITE_URL`, qui par défaut pointe vers `https://project--66439da9-…lovable.app` (l'URL de production publiée). Comme le projet n'est pas encore publié, cette URL renvoie "Forbidden". Pendant les tests vous utilisez `id-preview--…lovable.app`, donc la redirection part vers le mauvais host.

### 2. Pas de redirection automatique vers `/etudiant`
Après remplissage du formulaire post-paiement dans `src/routes/inscription.$slug.tsx`, le code fait `supabase.auth.signUp(...)` puis `navigate({ to: "/login" })`. L'étudiant doit confirmer son email et se reconnecter manuellement avant d'arriver sur son espace.

---

## Plan

### Étape 1 — Utiliser l'origine du navigateur courant comme URL de retour
- Dans `src/routes/inscription.$slug.tsx` (`CheckoutStep`), récupérer `window.location.origin` et l'envoyer au server function `startChariowCheckout` dans un nouveau champ `return_origin`.
- Dans `src/lib/chariow.functions.ts` :
  - Ajouter `return_origin: z.string().url().optional()` dans le validateur de `startChariowCheckout`.
  - Construire `redirect` à partir de `data.return_origin` en priorité, puis tomber sur `SITE_URL` si absent.
- Résultat : depuis le preview, Chariow renvoie vers `id-preview--…lovable.app/inscription/{slug}?sale=…`. Depuis la production, il renverra vers l'URL publiée.

### Étape 2 — Activer la confirmation automatique de l'email
- Appeler `supabase--configure_auth` pour activer `auto-confirm email signups`. Sans cela, `supabase.auth.signUp` ne crée pas de session immédiate et l'utilisateur doit cliquer sur un lien email avant de pouvoir se connecter.
- Cela est cohérent avec le flow : le paiement a déjà validé l'email côté Chariow, on n'a pas besoin d'une seconde vérification.

### Étape 3 — Connexion + redirection automatique vers l'espace étudiant
Dans `src/routes/inscription.$slug.tsx` (`PostPaymentStep.submit`) :
1. Après `signUp` réussi, si aucune session n'est retournée (cas où auto-confirm n'est pas encore propagé), appeler `supabase.auth.signInWithPassword({ email, password })`.
2. Appeler `claimPendingEnrollment` (déjà fait) et insérer les `form_responses` (déjà fait).
3. Remplacer `navigate({ to: "/login" })` par `navigate({ to: "/etudiant" })`.
4. Garder un fallback : si la connexion échoue malgré tout, afficher un toast et renvoyer vers `/login`.

### Étape 4 — Vérification manuelle
- Tester le flow complet depuis le preview : checkout → paiement → retour avec `?sale=…` → formulaire → arrivée directe sur `/etudiant`.

---

## Fichiers concernés
- `src/lib/chariow.functions.ts` — accepter et utiliser `return_origin`.
- `src/routes/inscription.$slug.tsx` — envoyer l'origine, auto-login après signup, rediriger vers `/etudiant`.
- Configuration auth Lovable Cloud — activer auto-confirm email.

Aucune modification de base de données nécessaire.