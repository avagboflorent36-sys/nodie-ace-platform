Je vais corriger l’intégration Chariow au niveau de l’appel checkout.

Plan :
1. Ajuster le payload envoyé à Chariow pour respecter exactement son format attendu : `phone` comme tableau contenant `number` et `country_code`.
2. Renforcer le parsing du numéro WhatsApp pour accepter les formats courants (`+221...`, `221...`, `77...`) et éviter d’envoyer un numéro vide.
3. Améliorer le message d’erreur affiché à l’utilisateur pour ne plus montrer l’erreur technique brute de Chariow.
4. Vérifier ensuite que le code construit bien un payload valide avant la redirection de paiement.

Fichiers concernés :
- `src/lib/chariow.functions.ts`
- éventuellement `src/lib/chariow.server.ts` si le typage doit être aligné