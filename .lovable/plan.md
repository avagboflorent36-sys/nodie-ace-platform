## Diagnostic

Le bouton **Gérer** navigue bien vers `/admin/cohortes/{id}` (vérifié), mais la page redirige immédiatement vers `/etudiant`. La cohorte existe bien en base et ton compte a les rôles `super_admin` + `admin` + `student`.

La cause : **race condition dans `src/hooks/useAuth.tsx`**.

Le hook fait :
1. `supabase.auth.getSession()` → set `user` puis `setLoading(false)` **sans attendre** le chargement des rôles (`loadRoles` n'est pas awaité).
2. `AdminLayout` voit `loading=false` et `roles=[]` → `isAdmin=false` → `<Navigate to="/etudiant" />`.

Quand tu cliques "Gérer" alors que l'app vient d'être ouverte (ou après un refresh), tu tombes dans cette fenêtre de quelques ms et tu te fais éjecter vers l'espace étudiant.

## Correctif

### 1. `src/hooks/useAuth.tsx`
- Attendre le chargement des rôles avant de passer `loading` à `false`.
- Ajouter un état `rolesLoaded` pour que `onAuthStateChange` (qui charge les rôles en différé via `setTimeout`) maintienne `loading=true` tant que les rôles ne sont pas connus pour l'utilisateur courant.
- Garder le pattern « listener d'abord, puis hydrate » et le `setTimeout(0)` pour éviter le deadlock du listener Supabase.

### 2. `src/routes/_authenticated/admin.tsx` (défense en profondeur)
- Ne rediriger vers `/etudiant` que lorsque `loading=false` ET qu'on est sûr que les rôles sont chargés (via la nouvelle valeur retournée par `useAuth`). Sinon afficher un état de chargement (comme `_authenticated.tsx`).

### 3. `src/routes/_authenticated/etudiant.tsx` (symétrique)
- Même garde si tu y avais ajouté une redirection basée sur les rôles, pour éviter le miroir du bug.

## Hors scope
Aucun changement sur la base de données, les RLS, le contenu des cohortes ou le wizard. Strictement un fix d'auth côté front.