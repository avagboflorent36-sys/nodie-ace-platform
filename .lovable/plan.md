Constat : le backend est en ligne, mais les derniers appels Chariow vers `/api/public/hooks/chariow/...` répondent en `400`. Aucune ligne n’a été enregistrée dans les événements webhook ni dans les paiements Chariow. Donc le paiement peut avoir été débité côté Chariow, mais la plateforme n’a pas pu lire/valider le message reçu.

Plan proposé :

1. Rendre le webhook plus tolérant
   - Accepter plusieurs formats possibles envoyés par Chariow au lieu de refuser directement si `sale.id` n’est pas exactement au bon endroit.
   - Enregistrer un événement webhook même quand le payload est invalide, avec l’erreur, pour que l’admin puisse diagnostiquer.
   - Retourner une réponse contrôlée pour éviter que le paiement disparaisse sans trace côté plateforme.

2. Ajouter une récupération manuelle admin
   - Sur la page admin liée au secret/webhook ou aux paiements, ajouter un champ “ID de vente Chariow”.
   - Permettre à l’admin de saisir l’ID de transaction visible dans Chariow pour forcer une vérification via l’API Chariow.
   - Si la vente est confirmée, créer/mettre à jour le paiement, l’inscription et l’accès étudiant.

3. Fiabiliser le parcours étudiant après paiement
   - Ajouter une page/état de retour qui vérifie le paiement plusieurs fois après redirection.
   - Si Chariow prend du temps ou si le webhook arrive en retard, afficher “confirmation en cours” au lieu de bloquer l’utilisateur.
   - Dès que le paiement est confirmé, rediriger vers le formulaire d’inscription.

4. Ajouter une visibilité admin simple
   - Afficher les derniers webhooks reçus, leur statut et les erreurs.
   - Cela permettra de voir si Chariow envoie un mauvais format, un mauvais événement, ou si l’ID de vente manque.

Détail technique :
- Modifier la route webhook Chariow pour extraire `saleId` depuis plusieurs clés possibles (`sale.id`, `data.id`, `id`, etc.).
- Créer une fonction serveur admin protégée pour “resynchroniser” une vente Chariow par ID.
- Réutiliser la logique existante de validation de vente pour éviter de dupliquer les règles métier.
- Ne pas toucher aux secrets existants sauf si les logs montrent ensuite un problème d’URL ou de clé API.