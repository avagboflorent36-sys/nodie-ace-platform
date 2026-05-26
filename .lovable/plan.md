# Plan : 3 améliorations admin

## 1. Fiche étudiant complète

**Nouvelle route** `src/routes/_authenticated/admin/etudiants.$id.tsx`
- Rendre les lignes du tableau `etudiants.tsx` cliquables (Link vers `/admin/etudiants/$id`).
- Page de détail avec onglets ou sections :
  - **Profil** : nom, email, WhatsApp, pays, date d'inscription, avatar.
  - **Cohortes** : liste des `cohort_enrollments` (cohorte, formation, statut, date), avec bouton activer/restreindre.
  - **Paiements** : tous les `payments` + `payment_installments` (mode, montants, échéances, statut, preuve, dates de validation).
  - **Progression** : ressources complétées (`progress_tracking`) regroupées par module/cohorte.
  - **Réponses au formulaire** : `form_responses` (cohorte + réponses JSON formatées).
  - **Activité** : annonces lues, sessions live à venir de ses cohortes.

## 2. Statistiques par formation

**Nouvel onglet/page** sur `admin/formations.tsx` (section « Statistiques » dans `FormationDetail`).
- Pour la formation sélectionnée, agréger sur toutes ses cohortes :
  - Nombre total d'inscrits, actifs, restreints.
  - Répartition par cohorte (tableau : cohorte, inscrits, actifs, % paiement, % progression moyenne).
  - Taux de complétion moyen (ressources complétées / total).
  - Revenus encaissés vs. attendus (sum `amount_paid` / `amount_total`).
  - Graphique simple inscriptions par mois (recharts déjà dispo).

## 3. Tranches de paiement & relances configurables

**Sur la cohorte** (`admin/cohortes.$id.tsx`, onglet « Paramètres ») :
- Ajouter une section **Plan de paiement** :
  - Liste éditable des tranches (position, label, % ou montant, jours avant échéance) — stockée dans une nouvelle table `cohort_payment_schedule` (cohort_id, position, amount_or_percent, due_offset_days, label) **OU** étendre les colonnes `installment_*_deadline_days` existantes vers un JSON `payment_schedule jsonb` sur `cohortes`. → Choix : **nouvelle table** pour permettre N tranches au lieu de 2.
  - Champs : prix 1x, prix nx (déjà existants).
- Ajouter une section **Relances automatiques** :
  - Nouvelle table `cohort_reminder_rules` (cohort_id, days_before|days_after, channel email/whatsapp, template_key, enabled).
  - UI : liste de règles (ex : J-7 email, J-3 email, J+1 whatsapp), toggle on/off, choix du canal et du modèle.
  - Cron déjà existant via `sendPaymentReminders` → adapter pour lire ces règles et déclencher chaque jour via un endpoint `api/public/hooks/payment-reminders` planifié avec pg_cron.

## Migrations DB

```sql
-- Tranches paramétrables
CREATE TABLE public.cohort_payment_schedule (
  id uuid PK default gen_random_uuid(),
  cohort_id uuid NOT NULL,
  position int NOT NULL,
  label text,
  percent numeric,            -- % du total (si null → amount fixe)
  amount numeric,
  due_offset_days int NOT NULL, -- jours après inscription
  created_at timestamptz default now()
);
GRANT SELECT ON public.cohort_payment_schedule TO anon, authenticated;
GRANT ALL ON public.cohort_payment_schedule TO service_role, authenticated;
ALTER TABLE ... ENABLE RLS;
-- Anyone reads / Admins manage

-- Règles de relance
CREATE TABLE public.cohort_reminder_rules (
  id uuid PK,
  cohort_id uuid NOT NULL,
  offset_days int NOT NULL,   -- négatif = avant, positif = après
  channel text NOT NULL,      -- 'email' | 'whatsapp'
  template_key text NOT NULL, -- ex 'reminder_before', 'reminder_overdue'
  enabled bool default true,
  created_at timestamptz default now()
);
-- GRANTs + RLS admin manage / authenticated read
```

À la création d'un `payment` en mode `installments_N`, les `payment_installments` sont générés à partir de `cohort_payment_schedule` (inscription_date + due_offset_days).

## Fichiers impactés

- **Nouveau** : `src/routes/_authenticated/admin/etudiants.$id.tsx`
- **Édit** : `src/routes/_authenticated/admin/etudiants.tsx` (lignes cliquables)
- **Édit** : `src/routes/_authenticated/admin/formations.tsx` (bloc statistiques)
- **Édit** : `src/routes/_authenticated/admin/cohortes.$id.tsx` (onglet Paramètres : tranches + relances)
- **Édit** : `src/lib/reminders.functions.ts` (lecture des règles)
- **Migrations** : 2 nouvelles tables + RLS + GRANTs
- **Cron** : route `api/public/hooks/daily-reminders` + pg_cron quotidien

## Confirmation demandée
1. OK pour 2 nouvelles tables (`cohort_payment_schedule`, `cohort_reminder_rules`) ?
2. OK pour cron quotidien automatique des relances ?
