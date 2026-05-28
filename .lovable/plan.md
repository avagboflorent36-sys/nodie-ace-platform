## Problème

Aujourd'hui, le lien tranche 2 (`/inscription/$slug/tranche-2`) affiche une page intermédiaire identique visuellement à `/inscription/$slug` :
- demande à l'étudiant de se (re)connecter,
- puis lui demande de cliquer sur "Finaliser ma tranche 2".

Résultat : l'étudiant a l'impression que "rien ne se passe" / "c'est la même page que le lien principal".

Vous voulez :
1. Le lien tranche 2 → **redirige directement vers la page de paiement Chariow**, sans étape intermédiaire.
2. Après le paiement → **retour sur la plateforme** (espace étudiant).

Le point 2 est déjà câblé côté serveur (`redirect = /etudiant/paiements?paid=2&sale={sale_id}`). Le vrai travail est sur le point 1.

## Approche

Lier le lien tranche 2 à un **token unique** émis lors de l'inscription en 2 tranches. Ce token identifie le `payment` ciblé, donc on connaît déjà l'email/nom/téléphone : on peut lancer Chariow immédiatement, sans login.

### Étapes

1. **Migration DB** : ajouter `payments.tranche2_token text unique` + backfill pour les paiements `installments_2` existants (token aléatoire).
2. **Serveur** : à la fin du checkout tranche 1 réussi (dans `processChariowSale` / création du `payment` en mode `installments_2`), générer le token si absent.
3. **Nouvelle server function** `startChariowCheckoutForTranche2Token({ token, return_origin })` (publique, sans auth) :
   - charge le `payment` + cohorte + profil via le token,
   - vérifie qu'il reste bien une tranche 2 non validée,
   - appelle `initCheckout` avec le `chariow_product_id_installment_2` et `redirect_url = ${origin}/etudiant/paiements?paid=2&sale={sale_id}`,
   - renvoie `{ checkout_url }`.
4. **Route `/inscription/$slug/tranche-2`** réécrite :
   - lit `?t=TOKEN` (search param),
   - si token présent : appelle la nouvelle server function au mount et fait `window.location.href = checkout_url` (écran de transition "Redirection vers le paiement…"),
   - si token absent / invalide : message clair "Lien invalide, demandez un nouveau lien à l'administrateur" (et fallback bouton "Voir mes paiements" si connecté). On supprime la double UI login + bouton manuel.
5. **Générateurs de liens** : `cohortes.$id.tsx` (admin) et `etudiant/paiements.tsx` (étudiant) ajoutent `?t=${payment.tranche2_token}` à l'URL copiée. Côté admin, comme un cohort peut avoir N étudiants, on affiche le lien tranche 2 dans le panneau "Inscriptions" à côté de chaque étudiant en mode 2 tranches (au lieu d'un seul lien générique en haut). On retire ou on grise le bouton "Copier le lien tranche 2" générique du header.
6. **Anti-rejeu** : si Chariow renvoie `ownership_confirmed` ou si le `payment.status === 'paid'`, ne pas redéclencher de checkout — afficher "Tranche 2 déjà payée → Voir mes paiements".

### Fichiers touchés

- `supabase/migrations/<new>.sql` — ajout colonne + backfill.
- `src/lib/chariow.functions.ts` — nouvelle server function, génération de token à la création du paiement 2 tranches.
- `src/routes/inscription.$slug.tranche-2.tsx` — réécriture : auto-redirection, plus de formulaire login intermédiaire.
- `src/routes/_authenticated/admin/cohortes.$id.tsx` — liens tranche 2 par étudiant, retrait du lien générique.
- `src/routes/_authenticated/etudiant/paiements.tsx` — ajout `?t=` au lien copié.

### Hors scope

- Aucune modification du flux tranche 1 / paiement intégral.
- Aucune modification de l'UI Chariow ni du webhook : le retour `/etudiant/paiements` fonctionne déjà.
