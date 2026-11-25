# Agent avant-vente, RAG sur Claude

Un agent conversationnel qui répond aux questions d'un prospect à partir d'une base de connaissances d'entreprise, qualifie le besoin et oriente vers une prise de rendez-vous. Modèle **Claude Haiku**, backend serverless, déployé sur **Vercel**.

- Démo live : https://axem-avant-vente.vercel.app
- Base de connaissances d'exemple : le contenu public d'AXEM IA (positionnement, Protocole, offres).

Construit comme démonstration dans le cadre de ma candidature chez AXEM IA. Ce n'est pas un service officiel d'AXEM ; la base de connaissances n'utilise que des informations publiques.

## Ce que fait l'agent

- Répond uniquement à partir de la base de connaissances fournie (pas d'invention, pas de prix, aucune donnée privée).
- Récupère les passages pertinents pour chaque question, puis laisse le modèle formuler une réponse courte et sourcée.
- Pose une question de qualification et propose un rendez-vous quand l'intérêt devient concret.

## Architecture

```
api/chat.js        Fonction serverless : retrieval + appel Claude. La clé API reste côté serveur.
data/knowledge.js  Base de connaissances (passages titrés), découplée de la logique.
public/index.html  Interface de chat (statique, sans framework).
vercel.json        Configuration de déploiement.
```

Flux d'une requête : le navigateur envoie l'historique à `api/chat.js`, qui sélectionne les passages pertinents de `data/knowledge.js`, construit le prompt système avec ce contexte et des consignes strictes, appelle l'API Messages de Claude, puis renvoie la réponse. Aucun état n'est conservé entre les requêtes.

## Choix techniques

- **Retrieval lexical plutôt que des embeddings vectoriels.** La base est petite et stable : un score de recouvrement de termes suffit, et il évite d'héberger une base vectorielle ou d'ajouter un second fournisseur. Pour un corpus plus large, on passerait à des embeddings et à un index vectoriel (voir Limites).
- **Backend serverless sans dépendance** (fetch natif de Node 18+). Surface d'attaque réduite, démarrage à froid rapide, déploiement et audit triviaux. Pas de `node_modules` à maintenir.
- **Claude Haiku.** Coût et latence adaptés à un assistant avant-vente à fort volume, avec un plafond de tokens par réponse.
- **Clé API côté serveur.** Elle n'apparaît jamais dans le code ni dans le client ; seulement en variable d'environnement.
- **Base de connaissances découplée de la logique.** `data/knowledge.js` est un simple tableau de passages : on peut pointer l'agent sur un autre corpus public en ne changeant qu'un fichier.

## Sécurité et garde-fous

- Clé API uniquement en variable d'environnement (`.env` exclu par `.gitignore`).
- Message limité à 500 caractères, historique tronqué aux 6 derniers tours, réponse plafonnée à 700 tokens.
- Limitation de débit par IP (best-effort) et gestion du `stop_reason: "refusal"`.
- Filet de sécurité principal recommandé : une limite de dépense mensuelle dans la console Anthropic.

## Limites et pistes de production

- Le retrieval lexical ne capte pas les reformulations éloignées. Sur un gros corpus, passer à des embeddings et un index vectoriel (par exemple pgvector).
- La limitation de débit en mémoire se réinitialise à froid ; en production, l'adosser à un store partagé (Upstash/Redis).
- Pas de persistance des conversations ni d'analytics : à ajouter selon le besoin.
- Base de connaissances figée dans le dépôt : pour un usage réel, l'alimenter depuis une source versionnée ou un CMS.

## Lancer en local

```bash
cp .env.example .env      # renseigner ANTHROPIC_API_KEY
npx vercel dev            # http://localhost:3000
```

## Déploiement

Importer le dépôt dans Vercel (framework : Other), ajouter la variable `ANTHROPIC_API_KEY`, déployer. Chaque push sur la branche par défaut redéploie automatiquement.

## Adapter l'agent à une autre base de connaissances

La logique est indépendante du contenu :

1. Remplacer les passages de `data/knowledge.js` par ceux du domaine visé.
2. Ajuster la constante `SYSTEM` et l'URL de rendez-vous dans `api/chat.js`.
3. Mettre à jour les libellés dans `public/index.html`.

## Licence

MIT. Voir `LICENSE`.
