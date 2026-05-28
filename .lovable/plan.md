
## Objectif

Faire fonctionner l'envoi d'emails Resend avec votre propre clé API personnelle.

## Plan

### 1. Remplacer la clé Resend actuelle
La clé `RESEND_API_KEY` actuelle est gérée par le connecteur Lovable (et n'est pas une vraie clé Resend). Il faut la remplacer par votre clé personnelle.

→ Je demanderai via le formulaire sécurisé les 2 secrets :
- `RESEND_API_KEY` : votre clé `re_xxx` depuis resend.com → API Keys
- `EMAIL_FROM` : votre adresse d'expédition vérifiée (ex: `Nodie IA Academy <contact@votredomaine.com>`)

### 2. `src/lib/email.server.ts`
- Conserver l'appel direct à `https://api.resend.com/emails` (fonctionne avec une vraie clé `re_xxx`).
- Lire `EMAIL_FROM` depuis le secret (avec fallback `onboarding@resend.dev` + warning).
- Renvoyer des erreurs explicites (status HTTP + body Resend) au lieu d'échouer silencieusement.

### 3. Bouton "Tester l'envoi"
- Server function `sendTestEmail` qui envoie un email de test à l'admin connecté.
- Bouton dans l'onglet Automatisations + toast avec succès ou message d'erreur Resend complet → diagnostic immédiat.

### 4. Bandeau d'aide dans l'onglet Automatisations
> "Pour envoyer aux étudiants : vérifiez un domaine sur resend.com → Domains, créez une clé API, et renseignez les secrets `RESEND_API_KEY` + `EMAIL_FROM`."

## Fichiers impactés

- `src/lib/email.server.ts` (lecture EMAIL_FROM + erreurs explicites)
- `src/lib/automation.functions.ts` (+ `sendTestEmail`)
- `src/routes/_authenticated/admin/cohortes.$id.tsx` (bouton test + bandeau)

## Étapes côté utilisateur

1. Sur resend.com : vérifier votre domaine (Domains → Add Domain → DNS).
2. Créer une clé API (API Keys → Create).
3. Quand je vous le demanderai, coller la clé `re_xxx` + l'adresse From.
4. Cliquer "Tester l'envoi" pour valider.
