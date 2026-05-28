## Cause racine

Le fichier de route s'appelle `paiements.tranche-2.$paymentId.tsx`. En routage à plat TanStack, le point dans le nom de fichier fait de cette route un **enfant** de `paiements.tsx`. Or `paiements.tsx` est une page-feuille — il **ne rend pas `<Outlet />`**. Résultat : quand on clique sur « Payer la tranche 2 », l'URL change bien vers `/etudiant/paiements/tranche-2/<id>`, mais la page enfant n'est jamais affichée, et l'utilisateur reste sur la liste des paiements — donnant l'impression que le bouton « n'est pas cliquable ».

Bonus : si un admin clique sur le lien « Copier » côté admin et l'ouvre dans son propre onglet, le layout `_authenticated/etudiant.tsx` le redirige vers `/admin`. La page Tranche 2 ne peut donc être ouverte que par l'étudiant lui-même.

## Correction

1. **Renommer le fichier de route** pour qu'il ne soit plus enfant de `paiements` :
   - `src/routes/_authenticated/etudiant/paiements.tranche-2.$paymentId.tsx`
   - → `src/routes/_authenticated/etudiant/tranche-2.$paymentId.tsx`
   - Mettre à jour la chaîne `createFileRoute(...)` à l'intérieur du fichier pour pointer sur `/_authenticated/etudiant/tranche-2/$paymentId`.

2. **Mettre à jour tous les liens** vers la nouvelle URL `/etudiant/tranche-2/$paymentId` :
   - `src/routes/_authenticated/etudiant/paiements.tsx` (2 boutons : bandeau « Payer la tranche 2 » + bouton « Payer » dans la liste)
   - `src/routes/_authenticated/admin/cohortes.$id.tsx` (génération de l'URL `Copier` côté admin)

3. **Note pour l'admin** : laisser un court texte dans l'onglet « Étudiants » précisant que le lien copié doit être envoyé à l'étudiant (ouvert dans le compte étudiant), car l'admin sera redirigé vers `/admin` s'il l'ouvre lui-même. (Déjà partiellement présent — je le clarifie.)

## Vérification

- Connecté en étudiant `avagbofacebook@gmail.com` : cliquer « Payer la tranche 2 » → la page diagnostic Tranche 2 s'ouvre (montant, Product ID, bouton Chariow).
- Côté admin : le bouton « Copier » génère bien la nouvelle URL `/etudiant/tranche-2/<paymentId>`.

Aucune modification de logique métier, de migration DB, ou de webhook nécessaire.