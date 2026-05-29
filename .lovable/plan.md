
## 1. Pré-remplir le formulaire après paiement (fin des doublons)

**Problème** : à l'étape 1 (`CheckoutStep`), l'étudiant saisit déjà `firstName`, `lastName`, `email`, `phone`. Au retour de Chariow (`PostPaymentStep`), tous ces champs sont vides et il doit les ressaisir.

**Solution** : récupérer les infos déjà saisies via le token et pré-remplir.

- Nouveau server fn `getPrefillFromToken` dans `src/lib/chariow.functions.ts` :
  - input : `{ attemptToken?, claimToken?, saleId? }`
  - lit `chariow_payment_attempts` (par token) → `first_name, last_name, email, phone` ; fallback `pending_enrollments` (par claim_token) ; fallback `chariow_payment_attempts` (par sale_id).
  - public, pas de `requireSupabaseAuth` (l'utilisateur n'a pas encore de compte).
- Dans `PostPaymentStep` (`src/routes/inscription.$slug.tsx`) :
  - `useQuery` qui appelle `getPrefillFromToken` dès qu'un token est présent.
  - `useEffect` initialise `form.firstName/lastName/email/whatsapp` depuis le résultat (sans écraser une saisie déjà en cours).
  - Les champs `email` et `whatsapp` deviennent `readOnly` quand pré-remplis (avec petit texte « issu de votre paiement »), `firstName/lastName` restent éditables.
  - Le champ `country` et `password` restent à remplir → fin de la répétition pour les 4 champs déjà fournis.

## 2. Bouton WhatsApp sur la page Étudiants + format unifié

- **Validation à l'inscription** (`src/lib/validators.ts` + `CheckoutStep` + post-payment) : `whatsapp` normalisé au format international `+225XXXXXXXX` (regex `^\+?[1-9]\d{6,14}$`, on retire espaces/tirets/parenthèses avant insert). Petit texte d'aide sous le champ : « Format international avec indicatif, ex : +22507XXXXXXXX ».
- **`etudiants.index.tsx`** : nouvelle colonne « WhatsApp » avec bouton icône (lucide `MessageCircle`/logo WA) :
  ```
  href = `https://wa.me/${whatsapp.replace(/\D/g,"")}`
  target="_blank" rel="noopener noreferrer"
  ```
  `e.stopPropagation()` pour ne pas déclencher la navigation vers la fiche étudiant.
- Idem dans la fiche étudiant (`etudiants.$id.tsx`) le lien existe déjà, on garde.
- Pour les profils existants au mauvais format : aucun backfill destructif, le bouton fonctionne dès lors qu'il y a au moins 7 chiffres ; sinon le bouton est désactivé avec tooltip.

## 3. Déblocage du certificat par étudiant (admin → étudiant)

**Migration** (à approuver) :
- Ajouter colonnes sur `cohort_enrollments` :
  - `certificate_unlocked_at timestamptz null`
  - `certificate_unlocked_by uuid null`
- Politique RLS : déjà couverte (étudiant lit son enrollment, admin gère).

**Admin** (`etudiants.$id.tsx`, onglet Cohortes) :
- Nouvelle colonne « Certificat » avec bouton `Débloquer` / `Verrouiller`.
- Mutation `supabase.from("cohort_enrollments").update({ certificate_unlocked_at: ... , certificate_unlocked_by: admin.id })`.

**Étudiant** (`src/routes/_authenticated/etudiant/certificat.tsx`) :
- La query récupère aussi `certificate_unlocked_at` par cohorte.
- `eligible` devient : `certificate_unlocked_at != null` (le déblocage admin remplace les conditions paiement+progression — l'admin a la responsabilité finale). Les conditions actuelles deviennent informatives seulement (badge « progression 80% » etc.).
- Quand non débloqué : message « Votre certificat sera disponible une fois validé par l'équipe ».
- Quand débloqué : bouton « Télécharger » (PDF déjà existant).

## 4. Suppression complète de l'onglet « Automatisations »

Dans `src/routes/_authenticated/admin/cohortes.$id.tsx` :
- Retirer le `<TabsTrigger value="automations">` et son `<TabsContent>`.
- Supprimer les fonctions `AutomationsTab`, `ReminderRulesEditor`, `AccessRulesEditor`, `EmailCampaignsEditor` et toute UI associée.
- Retirer l'import `from "@/lib/automation.functions"`.

Conservé (non détruit) : tables `cohort_reminder_rules`, `cohort_access_rules`, `cohort_email_campaigns`, `automation_run_log`, le cron `automation-tick` et `automation.server.ts`. Raison : éviter de casser les données / cron déjà programmés ; juste retirer l'accès UI comme demandé. Si tu veux aussi supprimer les tables, dis-le et j'ajouterai une migration `DROP TABLE`.

## Ordre d'exécution

1. Migration SQL (ajout colonnes certificat) → approbation.
2. Edits frontend en parallèle (inscription prefill, étudiants WhatsApp + certificat, suppression onglet automatisations).
3. Vérif build.
