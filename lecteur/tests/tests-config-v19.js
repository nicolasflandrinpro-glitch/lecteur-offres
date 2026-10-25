// Tests jsdom du lecteur v19 : premier lancement (détection de la configuration), offres retirées, recherches générées.
// Usage : node lecteur/tests/tests-config-v19.js (lecteur/lecteur.html = page de l'artefact sans la ligne d'enveloppe)
// 25/10/2026 : seul changement pour la 19.4, le chemin du lecteur.
const fs = require("fs");
const { JSDOM } = require("jsdom");
const html = fs.readFileSync(__dirname + "/../lecteur.html", "utf8");
function today(){ return new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()); }
const PAGE = "https://app.notion.com/p/" + "c".repeat(32);
const DB = n => "https://app.notion.com/p/" + String(n).repeat(32).slice(0, 32);
const pageTxt = `<page url="${PAGE}"><content>Notice.\n<database url="${DB(1)}" data-source-url="collection://ds-par" inline="false">\nParamètres\n</database>\n<database url="${DB(2)}" data-source-url="collection://ds-src" inline="false">\nSources\n</database>\n<database url="${DB(3)}" data-source-url="collection://ds-off" inline="false">\nOffres\n</database>\n<database url="${DB(4)}" data-source-url="collection://ds-can" inline="false">\nCandidatures\n</database>\n</content></page>`;
const vues = {
  [DB(1)]: [["view://v-par-autre", "Default view"], ["view://v-par", "Lecteur : ne pas modifier"]],
  [DB(2)]: [["view://v-src", "Lecteur : ne pas modifier"]],
  [DB(3)]: [["view://v-off", "Lecteur : ne pas modifier"]],
  [DB(4)]: [["view://v-can", "Lecteur : ne pas modifier"]]
};
const dbTxt = u => `<database url="{{${u}}}">\n<views>\n` + vues[u].map(v => `<view url="{{${v[0]}}}">\n${JSON.stringify({name: v[1], type: "table"})}\n</view>`).join("\n") + "\n</views>\n</database>";
const P = (nom, v, i) => ({"Paramètre": nom, Valeur: v, "À supprimer": "__NO__", url: "https://app.notion.com/p/" + String(500 + i).padStart(32, "b")});
const data = {
  "view://v-off": [
    {Identifiant:"a1", Titre:"PO Assurance", Entreprise:"Alpha", Plateforme:"Free-Work", Lien:"https://www.free-work.com/fr/tech-it/job-mission/po/a1", "date:Date de détection:start": today(), url:"https://app.notion.com/p/" + "1".repeat(32)},
    {Identifiant:"a2", Titre:"BA retirée", Entreprise:"Beta", Plateforme:"Free-Work", Lien:"https://www.free-work.com/fr/tech-it/job-mission/ba/a2", "date:Date de détection:start": today(), "date:Retirée le:start": today(), url:"https://app.notion.com/p/" + "2".repeat(32)}
  ],
  "view://v-can": [],
  "view://v-par": [P("Postes recherchés", "Product Owner; Business Analyst; Scrum Master; Coach agile", 1), P("Zone de présentiel", "Paris; Île-de-France, y compris toute commune des départements 75 à 95", 2),
    P("Types de collaboration acceptés", "Freelance", 3), P("Prénom", "Camille", 4), P("Version du modèle", "1", 5), P("Dernière exécution Offres", new Date().toISOString(), 6)]
};
const appels = [];
const mcp = { callTool: async (srv, tool, input) => {
  appels.push(tool);
  if (tool === "notion-search") return {payload: JSON.stringify({results: [{type:"page", title:"Lecteur d'offres : configuration", url: PAGE, path:"Espace"}, {type:"database", title:"Offres", url: DB(3)}]})};
  if (tool === "notion-fetch") return {payload: JSON.stringify({text: input.id === PAGE ? pageTxt : dbTxt(input.id)})};
  if (tool === "notion-query-data-sources") return {payload: JSON.stringify({results: JSON.parse(JSON.stringify(data[input.data.view_url] || [])), has_more:false})};
  return {payload:"{}"};
}};
const dom = new JSDOM(html, {runScripts:"dangerously", url:"https://claude.ai/artifact/y", pretendToBeVisual:true,
  beforeParse(w){ w.claude = {use: async k => k === "mcp" ? mcp : {}}; w.scrollTo = () => {}; w.open = () => null; }});
const w = dom.window, $ = id => w.document.getElementById(id), wait = ms => new Promise(r => setTimeout(r, ms));
let ok = 0, ko = 0;
function check(n, c, i){ if (c) { ok++; console.log("OK  " + n); } else { ko++; console.log("KO  " + n + (i ? " -> " + i : "")); } }
const btn = t => [...w.document.querySelectorAll("button")].find(b => b.textContent === t);
(async () => {
  await wait(300);
  check("sans configuration : écran de configuration affiché", !$("cfgView").hidden && $("listView").hidden);
  check("page trouvée par la recherche", /Lecteur d'offres : configuration \(Espace\)/.test($("cfgBody").textContent), $("cfgBody").textContent);
  check("bouton réglages masqué pendant la configuration", $("reglBtn").hidden);
  btn("Utiliser cette page").click(); await wait(200);
  const lignes = [...$("cfgBody").querySelectorAll("li")].map(l => l.textContent);
  check("bilan : 5 bases et l'extension", lignes.length === 6, JSON.stringify(lignes));
  check("bilan : Interdits absente signalée", lignes.some(l => /^✗Interdits : base introuvable/.test(l)), JSON.stringify(lignes));
  check("bilan : vue trouvée parmi plusieurs", lignes.some(l => /^✓Paramètres/.test(l)));
  check("bilan : extension non détectée", lignes.some(l => /Extension Chrome non détectée/.test(l)));
  btn("Valider et ouvrir le lecteur").click(); await wait(300);
  const cfg = JSON.parse(w.localStorage.getItem("lecteur-config"));
  check("configuration gardée dans le navigateur", cfg.bases["Offres"].view === "view://v-off" && cfg.bases["Paramètres"].view === "view://v-par" && cfg.bases["Candidatures"].ds === "ds-can", JSON.stringify(cfg));
  check("liste affichée après validation", !$("listView").hidden && $("cfgView").hidden);
  const titres = [...$("list").querySelectorAll(".title")].map(x => x.textContent);
  check("offre « Retirée le » masquée", JSON.stringify(titres) === JSON.stringify(["PO Assurance"]), JSON.stringify(titres));
  check("compteur des offres retirées", /1 retirée par la plateforme/.test($("count").textContent), $("count").textContent);
  // Réglages sans extension
  $("reglBtn").click(); await wait(50);
  check("sans extension : recherches LinkedIn indisponibles", /Import des posts LinkedIn indisponible/.test($("reglBody").textContent) && !btn("Générer les recherches"));
  check("bloc configuration dans les réglages", /Page de configuration Notion/.test($("reglBody").textContent) && !!btn("Changer de page de configuration"));
  // Extension détectée
  w.dispatchEvent(new w.MessageEvent("message", {data:{source:"lecteur-offres-ext", type:"presente", capacites:["ouvrir","import","file"]}, source:w})); await wait(80);
  check("avec extension : bouton Générer les recherches", !!btn("Générer les recherches"));
  btn("Générer les recherches").click(); await wait(30);
  const urls = [...$("reglBody").querySelectorAll('input[type="url"]')].map(i => decodeURIComponent(i.value.split("keywords=")[1].split("&")[0]));
  check("deux recherches générées (3 postes au plus chacune)", urls.length === 2, JSON.stringify(urls));
  check("requête 1", urls[0] === '(Paris OR Île-de-France) freelance ("Product Owner" OR "Business Analyst" OR "Scrum Master")', urls[0]);
  check("requête 2", urls[1] === '(Paris OR Île-de-France) freelance ("Coach agile")', urls[1]);
  const lib = [...$("reglBody").querySelectorAll('.rech input[type="text"]')].map(i => i.value);
  check("libellés", JSON.stringify(lib) === JSON.stringify(["PO, BA, SM", "CA"]), JSON.stringify(lib));
  btn("Générer les recherches").click(); await wait(30);
  check("pas de doublon si on regénère", $("reglBody").querySelectorAll('input[type="url"]').length === 2);
  check("aucun appel à l'ancienne vérification Free-Work", !appels.includes("verifier"));
  console.log("\n" + ok + " OK, " + ko + " KO"); process.exit(ko ? 1 : 0);
})();
