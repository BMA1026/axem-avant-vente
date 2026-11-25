# Avant-vente AXEM, agent IA (démo de candidature)

Un agent avant-vente qui répond aux questions d'un prospect à partir du contenu **public** d'AXEM, qualifie le besoin et propose un rendez-vous. Vrai modèle **Claude Haiku** derrière, backend serverless, déployé sur **Vercel** (l'hébergeur d'AXEM).

Construit par Baba Moustapha Amadou pour sa candidature au poste de Chef de projet IA en alternance. Ce n'est pas un service officiel d'AXEM.

## Ce que ça démontre

- Un vrai agent RAG en production, pas une maquette simulée.
- Maîtrise de l'API Claude, d'un backend serverless et d'un déploiement réel.
- Un packaging commercial propre, calé sur le Protocole AXEM (diagnostic, stratégie, activation, scaling).
- Un code documenté et réutilisable : on change la base de connaissances et la charte pour repersonnaliser l'agent pour une autre cible.

## Architecture

```
agent-avantvente/
  api/chat.js          Fonction serverless : RAG + appel Claude (clé côté serveur)
  data/knowledge.js    Base de connaissances (contenu public d'AXEM)
  public/index.html    Interface de l'agent (chat, DA portfolio)
  package.json         Node >= 18, zéro dépendance (fetch natif)
  vercel.json          Config Vercel
  .env.example         Modèle de variable d'environnement
```

Le retrieval est lexical (recouvrement de termes) sur une petite base, puis les passages retenus sont passés à Claude Haiku avec des consignes strictes : répondre seulement à partir du contexte, ne rien inventer, pas de prix (sur mesure), proposer le rendez-vous Calendly quand l'intérêt est concret.

## Déploiement (10 minutes)

1. **Clé API Claude.** Crée un compte sur console.anthropic.com, génère une clé API, et fixe une **limite de dépense mensuelle basse** (par exemple 5 $) dans les réglages de facturation. Haiku coûte environ 0,10 $ en entrée et 0,50 $ en sortie par million de tokens : une conversation revient à une fraction de centime.
2. **Dépôt.** Pousse ce dossier sur un dépôt GitHub (ou utilise la CLI Vercel, étape 4 bis).
3. **Vercel.** Sur vercel.com, `Add New > Project`, importe le dépôt. Framework : `Other`. Dans `Settings > Environment Variables`, ajoute `ANTHROPIC_API_KEY` avec ta clé. Déploie.
4. **Test.** Ouvre l'URL fournie par Vercel, pose une question. L'agent répond via ta clé.

   4 bis. **En local** : `npx vercel dev` après avoir copié `.env.example` en `.env` et renseigné la clé.

## Sécurité et coût

- La clé API n'est **jamais** dans le code ni dans le dépôt : uniquement dans les variables d'environnement Vercel. Le `.gitignore` exclut `.env`.
- Garde-fous intégrés : message limité à 500 caractères, 6 derniers tours seulement, réponse plafonnée à 700 tokens, limitation de débit best-effort par IP.
- La limitation de débit en mémoire se réinitialise à froid. Pour un plafond dur, ajoute Upstash Redis (quelques lignes) ou, plus simple, **garde la limite de dépense dans la console Anthropic** comme filet de sécurité principal.

## Repersonnaliser pour une autre candidature

1. Remplace `data/knowledge.js` par le contenu public de la cible (positionnement, offres, process, contact).
2. Adapte la constante `SYSTEM` et l'URL de rendez-vous dans `api/chat.js`.
3. Change les textes et le libellé de l'en-tête dans `public/index.html`.

Un seul codebase, autant de cas personnalisés.
