## Diagnostic

J'ai inspecté la base, les RLS, et les pages admin/étudiant. Le problème principal de la page **Formation** est **structurel**, pas un bug de droits :

### Cause racine (Formation cassée)
Il existe **deux systèmes de contenu pédagogique en parallèle**, et ils ne communiquent pas :

| Table | Géré par admin via | Lu par l'étudiant ? |
|---|---|---|
| `formation_modules` | `/admin/formations` (page actuelle) | ❌ **Jamais** |
| `formation_resources` | `/admin/formations` | ✅ Oui (flat, sans regroupement par module) |
| `modules` | `/admin/cohortes/:id` | ✅ Oui |
| `ressources` | `/admin/cohortes/:id` | ✅ Oui |

→ Tout ce que l'admin crée dans **"Formations → Modules + Leçons"** (ce que tu fais dans la capture) n'apparaît **jamais** côté étudiant. C'est pour ça que "ça ne marche pas du tout".

### Autres constats (plateforme globale)
- RLS et policies présentes sur toutes les tables sensibles (profiles, payments, modules, ressources, etc.) — OK.
- L'étudiant test `elyos6936@gmail.com` est bien `active` + `paid` (la fonction `is_student_active` renvoie `true`) → les modules cohorte se chargeraient correctement si du contenu y existait.
- Flux Chariow déjà réparé (réconciliation + déblocage email-matché).
- Triggers de notification, handle_new_user, update_payment_on_installment : en place et fonctionnels.
- Aucune table publique sans policies, aucune fuite RLS critique.

## Plan d'action

### 1. Unifier l'architecture du contenu (le vrai fix Formation)
Choix retenu : la **formation** reste la source de vérité du programme pédagogique (réutilisable d'une cohorte à l'autre), et la **cohorte** ne sert qu'aux ajouts spécifiques (annonces, replays live).

- **Étudiant** (`/etudiant/formation`) : afficher d'abord les `formation_modules` (+ `formation_resources` enfants groupés par `module_id`) de chaque formation à laquelle il est inscrit via une cohorte active, puis les `modules`/`ressources` cohorte-spécifiques.
- **Admin** : conserver les deux éditeurs mais clarifier l'UI :
  - `/admin/formations` → "Programme de la formation" (contenu partagé entre toutes les cohortes)
  - `/admin/cohortes/:id` → "Contenu spécifique à cette cohorte" (replays, annonces, exos cohorte)
- Migration légère : ajouter la policy SELECT manquante sur `formation_modules` pour étudiants inscrits actifs (déjà ouverte mais on aligne avec `formation_resources`).

### 2. Réparer la page étudiant Formation
Réécrire la requête de `src/routes/_authenticated/etudiant/formation.tsx` pour récupérer `formation_modules(*, formation_resources(*))` filtrés par `formation_id`, et regrouper les leçons par module dans l'affichage.

### 3. Diagnostic global et stabilité
- Parcourir chaque page étudiant (Dashboard, Formation, Live, Paiements, Certificat, Profil, Support) et chaque page admin (Vue, Étudiants, Formations, Cohortes, Paiements, Notifications, Webhook) pour vérifier qu'elles chargent sans erreur RLS/JS.
- Ajouter un fallback "aucun contenu" propre partout où une liste peut être vide.
- Vérifier que les realtime channels écoutent les bonnes tables (`formation_modules` manquait).
- Test manuel via navigateur : login admin → créer module formation + leçon → login étudiant test → vérifier l'affichage.

### 4. Confirmation finale
Après corrections, je relance un check complet (lecture DB + parcours UI navigateur) et je te confirme que tout est stable côté admin **et** étudiant.

## Fichiers impactés
- `src/routes/_authenticated/etudiant/formation.tsx` (requête + rendu)
- `src/routes/_authenticated/admin/formations.tsx` (libellés UI clarifiés)
- `src/routes/_authenticated/admin/cohortes.$id.tsx` (libellés UI clarifiés)
- 1 migration SQL légère si une policy manque après vérification finale
