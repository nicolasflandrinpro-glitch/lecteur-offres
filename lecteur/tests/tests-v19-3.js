// Tests jsdom du lecteur 19.3 : valeurs échappées par la lecture de vue, zones pliables.
// 25/10/2026 : seul changement pour la 19.4, le contrôle du pied de page et le chemin du lecteur.
const fs = require("fs"); const { JSDOM } = require("jsdom");
const html = fs.readFileSync(__dirname + "/../lecteur.html", "utf8");
const fmt = d => new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
const today = fmt(new Date()), hier = fmt(new Date(Date.now() - 864e5));
const U = i => "https://app.notion.com/p/" + String(i).padStart(32, "a");
const P = (nom, v, i) => ({"Paramètre": nom, Valeur: v, "À supprimer": "__NO__", url: U(300 + i)});
// Valeurs telles que la vue Notion les renvoie (constat du 25/10/2026).
const iso = new Date().toISOString().replace(/\.\d+Z$/, "+00:00").replace(/:/g, "\\:");
const par = [P("Postes recherchés", "Product Owner", 1), P("Prénom", "Camille", 2), P("Version du modèle", "4", 3),
  P("Dernière exécution Offres", iso, 4), P("Tâche Test de source", "trig\\_TEST123", 5), P("Dernier test de source", "", 6)];
const O = (id, t, d) => ({Identifiant: id, Titre: t, Entreprise: "Acme", Plateforme: "LinkedIn", Lien: "https://www.linkedin.com/jobs/view/" + id, "date:Date de détection:start": d, url: U(600 + +id)});
const offres = [O("1", "Product Owner \\- Data", today), O("2", "PM", today), O("3", "BA", hier)];
const cands = [{Titre: "Candidature X", Statut: "Candidature envoyée", Origine: "Prospection", "date:Date:start": today, url: U(700)}];
const views = {"view://v-off": offres, "view://v-can": cands, "view://v-par": par, "view://v-src": []};
const fires = [];
const mcp = { callTool: async (srv, tool, input) => {
  if (srv === "Claude Code Remote") { fires.push(input); return {payload: "{}"}; }
  if (tool === "notion-query-data-sources") return {payload: JSON.stringify({results: JSON.parse(JSON.stringify(views[input.data.view_url] || [])), has_more:false})};
  return {payload: "{}"};
}};
const cfg = {page:"https://app.notion.com/p/cfg", bases:{"Offres":{db:"x",ds:"ds-off",view:"view://v-off"},"Paramètres":{db:"x",ds:"ds-par",view:"view://v-par"},"Candidatures":{db:"x",ds:"ds-can",view:"view://v-can"},"Sources":{db:"x",ds:"ds-src",view:"view://v-src"}}};
const dom = new JSDOM(html, {runScripts:"dangerously", url:"https://claude.ai/artifact/z", pretendToBeVisual:true,
  beforeParse(w){ w.localStorage.setItem("lecteur-config", JSON.stringify(cfg)); w.LECTEUR_SONDE_MS = 40; w.claude = {use: async k => k === "mcp" ? mcp : {}};
    w.scrollTo = () => {}; w.open = () => null; w.HTMLElement.prototype.scrollIntoView = function(){}; }});
const w = dom.window, $ = id => w.document.getElementById(id), wait = ms => new Promise(r => setTimeout(r, ms));
let ok = 0, ko = 0;
function check(n, c, i){ if (c) { ok++; console.log("OK  " + n); } else { ko++; console.log("KO  " + n + (i ? " -> " + i : "")); } }
const btn = t => [...w.document.querySelectorAll("button")].find(b => b.textContent === t);
(async () => {
  await wait(400);
  check("pied de page 19.4", /^Lecteur v19\.4 /.test($("foot").textContent), $("foot").textContent);
  check("date échappée lue : pas de bandeau « brique pas encore passée »", $("status").hidden, $("status").textContent);
  check("offres pliées à l'ouverture", $("list").hidden && $("offTog").getAttribute("aria-expanded") === "false");
  check("titre et résumé par jour", $("offH").textContent === "Offres à lire (3)" && $("offResume").textContent === "· aujourd'hui 2 · " + ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"][new Date(hier + "T12:00:00Z").getUTCDay()] + " 1", $("offH").textContent + " " + $("offResume").textContent);
  check("barre de lecture visible, liste pliée", !$("bar").hidden && /3 offres à lire/.test($("count").textContent));
  check("titre d'offre désechappé", [...$("list").querySelectorAll(".title")].some(x => x.textContent === "Product Owner - Data"));
  $("offTog").click();
  check("clic : liste dépliée", !$("list").hidden && $("offTog").getAttribute("aria-expanded") === "true" && $("offTog").querySelector(".chev").textContent === "▾");
  check("candidatures dépliées par défaut", !$("candView").hidden && !$("candGroups").hidden && $("candTog").getAttribute("aria-expanded") === "true");
  $("candTog").click();
  check("clic : candidatures pliées, titre gardé", $("candGroups").hidden && $("candH").textContent === "Candidatures (1)");
  $("start").click(); await wait(20); $("back").click(); await wait(20);
  check("retour de lecture : états de pliage conservés", !$("list").hidden && $("candGroups").hidden);
  $("offTog").click();
  check("replier la liste", $("list").hidden);
  // Tâche de test : identifiant « trig\_… » désechappé
  $("reglBtn").click(); await wait(80);
  btn("+ Ajouter une plateforme").click(); await wait(20);
  const champ = lib => [...$("platBox").querySelectorAll(".ajout .champ")].find(c => c.querySelector("label").textContent === lib).querySelector("input");
  const saisir = (lib, v) => { const i = champ(lib); i.value = v; i.dispatchEvent(new w.Event("input")); };
  saisir("Nom de la plateforme", "Malt"); saisir("Site (domaine des offres)", "malt.fr");
  btn("Tester").click(); await wait(30);
  check("tâche de test déclenchée avec trig_TEST123", fires[0] && fires[0].trigger_id === "trig_TEST123", JSON.stringify(fires) + " " + $("platBox").textContent.slice(-200));
  console.log("\n" + ok + " OK, " + ko + " KO"); process.exit(ko ? 1 : 0);
})();
