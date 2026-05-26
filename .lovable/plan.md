# Refonte espace étudiant

## 1. Menu étudiant simplifié

Mettre à jour `src/routes/_authenticated/etudiant.tsx` pour ne garder que :

- Accueil → `/etudiant`
- Formation → `/etudiant/formation` (nouvelle route)
- Séances live → `/etudiant/live`
- Certificat → `/etudiant/certificat`
- Support → `/etudiant/support`

Suppression du menu : Ressources, Paiements, Progression.

## 2. Nouvelle page « Formation »

Créer `src/routes/_authenticated/etudiant/formation.tsx` qui regroupe, pour chaque cohorte active de l'étudiant :

- En-tête : nom de la cohorte, titre + description longue de la formation, image de couverture, dates, lien Zoom
- Bloc « Annonces » de la cohorte (récentes en premier)
- Ressources de la formation (`formation_resources`)
- Liste des modules avec leurs ressources (`modules` + `ressources`)
- Bannière d'alerte si l'inscription est `restricted` (paiement en retard)

Reprend la logique de l'actuelle page Ressources, enrichie des infos cohorte/formation.

## 3. Suppression des anciennes pages

Supprimer :
- `src/routes/_authenticated/etudiant/ressources.tsx`
- `src/routes/_authenticated/etudiant/paiements.tsx`
- `src/routes/_authenticated/etudiant/progression.tsx`

Nettoyer la page Accueil (`etudiant/index.tsx`) : retirer la carte « Paiements » et la statistique « Progression », garder un résumé cohortes + prochaines séances + dernières annonces.

## 4. Synchronisation temps réel (admin ↔ étudiant)

Activer Supabase Realtime pour les tables `annonces` et `notifications` via migration :

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.annonces;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.annonces REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
```

Côté client :
- Dans la page Formation, abonnement realtime sur `annonces` filtré par `cohort_id` → invalidation de la query annonces à chaque INSERT/UPDATE/DELETE.
- Créer un hook léger `useRealtimeNotifications` (ou inline dans `AppShell`) qui écoute `notifications` filtré sur `user_id = auth.uid()` et invalide la query notifications, pour que la cloche se mette à jour instantanément côté étudiant comme admin.

## 5. Détails techniques

- Routes TanStack : créer `formation.tsx` avec `createFileRoute("/_authenticated/etudiant/formation")`, le routeTree sera régénéré automatiquement.
- Toutes les requêtes utilisent `supabase` côté client + `useQuery` (cohérent avec le reste du code).
- L'abonnement realtime est posé dans un `useEffect` qui se désabonne au démontage, et appelle `queryClient.invalidateQueries({ queryKey: [...] })`.
- Le menu admin n'est pas modifié — la synchro temps réel rend simplement visibles immédiatement les annonces/notifs publiées depuis l'admin.

## Fichiers impactés

- ✏️ `src/routes/_authenticated/etudiant.tsx` (menu)
- ✏️ `src/routes/_authenticated/etudiant/index.tsx` (nettoyage stats)
- ➕ `src/routes/_authenticated/etudiant/formation.tsx`
- 🗑️ `ressources.tsx`, `paiements.tsx`, `progression.tsx`
- ➕ migration : activation realtime sur `annonces` et `notifications`
- ✏️ `src/components/AppShell.tsx` (ou nouveau hook) : abonnement realtime notifications
