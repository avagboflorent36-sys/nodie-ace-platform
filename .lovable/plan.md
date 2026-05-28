## Objectif

Afficher le lien générique de la tranche 2 juste en dessous du lien d'inscription principal, dans l'en-tête de la page admin d'une cohorte.

## Contexte

Aujourd'hui dans `src/routes/_authenticated/admin/cohortes.$id.tsx` (header, lignes ~72-79), on affiche uniquement le bouton « Copier le lien d'inscription » + une note disant que le lien tranche 2 est dans l'onglet Étudiants. Les liens personnalisés par étudiant (avec token) restent disponibles dans l'onglet Étudiants — on n'y touche pas.

## Changement

Dans le bloc header de la cohorte :
- Conserver le bouton « Copier le lien d'inscription » (URL : `/inscription/{slug}`).
- Ajouter juste en dessous un second bouton « Copier le lien tranche 2 » qui copie `${window.location.origin}/inscription/${cohort.slug}/tranche-2`.
- Remplacer la note actuelle par une note courte précisant que ce lien générique nécessite une connexion étudiant, et que pour un accès direct au paiement il faut utiliser le lien personnalisé de l'onglet Étudiants.

Aucune autre modification (pas de changement au flux tranche 2, aux tokens, à l'onglet Étudiants, ni aux paramètres).

## Fichier touché

- `src/routes/_authenticated/admin/cohortes.$id.tsx` — header uniquement.