# Plan validé

## 1. `src/styles.css`
Remplacer les valeurs des tokens `--gold` et `--gold-soft` (mode clair + mode sombre) par un violet élégant :
- Clair : `--gold: oklch(0.55 0.22 295)`, `--gold-soft: oklch(0.95 0.05 295)`
- Sombre : `--gold: oklch(0.70 0.20 295)`, `--gold-soft: oklch(0.35 0.10 295)`
- Ajuster `.gradient-gold` et `.shadow-gold` pour refléter la teinte violette.

Les noms de tokens restent `gold` pour éviter de toucher 25+ fichiers — pur cosmétique interne.

## 2. `src/components/Logo.tsx`
Afficher `Nodie IA Academy` en entier (la sidebar tronque proprement en mode replié grâce à `truncate`).

## Hors scope
- Aucune logique, route, donnée modifiée.
- Aucun renommage de token.
