// Tests jsdom du lecteur 19.5 : consigne « Prochain passage » écrite avant le lancement du test de source (modèle 6), absente en modèle 5.
// Usage : node lecteur/tests/tests-v19-5.js (lecteur/lecteur.html = page de l'artefact sans la ligne d'enveloppe)
const fs = require("fs"); const { JSDOM } = require("jsdom");
const html = fs.readFileSync(__dirname + "/../lecteur.html", "utf8");
const wait = ms => new Promise(r => setTimeout(r, ms));
const U = i => "https://app.notion.com/p/" + String(i).padStart(32, "a");
const P = (nom, v, i) => ({"Paramètre": nom, Valeur: v, "À supprimer": "__NO__", url: U(300 + i)});
let ok = 0, ko = 0;
function check(n, c, i){ if (c) { ok++; console.log("OK  " + n); } else { ko++; console.log("KO  " + n + (i ? " -> " + i : "")); } }
const cfg = {page:"https://app.notion.com/p/cfg", bases:{"Offres":{db:"x",ds:"ds-off",view:"view://v-off"},"Paramètres":{db:"x",ds:"ds-par",view:"view://v-par"},"Candidatures":{db:"x",ds:"ds-can",view:"view://v-can"},"Sources":{db:"x",ds:"ds-src",view:"view://v-src"}}};
const DEM = "TEST SOURCE S01 GABARIT generique PLATEFORME Hiway PRÉFIXE hiw DOMAINE hiway.fr EXPÉDITEUR -";
async function scenario(modele, avecLigne){
  const par = [P("Postes recherchés", "Product Owner", 1), P("Version du modèle", modele, 2), P("Dernière exécution Offres", new Date().toISOString(), 3),
    P("Tâche Test de source", "trig_TEST123", 4), P("Dernier test de source", "", 5)];
  if (avecLigne) par.push(P("Prochain passage", "", 6));
  const journal = [];
  const mcp = { callTool: async (srv, tool, input) => {
    if (srv === "Claude Code Remote") { journal.push({fire: input}); return {payload: "{}"}; }
    if (tool === "notion-query-data-sources") { const v = {"view://v-off": [], "view://v-can": [], "view://v-par": par, "view://v-src": []}; return {payload: JSON.stringify({results: JSON.parse(JSON.stringify(v[input.data.view_url] || [])), has_more:false})}; }
    if (tool === "notion-update-page") { journal.push({maj: input}); return {payload: "{}"}; }
    return {payload: "{}"};
  }};
  const dom = new JSDOM(html, {runScripts:"dangerously", url:"https://claude.ai/artifact/t", pretendToBeVisual:true,
    beforeParse(w){ w.localStorage.setItem("lecteur-config", JSON.stringify(cfg)); w.LECTEUR_SONDE_MS = 40; w.claude = {use: async k => k === "mcp" ? mcp : {}};
      w.scrollTo = () => {}; w.open = () => null; w.HTMLElement.prototype.scrollIntoView = function(){}; }});
  const w = dom.window, $ = id => w.document.getElementById(id);
  const btn = t => [...w.document.querySelectorAll("button")].find(b => b.textContent === t);
  const champ = lib => [...$("platBox").querySelectorAll(".ajout .champ")].find(c => c.querySelector("label").textContent === lib).querySelector("input");
  const saisir = (lib, v) => { const i = champ(lib); i.value = v; i.dispatchEvent(new w.Event("input")); };
  await wait(400);
  const pied = $("foot").textContent;
  $("reglBtn").click(); await wait(80);
  btn("+ Ajouter une plateforme").click(); await wait(20);
  saisir("Nom de la plateforme", "Hiway"); saisir("Site (domaine des offres)", "hiway.fr");
  btn("Tester").click(); await wait(80);
  return {pied, journal};
}
(async () => {
  let r = await scenario("6", true);
  check("modèle 6 : pied de page", r.pied.indexOf("Lecteur v19.5 (modèles 6, 5 et 4). ") === 0, r.pied);
  const i = r.journal.findIndex(x => x.maj), f = r.journal.findIndex(x => x.fire);
  const maj = i >= 0 ? r.journal[i].maj : null;
  check("modèle 6 : consigne écrite dans « Prochain passage » avant le lancement", i >= 0 && f > i && maj.page_id === "a".repeat(29) + "306", JSON.stringify(r.journal));
  check("modèle 6 : consigne « <date UTC> ; TEST SOURCE … »", maj && new RegExp("^\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\d\\+00:00 ; " + DEM.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$").test(maj.properties.Valeur), maj && maj.properties.Valeur);
  check("modèle 6 : consigne récente (moins d'une minute)", maj && Math.abs(Date.now() - Date.parse(maj.properties.Valeur.split(" ; ")[0])) < 60000, maj && maj.properties.Valeur);
  check("modèle 6 : demande aussi passée en texte au lancement", f >= 0 && r.journal[f].fire.text === DEM && r.journal[f].fire.trigger_id === "trig_TEST123", JSON.stringify(r.journal[f]));
  r = await scenario("5", false);
  check("modèle 5 : aucune écriture avant le lancement, demande en texte", !r.journal.some(x => x.maj) && r.journal.some(x => x.fire && x.fire.text === DEM), JSON.stringify(r.journal));
  console.log(`\n${ok}/${ok + ko} contrôles OK`); process.exit(ko ? 1 : 0);
})();
