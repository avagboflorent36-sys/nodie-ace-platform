## Diagnostic global

Le problème principal est maintenant clair : la vente Chariow existe, mais la réponse récupérée avec l’ID `SALE...` ne contient pas `cohort_id` dans `custom_metadata`. Donc l’application ne sait pas à quelle cohorte rattacher le paiement.

Il y a aussi trois fragilités importantes :

- Le même Product ID Chariow est utilisé pour plusieurs champs de la cohorte, donc le produit seul ne suffit pas toujours à reconstruire le contexte.
- Le flux dépend trop de Chariow pour renvoyer les métadonnées et/ou rediriger correctement l’étudiant.
- Le webhook et le resync arrivent trop tard : si Chariow ne renvoie pas le contexte attendu, on ne peut plus relier proprement paiement, cohorte, étudiant et formulaire.

## Solution recommandée : créer notre propre “dossier de paiement” avant Chariow

Au lieu d’attendre que Chariow nous renvoie toutes les informations, l’application doit créer une trace interne avant de rediriger vers Chariow.

Nouveau flux :

```text
Étudiant remplit prénom/email/téléphone/cohorte/mode
        ↓
L’app crée un payment_attempt interne avec un token unique
        ↓
L’app envoie vers Chariow avec redirect_url contenant ce token
        ↓
Retour étudiant ou webhook Chariow
        ↓
L’app retrouve le payment_attempt par token, sale ID, email ou produit
        ↓
Paiement validé → formulaire → compte étudiant → inscription cohorte
```

Ainsi, même si Chariow perd `custom_metadata`, l’application garde déjà :

- cohorte
- email
- prénom / nom
- téléphone
- mode de paiement
- montant attendu
- Product ID Chariow utilisé
- token de retour
- éventuel Sale ID Chariow
- statut du traitement

## Plan d’implémentation

### 1. Ajouter une table fiable de tentatives de paiement

Créer une table `chariow_payment_attempts` pour enregistrer chaque paiement avant la redirection Chariow.

Elle contiendra notamment :

- cohorte
- email client
- prénom / nom / téléphone
- mode de paiement
- tranche concernée
- Product ID Chariow
- montant attendu
- token public unique
- Sale ID Chariow si connu
- statut : `created`, `redirected`, `paid`, `processed`, `failed`
- dernière erreur technique
- payload Chariow brut pour audit

Accès : uniquement admin côté interface ; écriture via backend sécurisé.

### 2. Modifier le lancement du paiement

Quand l’étudiant clique “Payer via Chariow” :

- créer d’abord une tentative interne
- générer un token unique
- construire une URL de retour du type :

```text
/inscription/:slug?attempt=TOKEN
```

- envoyer ce token aussi dans `custom_metadata`, mais ne plus dépendre uniquement de lui
- enregistrer la réponse Chariow, y compris l’URL de checkout et tout ID disponible

### 3. Rendre le retour étudiant indépendant du webhook

Sur `/inscription/:slug?attempt=TOKEN` :

- retrouver la tentative interne
- si un Sale ID est déjà connu, vérifier Chariow
- sinon afficher un état clair : “Paiement en vérification” avec bouton “J’ai payé, vérifier maintenant”
- si Chariow confirme le paiement, débloquer immédiatement le formulaire
- si la confirmation est lente, ne pas bloquer définitivement l’étudiant

### 4. Renforcer webhook et resync

Le webhook devra chercher la tentative dans cet ordre :

1. `attempt_token` dans les métadonnées ou l’URL de retour
2. Sale ID déjà enregistré
3. email client + Product ID + paiement récent
4. Product ID + montant + fenêtre temporelle récente
5. si ambigu : créer une alerte admin “à associer manuellement”

Le resync admin devra permettre :

- entrer un Sale ID
- voir les infos récupérées depuis Chariow
- choisir une cohorte si elle n’est pas détectée
- associer manuellement le paiement à une tentative ou à une cohorte
- relancer le traitement

### 5. Ajouter une vraie page admin “Réconciliation Chariow”

Remplacer l’écran actuel trop technique par une page plus utile :

- paiements en attente
- paiements reçus mais non associés
- derniers webhooks
- erreurs lisibles
- bouton “Associer à une cohorte”
- bouton “Valider manuellement après vérification Chariow”

Objectif : même si l’automatisation échoue, l’admin peut réparer sans toucher au code.

### 6. Corriger la configuration produit Chariow

Vérifier et simplifier :

- un Product ID distinct pour paiement complet si nécessaire
- un Product ID distinct pour tranche 1 si nécessaire
- un Product ID distinct pour tranche 2 si nécessaire
- affichage clair dans l’admin pour éviter de coller la mauvaise URL ou le mauvais ID

Si Chariow ne supporte pas bien les métadonnées, ce n’est plus bloquant grâce à la table interne.

### 7. Option alternative plus simple si Chariow reste instable

Si tu veux une solution plus fiable et plus facile à maintenir, on peut remplacer Chariow par le système de paiement intégré Lovable :

- configuration plus standard
- webhooks plus prévisibles
- suivi test/live plus clair
- moins de dépendance à des métadonnées non garanties

Mais si tu veux garder Chariow, la refonte ci-dessus est la voie la plus robuste.

## Résultat attendu

Après cette refonte :

- un paiement débité ne disparaît plus
- le formulaire peut être débloqué même si le webhook arrive en retard
- l’admin peut récupérer un paiement sans intervention technique
- l’application ne dépend plus uniquement de `custom_metadata`
- chaque paiement aura une trace interne exploitable

## Point à valider avant implémentation

Je recommande de garder Chariow pour l’instant, mais de reconstruire le flux autour d’une table interne `chariow_payment_attempts` et d’une page de réconciliation admin.

Si tu approuves ce plan, je l’implémente en priorité.

<presentation-actions>
  <presentation-open-history>View History</presentation-open-history>
  <presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>