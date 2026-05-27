# Plan d'intégration Chariow ↔ Nodie IA Academy (révisé selon la doc officielle)

## Doc Chariow utilisée
- Auth : `Authorization: Bearer <API_KEY>` (clé créée dans Settings → API Keys)
- Checkout : `POST https://api.chariow.com/v1/checkout`
  → champs clés : `product_id`, `email`, `first_name`, `last_name`, `phone.{number,country_code}`, `custom_metadata` (10 clés × 255 chars), `redirect_url` (supporte `{sale_id}`)
  → réponse : `{ step: "payment", payment: { checkout_url, transaction_id }, purchase: { id, amount } }`
- Pulses (webhooks) : POST JSON vers notre URL HTTPS — **PAS de signature HMAC**
  → events : `successful.sale`, `abandoned.sale`, `failed.sale`
  → payload : `{ event, sale: { id, amount, status, custom_metadata }, product, customer, store, checkout }`
- Sales : `GET /v1/sales/{id}` pour re-vérifier toute donnée critique

## Flux retenu (Paiement d'abord)

```
1. Prospect arrive sur /inscription/{slug-cohorte}
   → choisit son mode (1x ou 2x → tranche 1)
        ↓
2. Nodie appelle createChariowCheckout (server fn)
   → POST Chariow /v1/checkout avec custom_metadata = {
        cohort_id, mode: "full"|"installments_2",
        installment_position: 1|2,
        nodie_ref: <uuid>
     }
   → redirect_url = https://.../inscription/{slug}?sale={sale_id}
        ↓
3. Prospect redirigé vers checkout_url Chariow → paie
        ↓
4. Webhook successful.sale arrive sur /api/public/hooks/chariow/<URL_SECRET>
   - Vérifie token d'URL secret
   - GET /v1/sales/{id} pour re-vérifier le payload
   - Idempotent (table chariow_webhook_events sur sale.id+event)
   - Crée/MAJ payments + installments (status=validated, source=chariow)
   - Lie via custom_metadata.cohort_id + customer.email
   - Si user n'existe pas → crée un "pending profile" (claim par email)
   - Envoie email "Finalisez votre inscription" avec lien
        ↓
5. Prospect redirigé vers /inscription/{slug}?sale=sal_xxx
   - Server fn fetchSaleStatus(sale_id) → confirme paiement
   - Affiche formulaire pré-rempli (email/nom/prénom de Chariow)
   - Création compte Supabase → lie au payment existant (par email)
        ↓
6. Accès débloqué automatiquement
```

## Modifications base de données

### `cohortes` — colonnes ajoutées
- `chariow_product_id_full` (text) — ID produit Chariow pour paiement 1x
- `chariow_product_id_installment_1` (text) — ID produit Chariow pour tranche 1
- `chariow_product_id_installment_2` (text) — ID produit Chariow pour tranche 2

(On garde les IDs de produits Chariow plutôt que les URLs : permet d'utiliser l'API Checkout pour pré-remplir l'email/nom et passer du `custom_metadata`.)

### `payments` — colonnes ajoutées
- `chariow_sale_id` (text, unique nullable)
- `chariow_customer_email` (text)
- `source` (text, default 'manual') — 'chariow' | 'manual'

### `payment_installments` — colonnes ajoutées
- `chariow_sale_id` (text, unique nullable)
- `chariow_raw_payload` (jsonb)

### Nouvelle table `chariow_webhook_events` (idempotence + audit)
- `id`, `event_type`, `sale_id`, `received_at`, `payload` (jsonb), `processed_at`, `error`, UNIQUE(event_type, sale_id)

### Nouvelle table `pending_enrollments` (paiement reçu sans compte existant)
- `id`, `cohort_id`, `email`, `first_name`, `last_name`, `phone`, `chariow_sale_id`, `mode`, `installment_position`, `claim_token`, `created_at`, `claimed_at`
- Permet de lier le paiement à l'étudiant quand il crée son compte

## Backend

### 1. Webhook public — `src/routes/api/public/hooks/chariow.$secret.ts`
- Path inclut un secret (équivalent au secret du webhook) : `/api/public/hooks/chariow/<CHARIOW_WEBHOOK_URL_SECRET>`
- POST handler :
  1. Vérifie `params.secret === process.env.CHARIOW_WEBHOOK_URL_SECRET` (constant-time)
  2. Parse + valide payload Zod
  3. Insert dans `chariow_webhook_events` (UNIQUE → idempotent)
  4. Si `event === "successful.sale"` :
     - `GET /v1/sales/{sale.id}` avec `CHARIOW_API_KEY` pour re-vérifier
     - Lit `sale.custom_metadata.cohort_id` + `installment_position`
     - Cherche le profile par email → si existe : crée/MAJ payment+installment lié au student_id
     - Sinon : crée une `pending_enrollments` + génère email avec lien `claim`
  5. Retourne 200 rapidement (traitement synchrone court ; pour > 30 s on passerait async)

### 2. `src/lib/chariow.server.ts` (helpers serveur)
- `chariowFetch(path, init)` — wrapper fetch avec auth Bearer + base URL
- `verifySale(saleId)` — `GET /v1/sales/{id}` retourne sale vérifiée
- `initCheckout({ productId, email, firstName, lastName, phone, customMetadata, redirectUrl })` — `POST /v1/checkout`

### 3. `src/lib/chariow.functions.ts` (server functions)
- `startChariowCheckout({ cohortId, mode, installmentPosition, email, firstName, lastName, phone })`
  → choisit le bon `chariow_product_id_*` selon mode/position
  → appelle `initCheckout` avec `custom_metadata = { cohort_id, mode, installment_position, nodie_ref }`
  → `redirect_url = ${SITE_URL}/inscription/${slug}?sale={sale_id}`
  → retourne `{ checkout_url }`
- `fetchSaleStatus({ saleId })` (public, mais avec rate limit léger) — vérifie un sale_id côté serveur pour la page de retour
- `claimPendingEnrollment({ claimToken })` — appelée à la création de compte pour lier `pending_enrollments` au nouveau profile
- `syncChariowSale({ saleId })` (admin only) — resync manuel d'un sale manqué
- `setCohortChariowProducts({ cohortId, productIdFull, productIdInst1, productIdInst2 })` (admin only)

### 4. Email transactionnel — `src/lib/email.server.ts`
- Template `chariowPaymentReceived(to, { firstName, amount, currency, cohortName, claimUrl })`

## Frontend

### 1. `admin/cohortes.$id.tsx` — section "Intégration Chariow"
- 3 champs : Product ID 1x / Tranche 1 / Tranche 2
- Affichage URL webhook à coller dans Chariow Dashboard :
  `https://<site>/api/public/hooks/chariow/<CHARIOW_WEBHOOK_URL_SECRET>` (avec bouton "Copier")
- Note : "Configurez aussi les events successful.sale, abandoned.sale, failed.sale"
- Bouton "Tester la connexion API" → appelle un endpoint qui fait un GET /v1/store pour valider la clé

### 2. `inscription.$slug.tsx` — refonte
- **Étape 1 (par défaut)** : choix du mode (1x / 2x) + formulaire minimal (email, prénom, nom, téléphone, pays)
  → bouton "Payer maintenant" → appelle `startChariowCheckout` → redirige vers `checkout_url`
- **Étape 2 (URL contient `?sale=sal_xxx`)** : retour de Chariow
  → loader serveur appelle `fetchSaleStatus(saleId)`
  → si paid : affiche "Paiement reçu ✓" + formulaire complet (champs `form_fields` cohorte) + création de compte (signup avec email pré-rempli)
  → si pending : message "Paiement en cours de validation..."
- **Étape 3 (URL contient `?claim=xxx`)** : si l'utilisateur a cliqué sur le lien email
  → idem étape 2 mais via `claim_token` au lieu de `sale_id`

### 3. `/etudiant/paiements` — petites améliorations
- Badge "Payé via Chariow ✓" quand `source === 'chariow'`
- Pour 2x avec tranche 2 non payée : bouton "Payer la tranche 2" → `startChariowCheckout({ mode: 'installments_2', installment_position: 2 })`

### 4. `/admin/paiements`
- Colonne "Source" (Chariow / Manuel)
- Bouton "Resynchroniser" (saisie `sale_id` Chariow) → `syncChariowSale`
- Onglet "Webhooks Chariow" → liste des `chariow_webhook_events`

## Secrets requis

À configurer maintenant via `secrets--add_secret` :
- `CHARIOW_API_KEY` — Bearer API key Chariow
- `CHARIOW_WEBHOOK_URL_SECRET` — chaîne aléatoire qu'on génère, incluse dans l'URL webhook (sert de "secret partagé")
- `SITE_URL` — déjà optionnel mais à confirmer (utilisé pour `redirect_url`)

(Pas besoin de "CHARIOW_WEBHOOK_SECRET" HMAC : la doc Chariow ne mentionne pas de signature. La sécurité repose sur : URL secrète + re-vérification API.)

## Sécurité

- **Webhook** : URL contient un secret (32 octets hex), comparé en constant-time. Toute donnée critique est re-vérifiée via `GET /v1/sales/{id}`.
- **Idempotence** : UNIQUE(event_type, sale_id) dans `chariow_webhook_events`.
- **`fetchSaleStatus`** (public) : limité à retourner statut + montant + email/nom (déjà saisis par l'utilisateur sur Chariow), pas de PII supplémentaire.
- **`claim_token`** des `pending_enrollments` : 32 octets hex, expire 30 jours, usage unique.
- **Validation Zod** sur tous les payloads (webhook + server fns).

## URL à fournir à Chariow

```
https://project--66439da9-0337-4213-a275-40cffeef22c6.lovable.app/api/public/hooks/chariow/<CHARIOW_WEBHOOK_URL_SECRET>
```

Events à activer dans le dashboard Chariow :
- `successful.sale` (obligatoire)
- `abandoned.sale` (optionnel — logs uniquement)
- `failed.sale` (optionnel — logs uniquement)

## Plan de livraison

**Étape 1 — Cette session** :
1. Demander les 2 secrets Chariow
2. Migration BDD (colonnes + 2 nouvelles tables)
3. Helpers serveur `chariow.server.ts`
4. Webhook `/api/public/hooks/chariow/$secret`
5. Server fns `chariow.functions.ts` (startCheckout, fetchSaleStatus, claim, sync)
6. Refonte page `/inscription/$slug` avec les 3 étapes
7. UI admin cohorte (saisie Product IDs + URL webhook affichée)
8. Email template
9. Badge "Chariow" + bouton "Payer tranche 2" dans espace étudiant
10. Onglet "Webhooks" + colonne "Source" admin paiements

**Étape 2 — Après premier test réel** :
- Ajustement parser webhook si Chariow ajoute des champs imprévus (visibles dans `chariow_webhook_events.payload`)
- Polishing email
