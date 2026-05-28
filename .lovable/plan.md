# Plan — Onglet « Automatisations » : affichage + planification précise

## Problème 1 — Affichage cassé de l'onglet Automatisations

**Cause**
- `TabsList` en `grid-cols-9` : 9 onglets serrés sur une seule ligne → l'onglet « Automatisations » saute en largeur quand React remonte le contenu (effet « disparait/réapparait »).
- À l'ouverture du tab, `useQuery(["automation-runs"])` part sans `placeholderData` → flash de l'état vide puis re-render.
- Les éditeurs de règles utilisent une grille rigide `grid-cols-12 gap-2` avec beaucoup de `Select`/`Input` côte à côte → débordement horizontal dans le conteneur `max-w-7xl` sur 1185px (viewport actuel).

**Correctifs (UI uniquement)**
1. `TabsList` : passer en `flex flex-wrap` + scroll horizontal sur mobile (au lieu de `grid-cols-9`), pour éviter le « saut » à chaque clic.
2. `AutomationsTab` :
   - `useQuery` → ajouter `placeholderData: (prev) => prev` et `staleTime: 30_000` pour supprimer le flash.
   - Wrapper `<div className="overflow-x-auto">` autour des éditeurs.
3. `ReminderRulesEditor` & `AccessRulesEditor` :
   - Refondre chaque ligne en `flex flex-wrap gap-2` (labels visibles « Quand », « Canal », « Modèle », « Action »…) au lieu d'une grille à 12 colonnes invisibles.
   - Largeurs minimales explicites sur chaque champ.

## Problème 2 — Planification précise (jour + heure exacts)

Aujourd'hui les règles ne portent qu'un `offset_days` (relatif à `due_date`) ; le cron tourne toutes les 15 min mais compare des dates (jour entier).
On ajoute **2 modes** par règle :

- **Mode `relative`** (existant, enrichi) : `offset_days` (J± par rapport à l'échéance) **+** `time_of_day` (`HH:MM`, par défaut 09:00) → la règle se déclenche le jour cible à l'heure indiquée.
- **Mode `absolute`** (nouveau) : `run_at` (timestamp date+heure exact) → la règle se déclenche une seule fois à ce moment précis.

### Migration DB
Ajouter sur `cohort_reminder_rules` **et** `cohort_access_rules` :
- `trigger_mode text not null default 'relative'` (check `'relative' | 'absolute'`)
- `time_of_day time` (utilisé en mode relative, défaut `09:00`)
- `run_at timestamptz` (utilisé en mode absolute)
- `last_run_at timestamptz` (anti-doublon pour le mode absolute)

### Logique du tick (`src/lib/automation.server.ts`)
- **Relances `relative`** : pour chaque règle, calculer `target_date = today - offset_days` ; ne déclencher que si l'heure courante UTC ≥ `time_of_day` (et ≤ `time_of_day + 1h` pour rester dans la fenêtre cron 15 min). La dédup actuelle par `payment_reminders` (1/jour/installment) suffit.
- **Relances `absolute`** : déclencher quand `now() ≥ run_at` ET `last_run_at IS NULL`. Mettre `last_run_at = now()` après exécution. Audience = tous les `payment_installments` non validés de la cohorte.
- **Règles d'accès** : même découpage. En mode `absolute`, à l'heure dite, bloquer les étudiants avec installment non validé. En mode `relative`, conserver le `offset_days` + `time_of_day`.

### UI éditeurs
Dans chaque ligne, un `Select` « Type de déclencheur » :
- `Relatif à l'échéance` → champs `offset_days` (J±) + `time_of_day` (input `type="time"`).
- `Date et heure exactes` → un seul input `type="datetime-local"` lié à `run_at` + badge « déjà exécuté le … » si `last_run_at` rempli, avec bouton « Réinitialiser ».

## Fichiers touchés
- `supabase/migrations/<new>.sql` — colonnes `trigger_mode`, `time_of_day`, `run_at`, `last_run_at` sur les 2 tables.
- `src/routes/_authenticated/admin/cohortes.$id.tsx` — `TabsList`, `AutomationsTab`, `ReminderRulesEditor`, `AccessRulesEditor`.
- `src/lib/automation.server.ts` — branchement `relative`/`absolute` pour relances et règles d'accès.

## Validation
- Onglet Automatisations : aucun « flash », contenu ne déborde plus à 1185px et reste lisible jusqu'à ~1024px.
- Créer une règle « Tranche 2 – J+7 à 09:00 » → déclenchée lors du tick après 09:00 le jour J+7.
- Créer une règle absolue « 2026-06-01 14:30 » → déclenchée une seule fois après cette heure ; `last_run_at` empêche la répétition.
