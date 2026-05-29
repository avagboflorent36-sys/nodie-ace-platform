# Édition des emails de relance avant envoi

## Objectif

Sur `/admin/paiements`, au lieu d'envoyer immédiatement les relances quand on clique sur **Relancer sélection** ou **Relancer tous les retards**, ouvrir un dialog qui permet à l'admin :
- de voir/modifier **l'objet** et le **contenu** de l'email
- de voir la liste des destinataires concernés
- d'envoyer après validation

Le contenu est pré-rempli automatiquement avec un modèle incluant le lien vers la **2e tranche** de chaque étudiant.

## Comportement attendu

### Bouton "Relancer sélection (N)"
- Ouvre un dialog avec un **objet** et un **contenu** par défaut.
- Le contenu utilise des variables remplacées par destinataire : `{{prenom}}`, `{{cohorte}}`, `{{montant}}`, `{{devise}}`, `{{echeance}}`, `{{lien_paiement}}`.
- L'admin peut éditer librement objet + contenu (textarea markdown/HTML simple).
- Liste les destinataires (nom + email) avec compteur.
- Boutons : **Annuler** / **Envoyer maintenant**.

### Bouton "Relancer tous les retards"
- Même dialog, pré-rempli avec un **modèle spécifique retard** (ton plus ferme, mention "en retard").
- Liste tous les étudiants en retard.
- Lien pointant vers la 2e tranche de chaque étudiant (`/etudiant/tranche-2/{paymentId}` côté étudiant, ou l'URL absolue équivalente).

## Modèles par défaut

**Sélection (rappel standard)** :
- Objet : `Rappel paiement — {{cohorte}}`
- Corps :
  ```
  Bonjour {{prenom}},

  Petit rappel concernant votre paiement pour {{cohorte}}.
  Montant : {{montant}} {{devise}} — Échéance : {{echeance}}.

  Réglez votre 2e tranche ici : {{lien_paiement}}

  L'équipe Nodie IA Academy
  ```

**Tous les retards** :
- Objet : `Paiement en retard — {{cohorte}}`
- Corps : variante avec "votre échéance est dépassée", même variables + `{{lien_paiement}}`.

## Détails techniques

### Server fn (modifier `src/lib/reminders.functions.ts`)
Étendre `sendPaymentReminders` pour accepter un objet et un template custom :
```ts
.inputValidator(z.object({
  installmentIds: z.array(z.string().uuid()).min(1).max(500),
  subject: z.string().min(2).max(200),
  bodyTemplate: z.string().min(10).max(10000), // contient les {{variables}}
}))
```
Le handler remplace les variables par destinataire avant l'envoi (idem flow actuel), en gardant la journalisation dans `payment_reminders`.

`{{lien_paiement}}` = URL absolue vers `/etudiant/tranche-2/{payment_id}` (récupérer `payment_id` via la jointure déjà présente). Si non applicable (mode `full`), fallback `/etudiant/paiements`.

### UI (`src/routes/_authenticated/admin/paiements.tsx`)
- Nouveau composant local `ReminderDialog` (Dialog shadcn) avec :
  - `Input` objet
  - `Textarea` contenu (rows ~12, monospace)
  - Liste des destinataires (scrollable, max-h)
  - Aide visuelle listant les variables disponibles
  - Bouton "Envoyer" → appelle `sendPaymentReminders` avec `subject`/`bodyTemplate`/`installmentIds`
- État `reminderDialog: { open, mode: "selection"|"late", ids: string[] }`
- `sendSelected` et `sendAllLate` n'envoient plus directement — ils ouvrent le dialog avec le bon modèle et les bons ids.
- Toast succès/échec inchangé après envoi.

### Hors-scope
- Pas de modification du cron `payment-reminders` (qui garde ses propres templates).
- Pas de stockage des templates en DB (édition à la volée par envoi).
- Pas de prévisualisation par destinataire (les variables sont juste documentées).

## Ordre d'exécution
1. Modifier `reminders.functions.ts` (signature + remplacement variables + lien tranche-2).
2. Modifier `paiements.tsx` (dialog + branchement des deux boutons).
3. Vérifier le build.
