# Diagnostic — Pourquoi la plateforme est lente

Après lecture de `src/router.tsx`, `src/routes/__root.tsx`, `src/hooks/useAuth.tsx`, `_authenticated.tsx`, `admin.tsx`, `etudiant.tsx`, j'ai identifié **3 causes racines** qui se cumulent et provoquent rechargements lents + sensation d'instabilité.

## Cause 1 — Invalidation globale à chaque évènement d'auth (critique)

Dans `__root.tsx`, le composant `AuthSync` fait :

```ts
supabase.auth.onAuthStateChange(() => {
  router.invalidate();              // re-run TOUS les loaders
  queryClient.invalidateQueries();  // refetch TOUTES les queries
});
```

Supabase déclenche `onAuthStateChange` pour **chaque** évènement : `INITIAL_SESSION` au montage, `TOKEN_REFRESHED` toutes les ~heures, à chaque retour d'onglet, etc. Résultat : la plateforme refetch **tout** en permanence → écrans qui se rechargent, latence, "chargement…" qui réapparaît.

## Cause 2 — QueryClient sans configuration de cache

`new QueryClient()` est créé sans defaults. Donc :
- `staleTime: 0` → chaque montage refetch
- `refetchOnWindowFocus: true` → refetch à chaque retour d'onglet
- `retry: 3` → 3 tentatives lentes sur erreur

Combiné avec la Cause 1, chaque navigation ou focus = volée de requêtes.

## Cause 3 — Pas de préchargement au survol

`defaultPreload` n'est pas défini → aucun préchargement quand l'utilisateur survole un lien, la navigation attend tout au clic.

---

# Plan de correction

### 1. `src/routes/__root.tsx` — `AuthSync` ciblé
Ne réagir qu'aux évènements qui changent réellement l'identité utilisateur (`SIGNED_IN`, `SIGNED_OUT`, `USER_UPDATED`). Ignorer `TOKEN_REFRESHED` et `INITIAL_SESSION`. Ne plus appeler `queryClient.invalidateQueries()` en masse — laisser les mutations invalider leurs propres clés.

### 2. `src/router.tsx` — defaults QueryClient + preload
```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,           // 1 min sans refetch
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

createRouter({
  routeTree,
  context: { queryClient },
  scrollRestoration: true,
  defaultPreload: "intent",        // précharge au survol
  defaultPreloadStaleTime: 0,
});
```

### 3. Vérification rapide
- Confirmer qu'aucun composant ne dépend de `invalidateQueries()` global pour se mettre à jour (les mutations existantes invalident déjà leurs clés ciblées).
- Pas de changement de comportement fonctionnel — uniquement performance et stabilité.

---

# Résultat attendu
- Navigation quasi instantanée (preload + cache 1 min)
- Plus de "Chargement…" qui réapparaît tout seul
- Plus de refetch global à chaque refresh de token Supabase
- Comportement métier strictement identique

Souhaitez-vous que j'applique ce plan ?
