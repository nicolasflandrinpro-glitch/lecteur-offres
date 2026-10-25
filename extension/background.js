// Extension « Lecteur d'offres » v0.6 (23/10/2026) : générique. Réglages saisis dans les options (adresse du lecteur,
// écran de la fenêtre de lecture, sous-dossier des enregistrements) ; fenêtre de lecture choisie depuis l'icône ;
// vérification des offres Free-Work retirée (faite désormais par la brique Offres).
// 1. Fenêtre de lecture. 2. Import des posts LinkedIn : l'extension n'agit jamais sur LinkedIn. Elle ouvre la recherche
//    à la demande du lecteur, observe l'enregistrement fait par l'utilisateur (Ctrl+S, « Page Web, un seul fichier »),
//    lit le fichier sur le disque, en garde une copie datée et transmet la page décodée au lecteur.
importScripts("reglages.js");

// ===== Fenêtre de lecture =====
// Ordre : fenêtre de la session, sinon fenêtre choisie depuis l'icône (si elle existe encore), sinon nouvelle fenêtre.
async function fenetreExistante(id) {
  if (!id) return null;
  try {
    const w = await chrome.windows.get(id, { populate: true });
    return (w && w.tabs && w.tabs.length) ? w : null;
  } catch (e) { return null; }
}

async function fenetreLecture() {
  const { fenetreId } = await chrome.storage.session.get("fenetreId");
  const w = await fenetreExistante(fenetreId);
  if (w) return w;
  const { fenetreChoisie } = await chrome.storage.local.get("fenetreChoisie");
  const c = await fenetreExistante(fenetreChoisie);
  if (c) { await chrome.storage.session.set({ fenetreId: c.id }); return c; }
  return null;
}

async function zoneEcran() {
  try {
    const r = await lireReglages();
    const ecrans = await chrome.system.display.getInfo();
    const e = (r.ecran && ecrans.find(x => x.id === r.ecran)) || ecrans.find(x => x.isPrimary) || ecrans[0];
    return e ? e.workArea : null;
  } catch (e) { return null; }
}

async function ouvrir(url) {
  const w = await fenetreLecture();
  if (w) {
    const onglet = w.tabs.find(t => t.active) || w.tabs[0];
    await chrome.tabs.update(onglet.id, { url: url });
    await chrome.windows.update(w.id, { focused: true, drawAttention: false });
    return;
  }
  const zone = await zoneEcran();
  const options = { url: url, type: "normal", focused: true };
  if (zone) Object.assign(options, { left: zone.left, top: zone.top, width: zone.width, height: zone.height });
  const nw = await chrome.windows.create(options);
  await chrome.storage.session.set({ fenetreId: nw.id });
  try { await chrome.windows.update(nw.id, { state: "maximized", focused: true }); } catch (e) {}
}

chrome.windows.onRemoved.addListener(async function (id) {
  const { fenetreId } = await chrome.storage.session.get("fenetreId");
  if (id === fenetreId) await chrome.storage.session.remove("fenetreId");
  const { fenetreChoisie } = await chrome.storage.local.get("fenetreChoisie");
  if (id === fenetreChoisie) await chrome.storage.local.remove("fenetreChoisie");
});

// ===== Messages du lecteur (relayés par pont.js) et de la fenêtre de l'icône =====
const MOTIF_RECHERCHE = /linkedin\.com\/search\/results\//i;

chrome.runtime.onMessage.addListener(function (msg, sender, repondre) {
  if (!msg) return;
  if (msg.type === "choisir-fenetre" && typeof msg.windowId === "number") {
    // Depuis la fenêtre de l'icône : cette fenêtre devient la fenêtre de lecture.
    Promise.all([chrome.storage.local.set({ fenetreChoisie: msg.windowId }), chrome.storage.session.set({ fenetreId: msg.windowId })])
      .then(() => repondre({ ok: true }), e => repondre({ ok: false, erreur: String(e && e.message || e) }));
    return true;
  }
  if (msg.type === "oublier-fenetre") {
    Promise.all([chrome.storage.local.remove("fenetreChoisie"), chrome.storage.session.remove("fenetreId")]).then(() => repondre({ ok: true }));
    return true;
  }
  if (msg.type === "ouvrir") {
    let url;
    try { url = new URL(msg.url); } catch (e) { repondre({ ok: false, erreur: "adresse invalide" }); return; }
    if (url.protocol !== "https:") { repondre({ ok: false, erreur: "adresse non https refusée" }); return; }
    ouvrir(url.href).then(() => repondre({ ok: true }), e => repondre({ ok: false, erreur: String(e && e.message || e) }));
    return true;
  }
  if (msg.type === "ouvrir-recherche") {
    // Seule une recherche LinkedIn est acceptée ; elle s'ouvre dans la fenêtre de lecture, comme les offres.
    let url;
    try { url = new URL(msg.url); } catch (e) { repondre({ ok: false, erreur: "adresse invalide" }); return; }
    if (url.protocol !== "https:" || url.hostname !== "www.linkedin.com" || !MOTIF_RECHERCHE.test(url.href)) {
      repondre({ ok: false, erreur: "seule une recherche LinkedIn peut être ouverte" }); return;
    }
    noterLecteur(sender);
    ouvrir(url.href).then(async () => {
      await journal({ etape: "0. Recherche ouverte dans la fenêtre de lecture", url: url.href });
      repondre({ ok: true });
    }, e => repondre({ ok: false, erreur: String(e && e.message || e) }));
    return true;
  }
  if (msg.type === "lecteur-present") { noterLecteur(sender); repondre({ ok: true }); return; }
  if (msg.type === "lire-import") {
    noterLecteur(sender);
    chrome.storage.local.get("imports").then(({ imports = [] }) => {
      repondre({ ok: true, imports: imports });
    }, e => repondre({ ok: false, erreur: String(e && e.message || e) }));
    return true;
  }
  if (msg.type === "import-traite") {
    chrome.storage.local.get("imports").then(async ({ imports = [] }) => {
      const x = imports.find(i => i.id === msg.id);
      if (x) {
        await chrome.storage.local.set({ imports: imports.filter(i => i.id !== msg.id) });
        await journal({ etape: "9. Import traité par le lecteur", fichier: x.fichier, bilan: msg.bilan || "" });
      }
      repondre({ ok: true });
    });
    return true;
  }
});

// Onglets où le lecteur d'offres est ouvert, notés quand le lecteur se signale.
async function noterLecteur(sender) {
  if (!sender || !sender.tab || typeof sender.tab.id !== "number") return;
  const { lecteurs = [] } = await chrome.storage.session.get("lecteurs");
  const cle = sender.tab.id + ":" + (sender.frameId || 0);
  if (lecteurs.some(l => l.cle === cle)) return;
  lecteurs.push({ cle: cle, tabId: sender.tab.id, frameId: sender.frameId || 0, windowId: sender.tab.windowId });
  await chrome.storage.session.set({ lecteurs: lecteurs.slice(-10) });
}
chrome.tabs.onRemoved.addListener(async function (tabId) {
  const { lecteurs = [] } = await chrome.storage.session.get("lecteurs");
  await chrome.storage.session.set({ lecteurs: lecteurs.filter(l => l.tabId !== tabId) });
});

// ===== Journal =====
function horodatage() {
  const d = new Date(), p = n => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes());
}

async function journal(entree) {
  const { journalImport = [] } = await chrome.storage.local.get("journalImport");
  journalImport.unshift(Object.assign({ heure: new Date().toLocaleString("fr-FR") }, entree));
  await chrome.storage.local.set({ journalImport: journalImport.slice(0, 40) });
}

// ===== Détection de l'enregistrement =====
// L'« Enregistrer sous » est signalé à la création (onCreated) mais sa fin n'est pas remontée : on le suit nous-mêmes.
// Ne jamais ajouter d'écouteur onDeterminingFilename (il fait perdre le nom de la copie datée).
function estRechercheLinkedIn(item) {
  return MOTIF_RECHERCHE.test(item.url || "") || MOTIF_RECHERCHE.test(item.finalUrl || "") || MOTIF_RECHERCHE.test(item.referrer || "");
}

async function dejaTraite(id) {
  const { traites = [] } = await chrome.storage.session.get("traites");
  if (traites.indexOf(id) >= 0) return true;
  traites.push(id);
  await chrome.storage.session.set({ traites: traites.slice(-50) });
  return false;
}

chrome.downloads.onCreated.addListener(async function (item) {
  if (!estRechercheLinkedIn(item)) return; // les autres téléchargements (dont nos copies datées) sont ignorés
  await journal({ etape: "1. Enregistrement détecté", url: item.url, fichier: item.filename, type: item.mime });
  suivre(item.id);
});

async function suivre(id) {
  for (let i = 0; i < 120; i++) {
    const [it] = await chrome.downloads.search({ id: id });
    if (!it) { await journal({ etape: "2. Suivi", erreur: "enregistrement introuvable" }); return; }
    if (it.state === "interrupted") { await journal({ etape: "2. Suivi", erreur: "enregistrement interrompu : " + (it.error || "") }); return; }
    if (it.state === "complete" && it.filename) {
      if (await dejaTraite(id)) return;
      await journal({ etape: "2. Enregistrement terminé", fichier: it.filename, taille: it.fileSize, attente: i + " s" });
      const lu = await lireFichier(it.filename);
      if (!lu) return;
      const copie = await renommerParCopie(it, lu.html);
      await transmettre(lu, copie || it.filename, it.url || it.finalUrl || "");
      return;
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  await journal({ etape: "2. Suivi", erreur: "pas terminé au bout de 2 minutes" });
}

// ===== Lecture du fichier =====
function versUrlFichier(chemin) {
  let c = String(chemin).replace(/\\/g, "/");
  if (!c.startsWith("/")) c = "/" + c;
  return "file://" + encodeURI(c).replace(/#/g, "%23").replace(/\?/g, "%3F");
}

// Format « Page Web, un seul fichier » (.mhtml) : la page est la première partie text/html, souvent en quoted-printable.
function extraireHtmlDeMhtml(brut) {
  const m = /boundary="?([^"\r\n;]+)"?/i.exec(brut);
  const parties = m ? brut.split("--" + m[1]) : [brut];
  for (const partie of parties) {
    const fin = partie.search(/\r?\n\r?\n/);
    if (fin < 0) continue;
    const entetes = partie.slice(0, fin);
    if (!/content-type:\s*text\/html/i.test(entetes)) continue;
    let corps = partie.slice(fin).replace(/^\r?\n\r?\n/, "");
    if (/content-transfer-encoding:\s*quoted-printable/i.test(entetes)) {
      corps = corps.replace(/=\r?\n/g, "");
      const octets = [];
      for (let i = 0; i < corps.length; i++) {
        const c = corps.charCodeAt(i);
        if (corps[i] === "=" && /^[0-9A-F]{2}$/i.test(corps.substr(i + 1, 2))) { octets.push(parseInt(corps.substr(i + 1, 2), 16)); i += 2; }
        else octets.push(c & 0xff);
      }
      return new TextDecoder("utf-8").decode(new Uint8Array(octets));
    }
    if (/content-transfer-encoding:\s*base64/i.test(entetes)) {
      const bin = atob(corps.replace(/\s+/g, ""));
      const o = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i);
      return new TextDecoder("utf-8").decode(o);
    }
    return corps;
  }
  return null;
}

function compterPosts(html) { return (html.match(/data-testid="expandable-text-box"/g) || []).length; }

async function lireFichier(chemin) {
  if (!(await chrome.extension.isAllowedFileSchemeAccess())) {
    await journal({ etape: "3. Lecture", verdict: "ÉCHEC : coche « Autoriser l'accès aux URL de fichier » dans chrome://extensions" });
    return null;
  }
  let html = null;
  try { html = await (await fetch(versUrlFichier(chemin))).text(); }
  catch (e) { await journal({ etape: "3. Lecture", verdict: "ÉCHEC : fichier illisible", erreur: String(e && e.message || e) }); return null; }
  const mhtml = /\.mhtml?$/i.test(chemin);
  if (mhtml) {
    html = extraireHtmlDeMhtml(html);
    if (!html) { await journal({ etape: "3. Lecture", verdict: "ÉCHEC : partie HTML introuvable dans le fichier .mhtml" }); return null; }
  }
  const posts = compterPosts(html);
  const conseil = mhtml ? "" : "Format conseillé : « Page Web, un seul fichier » (le format HTML ne contient que les premiers posts).";
  await journal({ etape: "3. Lecture", verdict: posts > 0 ? "RÉUSSITE" : "Fichier lu mais aucun post trouvé", postsTrouves: posts, tailleCaracteres: html.length, conseil: conseil });
  return posts > 0 ? { html: html, posts: posts, mhtml: mhtml } : null;
}

// ===== Copie datée dans le sous-dossier choisi (Chrome ne sait pas renommer un fichier) =====
function enBase64(texte) {
  const octets = new TextEncoder().encode(texte);
  let bin = "";
  for (let i = 0; i < octets.length; i += 0x8000) bin += String.fromCharCode.apply(null, octets.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function renommerParCopie(original, html) {
  const r = await lireReglages();
  const dossier = dossierValide(r.dossier) || REGLAGES_DEFAUT.dossier;
  const nom = dossier + "/posts-linkedin-" + horodatage() + ".html";
  let copieId;
  try {
    copieId = await chrome.downloads.download({ url: "data:text/html;base64," + enBase64(html), filename: nom, conflictAction: "uniquify", saveAs: false });
  } catch (e) { await journal({ etape: "4. Copie datée", erreur: String(e && e.message || e) }); return null; }
  for (let i = 0; i < 60; i++) {
    const [c] = await chrome.downloads.search({ id: copieId });
    if (c && c.state === "complete") {
      await journal({ etape: "4. Copie datée enregistrée", fichier: c.filename, taille: c.fileSize });
      try {
        await chrome.downloads.removeFile(original.id);
        await chrome.downloads.erase({ id: original.id });
        await journal({ etape: "5. Original supprimé", fichier: original.filename });
      } catch (e) { await journal({ etape: "5. Suppression de l'original", erreur: String(e && e.message || e) }); }
      return c.filename;
    }
    if (c && c.state === "interrupted") { await journal({ etape: "4. Copie datée", erreur: "interrompue : " + (c.error || "") }); return null; }
    await new Promise(r2 => setTimeout(r2, 1000));
  }
  await journal({ etape: "4. Copie datée", erreur: "pas terminée au bout d'une minute ; original conservé" });
  return null;
}

// ===== Transmission au lecteur =====
// File d'attente : plusieurs recherches peuvent être enregistrées à la suite ; chaque fichier reste en file
// jusqu'à ce que le lecteur l'ait traité (cinq au plus, les plus anciens sortent).
async function transmettre(lu, fichier, recherche) {
  const imp = { id: "imp-" + Date.now(), fichier: fichier, recherche: recherche, date: new Date().toISOString(), posts: lu.posts, html: lu.html };
  const { imports = [] } = await chrome.storage.local.get("imports");
  imports.push(imp);
  await chrome.storage.local.set({ imports: imports.slice(-5) });
  const { lecteurs = [] } = await chrome.storage.session.get("lecteurs");
  let prevenu = null;
  for (const l of lecteurs) {
    try { await chrome.tabs.sendMessage(l.tabId, { type: "import-dispo", id: imp.id, posts: imp.posts, recherche: recherche }, { frameId: l.frameId }); prevenu = prevenu || l; } catch (e) {}
  }
  await journal({ etape: "6. Import transmis au lecteur", fichier: fichier, postsTrouves: lu.posts,
    lecteurs: prevenu ? "lecteur prévenu" : "aucun lecteur ouvert : il le lira à sa prochaine ouverture" });
  if (prevenu) {
    try { await chrome.tabs.update(prevenu.tabId, { active: true }); await chrome.windows.update(prevenu.windowId, { focused: true }); } catch (e) {}
  }
}

// Première installation : ouvre les options pour saisir l'adresse du lecteur.
chrome.runtime.onInstalled.addListener(async function (d) {
  if (d.reason === "install") chrome.runtime.openOptionsPage();
});
