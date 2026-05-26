## Objectif

Étendre la page **Formation** (admin) pour gérer un contenu pédagogique structuré identique à celui des cohortes : **Modules → Leçons** (document, vidéo, lien, exercice), en plus des ressources "globales" déjà existantes.

## Modèle de données

Ajout d'une hiérarchie réutilisable sur la formation :

```text
formation
 └── formation_modules (titre, description, position)
       └── formation_resources (type, titre, url/fichier, description, position)
```

### Migration SQL

1. **Nouvelle table `formation_modules`**
   - `formation_id`, `title`, `description`, `position`
   - RLS : lecture publique (formations actives) + admins gèrent
   - GRANTs anon/authenticated/service_role

2. **Modifier `formation_resources`**
   - Ajouter colonne `module_id uuid NULL` (référence logique vers `formation_modules`)
   - Les ressources sans `module_id` restent les "ressources globales" actuelles (rétrocompatible)
   - Mettre à jour la policy "Enrolled students read formation_resources" pour couvrir aussi les ressources rattachées à un module de la formation

## UI – `admin/formations.tsx`

Remplacer le bloc "Contenu pédagogique global" par un éditeur en deux niveaux, calqué sur `ContentTab` de `cohortes.$id.tsx` :

- **Liste des modules** de la formation, avec :
  - Bouton **+ Nouveau module** (titre, description)
  - Édition / suppression / réordonnancement de chaque module
- **À l'intérieur de chaque module** (accordéon ou panneau dépliable) :
  - Liste des leçons avec icône par type (document, vidéo, lien, exercice)
  - Bouton **+ Ajouter une leçon** ouvrant un dialog (titre, type, URL ou upload fichier, description)
  - Suppression d'une leçon
- Conserver une section **"Ressources globales"** (ressources sans module) pour ne pas casser l'existant — repliable, optionnelle.

Aucun changement nécessaire côté étudiant pour cette étape (les leçons rattachées à un module seront accessibles via la même RLS mise à jour ; l'affichage côté étudiant pourra être enrichi dans un second temps si tu le souhaites).

## Fichiers impactés

- **Migration** : nouvelle table `formation_modules` + colonne `module_id` sur `formation_resources` + RLS/GRANTs
- **Édité** : `src/routes/_authenticated/admin/formations.tsx` (refonte du composant `FormationDetail` → modules + leçons)
- **Auto-régénéré** : `src/integrations/supabase/types.ts`

## Questions

1. OK pour la structure **Modules → Leçons** dans la formation (en plus des ressources globales existantes) ?
2. Veux-tu aussi que **l'espace étudiant** (`/etudiant/formation`) affiche ces modules/leçons dès maintenant, ou on garde ça pour une 2ᵉ étape ?