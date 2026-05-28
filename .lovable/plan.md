# Plan — Page Formation étudiant : nettoyage + progression

## 1. Supprimer les 2 premières sections
Dans `src/routes/_authenticated/etudiant/formation.tsx`, pour chaque cohorte affichée, retirer :
- **Section 1** : la carte d'en-tête (image, titre cohorte, description, dates, lien Zoom) — bloc `<Card>` lignes ~128-141.
- **Section 2** : la carte **Annonces** — bloc `cohortAnnonces.length > 0 && (...)` lignes ~143-160.

Conserver uniquement :
- `Programme de la formation` (modules + leçons globales)
- `Ressources de la formation` (ressources globales sans module) — sous-bloc de la formation, à conserver
- `Contenu spécifique à cette cohorte`

Le titre de page (`Ma formation` + sous-titre) reste, ainsi que le bandeau d'accès suspendu et l'état vide.

## 2. Marquer comme lu + passer au suivant

### 2.a — Base de données
Nouvelle table `public.resource_progress` :
- `user_id` (uuid, FK auth.users)
- `resource_type` (text : `'formation'` ou `'cohort'`)
- `resource_id` (uuid)
- `read_at` (timestamptz default now())
- Clé unique (user_id, resource_type, resource_id)
- RLS : l'utilisateur peut lire/insérer/supprimer **uniquement ses propres lignes** (`auth.uid() = user_id`).
- GRANT à `authenticated` + `service_role`.

### 2.b — Construire une file ordonnée
Dans `formation.tsx`, après avoir chargé les données d'une cohorte, construire une liste plate `playlist` ordonnée :
1. leçons de chaque module de formation (par position de module puis position de leçon) — type `formation`
2. ressources globales de la formation — type `formation`
3. leçons de chaque module de cohorte (par position) — type `cohort`

Cette playlist est passée à chaque `ResourceRow` avec son index, pour permettre le "suivant".

### 2.c — Composant `ResourceViewer`
Modifier `src/components/ResourceViewer.tsx` :
- Charger les ressources lues (`resource_progress`) une fois pour l'utilisateur — via une query React Query partagée (clé `["resource-progress", userId]`).
- Dans le dialog, ajouter en pied :
  - Bouton **« Marquer comme lu »** (ou **« ✓ Déjà lu »** si déjà coché, avec option pour annuler) → insert/delete dans `resource_progress` + invalidation de la query.
  - Bouton **« Ressource suivante → »** si un suivant existe dans la playlist : ferme le dialog courant et ouvre le suivant. Désactivé si dernier.
- Dans `ResourceRow`, afficher un petit indicateur ✓ vert à côté du titre quand la ressource est marquée lue.

### 2.d — Coordination playlist ↔ dialog
- `ResourceRow` reçoit `playlist: ResourceItem[]` et `index: number`.
- Quand l'utilisateur clique « Suivant », on déclenche un callback `onNavigate(nextIndex)` qui est géré au niveau du conteneur de chaque section : un état partagé `openIndex` détermine quelle ressource est ouverte dans la cohorte courante.
- Implémentation simple : un seul composant parent par cohorte (`<CohortPlaylist resources={playlist}>`) gère l'état `openIndex`, rend toutes les `ResourceRow` et un unique `ResourceViewer`.

## Fichiers touchés
- `src/routes/_authenticated/etudiant/formation.tsx` — suppression de 2 sections, construction de la playlist par cohorte, intégration du nouveau composant.
- `src/components/ResourceViewer.tsx` — ajout des boutons « Marquer comme lu » et « Suivant », badge « lu », gestion de la navigation.
- Nouvelle migration Supabase : table `resource_progress` + RLS + GRANT.

## Hors scope
- Aucun changement sur le côté admin.
- Aucune modification du contenu des ressources elles-mêmes.

Souhaitez-vous que j'applique ce plan ?
