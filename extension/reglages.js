// Réglages de l'extension (v0.6), partagés par le script de fond, les options, la fenêtre de l'icône et icone.js.
// Aucune adresse en dur : l'adresse du lecteur, l'écran de la fenêtre de lecture et le sous-dossier sont saisis dans les options.
const REGLAGES_DEFAUT = { lecteurs: [], dossier: "Posts LinkedIn", ecran: "" };

async function lireReglages() {
  try {
    const { reglages } = await chrome.storage.sync.get("reglages");
    return Object.assign({}, REGLAGES_DEFAUT, reglages || {});
  } catch (e) { return Object.assign({}, REGLAGES_DEFAUT); }
}

async function ecrireReglages(r) { await chrome.storage.sync.set({ reglages: r }); }

// Sous-dossier de Téléchargements : Chrome refuse les chemins absolus et les « .. » (documentation chrome.downloads).
function dossierValide(d) {
  const p = String(d || "").replace(/\\/g, "/").split("/").map(x => x.trim()).filter(Boolean);
  if (!p.length || p.some(x => x === ".." || x === "." || /[<>:"|?*]/.test(x))) return null;
  return p.join("/");
}

// Adresse d'un lecteur : page d'artefact claude.ai, sans paramètres.
function adresseLecteurValide(u) {
  try {
    const x = new URL(String(u).trim());
    if (x.protocol !== "https:" || x.hostname !== "claude.ai" || !/^\/(code\/)?artifact\/[A-Za-z0-9-]+\/?$/.test(x.pathname)) return null;
    return "https://claude.ai" + x.pathname.replace(/\/$/, "");
  } catch (e) { return null; }
}
