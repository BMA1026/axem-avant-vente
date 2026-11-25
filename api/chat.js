// Agent avant-vente AXEM, fonction serverless (Vercel, runtime Node 18+).
// Vrai modèle Claude Haiku derrière, appel HTTP direct (zéro dépendance npm).
// La clé API reste côté serveur, lue depuis la variable d'environnement.

import { KNOWLEDGE } from "../data/knowledge.js";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-5-5";
const CAL = "https://calendly.com/clem-pred/30min";

const SYSTEM = [
  "Tu es l'assistant avant-vente d'AXEM IA, une agence qui rend l'IA simple, rentable et actionnable.",
  "Tu réponds en français, de façon chaleureuse, précise et concise (5 phrases maximum).",
  "Règles strictes :",
  "- Tu t'appuies uniquement sur le CONTEXTE fourni ci-dessous. Tu n'inventes jamais un chiffre, un prix, un client ou une fonctionnalité.",
  "- La tarification d'AXEM est sur mesure : ne donne jamais de prix, propose un devis gratuit sous 24 heures.",
  "- Quand le visiteur montre un intérêt concret (un besoin, un cas d'usage, une demande de prix ou de prochaine étape), propose un rendez-vous de 30 minutes : " + CAL + ".",
  "- Pose une seule question de qualification quand c'est utile (secteur, taille d'équipe, processus à améliorer).",
  "- Si l'information n'est pas dans le CONTEXTE, dis-le simplement et propose l'appel ou le mail contact@axem-ia.fr.",
  "- Si on te demande qui t'a construit, explique que tu es une démonstration réalisée par Baba Moustapha Amadou pour sa candidature chez AXEM, avec un vrai modèle Claude.",
  "- Style humain : phrases de longueurs variées, pas de tiret cadratin, pas de jargon inutile."
].join("\n");

const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const max = 8;
  const arr = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > max;
}

function norm(s) {
  return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}
function tokens(s) {
  return norm(s).split(/[^a-z0-9]+/).filter((w) => w.length > 2);
}
function retrieve(query, k = 4) {
  const qt = [...new Set(tokens(query))];
  const scored = KNOWLEDGE.map((c) => {
    const ct = new Set(tokens(c.title + " " + c.text));
    let s = 0;
    qt.forEach((w) => { if (ct.has(w)) s++; });
    return { c, s };
  }).sort((a, b) => b.s - a.s);
  const top = scored.filter((x) => x.s > 0).slice(0, k).map((x) => x.c);
  if (top.length < 2) {
    ["positionnement", "protocole-diagnostic", "contact"].forEach((id) => {
      const f = KNOWLEDGE.find((c) => c.id === id);
      if (f && !top.includes(f)) top.push(f);
    });
  }
  return top.slice(0, Math.max(k, top.length));
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Méthode non autorisée." }); return; }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: "Clé API absente côté serveur (variable ANTHROPIC_API_KEY)." });
    return;
  }

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "anon";
  if (rateLimited(ip)) {
    res.status(429).json({ error: "Trop de messages d'affilée. Réessayez dans une minute." });
    return;
  }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const incoming = Array.isArray(body && body.messages) ? body.messages : [];
  const last = incoming[incoming.length - 1];
  if (!last || last.role !== "user" || typeof last.content !== "string") {
    res.status(400).json({ error: "Message invalide." });
    return;
  }
  if (last.content.length > 500) {
    res.status(400).json({ error: "Message trop long (500 caractères maximum)." });
    return;
  }

  const trimmed = incoming
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-6)
    .map((m) => ({ role: m.role, content: m.content }));

  const ctx = retrieve(last.content).map((c) => `## ${c.title}\n${c.text}`).join("\n\n");
  const system = `${SYSTEM}\n\nCONTEXTE (contenu public d'AXEM, seule source autorisée) :\n${ctx}`;

  try {
    const r = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 700, system, messages: trimmed })
    });
    const data = await r.json();
    if (!r.ok) {
      console.error("Anthropic error", r.status, data);
      res.status(502).json({ error: "Service momentanément indisponible." });
      return;
    }
    if (data.stop_reason === "refusal") {
      res.status(200).json({ answer: "Je préfère ne pas répondre à cela. Posez-moi une question sur l'offre d'AXEM, ou réservons un échange : " + CAL });
      return;
    }
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    res.status(200).json({ answer: text || ("Je n'ai pas la réponse ici. Réservons un échange de 30 minutes : " + CAL) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Service momentanément indisponible." });
  }
}
