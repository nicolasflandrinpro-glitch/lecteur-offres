// Tests jsdom du lecteur 19.6 : heure de passage lue dans Paramètres, statut « En pause », alertes Collective sans offres, rubrique « Que demander à Claude ».
// Usage : node lecteur/tests/tests-v19-6.js (lecteur/lecteur.html = page de l'artefact sans la ligne d'enveloppe)
const fs = require("fs"); const { JSDOM } = require("jsdom");
const html = fs.readFileSync(__dirname + "/../lecteur.html", "utf8");
const wait = ms => new Promise(r => setTimeout(r, ms));
const U = i => "https://app.notion.com/p/" + String(i).padStart(32, "a");
const P = (nom, v, i) => ({"Paramètre": nom, Valeur: v, "À supprimer": "__NO__", url: U(300 + i)});
let ok = 0, ko = 0;
function check(n, c, i){ if (c) { ok++; console.log("OK  " + n); } else { ko++; console.log("KO  " + n + (i ? " -> " + i : "")); } }
const cfg = {page:"https://app.notion.com/p/cfg", bases:{"Offres":{db:"x",ds:"ds-off",view:"view://v-off"},"Paramètres":{db:"x",ds:"ds-par",view:"view://v-par"},"Candidatures":{db:"x",ds:"ds-can",view:"view://v-can"},"Sources":{db:"x",ds:"ds-src",view:"view://v-src"}}};
const hier = new Date(Date.now() - 86400000 * 2).toISOString();
const auj = new Date().toISOString().slice(0, 10);
const C = (t, st, i) => ({Titre: t, Statut: st, Origine: "Offre d'emploi", "date:Date:start": auj, url: U(500 + i)});
async function scenario(opts){
  const par = [P("Postes recherchés", "Product Owner", 1), P("Version du modèle", opts.modele || "7", 2), P("Dernière exécution Offres", opts.derniere || hier, 3),
    P("Tâche Test de source", "trig_TEST123", 4), P("Dernier test de source", "", 5), P("Prochain passage", "", 6),
    P("Offres non affichées (alertes)", opts.na || "", 7)];
  if (opts.heure !== undefined) par.push(P("Heure de passage", opts.heure, 8));
  const offres = [{Titre: "PO", Identifiant: "1", Plateforme: "LinkedIn", Lien: "https://www.linkedin.com/jobs/view/1/", "date:Date de détection:start": auj, url: U(700)}];
  const cands = opts.cands || [];
  const journal = [];
  const mcp = { callTool: async (srv, tool, input) => {
    if (srv === "Claude Code Remote") { journal.push({fire: input}); return {payload: "{}"}; }
    if (tool === "notion-query-data-sources") { const v = {"view://v-off": offres, "view://v-can": cands, "view://v-par": par, "view://v-src": []}; return {payload: JSON.stringify({results: JSON.parse(JSON.stringify(v[input.data.view_url] || [])), has_more:false})}; }
    if (tool === "notion-update-page") { journal.push({maj: input}); return {payload: "{}"}; }
    return {payload: "{}"};
  }};
  const copies = [];
  const dom = new JSDOM(html, {runScripts:"dangerously", url:"https://claude.ai/artifact/t", pretendToBeVisual:true,
    beforeParse(w){ w.localStorage.setItem("lecteur-config", JSON.stringify(cfg)); w.LECTEUR_SONDE_MS = 40; w.claude = {use: async k => k === "mcp" ? mcp : {}};
      w.scrollTo = () => {}; w.open = () => null; w.HTMLElement.prototype.scrollIntoView = function(){};
      Object.defineProperty(w.navigator, "clipboard", {value: {writeText: async t => { copies.push(t); }}, configurable: true}); }});
  const w = dom.window, $ = id => w.document.getElementById(id);
  await wait(400);
  return {w, $, journal, copies};
}
(async () => {
  let r = await scenario({heure: "09:30"});
  check("heure 09:30 : bandeau « vers 9 h 30 » et « après 9 h 35 »", /passage vers 9 h 30\).*après 9 h 35\./.test(r.$("status").textContent), r.$("status").textContent);
  r = await scenario({});
  check("ligne absente : bandeau « vers 8 h 45 » et « après 8 h 50 »", /passage vers 8 h 45\).*après 8 h 50\./.test(r.$("status").textContent), r.$("status").textContent);
  r = await scenario({heure: "23:58"});
  check("heure 23:58 : recharger après 0 h 03", /après 0 h 03\./.test(r.$("status").textContent), r.$("status").textContent);
  r = await scenario({heure: "n'importe quoi"});
  check("heure illisible : 8 h 45", /passage vers 8 h 45\)/.test(r.$("status").textContent), r.$("status").textContent);
  // Alertes
  const na = "27/10/2026 ; PO Paris ; 4 annoncées, 0 lues ; https://app.collective.work/a ; Collective\n27/10/2026 ; Chef de projet ; 1 annoncées, 0 lues ; https://app.collective.work/b ; Collective\n27/10/2026 ; PO ; 12 annoncées, 6 lues ; https://www.linkedin.com/jobs/a";
  r = await scenario({na, heure: "08:45", derniere: new Date().toISOString()});
  const titres = [...r.$("alertList").querySelectorAll(".cname")].map(x => x.textContent);
  check("titre de section « Alertes incomplètes »", r.$("alertH").textContent === "Alertes incomplètes", r.$("alertH").textContent);
  check("Collective : « Collective : 4 offres annoncées par l'alerte PO Paris »", titres[0] === "Collective : 4 offres annoncées par l'alerte PO Paris", titres[0]);
  check("Collective, singulier : « 1 offre annoncée »", titres[1] === "Collective : 1 offre annoncée par l'alerte Chef de projet", titres[1]);
  check("LinkedIn inchangée : « PO : 6 offres non affichées »", titres[2] === "PO : 6 offres non affichées", titres[2]);
  const boutons = [...r.$("alertList").querySelectorAll("button")].map(b => b.textContent);
  check("boutons « Voir les offres ↗ » (Collective) et « Voir toutes les offres ↗ » (LinkedIn)", boutons[0] === "Voir les offres ↗" && boutons[2] === "Voir toutes les offres ↗", boutons.join(" | "));
  // En pause
  r = await scenario({derniere: new Date().toISOString(), cands: [C("Mission A", "Candidature envoyée", 1), C("Mission B", "En pause", 2), C("Mission C", "En pause", 3)]});
  check("compte des candidatures sans les pauses : « Candidatures (1) »", r.$("candH").textContent === "Candidatures (1)", r.$("candH").textContent);
  const tog = r.$("pauseTog");
  check("groupe « En pause (2) » présent, plié par défaut", tog && /En pause \(2\)/.test(tog.textContent) && r.$("pauseList").hidden && tog.getAttribute("aria-expanded") === "false", tog && tog.outerHTML);
  check("groupe En pause en bas de la zone", r.$("candGroups").lastElementChild.classList.contains("pause"));
  tog.click(); await wait(30);
  check("clic : groupe déplié", !r.$("pauseList").hidden);
  const ligneB = [...r.$("pauseList").querySelectorAll("li")].find(li => /Mission B/.test(li.textContent));
  const rep = [...ligneB.querySelectorAll("select")].find(s => s.options[0].textContent === "Reprendre ▾");
  check("ligne en pause : menu « Reprendre ▾ » avec les statuts actifs", rep && [...rep.options].slice(1).map(o => o.value).join("|") === "À préparer|Candidature envoyée|Relancée|Processus en cours", rep && [...rep.options].map(o => o.value).join("|"));
  check("ligne en pause : pas de relance prévue affichée", !/relance prévue/.test(ligneB.textContent), ligneB.textContent);
  rep.value = "Relancée"; rep.dispatchEvent(new r.w.Event("change")); await wait(60);
  const maj = r.journal.filter(x => x.maj).pop();
  check("Reprendre → Relancée écrit dans Notion", maj && maj.maj.properties.Statut === "Relancée" && maj.maj.page_id === "a".repeat(29) + "502", JSON.stringify(maj));
  const ligneA = [...r.$("candGroups").querySelectorAll("li")].find(li => /Mission A/.test(li.textContent));
  const menu = ligneA.querySelector("select.menu");
  check("menu « ⋯ » : option « Mettre en pause »", [...menu.options].some(o => o.textContent === "Mettre en pause" && o.value === "s:En pause"), [...menu.options].map(o => o.textContent).join("|"));
  menu.value = "s:En pause"; menu.dispatchEvent(new r.w.Event("change")); await wait(60);
  const maj2 = r.journal.filter(x => x.maj).pop();
  check("Mettre en pause écrit « En pause »", maj2 && maj2.maj.properties.Statut === "En pause", JSON.stringify(maj2));
  check("après la pause : « Candidatures (1) » (Mission B reprise), En pause (2)", r.$("candH").textContent === "Candidatures (1)" && /En pause \(2\)/.test(r.$("pauseTog").textContent), r.$("candH").textContent + " / " + r.$("pauseTog").textContent);
  r = await scenario({derniere: new Date().toISOString(), cands: [C("Mission B", "En pause", 2)]});
  check("seulement des pauses : zone Candidatures visible, « Candidatures (0) »", !r.$("candView").hidden && r.$("candH").textContent === "Candidatures (0)");
  // Aide
  r = await scenario({derniere: new Date().toISOString()});
  r.$("reglBtn").click(); await wait(80);
  const aide = r.w.document.querySelector(".champ.aide");
  check("rubrique « Que demander à Claude » présente", aide && aide.querySelector(".clib").textContent === "Que demander à Claude");
  check("intro « Colle une de ces phrases dans une conversation Cowork : »", aide && aide.querySelector(".corig").textContent === "Colle une de ces phrases dans une conversation Cowork :");
  const phrases = aide ? [...aide.querySelectorAll(".aidep")].map(x => x.textContent) : [];
  check("cinq phrases validées", phrases.join("|") === "Ajoute la plateforme <nom> au lecteur d'offres.|Règle mes critères du lecteur d'offres.|Change l'heure de passage de la brique Offres à <HH:MM>.|Explique-moi le dernier débrief de la brique Offres.|Mets à jour le lecteur d'offres.", phrases.join("|"));
  const b0 = aide.querySelectorAll("button")[3]; b0.click(); await wait(30);
  check("« Copier » copie la phrase et affiche « Copié »", r.copies[0] === "Explique-moi le dernier débrief de la brique Offres." && b0.textContent === "Copié", r.copies.join("|") + " / " + b0.textContent);
  r.$("reglSave").click(); await wait(80);
  console.log(`\n${ok}/${ok + ko} contrôles OK`); process.exit(ko ? 1 : 0);
})();
