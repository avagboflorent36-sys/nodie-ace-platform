## Diagnostic

Avant de proposer des correctifs, voici ce que j'ai mesuré :

- **`tsc --noEmit`** : passe sans erreur. Aucun bug TypeScript bloquant.
- **`eslint`** : uniquement des warnings cosmétiques (`any`, formatage Prettier). Pas de bug runtime.
- **Erreur récurrente `SyntaxError: Unexpected token (204:10)`** : trace héritée du cache Vite SSR (module compilé avant un fix précédent). Le fichier actuel `etudiant/paiements.tsx` parse correctement. → fix = vider le cache + redémarrer le dev server.
- **Boundaries d'erreur** : `__root.tsx` a `errorComponent` + `notFoundComponent` ✓. Le router n'a PAS de `defaultErrorComponent` (fallback ultime manquant).
- **Pas de `useEffect`/state suspects** dans les pages admin lues. Pas de boucle infinie évidente.

## Cause probable de "l'instabilité globale"

1. **Cache SSR Vite figé** sur une ancienne version d'un fichier → écran blanc + erreur `204:10` réapparaît à chaque navigation tant que le serveur n'est pas relancé proprement.
2. **Pas de `defaultErrorComponent` router** : si un loader/composant throw hors d'un boundary, l'utilisateur voit la page blanche h3 (`{"unhandled":true}`) au lieu d'un fallback.
3. **Queries sans état `isLoading` visible** sur plusieurs pages admin (`paiements`, `etudiants`) : pendant le chargement, l'écran reste vide → ressenti "ne marche pas".
4. **Boutons inertes** : sur la ligne admin paiements, certaines lignes n'ont pas d'action visible quand `payments` est null (jointure échouée à cause RLS ou ligne orpheline) → la cellule Actions est vide.

## Plan de correction (1 passe, sans toucher au business)

### 1. Stabilité runtime
- Ajouter `defaultErrorComponent` dans `src/router.tsx` (même UI que celui du root) pour couvrir les throws hors-tree.
- Restart du dev server pour vider le cache SSR (Lovable le fait auto après edit).

### 2. États de chargement visibles
- Ajouter un skeleton/spinner sur :
  - `admin/paiements.tsx` (rows query)
  - `admin/etudiants.index.tsx` (students query)
  - `admin/etudiants.$id.tsx` (déjà `isLoading` mais pas branché — l'utiliser)
- Afficher un message "Aucune donnée liée" quand `r.payments == null` au lieu d'une cellule vide.

### 3. Boutons inertes & garde-fous
- `admin/paiements.tsx` : filtrer dès la query les rows orphelines (`payments != null`) pour éviter les lignes "fantômes" sans action possible.
- `admin/etudiants.index.tsx` : ajouter un `title` quand WhatsApp manque (déjà fait) — vérifier l'`onClick stopPropagation` sur le bouton (déjà OK).
- `etudiant/paiements.tsx` : déjà corrigé tranche 2 (lot précédent).

### 4. Resilience requêtes Supabase
- Ajouter `throwOnError: false` explicite et un `toast.error` sur les `error` ignorées dans les pages admin (actuellement on log silencieux → données vides sans signal).

## Hors scope (à demander explicitement)

- Refactor des `any` (cosmétique, risque de régression vs gain nul).
- Réécriture du flux Chariow / webhook.
- Migration RLS / schéma DB.
- Changement de design.

## Détail technique

```text
src/router.tsx                              + defaultErrorComponent
src/routes/_authenticated/admin/paiements.tsx
  + isLoading skeleton table
  + filter rows where payments == null
  + toast.error si query error
src/routes/_authenticated/admin/etudiants.index.tsx
  + isLoading skeleton
src/routes/_authenticated/admin/etudiants.$id.tsx
  + brancher isLoading existant
```

Aucune migration DB, aucun changement de logique métier. Tous les correctifs sont défensifs (gardes, fallbacks, états de chargement).

## Validation

Après les changements, je relance `tsc` et j'ouvre `/admin/paiements`, `/admin/etudiants`, `/etudiant/paiements` dans le navigateur pour confirmer que :
- Aucune page ne reste blanche.
- Les spinners apparaissent puis cèdent la place aux données.
- Les boutons critiques (WhatsApp, validation paiement, tranche 2) sont fonctionnels.

Si vous voyez des symptômes plus précis (un bouton précis qui ne fait rien, une page nommée qui crashe), dites-le-moi — je préfère cibler que ratisser large.