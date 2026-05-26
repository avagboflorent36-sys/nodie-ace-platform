
# Plan — Nodie IA Academy (Phase 1)

Plateforme SaaS éducative premium : LMS + CRM étudiant + gestion paiements (preuve manuelle) + ressources pédagogiques.

## Stack
- React + Vite + TailwindCSS + Shadcn UI
- Lovable Cloud (Supabase) : Auth, DB, Storage, RLS
- Recharts pour les graphiques
- Design system : noir / blanc / jaune doré / gris clair, sidebar pro, cartes modernes, dark mode

## Périmètre de cette itération (Phase 1 complète)

### 1. Design system & Landing publique
- Tokens couleurs (noir #0A0A0A, jaune doré #F5B400, gris clair, blanc) dans `index.css` + `tailwind.config`
- Landing : Hero, présentation académie, liste formations (depuis DB), témoignages, FAQ, CTA inscription, footer
- Animations fluides, hover, responsive

### 2. Authentification (Lovable Cloud)
- Sign up / Login / Forgot password / Reset password
- Email auto-confirm activé (pas d'OTP email pour éviter friction en dev)
- 3 rôles via table `user_roles` séparée + enum `app_role` (`super_admin`, `admin`, `student`) + fonction `has_role()` SECURITY DEFINER
- Protection des routes par rôle, redirection auto vers le bon dashboard

### 3. Base de données (migrations Supabase)
Tables avec RLS activée sur chacune :
- `profiles` (id ↔ auth.users, nom, prénom, téléphone, pays, avatar)
- `user_roles` (user_id, role)
- `formations` (titre, description, image, prix, durée)
- `cohortes` (formation_id, nom, date_début, date_fin, statut, lien_zoom)
- `cohort_enrollments` (student_id, cohort_id, statut, date_inscription)
- `modules` (cohort_id, titre, ordre, description)
- `ressources` (module_id, type [video|document|link|exercice], titre, url, fichier_path)
- `live_sessions` (cohort_id, titre, date, lien)
- `annonces` (cohort_id, titre, contenu)
- `payments` (student_id, cohort_id, montant_total, mode [unique|2x], statut [paye|partiel|attente|retard|suspendu], date_limite)
- `payment_installments` (payment_id, montant, date_echeance, statut, preuve_path, validated_at, validated_by)
- `progress_tracking` (student_id, ressource_id, completed, completed_at)
- `notifications` (user_id, type, titre, contenu, lu)

Storage buckets : `payment-proofs` (privé), `ressources` (privé), `avatars` (public)

### 4. Formulaire d'inscription cohorte
- Route publique `/inscription/:cohort_slug`
- Champs : nom, prénom, email, WhatsApp, pays, formation (auto), mode paiement (1x/2x), upload preuve
- Au submit : créer compte Supabase Auth + profile + enrollment + payment + 1er installment avec preuve
- Redirection vers dashboard étudiant

### 5. Dashboard Étudiant
Sidebar : Accueil, Mes formations, Ressources, Séances live, Progression, Paiements, Certificat (placeholder), Support
- Accueil : carte progression, statut paiement, prochaines séances, notifications, calendrier
- Mes formations : cohortes inscrites
- Ressources : liste par module (vidéos, docs, exercices) avec marquage progression
- Séances live : liste avec liens Zoom/Meet
- Paiements : historique, échéances, upload preuve pour 2e tranche
- **Restriction automatique** : si paiement en retard, masquer ressources/vidéos/live et afficher écran de suspension avec montant restant + bouton "Finaliser"

### 6. Dashboard Admin
Sidebar : Vue d'ensemble, Étudiants, Formations, Cohortes, Paiements, Ressources, Notifications
- **Vue d'ensemble** : KPIs (nb étudiants, revenus, paiements attente, suspendus, complétion moyenne), graphiques Recharts (revenus/mois, inscriptions/cohorte, statuts paiements)
- **Étudiants** : table avec recherche/filtres, voir détail (progression, paiements, historique), suspendre/réactiver, envoyer notification interne
- **Formations** : CRUD
- **Cohortes** : CRUD + gestion modules/ressources/séances/annonces (uploads vers Storage)
- **Paiements** : valider preuves uploadées, marquer comme payé, voir retards
- **Notifications** : temps réel via Supabase Realtime sur nouvelle inscription/paiement

### 7. Logique de restriction d'accès
- Fonction SQL `is_student_active(student_id, cohort_id)` → retourne true si paiement complet ou partiel non échu
- RLS sur `ressources` et `live_sessions` : SELECT autorisé seulement si étudiant actif
- Cron job (Edge Function + pg_cron) quotidien qui passe les échéances dépassées en `retard`/`suspendu`

### 8. Notifications temps réel
- Supabase Realtime sur table `notifications`
- Badge cloche dans header (admin + étudiant)
- Triggers DB : nouvelle inscription → notif admin ; validation paiement → notif étudiant

## Hors périmètre (itérations suivantes — à confirmer après Phase 1)
- **Phase 2** : Automatisation email Resend (séquences, éditeur workflow visuel), intégrations Flutterwave/Paystack/Stripe live, WhatsApp Cloud API, analytics avancés
- **Phase 3** : Certificats PDF + QR code, IA (recommandations, chatbot), gamification

## Détails techniques

**Sécurité** :
- RLS sur 100% des tables
- `user_roles` séparée + `has_role()` SECURITY DEFINER (pas de récursion RLS)
- Validation Zod côté client ET dans toutes les edge functions
- Uploads validés (taille, type MIME)
- Service role utilisé uniquement dans edge functions

**Edge Functions Phase 1** :
- `create-student-from-form` : créer compte + profile + enrollment + payment (preuve)
- `validate-payment` : admin valide une preuve, met à jour statut
- `check-overdue-payments` : cron quotidien, marque les retards

**Architecture frontend** :
```
src/
  pages/           landing, auth, /etudiant/*, /admin/*, /inscription/:slug
  components/      ui (shadcn), layout (Sidebar, Header), domain (StudentCard, PaymentBadge, ResourceItem...)
  hooks/           useAuth, useRole, useRealtime
  integrations/supabase/  (auto-généré)
  lib/             utils, validators (zod), constants
```

**Routing** : React Router avec `<ProtectedRoute role="admin|student">` wrapper.

**Email Resend** : Phase 2 — je vous demanderai à ce moment-là d'ajouter votre clé API Resend via le système de secrets sécurisés.

## Livrables de cette itération
À la fin : landing fonctionnelle, inscription via formulaire cohorte opérationnelle, étudiants accèdent à leurs ressources, admin gère cohortes/étudiants/paiements, restrictions auto en place. Le tout sur la palette noir/blanc/jaune doré avec UX premium.

Vu l'ampleur, je construirai par blocs cohérents dans l'ordre : design system → DB+Auth → Admin (CRUD cohortes) → Formulaire inscription → Espace étudiant → Restrictions/Notifications → Landing.
