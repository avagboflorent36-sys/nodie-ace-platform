# Étape 1 — Intégration Chariow complète

Webhook validé côté Chariow. On livre maintenant tout le pipeline en une fois.

## 1. Secrets

- `CHARIOW_API_KEY` (Bearer Chariow, à demander à l'utilisateur via add_secret)
- `CHARIOW_WEBHOOK_URL_SECRET` = `7f3e9c8a2b1d4e6f5a0c8b9d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f` (déjà collé dans Chariow)

## 2. Migration base de données

**`cohortes`** : `chariow_product_id_full`, `chariow_product_id_installment_1`, `chariow_product_id_installment_2` (text nullable)

**`payments`** : `chariow_sale_id` (text, unique nullable), `chariow_customer_email` (text), `source` (text default `'manual'`)

**`payment_installments`** : `chariow_sale_id` (text, unique nullable), `chariow_raw_payload` (jsonb)

**Nouvelle `chariow_webhook_events`** (idempotence + audit) — `event_type`, `sale_id`, `payload jsonb`, `received_at`, `processed_at`, `error`, UNIQUE(`event_type`, `sale_id`). RLS : admin only.

**Nouvelle `pending_enrollments`** (paiement reçu avant compte créé) — `cohort_id`, `email`, `first_name`, `last_name`, `phone`, `chariow_sale_id`, `mode`, `installment_position`, `claim_token` (unique), `claimed_at`. RLS : admin read, insert via service role.

## 3. Backend

**`src/lib/chariow.server.ts`** — helpers `chariowFetch`, `verifySale(sale_id)`, `initCheckout(payload)`.

**`src/lib/chariow.functions.ts`** — server fns :
- `startChariowCheckout(cohort_id, mode, position, contact)` → POST `/v1/checkout`, retourne `checkout_url`
- `fetchSaleStatus(sale_id)` → public, renvoie `{status, amount, currency}` seulement
- `claimPendingEnrollment(claim_token)` (auth) → lie le payment à `auth.uid()`, crée `cohort_enrollment`
- `syncChariowSale(sale_id)` (admin) → resync manuel
- `setCohortChariowProducts(cohort_id, ids)` (admin)

**`src/routes/api/public/hooks/chariow.$secret.ts`** — webhook :
1. Comparaison constant-time du secret de l'URL avec `CHARIOW_WEBHOOK_URL_SECRET`
2. Parse + Zod
3. Insert dans `chariow_webhook_events` (UNIQUE → idempotent)
4. `GET /v1/sales/{id}` pour re-vérifier le payload
5. Lit `custom_metadata` (cohort_id, mode, position)
6. Crée/MAJ `payments` + `payment_installments` (status=validated, source=chariow)
7. Liaison email → `profiles` : si trouvé → `student_id` direct + `cohort_enrollment`, sinon → `pending_enrollments` + email "Finalisez votre inscription"
8. MAJ `processed_at` ou `error`

## 4. Frontend

**Admin `cohortes.$id.tsx`** — section "Intégration Chariow" :
- 3 inputs Product ID + bouton Save
- URL webhook affichée (read-only) + bouton copier

**Public `inscription.$slug.tsx`** — refonte 3 états :
- défaut : choix mode (1x / tranche 1 de 2x) + form minimal (email, prénom, nom, tel) → bouton "Payer via Chariow" → redirect `checkout_url`
- `?sale=xxx` : `fetchSaleStatus` confirme → formulaire complet (form_fields) pré-rempli + signup compte → `claimPendingEnrollment` à la création
- `?claim=xxx` : idem via lien email

**Étudiant `/etudiant/paiements`** : badge "Payé via Chariow ✓" sur les lignes `source=chariow` + bouton "Payer tranche 2" qui appelle `startChariowCheckout` pour position 2

**Admin `/admin/paiements`** : colonne Source (badge Chariow/Manuel), bouton resync sur les lignes chariow, nouvel onglet "Webhooks" listant `chariow_webhook_events`

## 5. Email transactionnel

Template "Finalisez votre inscription" envoyé quand le webhook ne trouve pas le profile — contient lien `/inscription/{slug}?claim={claim_token}`.

## Sécurité

- Secret webhook en path, comparaison constant-time
- Re-vérification `GET /v1/sales/{id}` systématique
- Idempotence UNIQUE(event_type, sale_id)
- `claim_token` 32 octets hex, expiration 30j
- `fetchSaleStatus` renvoie status+montant uniquement (pas de PII)
- Validation Zod sur tout payload

## Ordre d'exécution

1. Migration DB (avec approbation utilisateur)
2. `add_secret` pour `CHARIOW_API_KEY` (l'utilisateur le colle)
3. Helpers + server fns + webhook
4. UI admin cohorte
5. Refonte page inscription
6. UI étudiant + admin paiements
7. Email "Finalisez"

## Étape 2 (après 1er paiement test réel)

Ajustements si Chariow envoie des champs imprévus (visibles dans `chariow_webhook_events.payload`), polishing email.
