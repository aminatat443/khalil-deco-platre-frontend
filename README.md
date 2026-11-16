# Khalil Déco Plâtre — Frontend

Application React/Vite autonome. L'API est hébergée et configurée dans son dépôt backend séparé.

## Développement

Prérequis : Node.js 22 et npm.

```sh
npm ci
cp .env.example .env
npm run dev
```

Le serveur Vite écoute par défaut sur `http://localhost:8080`. Laissez `VITE_API_URL` vide pour utiliser le proxy local vers l'API sur `http://127.0.0.1:3001`. Pour joindre une API distante, définissez `VITE_API_URL=https://api.example.com` (sans `/api`).

## Vérifications et build

```sh
npm test
npm run lint
npm run build
```

`VITE_API_URL` est intégré au bundle au moment du build; reconstruisez l'application si l'URL de l'API change.

## Déploiement

Publiez le contenu de `dist/` sur un hébergeur statique et définissez `VITE_API_URL` dans l'environnement de build. Côté backend, autorisez l'origine exacte du site dans `FRONTEND_ORIGINS` et configurez `PUBLIC_SITE_URL`.
# khalil-deco-platre-frontend
