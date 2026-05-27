# Plan — Intégration Chariow ↔ Nodie IA Academy

Basé sur la doc officielle Chariow (`chariow.dev`).

## Ce que Chariow nous offre (vérifié dans la doc)

- **Auth API** : `Authorization: Bearer <CHARIOW_API_KEY>` (créée dans Settings → API Keys)
- **API Checkout** (`POST /v1/checkout`) — on initie une vente depuis Nodie en passant :
  - `product_id`, `email`, `first_name`, `last_name`, `phone`
  - **`custom_metadata`** (10 clés max, 255 chars) → renvoyé tel quel dans le webhook
  - **`redirect_url`** avec placeholder `{sale_id}` → retour automatique vers Nodie après paiement
- **Pulses (webhooks)** — events `successful.sale`, `abandoned.sale`, `failed.sale` ; payload contient `sale.id`, `sale.amount`, `sale.custom_metadata`, `customer.{email,first_name,last_name,phone,country}`, `product.id`
- **Sales API** (`GET /v1/sales/{id}`) — pour re-vérifier un paiement côté serveur

⚠ Point d'attention : la doc ne mentionne **aucune signature HMAC** sur les webhooks. La sécurité repose donc sur :
1. URL webhook contenant un secret (path token)
2. Re-vérification systématique via `GET /v1/sales/{id}` avant toute action critique

## Flux retenu — "Paiement d'abord"

```text
1. Prospect → /inscription/{slug-cohorte}
   Choisit son mode (1x ou tranche 1 de 2x) + saisit email/nom/prénom/téléphone

2. Nodie appelle startChariowCheckout (server fn)
   → POST Chariow /v1/checkout avec :
       custom_metadata = { cohort_id, mode, installment_position }
       redirect_url    = https://.../inscription/{slug}?sale={sale_id}
   → retourne checkout_url

3. Prospect redirigé vers Chariow → paie

4. Chariow envoie webhook successful.sale → /api/public/hooks/chariow/<SECRET>
   - Vérifie le secret de l'URL
   - GET /v1/sales/{id} pour re-vérifier le payload
   - Idempotent via table chariow_webhook_events
   - Crée/MAJ payments + payment_installments (status=validated, source=chariow)
   - Lie par email : si profile existe → student_id direct
                     sinon → pending_enrollments + email "Finalisez l'inscription"

5. Prospect revient sur /inscription/{slug}?sale=sal_xxx
   - fetchSaleStatus(sale_id) confirme paiement
   - Affiche formulaire complet pré-rempli (form_fields cohorte)
   - Création de compte → liaison auto au payment via email
```

## Modifications base de données

**`cohortes`** — 3 colonnes ajoutées
- `chariow_product_id_full` (text) — produit Chariow paiement 1x
- `chariow_product_id_installment_1` (text) — produit tranche 1
- `chariow_product_id_installment_2` (text) — produit tranche 2

**`payments`** — 3 colonnes
- `chariow_sale_id` (text, unique nullable)
- `chariow_customer_email` (text)
- `source` (text, default `'manual'`) — `'chariow' | 'manual'`

**`payment_installments`** — 2 colonnes
- `chariow_sale_id` (text, unique nullable)
- `chariow_raw_payload` (jsonb)

**Nouvelle table `chariow_webhook_events`** — idempotence + audit
- `event_type`, `sale_id`, `payload` (jsonb), `received_at`, `processed_at`, `error`
- UNIQUE(`event_type`, `sale_id`)

**Nouvelle table `pending_enrollments`** — paiement reçu avant création de compte
- `cohort_id`, `email`, `first_name`, `last_name`, `phone`, `chariow_sale_id`, `mode`, `installment_position`, `claim_token`, `claimed_at`

## Backend (TanStack server)

1. **Webhook** : `src/routes/api/public/hooks/chariow.$secret.ts`
2. **Helpers** : `src/lib/chariow.server.ts` (`chariowFetch`, `verifySale`, `initCheckout`)
3. **Server fns** : `src/lib/chariow.functions.ts`
   - `startChariowCheckout` (public) — initie un paiement
   - `fetchSaleStatus` (public, info minimale) — vérifie un sale_id au retour
   - `claimPendingEnrollment` — liaison à la création de compte
   - `syncChariowSale` (admin) — resync manuel d'une vente manquée
   - `setCohortChariowProducts` (admin) — configuration des product IDs
4. **Email** : template "Finalisez votre inscription" (lien claim)

## Frontend

1. **Admin** `cohortes.$id.tsx` — section "Intégration Chariow"
   - 3 champs Product ID
   - URL webhook affichée + bouton copier
   - Bouton "Tester la connexion API"
2. **Public** `inscription.$slug.tsx` — refonte 3 états
   - défaut : choix mode + form minimal → bouton "Payer"
   - `?sale=xxx` : confirmation paiement + form complet + signup
   - `?claim=xxx` : idem via lien email
3. **Étudiant** `/etudiant/paiements` : badge "Payé via Chariow ✓" + bouton "Payer tranche 2"
4. **Admin** `/admin/paiements` : colonne Source, bouton resync, onglet logs webhooks

## Secrets requis

- `CHARIOW_API_KEY` — Bearer key Chariow (`sk_live_xxx`)
- `CHARIOW_WEBHOOK_URL_SECRET` — chaîne aléatoire 32 octets hex (incluse dans l'URL webhook)

Pas de secret HMAC — Chariow ne signe pas ses webhooks.

## URL à coller dans le dashboard Chariow

```
https://project--66439da9-0337-4213-a275-40cffeef22c6.lovable.app/api/public/hooks/chariow/<CHARIOW_WEBHOOK_URL_SECRET>
```

Events à activer côté Chariow : `successful.sale` (obligatoire), `abandoned.sale`, `failed.sale` (logs).

## Sécurité

- Webhook protégé par secret en path (comparaison constant-time)
- Re-vérification de **toute** vente via `GET /v1/sales/{id}` avant action
- Idempotence stricte (UNIQUE event_type+sale_id)
- `claim_token` : 32 octets hex, usage unique, expiration 30 jours
- `fetchSaleStatus` public ne renvoie que statut + montant (pas de PII supplémentaire)
- Validation Zod sur tous les payloads (webhook + server fns)

## Livraison

**Étape 1 (cette session après approbation)** : tout le pipeline ci-dessus en une fois — migrations, webhook, helpers, server fns, UI admin cohorte, refonte page inscription, badge étudiant, onglet admin.

**Étape 2 (après premier paiement test réel)** : ajustements si Chariow envoie des champs imprévus (visibles dans `chariow_webhook_events.payload`), polishing email.
