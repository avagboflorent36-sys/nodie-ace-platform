# Diagnostic global de la plateforme

Objectif : vérifier que toutes les pages (publiques et internes) fonctionnent, sont rapides et stables, et identifier les problèmes éventuels avant correction.

## Périmètre

### Pages publiques (non authentifiées)
- `/` — landing
- `/login`, `/signup`, `/forgot-password`, `/reset-password`
- `/inscription/$slug` — inscription cohorte
- `/inscription/$slug/tranche-2` — paiement 2e tranche pré-inscription

### Espace étudiant (`/etudiant/*`)
- Dashboard, formation, live, paiements, profil, certificat, support
- `/etudiant/tranche-2/$paymentId` — paiement 2e tranche

### Espace admin (`/admin/*`)
- Vue d'ensemble, étudiants (liste + détail), formations, cohortes (liste + détail), paiements, notifications, webhook-secret

### Endpoints serveur
- `/api/public/hooks/chariow.$secret` — webhook paiement
- `/api/public/hooks/automation-tick` — cron automatisations
- `/api/public/hooks/payment-reminders` — relances

## Méthode de diagnostic

### 1. Diagnostic statique (code & config)
- Vérifier l'intégrité de `routeTree.gen.ts` (toutes les routes existent)
- Vérifier `src/start.ts` (middleware `attachSupabaseAuth` enregistré)
- Vérifier que chaque route a un `errorComponent` / `notFoundComponent` et que les layouts ont `<Outlet />`
- Linter Supabase (RLS, policies, grants manquants)
- Logs récents serveur (erreurs runtime publiées + dev sandbox)
- Logs DB / auth (erreurs récentes)

### 2. Diagnostic runtime (navigation réelle)
- Naviguer sur chaque page publique en non-connecté → vérifier rendu, console, network
- Se connecter comme étudiant test → parcourir toutes les pages étudiant
- Se connecter comme admin → parcourir toutes les pages admin (liste + au moins un détail)
- Capturer erreurs console / requêtes 4xx/5xx / temps de chargement anormaux

### 3. Diagnostic backend & données
- Statut Cloud (healthy)
- Santé DB (connexions, taille, deadlocks)
- Cohérence données critiques : paiements orphelins, installments tranche-2 manquantes, enrollments incohérents

### 4. Diagnostic performance
- Performance profile sur landing + dashboard étudiant + dashboard admin
- Identifier long tasks, requêtes N+1, payloads lourds

## Livrable

Un rapport structuré listant :
- ✅ Ce qui fonctionne
- ⚠️ Anomalies mineures (UX, perf, warnings)
- 🔴 Bugs bloquants à corriger en priorité

Aucune modification de code dans cette phase — je présenterai ensuite un plan de correction ciblé pour les problèmes trouvés.

## Question avant exécution

Pour les tests runtime sur l'espace étudiant et admin, j'ai besoin d'être authentifié dans le preview. Deux options :
1. **Tu te connectes toi-même** dans la preview (étudiant + admin successivement) et je lance le diagnostic
2. **Tu me fournis** un email/mot de passe de test pour chaque rôle

Réponds simplement "OK option 1" ou colle les identifiants pour option 2, et je lance le diagnostic.
