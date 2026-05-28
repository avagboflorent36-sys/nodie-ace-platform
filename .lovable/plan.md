## Diagnostic global

Le problème vient d’une confusion entre deux types de liens :

1. **Lien principal d’inscription**
   - URL actuelle : `/inscription/{slug}`
   - Ce lien affiche le formulaire et démarre toujours le paiement initial : paiement 1x ou tranche 1.
   - Il utilise `chariow_product_id_full` ou `chariow_product_id_installment_1`.

2. **Lien tranche 2 réel**
   - Le lien qui permet un paiement direct tranche 2 doit contenir un token étudiant : `/inscription/{slug}/tranche-2?t={tranche2_token}`.
   - C’est ce token qui permet au serveur de retrouver le paiement partiel, l’étudiant, la cohorte, puis d’appeler Chariow avec `chariow_product_id_installment_2`.

Aujourd’hui, dans l’en-tête admin, le bouton “Copier le lien tranche 2” copie seulement :

```text
/inscription/{slug}/tranche-2
```

Sans `?t=...`, cette URL ne peut pas identifier l’étudiant ni son paiement partiel. Elle ressemble donc à un lien générique et donne l’impression que la tranche 2 est “la même partout”.

Les données réelles de la cohorte consultée confirment pourtant que les Product IDs sont bien différents :

```text
Paiement 1x   : prd_hmels6
Tranche 1     : prd_fied8f
Tranche 2     : prd_wdheah
```

La vraie faiblesse est donc l’UX + l’architecture des liens : on affiche encore un lien tranche 2 générique alors que la tranche 2 ne peut fonctionner correctement qu’avec un lien personnalisé par étudiant.

## Objectif de correction

Rendre impossible toute confusion :

- le lien principal reste uniquement pour l’inscription initiale ;
- le lien tranche 2 visible/admin devient toujours un lien personnalisé par étudiant avec token ;
- le checkout tranche 2 utilise toujours le Product ID tranche 2 ;
- après paiement tranche 2, l’étudiant est renvoyé vers la plateforme ;
- si quelqu’un ouvre une URL tranche 2 sans token, l’app affiche une erreur claire et ne tente jamais d’utiliser le flux principal.

## Plan d’implémentation

### 1. Supprimer le faux lien tranche 2 générique dans l’en-tête admin

Dans `src/routes/_authenticated/admin/cohortes.$id.tsx` :

- Retirer le bouton qui copie `${inscriptionUrl}/tranche-2`.
- Garder uniquement le bouton du lien principal `/inscription/{slug}`.
- Ajouter un message court sous le bouton principal :
  - “Les liens tranche 2 sont personnalisés par étudiant et disponibles dans l’onglet Étudiants.”

Raison : un lien tranche 2 sans token ne peut pas être correct, car il ne sait pas quel paiement partiel finaliser.

### 2. Renforcer l’onglet Étudiants comme source unique des liens tranche 2

Dans `StudentsTab` de `src/routes/_authenticated/admin/cohortes.$id.tsx` :

- Garder la colonne “Lien tranche 2”.
- Générer exclusivement :

```text
/inscription/{slug}/tranche-2?t={payment.tranche2_token}
```

- Afficher ce bouton seulement si :
  - paiement en mode `installments_2` ;
  - paiement non payé entièrement ;
  - token tranche 2 présent.
- Ajouter éventuellement un libellé explicite : “Copier lien personnalisé”.

### 3. Ajouter un bouton de diagnostic/admin pour voir le Product ID utilisé

Dans l’interface admin, près de la configuration Chariow ou dans l’alerte de cohorte :

- Afficher clairement les 3 Product IDs configurés :

```text
Paiement 1x   : prd_...
Tranche 1     : prd_...
Tranche 2     : prd_...
```

- Si deux IDs sont identiques, garder l’alerte de collision actuelle.
- Si l’ID tranche 2 est absent, afficher que les liens tranche 2 ne seront pas disponibles.

But : l’admin peut immédiatement confirmer que la tranche 2 utilise un produit différent.

### 4. Corriger le bouton “Payer tranche 2” dans l’espace étudiant

Dans `src/routes/_authenticated/etudiant/paiements.tsx` :

- Le bouton “Payer tranche 2” ne doit plus appeler le flux générique `startChariowCheckout`.
- Il doit rediriger vers le lien tokenisé déjà généré :

```text
/inscription/{slug}/tranche-2?t={tranche2_token}
```

Raison : cela force tous les chemins tranche 2 à passer par le même flux sécurisé `startChariowCheckoutForTranche2Token`, qui utilise explicitement `chariow_product_id_installment_2`.

### 5. Factoriser la normalisation téléphone pour éviter l’erreur Chariow 400

Dans `src/lib/chariow.functions.ts` :

- Extraire la logique de formatage téléphone dans une fonction commune.
- L’utiliser dans :
  - `startChariowCheckout` ;
  - `startChariowCheckoutForTranche2Token`.
- Améliorer le mapping des pays détectés depuis l’indicatif international.
- En cas de téléphone invalide, retourner une erreur claire sans planter la page.

Cela corrige l’erreur récurrente :

```text
Invalid phone number. Check the number and country code.
```

### 6. Renforcer le serveur : la tranche 2 doit toujours vérifier le produit

Dans `startChariowCheckoutForTranche2Token` :

- Conserver la récupération du paiement via `tranche2_token`.
- Vérifier que le paiement appartient bien à une cohorte ayant `chariow_product_id_installment_2`.
- Créer la tentative Chariow avec :

```text
mode = installments_2
installment_position = 2
chariow_product_id = chariow_product_id_installment_2
```

- Retourner aussi `product_id` dans la réponse serveur, utile pour diagnostic.

### 7. Vérifier les données existantes

Faire une vérification base de données :

- Tous les paiements `installments_2` partiels doivent avoir un `tranche2_token`.
- La cohorte doit avoir un Product ID tranche 2 configuré.
- Les tentatives tranche 2 créées après correction doivent enregistrer `chariow_product_id = prd_wdheah` pour la cohorte testée.

Si nécessaire, ajouter une migration de rattrapage uniquement pour les tokens manquants.

### 8. Validation finale

Après implémentation :

- Copier le lien principal depuis l’admin : il doit être `/inscription/{slug}` uniquement.
- Copier le lien tranche 2 depuis l’onglet Étudiants : il doit contenir `?t=...`.
- Ouvrir le lien tranche 2 personnalisé : il doit rediriger directement vers Chariow.
- Vérifier la dernière tentative Chariow : `installment_position = 2` et `chariow_product_id = prd_wdheah`.
- Après paiement, la redirection doit revenir vers `/etudiant/paiements`.

## Fichiers à modifier

- `src/routes/_authenticated/admin/cohortes.$id.tsx`
  - supprimer le lien générique tranche 2 ;
  - clarifier l’UI admin ;
  - renforcer la colonne liens étudiants.

- `src/routes/_authenticated/etudiant/paiements.tsx`
  - faire passer le bouton tranche 2 par le lien tokenisé.

- `src/lib/chariow.functions.ts`
  - factoriser et fiabiliser le format téléphone ;
  - renforcer la réponse/diagnostic du checkout tranche 2.

- Base de données si nécessaire uniquement
  - rattraper les tokens manquants pour les paiements en 2 tranches.