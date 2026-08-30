SPEED FACT V1
=============

Déploiement GitHub / Cloudflare Pages : mettre TOUT le contenu de ce dossier à la racine du dépôt.
Ne pas renommer : index.html, sw.js, version.json, manifest.webmanifest, products-authorized.js, dossier src, dossier assets.

MISES À JOUR
- À chaque nouvelle version, modifier la constante VERSION dans src/app.js.
- Modifier version dans version.json.
- Modifier le nom CACHE dans sw.js.
- Publier sur GitHub/Cloudflare.
- L'application vérifie version.json sans cache et propose "Mettre à jour".
- Les données clients/chantiers restent dans localStorage et ne sont pas supprimées par la mise à jour du code.

CATALOGUE E-PHY
- products-authorized.js est indépendant du code.
- Pour actualiser les produits, remplacer uniquement ce fichier avec un nouveau catalogue au même format.
