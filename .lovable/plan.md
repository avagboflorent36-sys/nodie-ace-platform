## Réponse courte

Non, le problème ne semble pas être qu’il faut créer une nouvelle webhook Chariow.

Le backend reçoit déjà des webhooks Chariow avec des événements `successful.sale`, donc l’URL webhook actuelle fonctionne. Le vrai problème visible dans les données est plutôt ceci : aucune tentative de paiement Tranche 2 n’a encore été créée (`0` tentative avec `installment_position = 2`). Donc le flux Tranche 2 ne démarre probablement pas correctement depuis l’espace étudiant, ou il est bloqué avant d’appeler Chariow.

## Diagnostic observé

- Le webhook Chariow reçoit bien des événements récents et les traite.
- La cohorte `test 1` a bien des IDs produits différents :
  - Paiement intégral : `prd_hmels6`
  - Tranche 1 : `prd_fied8f`
  - Tranche 2 : `prd_wdheah`
- Le paiement étudiant existant est en `partial`, avec :
  - Tranche 1 validée
  - Tranche 2 en attente
- Mais il n’existe aucune tentative Chariow Tranche 2 en base.

Conclusion : créer une nouvelle webhook ne réglera probablement pas le lien Tranche 2. Il faut rendre le flux Tranche 2 impossible à confondre avec la Tranche 1 et visible de bout en bout.

## Plan d’implémentation définitif

### 1. Remplacer le lien Tranche 2 par une page de paiement dédiée

Créer un flux dédié :

```text
Étudiant connecté
→ /etudiant/paiements
→ bouton “Payer la tranche 2”
→ page dédiée /etudiant/paiements/tranche-2/$paymentId
→ vérification des données
→ création checkout Chariow avec product_id tranche 2 uniquement
→ redirection Chariow
→ retour espace étudiant
```

Objectif : ne plus dépendre d’un lien partagé ambigu ou d’un ancien token qui peut pointer vers le mauvais produit.

### 2. Ajouter un diagnostic affiché avant redirection

Sur la page dédiée Tranche 2, afficher clairement avant redirection :

- Cohorte concernée
- Montant Tranche 2
- Product ID Chariow utilisé
- Statut actuel de la Tranche 2
- Erreur claire si téléphone, email ou Product ID manque

Cela permet de vérifier immédiatement si `prd_wdheah` est bien utilisé avant d’envoyer l’étudiant chez Chariow.

### 3. Corriger le traitement backend Tranche 2

Dans le traitement webhook/réconciliation :

- Pour `installments_2`, `amount_total` doit représenter les deux tranches.
- La Tranche 2 doit valider uniquement `payment_installments.position = 2`.
- Le paiement parent doit passer à `paid` seulement quand Tranche 1 + Tranche 2 sont validées.
- Le traitement doit utiliser en priorité la tentative interne créée avant le checkout, pas uniquement les métadonnées envoyées par Chariow.

### 4. Enregistrer plus d’informations de debug par tentative

Pour chaque tentative Chariow, enregistrer :

- `payment_id`
- `installment_id`
- `installment_position`
- `chariow_product_id`
- `checkout_url`
- `chariow_sale_id`
- dernier message d’erreur

But : pouvoir dire exactement si le blocage vient du bouton, du checkout Chariow, du retour, ou du webhook.

### 5. Ajouter un bouton admin “Tester Tranche 2”

Dans l’admin cohorte/étudiants ou page webhook :

- afficher pour chaque étudiant en paiement partiel :
  - Product ID attendu Tranche 2
  - statut tentative Tranche 2
  - dernier checkout généré
- ajouter une action “Créer/Recréer checkout Tranche 2” pour un paiement précis.

Cela donne une alternative fiable si l’étudiant n’arrive pas à déclencher le paiement depuis son espace.

### 6. Garder une seule webhook Chariow, mais vérifier la bonne URL

Ne pas créer plusieurs webhooks sauf si Chariow sépare obligatoirement les webhooks par produit.

À faire côté Chariow :

- Utiliser l’URL production affichée dans `/admin/webhook-secret`.
- L’appliquer au niveau compte/boutique Chariow si possible, pas seulement sur un produit.
- Si Chariow impose un webhook par produit, alors ajouter la même URL webhook sur les 3 produits : intégral, Tranche 1, Tranche 2.

## Approche alternative plus simple pour les étudiants

La solution la plus robuste serait de ne plus faire circuler de “lien Tranche 2” externe. L’étudiant se connecte, voit son solde, clique sur “Payer maintenant”, et l’app génère un checkout frais à chaque clic avec le bon produit Chariow.

Cela évite :

- les anciens liens réutilisés,
- les mauvais IDs produits,
- les tokens expirés/confondus,
- les problèmes de copier-coller admin.

## Validation après implémentation

Je validerai avec ces contrôles :

- Une tentative Tranche 2 est créée avec `installment_position = 2`.
- La tentative utilise `prd_wdheah`.
- Le checkout Chariow obtenu n’est pas celui de la Tranche 1.
- Le webhook `successful.sale` met à jour la Tranche 2, pas la Tranche 1.
- Le paiement parent passe à `paid` uniquement après validation des deux tranches.