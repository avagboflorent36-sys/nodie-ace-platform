## Objectif
Afficher **toutes** les informations utiles sur la fiche étudiant `/admin/etudiants/$id` et activer les actions admin déjà prévues mais non câblées.

## Page actuelle (déjà présent)
- En-tête profil : avatar, nom, email, WhatsApp, pays, date d'inscription
- Onglets : Cohortes, Paiements, Progression, Réponses

## Ajouts prévus dans `src/routes/_authenticated/admin/etudiants.$id.tsx`

### 1. Bandeau d'actions admin (en haut, à droite du profil)
- **Bouton « Restreindre / Rétablir »** par inscription (toggle `cohort_enrollments.status` entre `active` ↔ `restricted`)
- **Bouton « Relancer paiements »** → appelle `sendPaymentReminders` (déjà importé mais inutilisé)
- **Bouton « Envoyer une notification »** → crée une ligne dans `notifications` (titre + message via dialog)
- **Badge rôle** (admin / student) lu depuis `user_roles`

### 2. Carte « Vue d'ensemble » (KPIs)
- Nombre de cohortes actives / restreintes
- Total payé / total dû (toutes cohortes confondues, en FCFA)
- Échéances en retard (compteur rouge)
- Taux de progression global (ressources complétées / total ressources des cohortes inscrites)

### 3. Onglet « Cohortes » enrichi
- Ajouter colonnes : progression (%), montant payé / total, prochaine échéance
- Bouton inline « Restreindre / Rétablir » par ligne

### 4. Onglet « Paiements » enrichi
- Afficher les **preuves de paiement** (lien signed URL vers `payment-proofs`)
- Bouton « Valider / Rejeter » par échéance soumise mais non validée
- Historique des relances envoyées (depuis `payment_reminders`)

### 5. Nouvel onglet « Notifications »
- Liste des notifications reçues par l'étudiant (`notifications` filtrées par `user_id`)
- Statut lu/non lu, date

### 6. Nouvel onglet « Activité »
- Timeline fusionnée : inscriptions, paiements soumis/validés, ressources complétées, réponses au formulaire
- Triée par date décroissante

### 7. Onglet « Réponses » enrichi
- Inclure aussi les réponses sans cohorte (inscription publique en attente)
- Mapper les `field_key` vers les `label` lisibles via `form_fields`

## Détails techniques
- Étendre le `useQuery` pour récupérer en parallèle : `user_roles`, `notifications`, `payment_reminders`, totaux d'agrégation
- Ajouter des `useMutation` pour : toggle restriction, validation/rejet d'échéance, envoi notification, relance paiement
- Invalidation du cache `["admin-student", id]` après chaque mutation
- Utiliser `supabase.storage.from("payment-proofs").createSignedUrl()` pour les preuves
- Pas de changement de schéma DB nécessaire — toutes les tables existent déjà
- Pas de nouveau package nécessaire

## Hors périmètre
- Édition des infos profil (email/whatsapp/pays) — l'étudiant le fait depuis `/etudiant/profil`
- Suppression du compte étudiant
- Export PDF de la fiche