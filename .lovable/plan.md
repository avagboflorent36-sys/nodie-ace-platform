## Diagnostic

Le problème ne vient pas seulement du formulaire : le paiement revient avec `?attempt=...`, mais l’application attend que la tentative soit marquée `processed` ou qu’un `sale_id` soit enregistré. Or, dans les données actuelles :

- La tentative existe bien et a été créée avant redirection vers Chariow.
- Elle est encore en statut `redirected`.
- `chariow_sale_id` est vide.
- Aucun webhook Chariow récent n’a été reçu pour cette tentative.
- Aucun paiement n’a été créé dans la plateforme.

Donc l’écran reste bloqué sur “Vérification du paiement…” puis affiche “Nous n’avons pas encore reçu la confirmation”.

## Objectif

Ne plus dépendre uniquement du webhook ou du `sale_id` dans l’URL pour afficher le formulaire. Le flux doit fonctionner même si Chariow ne renvoie pas `{sale_id}` dans l’URL et même si le webhook arrive tard ou pas du tout.

## Plan de correction

1. **Ajouter une vérification directe par tentative**
   - Créer côté serveur une fonction robuste qui prend `attempt_token`.
   - Elle récupère la tentative interne.
   - Elle interroge Chariow avec les données disponibles de la tentative : email, produit, lien de checkout, ou référence retournée par checkout si présente.
   - Si une vente payée correspond, elle enregistre le `chariow_sale_id`, marque la tentative comme confirmée/traitée, puis crée le paiement interne.

2. **Rendre le retour post-paiement indépendant du webhook**
   - Sur `/inscription/:slug?attempt=...`, remplacer le polling actuel par une vérification serveur qui tente aussi la réconciliation directe.
   - Si le paiement est confirmé, afficher immédiatement le formulaire complet.
   - Si la confirmation n’est pas encore trouvée, afficher un bouton “J’ai payé, revérifier” au lieu d’un simple message bloquant.

3. **Conserver une sécurité stricte**
   - Ne jamais débloquer l’accès juste parce qu’un `attempt_token` existe.
   - Débloquer uniquement si Chariow confirme une vente payée ou si une tentative a déjà été traitée par le webhook/admin.
   - Vérifier que le produit/email/cohorte correspondent avant activation.

4. **Améliorer le webhook existant**
   - Ajouter plus d’extraction de champs possibles pour retrouver l’`attempt_token`, le produit, l’email et le `sale_id`.
   - Enregistrer les erreurs utiles dans `chariow_payment_attempts.last_error` pour savoir exactement pourquoi une tentative reste bloquée.

5. **Ajouter une récupération admin simple**
   - Dans la page admin liée à Chariow, rendre visible la tentative bloquée avec son email, produit, lien checkout et statut.
   - Ajouter une action “Revérifier / réconcilier” qui relance la vérification directe sans refaire payer l’étudiant.

6. **Tester le cas réel actuel**
   - Vérifier la tentative existante `elyos6936@gmail.com` / cohorte `test 1`.
   - Confirmer que l’écran passe au formulaire uniquement après confirmation Chariow.
   - Vérifier qu’un utilisateur créé via ce formulaire reçoit bien un paiement validé, une inscription active et l’accès étudiant.

## Résultat attendu

Après paiement, l’étudiant revient sur la page d’inscription, l’application réconcilie le paiement même sans webhook immédiat, puis affiche le formulaire dès que Chariow confirme que le paiement est passé.