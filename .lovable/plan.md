
# Finalisation de la plateforme

État actuel : la majorité des écrans existent. Plusieurs sont incomplets (certificat, live, support sont des stubs) et il manque l'écran **paiements côté étudiant** ainsi que **l'envoi automatique des relances**. Ce plan rend chaque fonctionnalité opérationnelle de bout en bout.

---

## 1. Espace étudiant — combler les manques

### 1.1 Nouvel écran "Mes paiements" `/etudiant/paiements`
Route absente aujourd'hui (les relances pointent dessus mais elle n'existe pas).
- Liste des paiements de l'étudiant (table `payments` + `payment_installments`)
- Pour chaque tranche : montant, échéance, statut (badge couleur), bouton **Téléverser une preuve** (upload vers bucket `payment-proofs`, sous-dossier `userId/`) qui passe la tranche en `submitted`
- Bandeau de retard si une échéance est dépassée et non validée
- Ajout dans la sidebar étudiant (icône `Wallet`)

### 1.2 Écran "Séances live" `/etudiant/live`
Aujourd'hui minimal. À compléter :
- Sessions à venir + sessions passées (séparation par date)
- Bouton "Rejoindre" pointant sur `meeting_link`
- Realtime sur la table `live_sessions`

### 1.3 Écran "Certificat" `/etudiant/certificat`
Aujourd'hui un simple placeholder.
- Vérifier l'éligibilité : formation `paid` + 100 % de progression (`progress_tracking` couvre toutes les `ressources` des `modules` de la cohorte)
- Si éligible : carte certificat avec nom, formation, date, bouton **Télécharger en PDF** (rendu côté client via `jspdf`)
- Sinon : barre de progression + ce qu'il reste à faire

### 1.4 Écran "Support" `/etudiant/support`
Aujourd'hui un simple placeholder.
- Formulaire de contact (sujet, message) qui crée une `notifications` de type `support` pour tous les admins (et email via Resend)
- Liens WhatsApp / email statiques en bas

### 1.5 Profil étudiant (avatar + infos)
Nouvelle route `/etudiant/profil` :
- Édition `first_name`, `last_name`, `whatsapp`, `country`
- Upload avatar dans bucket `avatars`
- Accessible depuis l'AppShell

---

## 2. Espace admin — finalisations

### 2.1 Ajout dans `etudiants.$id.tsx`
- Bouton **Restreindre / Rétablir** par cohorte (toggle `cohort_enrollments.status`)
- Bouton **Envoyer une relance** pour les tranches en retard de cet étudiant

### 2.2 Annonces par cohorte (déjà table `annonces`, manque l'UI admin)
Dans `cohortes.$id.tsx`, ajouter un onglet "Annonces" :
- Liste, création, suppression (déjà des policies admin)
- L'insertion crée automatiquement une notification in-app pour chaque étudiant de la cohorte

### 2.3 Sessions live (table `live_sessions`)
Dans `cohortes.$id.tsx`, onglet "Live" :
- Liste des sessions, créer/éditer/supprimer (titre, date, lien Zoom, description)

### 2.4 Export CSV
- Bouton "Exporter CSV" sur `/admin/etudiants` et `/admin/paiements`

---

## 3. Paiements & relances automatiques

### 3.1 Cron de relances quotidien
La fonction `sendPaymentReminders` existe déjà et utilise Resend. À automatiser :
- Créer une route publique `src/routes/api/public/hooks/payment-reminders.ts` qui :
  - Lit toutes les tranches `pending`/`partial` non validées
  - Pour chaque cohorte, applique les `cohort_reminder_rules` actives (X jours avant/après échéance)
  - Évite les doublons (consulte `payment_reminders` pour ne pas renvoyer la même relance le même jour)
  - Envoie via Resend, log dans `payment_reminders`
- Cron `pg_cron` quotidien à 9h appelant cette route avec `apikey`

### 3.2 Sender Resend
Aujourd'hui : `onboarding@resend.dev` (sandbox).
- Demander si un domaine est déjà vérifié sur Resend → sinon laisser `onboarding@resend.dev` pour les tests
- Centraliser dans une constante `EMAIL_FROM`

### 3.3 Emails transactionnels
Envois directs (sans cron) via Resend pour :
- Inscription à une cohorte (confirmation)
- Validation d'un paiement
- Réception d'une réponse support

---

## 4. Détails techniques

**Nouvelles routes**
- `src/routes/_authenticated/etudiant/paiements.tsx`
- `src/routes/_authenticated/etudiant/profil.tsx`
- `src/routes/api/public/hooks/payment-reminders.ts`

**Routes refondues**
- `etudiant/live.tsx`, `etudiant/certificat.tsx`, `etudiant/support.tsx`
- `admin/cohortes.$id.tsx` (onglets Annonces + Live)
- `admin/etudiants.$id.tsx` (actions restreindre/relancer)
- `admin/etudiants.index.tsx`, `admin/paiements.tsx` (export CSV)

**Nouveau helper**
- `src/lib/email.functions.ts` : `sendTransactionalEmail({ to, subject, html })` réutilisé par support, validation paiement, inscription

**Migration SQL**
- Politique storage `avatars` : autoriser l'upload de l'avatar du user (préfixe `userId/`)
- Politique storage `payment-proofs` : autoriser upload sur préfixe `userId/`
- Cron `pg_cron` quotidien (via tool `supabase--insert`, pas migration)

**Dépendances**
- Aucune nouvelle, `jspdf` à installer pour le certificat (`bun add jspdf`)

**Domaine Resend**
- Si l'utilisateur a un domaine vérifié, on l'utilise ; sinon on reste sur `onboarding@resend.dev` (limite : envoi uniquement à l'adresse du compte Resend). Je le confirmerai en cours d'implémentation.

---

## Ce qui n'est PAS dans ce plan
- Génération de PDF côté serveur (le PDF certificat est fait côté client, suffisant)
- Marketing emails / newsletters
- Système de chat en direct support (formulaire + notifications suffisent)
- Intégration paiement en ligne (Stripe/Paddle) — non demandé, le flux reste preuve de virement
