## Diagnostic

Le contenu est bien visible côté étudiant, mais il n’est pas réellement ouvrable de façon fiable :

- Les vidéos/PDF/liens sont rendus comme de simples liens externes.
- Si l’URL est absente, invalide ou non cliquable, la ligne semble exister mais l’utilisateur ne peut rien ouvrir.
- Les exercices n’ont actuellement aucun vrai comportement d’ouverture : s’il n’y a pas d’URL, ils ne mènent à rien.
- Il n’y a pas de lecteur intégré, pas de modal de lecture, pas d’état d’erreur clair, et pas de validation forte côté admin au moment d’ajouter une ressource.

## Plan de correction définitive

### 1. Créer une ouverture fiable des contenus côté étudiant
Sur `/etudiant/formation`, remplacer les simples liens par une vraie action “Ouvrir” sur chaque ressource :

- Vidéo : ouvrir dans un lecteur intégré si c’est YouTube/Vimeo ou afficher un bouton externe si le lien ne peut pas être intégré.
- PDF/document : ouvrir dans une visionneuse intégrée quand possible, avec bouton “ouvrir dans un nouvel onglet”.
- Lien/playlist : ouvrir proprement dans un nouvel onglet.
- Exercice : ouvrir une modal dédiée avec la consigne/description et, si une URL existe, un bouton pour accéder au support externe.

### 2. Gérer les contenus sans URL
Pour les ressources qui n’ont pas d’URL :

- Ne plus afficher une ligne qui pointe vers `#`.
- Afficher clairement “Contenu non disponible” ou ouvrir une modal avec la description si c’est un exercice.
- Désactiver l’action externe quand aucun lien n’existe.

### 3. Ajouter une validation admin minimale
Dans `/admin/formations` et `/admin/cohortes/:id` :

- Vérifier les URLs avant enregistrement pour les types vidéo, document et lien.
- Afficher un message clair si l’admin essaie d’ajouter une vidéo/PDF/lien sans URL valide.
- Autoriser les exercices sans URL seulement si une description/consigne est fournie.

### 4. Factoriser le rendu des ressources
Créer un composant réutilisable pour éviter que la logique soit différente entre :

- ressources du programme de formation,
- ressources globales,
- contenu spécifique à la cohorte.

Ce composant gérera : icône, type, bouton ouvrir, modal lecteur, fallback sans URL, et comportement mobile/desktop.

### 5. Vérifier les accès et les données existantes
Le backend est opérationnel et les règles d’accès permettent déjà aux étudiants actifs de lire les ressources. Je garderai ces règles, puis je vérifierai que les ressources existantes avec URL YouTube s’ouvrent correctement après correction.

## Fichiers à modifier

- `src/routes/_authenticated/etudiant/formation.tsx`
- `src/routes/_authenticated/admin/formations.tsx`
- `src/routes/_authenticated/admin/cohortes.$id.tsx`
- éventuellement un petit composant dédié dans `src/components/` si cela rend le code plus stable

## Résultat attendu

Après implémentation, un étudiant pourra ouvrir les vidéos, PDF, liens et exercices depuis sa page Formation, avec un comportement clair même quand une ressource est mal renseignée côté admin.