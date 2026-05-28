
## Diagnostic

L'examen de la base montre que les 8 dernières tentatives sur cette cohorte utilisaient toutes `prd_hmels6` (ancien ID, avant vos modifications). Les plus récentes ont reçu `ownership_confirmed` de Chariow (l'email a déjà acheté ce produit) → Chariow ne renvoie aucune URL de paiement et le code ne le signale pas clairement à l'utilisateur.

Les IDs en DB sont maintenant corrects et distincts :
- Full : `prd_hmels6`
- Tranche 1 : `prd_fied8f`
- Tranche 2 : `prd_wdheah`

## Plan

### 1. Rendre `ownership_confirmed` visible et actionnable
Actuellement, quand Chariow répond "déjà acheté", la page ne réagit pas. Modifier :

- **`src/routes/inscription.$slug.tsx`** : si `r.status === "ownership_confirmed"`, afficher un toast clair + rediriger vers `r.redirect_url` (reprise du flux de création de compte via attempt_token).
- **`src/routes/inscription.$slug.tranche-2.tsx`** : idem — si `ownership_confirmed`, afficher un message expliquant que cette adresse a déjà été utilisée pour ce produit Chariow, avec le choix de contacter le support ou réessayer avec un autre email.

### 2. Diagnostic visible côté admin
- **`src/routes/_authenticated/admin/cohortes.$id.tsx`** : dans l'onglet Paiements, afficher un mini-récap "Dernières tentatives Chariow" (10 dernières lignes de `chariow_payment_attempts` : email, mode, position, product_id utilisé, status, last_error). Ça permet de vérifier en un coup d'œil que le bon product_id est envoyé.

### 3. Surface des messages d'erreur Chariow
- Dans `startChariowCheckout`, quand Chariow renvoie autre chose qu'une URL, propager le `message` Chariow original dans la réponse (déjà fait pour `already_purchased`) + le product_id utilisé → faciliter le debug.

### 4. Validation : produits identiques
Déjà en place dans `setCohortChariowProducts` (refuse les doublons) — pas de changement.

## Fichiers impactés

- `src/routes/inscription.$slug.tsx` (gestion `ownership_confirmed` + toast)
- `src/routes/inscription.$slug.tranche-2.tsx` (idem)
- `src/lib/chariow.functions.ts` (propager product_id + message dans la réponse)
- `src/routes/_authenticated/admin/cohortes.$id.tsx` (panneau "Dernières tentatives")

## Action côté utilisateur après implémentation

Tester avec **une nouvelle adresse email** (non utilisée précédemment sur Chariow pour cette cohorte) pour valider que les 3 modes ouvrent bien 3 pages de paiement distinctes correspondant aux 3 product IDs.
