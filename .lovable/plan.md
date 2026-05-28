## Objectif
Sortir les règles d'automatisation (règles d'accès + campagnes email) de l'onglet **Paramètres** et les placer dans un nouvel onglet dédié **Automatisations**, positionné entre **Formulaire** et **Réponses**.

## Changements

### `src/routes/_authenticated/admin/cohortes.$id.tsx`

1. **Barre d'onglets** (ligne ~70-79)
   - Passer la grille de `grid-cols-8` à `grid-cols-9`.
   - Insérer un nouveau `<TabsTrigger value="automations">Automatisations</TabsTrigger>` entre `form` et `responses`.

2. **Contenu des onglets** (ligne ~81-88)
   - Ajouter `<TabsContent value="automations">` entre `form` et `responses`.
   - Ce nouvel onglet rend un composant `AutomationsTab` qui regroupe :
     - `AccessRulesEditor` (règles d'accès / blocage)
     - `EmailCampaignsEditor` (campagnes de relance)
   - Optionnel : inclure aussi `ReminderRulesEditor` pour centraliser toute l'automatisation des paiements (à confirmer pendant l'implémentation — si oui, le retirer aussi de Settings).

3. **Onglet Paramètres** (`SettingsTab`, lignes ~422-430)
   - Retirer les blocs `<AccessRulesEditor>` et `<EmailCampaignsEditor>` (et `ReminderRulesEditor` selon décision ci-dessus).
   - Conserver `PaymentScheduleEditor` et `ChariowSection` qui sont des paramètres de configuration et non des règles d'automatisation.

4. **Nouveau composant `AutomationsTab`**
   - Wrapper simple qui empile les éditeurs avec un titre clair et une courte description en haut ("Programmez les règles d'accès, blocages et relances automatiques pour cette cohorte").
   - Les composants `AccessRulesEditor` et `EmailCampaignsEditor` existants sont réutilisés tels quels (aucune logique métier modifiée).

## Hors périmètre
- Aucune modification de schéma, de server functions, ni de la logique d'exécution des automatisations.
- Aucun changement sur le formulaire d'inscription ou le système de paiement.

## Résultat attendu
- 9 onglets : Vue d'ensemble · Étudiants · Contenu · Annonces · Live · Formulaire · **Automatisations** · Réponses · Paramètres.
- L'onglet Paramètres ne contient plus les règles d'automatisation, uniquement la config de cohorte + paiement + Chariow.
