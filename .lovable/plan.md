## Problème

Sur `/etudiant/paiements`, l'étudiant `akitobiante85@gmail.com` voit son paiement `test 1` :
- Mode : 2 tranches, 100 / 200 XOF, statut `partial`, source `chariow`
- Une seule ligne `Tranche #1 — Validé`
- **Aucun bouton pour payer la tranche 2**

Vérification base de données : `payment_installments` ne contient qu'une seule ligne (position 1). La ligne tranche #2 n'a jamais été créée pour ce paiement Chariow.

Le code actuel de `src/routes/_authenticated/etudiant/paiements.tsx` fait :
```ts
const t2 = insts.find((i) => i.position === 2);
const needsTranche2 = p.mode === "installments_2" && p.status !== "paid" && t2 && t2.status !== "validated";
```
Comme `t2` est `undefined`, le carton CTA et le bouton « Payer la tranche 2 » ne s'affichent jamais.

## Correctif

Dans `src/routes/_authenticated/etudiant/paiements.tsx` :

1. **Rendre le CTA tranche 2 indépendant de l'existence de la ligne en base.**
   Nouvelle condition :
   ```ts
   const needsTranche2 =
     p.mode === "installments_2" &&
     p.status !== "paid" &&
     (!t2 || t2.status !== "validated");
   const remaining = Number(p.amount_total) - Number(p.amount_paid);
   const t2Amount = t2?.amount ?? remaining;
   const t2Due = t2?.due_date ?? p.final_deadline ?? null;
   ```
   Afficher le carton avec ces valeurs et le lien existant `/etudiant/tranche-2/$paymentId`.

2. **Garder la liste des échéances inchangée** (on n'invente pas une ligne tranche #2 visuelle s'il n'y en a pas en DB), mais le carton CTA en haut suffit pour permettre le paiement et donc le rétablissement de l'accès.

## Hors scope

- Pas de migration pour backfiller la ligne `payment_installments` position 2 manquante (la route `/etudiant/tranche-2/$paymentId` la créera/mettra à jour au paiement).
- Pas de modification de la page admin ni du flux Chariow.
- Pas de changement de design.

## Détail technique

```text
etudiant/paiements.tsx (carton CTA)
  needsTranche2 = mode=installments_2 && status!=paid && (!t2 || t2.status!=validated)
  remaining     = amount_total - amount_paid
  t2Amount      = t2?.amount      ?? remaining
  t2Due         = t2?.due_date    ?? final_deadline
  → <Link to="/etudiant/tranche-2/$paymentId" params={{paymentId: p.id}}>
```
