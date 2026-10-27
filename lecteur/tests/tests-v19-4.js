// Tests jsdom du lecteur 19.4 : titre de configuration toléré, lien retenu, modèles 5 et 4, renvois vers la page d'accueil,
// accès à Notion absent (roue dentée masquée, état de la permission « mcp »), réglages robustes à des paramètres incomplets.
// Usage : node lecteur/tests/tests-v19-4.js (lecteur/lecteur.html = page de l'artefact sans la ligne d'enveloppe)
// 27/10/2026 : seul changement pour la 19.5, le contrôle du pied de page (v19.5, modèles 6, 5 et 4).
const fs = require("fs"); const { JSDOM, VirtualConsole } = require("jsdom");
const html = fs.readFileSync(__dirname + "/../lecteur.html", "utf8");
const wait = ms => new Promise(r => setTimeout(r, ms));
const ACCUEIL = "https://nicolasflandrinpro-glitch.github.io/lecteur-offres/";
let ok = 0, ko = 0;
function check(n, c, i){ if (c) { ok++; console.log("OK  " + n); } else { ko++; console.log("KO  " + n + (i ? " -> " + i : "")); } }
const U = i => "https://app.notion.com/p/" + String(i).padStart(32, "a");
const P = (nom, v, i) => ({"Paramètre": nom, Valeur: v, "À supprimer": "__NO__", url: U(300 + i)});
const CFG = {page:"https://app.notion.com/p/cfg", bases:{"Offres":{db:"x",ds:"ds-off",view:"view://v-off"},"Paramètres":{db:"x",ds:"ds-par",view:"view://v-par"},"Candidatures":{db:"x",ds:"ds-can",view:"view://v-can"}}};
// Ouvre le lecteur ; renvoie la fenêtre, les erreurs JavaScript et l'état de la page.
function ouvrir({use, stockage = {}, recharger}){
  const erreurs = [], vc = new VirtualConsole();
  vc.on("jsdomError", e => { if (!/Not implemented/.test(e.message)) erreurs.push(e.message); });
  const dom = new JSDOM(html, {runScripts:"dangerously", url:"https://claude.ai/artifact/t", pretendToBeVisual:true, virtualConsole: vc,
    beforeParse(w){ Object.keys(stockage).forEach(k => w.localStorage.setItem(k, stockage[k])); w.claude = use === null ? undefined : {use};
      w.LECTEUR_RECHARGER = recharger || (() => {}); w.scrollTo = () => {}; w.open = () => null; w.HTMLElement.prototype.scrollIntoView = function(){};
      w.addEventListener("error", e => erreurs.push(String(e.message))); w.addEventListener("unhandledrejection", e => erreurs.push("rejet : " + String(e.reason && (e.reason.message || e.reason)))); }});
  const w = dom.window;
  return {w, $: id => w.document.getElementById(id), erreurs, btn: t => [...w.document.querySelectorAll("button")].find(b => b.textContent === t)};
}
const vuesNotion = par => ({ callTool: async (srv, tool, input) => {
  const v = {"view://v-off": [], "view://v-can": [], "view://v-par": par};
  if (tool === "notion-query-data-sources") return {payload: JSON.stringify({results: JSON.parse(JSON.stringify(v[input.data.view_url] || [])), has_more:false})};
  return {payload: "{}"};
}});
// Permission « mcp » simulée : état initial, réponse à request, effet de manage.
function permissions(etat, {apresRequest, manage} = {}){
  const appels = {state: 0, request: [], manage: 0};
  return {appels, ns: {
    state: async n => { appels.state++; return n === "mcp" ? etat : "unavailable"; },
    request: async names => { appels.request.push(names); if (apresRequest) etat = apresRequest; return {mcp: etat}; },
    manage: async () => { appels.manage++; if (manage === "rejette") throw {code: "unavailable"}; if (manage) etat = manage; }
  }};
}
const sansMcp = perm => async k => k === "mcp" ? null : k === "permissions" ? perm : null;

(async () => {
  // ---- 1. Titre de configuration toléré, lien retenu, renvoi vers la page d'accueil ----
  {
    const mcp = { callTool: async (srv, tool) => {
      if (tool === "notion-search") return {payload: JSON.stringify({results: [
        {type:"page", title:"**Lecteur d’offres :  Configuration**", url:"https://app.notion.com/p/" + "c".repeat(32), path:"Espace"},
        {type:"page", title:"Notes sur le lecteur", url:"https://app.notion.com/p/" + "d".repeat(32)}]})};
      throw {code: "tool_error", message: "page illisible"};
    }};
    const p = ouvrir({use: async k => k === "mcp" ? mcp : null});
    await wait(300);
    const t = p.$("cfgBody").textContent;
    check("titre en gras, apostrophe typographique, espaces et casse : page trouvée", !!p.btn("Utiliser cette page") && /\(Espace\)/.test(t), t);
    check("page sans rapport écartée", !/Notes sur le lecteur/.test(t), t);
    check("champ « Colle le lien de ta page de configuration »", [...p.$("cfgBody").querySelectorAll("label")].some(l => l.textContent === "Colle le lien de ta page de configuration"));
    const i = p.$("cfgUrl"); i.value = " https://app.notion.com/p/" + "e".repeat(32) + " ";
    p.btn("Analyser").click(); await wait(100);
    check("lien collé retenu dans le navigateur", p.w.localStorage.getItem("lecteur-config-lien") === "https://app.notion.com/p/" + "e".repeat(32), p.w.localStorage.getItem("lecteur-config-lien"));
    check("analyse en échec : champ repris avec le lien retenu", p.$("cfgUrl") && p.$("cfgUrl").value === "https://app.notion.com/p/" + "e".repeat(32) && /Lecture impossible/.test(p.$("cfgBody").textContent), p.$("cfgBody").textContent);
    check("aucune erreur JavaScript (configuration)", !p.erreurs.length, p.erreurs.join(" | "));
  }
  {
    const mcp = { callTool: async (srv, tool) => tool === "notion-search" ? {payload: JSON.stringify({results: []})} : {payload: "{}"} };
    const p = ouvrir({use: async k => k === "mcp" ? mcp : null, stockage: {"lecteur-config-lien": "https://app.notion.com/p/" + "f".repeat(32)}});
    await wait(300);
    const t = p.$("cfgBody").textContent;
    check("aucune page trouvée : renvoi vers la page d'accueil du kit", t.indexOf("Lance l'installation depuis la page d'accueil du kit (" + ACCUEIL + "), ou colle son lien ci-dessous.") >= 0 && !/Duplique le modèle/.test(t), t);
    check("lancement suivant : champ prérempli avec le lien retenu", p.$("cfgUrl").value === "https://app.notion.com/p/" + "f".repeat(32), p.$("cfgUrl").value);
  }
  // ---- 2. Modèles acceptés ----
  for (const [m, attendu] of [["5", "Lecteur v19.5 (modèles 6, 5 et 4). "], ["4", "Lecteur v19.5 (modèles 6, 5 et 4). "], ["3", "Lecteur v19.5 (modèles 6, 5 et 4, Notion en modèle 3 : mise à jour à appliquer). "]]) {
    const par = [P("Postes recherchés", "Product Owner", 1), P("Version du modèle", m, 2), P("Dernière exécution Offres", new Date().toISOString(), 3)];
    const p = ouvrir({use: async k => k === "mcp" ? vuesNotion(par) : null, stockage: {"lecteur-config": JSON.stringify(CFG)}});
    await wait(300);
    check("modèle " + m + " : pied de page", p.$("foot").textContent.indexOf(attendu) === 0, p.$("foot").textContent);
  }
  // ---- 3. Renvois des réglages vers la mise à jour de la configuration ----
  {
    const par = [P("Postes recherchés", "Product Owner", 1), P("Version du modèle", "4", 2), P("Dernière exécution Offres", new Date().toISOString(), 3)];
    const p = ouvrir({use: async k => k === "mcp" ? vuesNotion(par) : null, stockage: {"lecteur-config": JSON.stringify(CFG)}});
    await wait(300);
    p.$("reglBtn").click(); await wait(30); p.$("reglSave").click(); await wait(30);
    check("lignes absentes : renvoi vers « mets à jour le lecteur d'offres »", p.$("reglMsg").textContent.indexOf("Mets à jour ta configuration (dans Cowork : « mets à jour le lecteur d'offres ») avant de modifier ces réglages.") > 0, p.$("reglMsg").textContent);
  }
  // ---- 4. Accès à Notion absent ----
  const SANS = "Cette vue ne permet pas d'appeler Notion. Ouvre la page depuis claude.ai ou l'application Claude.";
  const REFUSE = "Accès à Notion refusé pour cette page : rétablis-le depuis le menu Permissions de l'artefact, puis recharge la page.";
  const INDISPO = "L'accès à Notion n'est pas disponible depuis ce compte ou cette vue. Ouvre ta propre copie du lecteur.";
  {
    const pm = permissions("prompt", {apresRequest: "granted"}); let rech = 0;
    const p = ouvrir({use: sansMcp(pm.ns), recharger: () => rech++});
    await wait(200);
    check("prompt : bandeau d'erreur et bouton « Autoriser l'accès à Notion »", !p.$("status").hidden && p.$("status").textContent.indexOf(SANS) === 0 && !!p.btn("Autoriser l'accès à Notion"), p.$("status").textContent);
    check("roue dentée masquée sans accès à Notion", p.$("reglBtn").hidden);
    p.btn("Autoriser l'accès à Notion").click(); await wait(50);
    check("prompt accepté : request([\"mcp\"]) puis rechargement", JSON.stringify(pm.appels.request) === JSON.stringify([["mcp"]]) && rech === 1, JSON.stringify(pm.appels) + " " + rech);
    p.$("reglBtn").click(); await wait(50);
    check("clic forcé sur la roue masquée : réglages ouverts sans erreur (paramètres incomplets)", !p.$("reglView").hidden && !p.erreurs.length, p.erreurs.join(" | "));
    check("réglages par défaut : types et modes cochés", [...p.$("reglBody").querySelectorAll("fieldset")[0].querySelectorAll("input")].every(c => c.checked) && [...p.$("reglBody").querySelectorAll("fieldset")[2].querySelectorAll("input")].every(c => c.checked));
  }
  {
    const pm = permissions("prompt", {apresRequest: "denied"}); let rech = 0;
    const p = ouvrir({use: sansMcp(pm.ns), recharger: () => rech++});
    await wait(200); p.btn("Autoriser l'accès à Notion").click(); await wait(50);
    check("prompt refusé : message « refusé », pas de rechargement", p.$("status").textContent.indexOf(REFUSE) === 0 && !rech && !p.btn("Autoriser l'accès à Notion"), p.$("status").textContent);
    check("aucune erreur JavaScript (prompt)", !p.erreurs.length, p.erreurs.join(" | "));
  }
  {
    const pm = permissions("denied", {manage: "granted"}); let rech = 0;
    const p = ouvrir({use: sansMcp(pm.ns), recharger: () => rech++});
    await wait(200);
    check("denied : message « refusé » et bouton « Ouvrir les permissions »", p.$("status").textContent.indexOf(REFUSE) === 0 && !!p.btn("Ouvrir les permissions") && p.$("reglBtn").hidden, p.$("status").textContent);
    check("denied : aucune demande d'accès au chargement", !pm.appels.request.length && !pm.appels.manage);
    p.btn("Ouvrir les permissions").click(); await wait(50);
    check("denied puis accès rétabli dans le panneau : rechargement", pm.appels.manage === 1 && rech === 1, JSON.stringify(pm.appels) + " " + rech);
  }
  {
    const pm = permissions("denied", {manage: "rejette"}); let rech = 0;
    const p = ouvrir({use: sansMcp(pm.ns), recharger: () => rech++});
    await wait(200); p.btn("Ouvrir les permissions").click(); await wait(50);
    check("panneau impossible à ouvrir : bouton retiré, message gardé", !p.btn("Ouvrir les permissions") && p.$("status").textContent === REFUSE && !rech, p.$("status").textContent);
    check("aucune erreur JavaScript (denied)", !p.erreurs.length, p.erreurs.join(" | "));
  }
  for (const [lib, use] of [["unavailable", sansMcp(permissions("unavailable").ns)], ["permissions absent", sansMcp(null)],
                            ["granted mais mcp null", sansMcp(permissions("granted").ns)], ["window.claude absent", null]]) {
    const p = ouvrir({use});
    await wait(200);
    check(lib + " : message « indisponible », roue masquée, aucun bouton", p.$("status").textContent === INDISPO && p.$("reglBtn").hidden && !p.$("status").querySelector("button"), p.$("status").textContent);
    check(lib + " : aucune erreur JavaScript", !p.erreurs.length, p.erreurs.join(" | "));
  }
  console.log("\n" + ok + " OK, " + ko + " KO"); process.exit(ko ? 1 : 0);
})();
