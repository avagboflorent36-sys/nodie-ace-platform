
# Plan d'intégration Chariow ↔ Nodie IA Academy

## Vue d'ensemble du flux

```
1. Admin crée 3 liens Chariow par cohorte (intégral, tranche 1, tranche 2)
   et les enregistre dans la plateforme.

2. Prospect clique "S'inscrire" sur Nodie
        ↓
   Choisit son mode (1x ou 2x) → redirigé vers Chariow

3. Paiement sur Chariow
        ↓
   ┌────────────────────────────────┐
   │ a) Webhook serveur (instantané)│   ← source de vérité
   │ b) Redirection navigateur     │   ← UX
   └────────────────────────────────┘
        ↓
4. Webhook Chariow → /api/public/hooks/chariow
   - Vérifie signature HMAC
   - Crée/MAJ payment + installment (status: validated)
   - Génère un "claim_token" unique
   - Envoie email "Finalisez votre inscription" avec lien
     /inscription/{cohorte}?claim={token}

5. Prospect arrive sur le formulaire
   - claim_token vérifié → email & paiement déjà liés
   - Remplit infos perso + crée son compte
   - Compte automatiquement rattaché au payment existant

6. Accès débloqué + dashboard à jour
```

## Modifications base de données

### Nouvelles tables / colonnes

**`cohortes`** — 3 colonnes ajoutées :
- `chariow_link_full` (text) — URL paiement intégral
- `chariow_link_installment_1` (text) — URL tranche 1
- `chariow_link_installment_2` (text) — URL tranche 2

**`payments`** — colonnes ajoutées :
- `chariow_transaction_id` (text, unique)
- `claim_token` (text, unique) — token sécurisé pour lier formulaire ↔ paiement
- `claim_email` (text) — email saisi sur Chariow
- `claimed_at` (timestamptz) — quand le prospect a rempli le formulaire
- `source` (text, default 'manual') — 'chariow' | 'manual'

**`payment_installments`** — colonnes ajoutées :
- `chariow_transaction_id` (text, unique)
- `chariow_raw_payload` (jsonb) — copie du webhook pour audit

**Nouvelle table `chariow_webhook_events`** (idempotence + audit) :
- `id`, `event_id` (unique), `received_at`, `payload` (jsonb), `processed` (bool), `error` (text)

## Backend (TanStack server functions + route)

### 1. Webhook public — `src/routes/api/public/hooks/chariow.ts`
- POST, signature HMAC vérifiée (secret `CHARIOW_WEBHOOK_SECRET`)
- Idempotent (vérifie `event_id` dans `chariow_webhook_events`)
- Parse le payload Chariow → identifie cohorte (via le lien/produit), mode, montant, email
- Crée ou met à jour `payments` + `payment_installments` (status `validated`)
- Génère `claim_token` si paiement orphelin (pas de `student_id`)
- Déclenche email transactionnel "Finalisez votre inscription"

### 2. Server function `claimPaymentByToken` — `src/lib/chariow.functions.ts`
- Appelée depuis `/inscription/{slug}?claim=xxx`
- Retourne les infos du paiement (montant, mode, cohorte) sans révéler de données sensibles
- À la soumission du formulaire + création de compte : rattache `payments.student_id` au nouveau profil

### 3. Server function admin `syncChariowTransaction` (filet de sécurité)
- Permet à un admin de saisir un `transaction_id` Chariow pour forcer la resynchronisation via API REST Chariow
- Utile si un webhook est perdu

### 4. Email "Finalisez votre inscription"
- Ajout d'un template dans `src/lib/email.server.ts`
- Envoyé par le webhook après création du paiement

## Frontend

### 1. Page admin cohorte — `admin/cohortes.$id.tsx`
- Nouvelle section "Liens de paiement Chariow" : 3 champs URL + boutons "Copier"
- Affichage de l'URL webhook à coller dans Chariow + secret

### 2. Page publique d'inscription — `inscription.$slug.tsx`
- **Mode A (sans `?claim=`)** : affiche les options de paiement (boutons "Payer 1x" / "Payer 2x") qui redirigent vers Chariow
- **Mode B (avec `?claim=xxx`)** : pré-remplit l'email, affiche le récap paiement reçu ("Paiement de 50 000 XOF validé"), puis le formulaire d'inscription complet
- À la soumission : crée le compte Supabase + lie le payment

### 3. Espace étudiant `/etudiant/paiements`
- Affiche un badge "Payé via Chariow ✓" pour les paiements automatisés
- Pour les tranches 2x non encore payées via Chariow, propose le bouton "Payer la tranche 2" → lien Chariow

### 4. Espace admin `/admin/paiements`
- Filtre supplémentaire "Source : Chariow / Manuel"
- Bouton "Resynchroniser via Chariow" (saisie `transaction_id`)
- Onglet "Webhooks Chariow" → log des événements reçus (table `chariow_webhook_events`)

## Secrets à configurer

À ajouter via `secrets--add_secret` :
- `CHARIOW_WEBHOOK_SECRET` — secret HMAC fourni par Chariow pour vérifier les webhooks
- `CHARIOW_API_KEY` — clé API REST Chariow (pour resync manuelle)
- `CHARIOW_API_BASE_URL` — URL base de l'API Chariow (ex: `https://api.chariow.com/v1`)

## URL à fournir à Chariow

Une fois publié :
```
https://project--66439da9-0337-4213-a275-40cffeef22c6.lovable.app/api/public/hooks/chariow
```

## Sécurité

- Webhook : signature HMAC obligatoire + idempotence par `event_id`
- `claim_token` : 32 octets aléatoires, expire après 7 jours, usage unique
- L'email envoyé contient le lien `claim` — seul le destinataire peut le récupérer
- Aucune donnée sensible exposée côté client (montants visibles uniquement après authentification ou via `claim_token`)
- Validation Zod sur tous les payloads webhook

## Ce qu'il vous faudra côté Chariow

Avant que je puisse implémenter, vous devrez récupérer **dans le dashboard Chariow** :

1. **La documentation de leur format de webhook** : quels champs envoient-ils ? (email, montant, transaction_id, product_id, status...)
2. **Le secret HMAC** pour vérifier les webhooks (souvent nommé "Signing secret" ou "Webhook secret")
3. **Comment configurer la signature** : en-tête utilisé (`X-Chariow-Signature`?), algorithme (sha256?)
4. **Une clé API REST** pour la resynchronisation
5. **L'URL de redirection après paiement** configurable et la possibilité d'y passer des query params

## Plan de livraison en étapes

1. **Étape 1 (cette session si vous validez)** : migration BDD + webhook + secrets + page admin pour saisir les liens Chariow + UI inscription avec `?claim=`
2. **Étape 2 (après tests réels avec Chariow)** : ajustement du parser de payload selon le format exact reçu + email template peaufiné
3. **Étape 3** : resync manuelle via API REST + log webhooks dans admin

---

**Pour démarrer l'étape 1, je n'ai besoin que de votre validation.** Le format exact du payload Chariow sera ajusté à l'étape 2 quand vous m'aurez transmis un exemple de webhook reçu (vous pourrez le voir dans les logs admin après le premier paiement test).
