## Objectif
Exposer un **second lien d'inscription** dédié au paiement de la **tranche 2**, à la fois côté admin (sous le lien principal) et côté étudiant (page Paiements) pour que les étudiants en paiement partiel finalisent en un clic.

## URL du second lien
Format : `/inscription/<slug>/tranche-2`

Différence avec le lien principal :
- Le lien principal ouvre le formulaire d'inscription (collecte des infos + paiement initial).
- Le lien tranche-2 saute le formulaire et envoie l'utilisateur directement vers la suite de paiement (Chariow) puisque l'étudiant est déjà inscrit.

## Changements

### 1. Nouvelle route publique — `src/routes/inscription.$slug.tranche-2.tsx`

Comportement :
- Charger la cohorte par `slug`.
- Si l'utilisateur **n'est pas connecté** → afficher un écran "Connectez-vous pour finaliser" avec bouton vers `/login?next=/inscription/<slug>/tranche-2`.
- Si **connecté** : rechercher dans `payments` la ligne de l'utilisateur pour cette cohorte.
  - `status = "partial"` et tranche 2 non validée → bouton **"Finaliser ma tranche 2"** qui appelle `startChariowCheckout({ cohort_id, mode: "installments_2", installment_position: 2, ... })` puis redirige vers `checkout_url`.
  - `status = "paid"` ou tranche 2 déjà validée → message "Déjà payé" + lien vers `/etudiant/paiements`.
  - Aucun paiement trouvé → message "Aucune inscription trouvée" + lien vers le formulaire principal `/inscription/<slug>`.
- UI cohérente avec la page d'inscription existante (mêmes couleurs/Card, header cohorte + formation).

### 2. Page admin cohorte — `src/routes/_authenticated/admin/cohortes.$id.tsx`

A. **Header** (zone du bouton "Copier le lien d'inscription", ~ligne 63)
- Calculer `tranche2Url = `${origin}/inscription/${slug}/tranche-2``.
- Ajouter sous le bouton existant un second bouton "Copier le lien tranche 2" (variant `outline`, icône `Copy`), avec `toast.success("Lien tranche 2 copié")`.

B. **`FormBuilderTab`** (~ligne 320-335) — afficher également le second lien sous le lien principal, avec copie + aperçu URL en `text-xs text-muted-foreground`.

### 3. Page étudiant paiements — `src/routes/_authenticated/etudiant/paiements.tsx`

Pour chaque `payment` dont `status === "partial"` :
- Sous le bouton "Payer tranche 2" existant (ou en complément à côté), afficher un petit bloc "Lien direct de finalisation" avec :
  - L'URL `${origin}/inscription/<slug-cohorte>/tranche-2`
  - Un bouton "Copier" (clipboard + toast)
- Cela nécessite de récupérer le `slug` de la cohorte : étendre la query Supabase pour inclure `cohortes(slug)` (déjà sélectionne `cohortes(name, formations(title))`).

## Hors périmètre
- Aucun changement de schéma DB.
- Aucune modification de la logique Chariow / server functions existantes.
- Pas de modification du flux d'inscription initial.

## Résultat attendu
- Admin : deux liens visibles, le principal pour la nouvelle inscription, et celui de tranche 2 à partager aux étudiants en retard.
- Étudiant en paiement partiel : voit le bouton "Payer tranche 2" + un lien partageable pour finaliser depuis n'importe où.
- Cliquer le lien tranche-2 (connecté + partiel) ouvre directement le checkout Chariow, sans repasser par le formulaire.
