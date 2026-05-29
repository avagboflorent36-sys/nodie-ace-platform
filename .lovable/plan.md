# Corrections page Étudiants + page Paiements

## 1. Bouton WhatsApp (`/admin/etudiants`)

**Problème** : `https://wa.me/${digits}` ouvre WhatsApp mais souvent sans rediriger correctement vers la conversation (digits parfois mal formatés : « 00225… », espaces, `+` retiré mais zéros internationaux conservés, etc.).

**Correction dans `src/routes/_authenticated/admin/etudiants.index.tsx`** :
- Normaliser le numéro avant l'URL : retirer tous les non-chiffres, puis enlever un éventuel préfixe `00` (format international alternatif) pour ne garder que le format E.164 sans `+`.
- Utiliser `https://wa.me/<digits>?text=...` avec un message prérempli court (« Bonjour {prenom}, ») pour forcer l'ouverture de la conversation.
- Garder `target="_blank"` + `rel="noopener noreferrer"`.
- Si après nettoyage le numéro fait moins de 8 chiffres → afficher « — » (numéro invalide).

Aucun changement DB. Aucun changement sur la page étudiant détail.

## 2. Statut d'accès dans la colonne « Actions » (`/admin/paiements`)

**Problème** : on voit les boutons 🔒 Restreindre / 🔓 Rétablir mais pas l'état courant de l'accès de l'étudiant à la cohorte.

**Correction dans `src/routes/_authenticated/admin/paiements.tsx`** :

1. **Charger les enrollments** : ajouter une 2e query (`admin-enrollments-all`) qui lit `cohort_enrollments(student_id, cohort_id, status)` et construit une `Map<"studentId:cohortId", status>`.
2. **Afficher un badge d'état** dans la cellule Actions, avant les boutons :
   - `status === "active"` → badge vert « Accès actif » (icône `Unlock`)
   - `status === "restricted"` → badge rouge « Accès restreint » (icône `Lock`)
   - autre / absent → badge neutre « — »
3. **N'afficher que le bouton pertinent** :
   - Si actif → bouton « Restreindre » uniquement
   - Si restreint → bouton « Rétablir » uniquement
4. **Après `toggleAccess`** : invalider aussi `admin-enrollments-all` pour rafraîchir le badge immédiatement.

Aucun changement DB ni sur d'autres pages.

## Détails techniques

```text
etudiants.index.tsx
  digits = raw.replace(/\D/g,'').replace(/^00/, '')
  href   = `https://wa.me/${digits}?text=${encodeURIComponent('Bonjour ' + s.first_name + ',')}`

paiements.tsx
  useQuery('admin-enrollments-all') → Map<`${student_id}:${cohort_id}`, 'active'|'restricted'|...>
  cell: <AccessBadge status={enrollMap.get(key)} /> + bouton conditionnel
  toggleAccess → qc.invalidateQueries(['admin-enrollments-all'])
```

## Hors scope
- Pas de changement aux relances email
- Pas de changement DB
- Pas de changement aux autres pages