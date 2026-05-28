Voici le plan pour corriger définitivement les deux problèmes.

## Constats vérifiés

- Le lien applicatif tranche 2 existe bien (`/inscription/<slug>/tranche-2`), mais la cohorte actuelle utilise le même Product ID Chariow pour le paiement intégral, la tranche 1 et la tranche 2 : `prd_hmels6`. Résultat : même si l’URL est différente, Chariow ouvre le même produit/paiement.
- Les campagnes email échouent car l’envoi passe par une configuration de test qui refuse d’envoyer à d’autres destinataires que l’adresse autorisée. Le journal montre une erreur de domaine d’envoi non vérifié.
- Un cron d’automatisation existe, mais il appelle l’URL publiée. En preview/test, cela peut exécuter une ancienne version ou rien si l’app publiée n’a pas encore les dernières routes. Il faut une exécution centralisée et contrôlable depuis l’admin.

## Plan de correction

1. Corriger et sécuriser le paiement tranche 2
   - Garder un lien visible et clairement distinct : `/inscription/<slug>/tranche-2`.
   - Ajouter une alerte admin si le Product ID “Tranche 2” est identique à “Tranche 1” ou au paiement intégral.
   - Bloquer l’enregistrement d’une configuration Chariow invalide côté serveur si Tranche 1 et Tranche 2 utilisent le même Product ID.
   - Sur la page tranche 2, afficher une erreur explicite si la tranche 2 n’a pas son propre Product ID au lieu de laisser l’étudiant lancer un paiement ambigu.

2. Fiabiliser les relances et règles d’accès
   - Centraliser toute la logique d’automatisation dans une seule fonction serveur réutilisable : relances email, blocage d’accès, campagnes programmées.
   - Faire utiliser cette logique par :
     - le cron public sécurisé,
     - un bouton admin “Exécuter maintenant” dans l’onglet Automatisations,
     - les futures relances programmées.
   - Corriger le calcul J-7 / J+7 pour que les relances avant/après échéance ciblent les bonnes dates.
   - Ajouter des logs détaillés visibles en base : nombre de relances envoyées, blocages, campagnes envoyées, erreurs.

3. Corriger les campagnes email
   - Remplacer les envois dispersés par le même service email centralisé.
   - Ne plus marquer une campagne comme “envoyée” si tous les emails échouent.
   - Afficher le nombre réel d’emails envoyés/échoués dans l’admin.
   - Tant qu’aucun domaine d’envoi n’est configuré, afficher une erreur claire au lieu d’un échec silencieux.

4. Configurer l’infrastructure email proprement
   - Le projet n’a actuellement aucun domaine email configuré. Pour que les emails partent vers tous les étudiants, il faudra configurer un domaine d’envoi dans Lovable Cloud.
   - Après configuration du domaine, je brancherai les campagnes et relances dessus pour éviter les limites de test actuelles.

5. Corriger le cron d’automatisation
   - Mettre à jour le job planifié pour appeler la bonne route d’automatisation avec l’authentification attendue.
   - Garder une exécution toutes les 15 minutes.
   - Ajouter un bouton admin de test pour ne pas dépendre uniquement du cron pendant les vérifications.

6. Nettoyage UI admin
   - Supprimer le doublon actuel de la section Chariow dans les paramètres.
   - Dans l’onglet Automatisations, ajouter un bloc “État du système” avec dernière exécution, erreurs récentes et bouton d’exécution manuelle.

## Validation prévue

- Vérifier en base que la cohorte ne peut plus sauvegarder deux tranches avec le même Product ID.
- Tester la page `/inscription/<slug>/tranche-2` avec une cohorte bien configurée.
- Lancer manuellement les automatisations depuis l’admin et vérifier les logs.
- Vérifier que les campagnes ne passent en “envoyé” que si au moins un email part réellement.
- Vérifier que le cron existe et pointe vers la bonne route.