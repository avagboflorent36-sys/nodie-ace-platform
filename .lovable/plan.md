# Optimisation du système de paiement & automatisations

## Objectifs
1. Suivi clair de tous les paiements (vue admin consolidée, états explicites, alertes).
2. Relances automatiques (email) sans action manuelle.
3. Règles d'automatisation par cohorte : blocage/déblocage d'accès, emails groupés.
4. Lien de paiement de la tranche 2 → renvoie vers l'espace étudiant (et non vers le formulaire d'inscription).

---

## 1. Lien tranche 2 — flux corrigé

Aujourd'hui : `inscription.$slug` est le seul point d'entrée Chariow → après paiement, l'utilisateur passe par `claim_token` et reformulaire.

Cible :
- Tranche 1 (ou paiement intégral) → reste sur `inscription.$slug` (utilisateur non encore inscrit).
- Tranche 2 → bouton "Payer tranche 2" sur `/etudiant/paiements` (déjà présent côté code), mais on s'assure que :
  - Le `success_url` Chariow pour la tranche 2 pointe vers `/etudiant/paiements?paid=2` (et non `/inscription/...`).
  - Le webhook Chariow lie directement la tranche 2 au `payment` existant via `student_id + cohort_id` (pas de `pending_enrollment` créé pour la tranche 2).
  - Affichage d'un toast de confirmation au retour.

Fichiers : `src/lib/chariow.functions.ts` (success_url conditionnel selon `installment_position`), `src/routes/api/public/hooks/chariow.$secret.ts` (skip claim flow pour position=2), `src/routes/_authenticated/etudiant/paiements.tsx` (toast `?paid=2`).

---

## 2. Tableau de bord paiements — admin

Refonte de `/admin/paiements` :
- KPIs en haut : Total encaissé, En attente de validation, En retard, Taux de complétion (par cohorte).
- Filtres combinables : cohorte, mode (1x/2x), statut, source (chariow/manuel), période.
- Timeline par étudiant (modal détail) : inscription → T1 → T2 → relances envoyées → blocage/déblocage.
- Badges visuels : "En retard X j", "Bloqué", "Relancé Xx", "Validé".
- Export CSV enrichi (déjà existant, ajouter colonnes relances + accès).

---

## 3. Moteur d'automatisation par cohorte

Nouvelle section "Automatisations" dans `/admin/cohortes/$id` avec 3 types de règles :

### A. Relances paiement (existe déjà partiellement — `cohort_reminder_rules`)
- UI plus claire : J-7, J-3, J-1, J+1, J+3, J+7 avec aperçu d'email.
- Templates personnalisables par cohorte (sujet + corps Markdown).

### B. Règles d'accès automatiques (nouveau)
Nouvelle table `cohort_access_rules` :
```
id, cohort_id, trigger ('payment_overdue'), offset_days (ex: +7),
action ('restrict_access' | 'restore_access' | 'send_email'),
enabled, created_at
```
- Exemples :
  - `J+7 après échéance T2 non payée` → `status='restricted'` sur `cohort_enrollments`.
  - `Validation T2` → `status='active'` automatiquement (déjà déclenchable par trigger DB).
- Implémentation : trigger Postgres `AFTER UPDATE` sur `payment_installments.status` + tâche cron quotidienne pour les délais.

### C. Campagnes email programmées (nouveau)
Nouvelle table `cohort_email_campaigns` :
```
id, cohort_id, subject, body_html, audience
  ('all' | 'paid_full' | 'paid_partial' | 'unpaid' | 'restricted'),
scheduled_at, sent_at, status
```
- UI : créer/programmer/dupliquer un email, choisir l'audience, prévisualiser, envoyer un test.
- Dispatch : cron horaire qui sélectionne les campagnes `scheduled_at <= now() AND sent_at IS NULL`.

---

## 4. Infrastructure (cron + jobs)

Un seul endpoint cron `POST /api/public/hooks/automation-tick` (protégé par `apikey` anon), planifié toutes les 15 min via `pg_cron` :
1. Calcule les échéances et déclenche les relances (`cohort_reminder_rules`).
2. Applique les règles d'accès (`cohort_access_rules`) : restrict / restore.
3. Envoie les campagnes dues (`cohort_email_campaigns`).
4. Loggue tout dans `automation_run_log` (audit + debug admin).

Trigger DB supplémentaire :
- À la validation de la tranche 2 → `cohort_enrollments.status = 'active'` automatique (déblocage immédiat sans attendre le cron).

---

## Détails techniques

### Migrations
1. `cohort_access_rules` (+ RLS admin only + GRANTs).
2. `cohort_email_campaigns` (+ RLS admin, GRANTs, index `(scheduled_at, status)`).
3. `automation_run_log` (id, run_at, type, payload jsonb, status).
4. Trigger `on_installment_validated_restore_access`.
5. Cron `pg_cron` toutes les 15 min vers `/api/public/hooks/automation-tick`.

### Server functions / routes
- `src/lib/automation.functions.ts` : CRUD règles + campagnes + envoi de test.
- `src/routes/api/public/hooks/automation-tick.ts` : exécution.
- Refactor `src/lib/reminders.functions.ts` pour partager le rendu d'emails (templates Markdown → HTML).

### UI nouvelle
- `src/routes/_authenticated/admin/cohortes.$id.tsx` : nouveaux blocs "Règles d'accès" et "Campagnes email" (à côté de "Relances automatiques").
- `/admin/paiements` : KPIs, filtres, modal timeline.

### Flux tranche 2
- `startChariowCheckout` : `success_url = installment_position === 2 ? '/etudiant/paiements?paid=2' : '/inscription/<slug>/merci?token=...'`.
- Webhook : si `installment_position=2` et `payment` existe déjà → MAJ directe, pas de `pending_enrollment`.

---

## Livrables (ordre d'implémentation)
1. Migrations DB (tables, trigger, GRANTs, cron).
2. Server functions automation + endpoint cron.
3. UI cohorte (règles d'accès + campagnes email).
4. Refonte vue admin paiements (KPIs + filtres + timeline).
5. Correction flux tranche 2 (success_url + webhook + toast).
6. Tests manuels : simuler un retard, vérifier blocage J+7, payer T2, vérifier déblocage automatique, lancer une campagne ciblée.
