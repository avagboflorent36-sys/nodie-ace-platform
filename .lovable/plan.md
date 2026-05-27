
## Objectif
Afficher **une seule fois** la valeur de `CHARIOW_WEBHOOK_URL_SECRET` dans une page admin protégée, pour que tu puisses copier l'URL complète du webhook à coller dans Chariow. Ensuite, la page sera supprimée.

## Étapes

### 1. Créer une server function protégée
Fichier : `src/lib/admin-secrets.functions.ts`
- `createServerFn` avec middleware `requireSupabaseAuth`
- Vérifie que `userId` a le rôle `admin` ou `super_admin` via `user_roles`
- Si oui → renvoie `process.env.CHARIOW_WEBHOOK_URL_SECRET` et construit l'URL complète :
  ```
  https://project--66439da9-0337-4213-a275-40cffeef22c6-dev.lovable.app/api/public/hooks/chariow/<SECRET>
  ```
- Si non → throw `Unauthorized`

### 2. Créer la page admin temporaire
Fichier : `src/routes/_authenticated/admin/webhook-secret.tsx`
- Route protégée (déjà sous `_authenticated` + check admin)
- Bouton "Révéler le secret" → appelle la server function
- Affiche :
  - L'URL preview (`-dev.lovable.app`) — pour tester
  - L'URL production (`.lovable.app`) — à utiliser après publication
- Bouton "Copier" pour chaque URL
- Avertissement rouge : "Page temporaire, sera supprimée après usage"

### 3. Ajouter un lien dans la sidebar admin
Lien discret dans `/admin` vers `/admin/webhook-secret`.

### 4. Après que tu aies copié l'URL
Tu me dis "c'est bon", et je supprime :
- `src/routes/_authenticated/admin/webhook-secret.tsx`
- `src/lib/admin-secrets.functions.ts`
- Le lien dans la sidebar

## Ce que tu feras ensuite
1. Aller sur `/admin/webhook-secret`
2. Cliquer "Révéler"
3. Copier l'URL complète (version `-dev` pour tester maintenant)
4. La coller dans Chariow comme URL de webhook
5. Faire un paiement test
6. Vérifier dans `/admin/paiements` que le paiement apparaît
7. Me dire "c'est bon" pour que je nettoie

## Sécurité
- Server function vérifie le rôle admin côté serveur (pas seulement côté UI)
- Le secret n'est jamais exposé dans le bundle client
- La page est supprimée après usage → aucune fuite persistante
