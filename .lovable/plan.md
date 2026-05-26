
# Plan de refonte — Phase 2 Nodie IA Academy

## 1. Cohortes enrichies (cœur du système)

Chaque cohorte devient le conteneur central : formation associée, ressources, formulaire d'inscription, échéances de paiement.

**Création d'une cohorte (wizard en 4 étapes) :**
1. **Infos générales** — nom, formation liée, dates début/fin, lien Zoom, statut.
2. **Tarification** — prix complet, prix en 2x, dates limites des tranches (ex: tranche 1 avant J+15, tranche 2 avant J+45). Ces dates servent aux relances automatiques.
3. **Formulaire d'inscription personnalisé** — l'admin compose les champs que les prospects rempliront : texte court, texte long, email, téléphone, choix unique, choix multiple, fichier. Champs réorganisables, marquables obligatoires. Les 4 champs de base (prénom, nom, email, WhatsApp) restent imposés.
4. **Récapitulatif + génération du lien d'inscription public** (`/inscription/$slug`).

**Page détail d'une cohorte (admin) :**
- Onglet **Vue d'ensemble** : KPIs (inscrits, payés, en attente, restreints).
- Onglet **Étudiants** : liste avec statut paiement et accès.
- Onglet **Contenu** : gestion modules + ressources (déplacé depuis l'ancienne page Contenu).
- Onglet **Formulaire** : édition du formulaire personnalisé + lien à partager.
- Onglet **Réponses formulaire** : voir toutes les réponses des prospects.
- Onglet **Paramètres** : tarifs, échéances, Zoom, statut.

## 2. Suppression de la page "Contenu" globale

L'item "Contenu" disparaît de la sidebar admin. Toute la gestion de contenu se fait désormais **dans la cohorte concernée**, ce qui isole naturellement les ressources : un étudiant inscrit dans la cohorte A ne voit que les ressources de A ; s'il est aussi dans B, il voit aussi celles de B sur son espace.

## 3. Page Formations enrichie

La page Formations devient un catalogue éditorial complet :
- Titre, description longue, image de couverture, prix, durée.
- **Contenu pédagogique global** (visible avant inscription) : vidéos d'intro, playlists YouTube/Vimeo, replays, documents PDF de présentation, programme détaillé.
- Ces ressources de formation sont **visibles par tous les inscrits** d'une cohorte de cette formation (en plus des ressources spécifiques de la cohorte).

Sur l'espace étudiant, la page **Ressources** affichera deux blocs par cohorte :
- Ressources de la formation (communes).
- Ressources de la cohorte (spécifiques).

## 4. Inscription publique dynamique

La route `/inscription/$slug` charge le formulaire personnalisé de la cohorte et le rend automatiquement (champs dynamiques). À la soumission :
- Création du compte étudiant (si nouveau).
- Enregistrement des réponses dans une table `form_responses`.
- Création du `payment` avec mode choisi (1x ou 2x) et `payment_installments` avec dates limites issues de la cohorte.
- Upload de la preuve de paiement (1ère tranche).

## 5. Page Paiements — filtres et vue globale

Refonte avec onglets :
- **Tous** — toutes les tranches.
- **Payé intégralement (1x)** — étudiants ayant payé en une fois.
- **En 2x — à jour**.
- **En 2x — en retard** (tranche dépassée, non payée).
- **À valider** (preuve soumise, en attente admin).
- **Restreints** (accès bloqué).

Chaque ligne montre : étudiant, cohorte, mode, montant total / payé, prochaine échéance, bouton **Valider / Rejeter / Restreindre / Rétablir**.

## 6. Relances automatiques (nouveau)

**Manuel (bouton admin) :**
Sur la page Paiements, bouton **"Relancer les retardataires"** → sélectionne tous les étudiants avec une tranche dépassée non payée → envoie un email Resend avec rappel + lien vers leur espace paiement.

Sélection fine : checkboxes pour choisir individuellement avant relance.

**Automatique (cron quotidien) :**
Tâche `pg_cron` qui tourne chaque jour à 9h :
- Détecte les tranches dont la date limite arrive dans 3 jours → email "rappel amical".
- Détecte les tranches dépassées → email "relance" + crée une notification in-app.
- Après 7 jours de dépassement sans paiement → bascule `enrollment.status = 'restricted'` automatiquement (l'étudiant perd l'accès aux ressources via les policies RLS existantes basées sur `is_student_active`).

**Côté étudiant :**
Bandeau d'alerte sur le dashboard si une échéance approche, avec bouton **"Je confirme que je paierai avant le [date]"** (engagement enregistré).

## 7. Restriction d'accès

- Statut `restricted` dans `cohort_enrollments` → la fonction `is_student_active` retourne `false` → toutes les ressources, modules, lives deviennent invisibles via RLS (déjà en place).
- L'étudiant voit uniquement un écran "Accès suspendu — régularisez votre paiement" + sa page paiements.
- Bouton admin **"Rétablir l'accès"** sur fiche étudiant et page Paiements.

## 8. Détails techniques

### Nouvelles tables
- `form_fields` (cohort_id, label, type, options jsonb, required, position).
- `form_responses` (cohort_id, student_id, answers jsonb, created_at).
- `payment_reminders` (installment_id, sent_at, channel, status) — log des relances.

### Modifications de tables existantes
- `cohortes` : ajouter `installment_1_deadline_days`, `installment_2_deadline_days`, `reminder_days_before` (int[]).
- `payment_installments` : ajouter `student_confirmed_at` (engagement de paiement).
- `cohort_enrollments` : valeur `restricted` ajoutée à l'enum `enrollment_status`.
- `formations` : ajouter `long_description`, `cover_image_url`, `program jsonb`.
- Nouvelle table `formation_resources` (formation_id, title, type, url, position) pour les ressources globales de formation.

### Email Resend
- Server function `sendReminderEmail` (createServerFn POST) appelée par le bouton manuel ET par la route cron.
- Route cron : `/api/public/hooks/daily-reminders` appelée par `pg_cron`.
- Secret `RESEND_API_KEY` (déjà demandé en Phase 1, à confirmer présent — sinon `add_secret`).

### UI
- Wizard cohorte = Dialog en 4 steps avec barre de progression.
- Builder de formulaire = liste draggable (dnd-kit) avec preview live à droite.
- Page détail cohorte = onglets shadcn `Tabs`.
- Page Paiements = `Tabs` + `Table` avec filtres et actions groupées.

### Sidebar admin (mise à jour)
Vue d'ensemble · Étudiants · Formations · Cohortes · Paiements · Relances · Notifications  
(suppression de "Contenu")

## 9. Ordre d'exécution

1. Migration DB (nouvelles tables, enums, colonnes).
2. Wizard de création de cohorte + formulaire builder.
3. Page détail cohorte avec onglets (contenu, formulaire, étudiants, réponses, paramètres).
4. Suppression de la page Contenu globale + nettoyage sidebar.
5. Refonte page Formations (édition complète + ressources globales).
6. Refonte page inscription publique (rendu dynamique du formulaire).
7. Refonte espace étudiant (affichage ressources formation + cohorte, gestion restriction).
8. Refonte page Paiements (onglets, filtres, actions).
9. Système de relances (server fn email + bouton manuel + cron quotidien + bandeau étudiant).
10. Restriction automatique + écran "accès suspendu".

---

**Question rapide avant de lancer :** confirmes-tu que le secret `RESEND_API_KEY` est déjà configuré ? Si non, je te le demanderai au moment d'activer les relances email. Tout le reste peut démarrer immédiatement.
