## Diagnostic confirmé

### 1. Page Automatisations trop large / mauvaise prévisualisation
- La capture montre un débordement horizontal global : le contenu admin dépasse la largeur utile, ce qui force une barre de scroll horizontale.
- La cause n’est pas seulement l’onglet Automatisations : le shell admin laisse le `<main>` s’étirer avec des enfants trop larges, et certains blocs internes ont des largeurs minimales cumulées.
- La barre latérale reste ouverte dans une largeur de preview intermédiaire, ce qui réduit fortement l’espace réel et amplifie le débordement.

### 2. Tranche 2 non fonctionnelle
- La cohorte a bien deux Product IDs différents :
  - tranche 1 : `prd_fied8f`
  - tranche 2 : `prd_wdheah`
- Pourtant, aucune tentative de paiement tranche 2 n’existe en base : le flux actuel ne démarre pas réellement le checkout tranche 2.
- Le modèle actuel est trop fragile : il dépend d’un lien tokenisé copié/collé (`/inscription/.../tranche-2?t=...`) puis d’une redirection automatique. Cela masque les erreurs et donne l’impression que le lien ne fonctionne pas.
- Autre incohérence détectée : lors d’un paiement en 2 tranches, le système ne crée pas systématiquement la ligne “tranche 2 à payer” dès la première tranche. Cela rend l’interface étudiant ambiguë.

## Approche définitive proposée

### A. Stabiliser l’affichage admin une fois pour toutes
1. Corriger le layout global `AppShell` :
   - empêcher le contenu principal de dépasser la largeur de l’écran avec `min-w-0`, `overflow-x-hidden` et conteneur responsive.
   - faire en sorte que la page admin reste lisible même quand la sidebar est ouverte.
2. Remplacer l’affichage Automatisations par un layout vertical stable :
   - journal d’exécution dans un bloc qui coupe proprement les longs messages au lieu d’élargir la page.
   - règles de relance, règles d’accès et campagnes dans des sections séparées, avec champs empilés sur petits écrans.
3. Supprimer les causes de “page qui disparaît/réapparaît” :
   - garder les données précédentes pendant le refetch.
   - éviter les remounts visuels de l’onglet.
   - retirer l’animation globale qui accentue l’effet de flash sur cette page.

### B. Remplacer le lien tranche 2 par un bouton de paiement fiable
Au lieu de demander aux étudiants/admins de copier un lien technique, créer un vrai flux :

```text
Espace étudiant > Mes paiements > Payer la tranche 2
        ↓
server function sécurisée
        ↓
création tentative Chariow avec product_id tranche 2
        ↓
redirection checkout
        ↓
webhook/retour paiement
        ↓
validation tranche 2 + accès rétabli
```

Concrètement :
1. Ajouter une server function authentifiée `startMyTranche2Checkout`.
   - Elle prend seulement `payment_id`.
   - Elle vérifie que le paiement appartient à l’étudiant connecté.
   - Elle lit directement le Product ID tranche 2 depuis la cohorte.
   - Elle démarre Chariow avec `installment_position = 2`.
   - Elle retourne l’URL checkout ou une erreur claire.
2. Modifier `/etudiant/paiements` :
   - bouton principal : `Payer la tranche 2`.
   - plus de redirection vers une page tokenisée intermédiaire.
   - afficher clairement : montant restant, statut tranche 1, statut tranche 2.
3. Garder le lien tokenisé uniquement comme solution de secours admin :
   - dans l’onglet Étudiants, afficher “Copier lien de secours tranche 2”.
   - le bouton normal étudiant devient la méthode officielle.

### C. Corriger le modèle des tranches
1. À la validation de la tranche 1, garantir que deux lignes existent :
   - tranche 1 : validée.
   - tranche 2 : pending, avec montant et échéance.
2. Corriger la logique de montant :
   - si `price_installment` représente le prix par tranche, alors `payments.amount_total = price_installment * 2`.
   - `amount_paid` doit additionner les tranches validées.
3. Ajouter une migration de réparation des paiements existants :
   - créer les lignes tranche 2 manquantes pour les paiements en 2 tranches.
   - corriger `amount_total` des paiements partiels incohérents.
   - conserver les tokens tranche 2 déjà générés.

### D. Rendre les erreurs paiement visibles
1. Sur la page étudiant, afficher une erreur claire si :
   - Product ID tranche 2 absent.
   - téléphone invalide.
   - Chariow ne renvoie pas d’URL.
   - paiement déjà validé.
2. Dans l’admin, ajouter dans l’onglet Étudiants :
   - Product ID utilisé pour la tranche 2.
   - dernier statut tentative Chariow.
   - bouton copier lien de secours.

### E. Vérifications finales
- Tester la page Automatisations à la largeur actuelle de preview : `1185x632`.
- Vérifier qu’il n’y a plus de scroll horizontal global.
- Tester un paiement tranche 2 depuis `/etudiant/paiements`.
- Confirmer en base qu’une tentative Chariow est créée avec `installment_position = 2` et `chariow_product_id = prd_wdheah`.
- Confirmer que la tranche 2 passe à validée après webhook/retour paiement.