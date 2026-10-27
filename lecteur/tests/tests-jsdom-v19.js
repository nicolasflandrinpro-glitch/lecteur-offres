// Tests jsdom du lecteur v19 (zone Candidatures reprise de la v17, schéma modèle 1, réglages v18)
// Usage : node lecteur/tests/tests-jsdom-v19.js (lecteur/lecteur.html = page de l'artefact sans la ligne d'enveloppe)
// 24/10/2026 : seul changement pour la 19.2, le contrôle du pied de page (v19.2, modèle 4).
// 25/10/2026 : seul changement pour la 19.4, le contrôle du pied de page (v19.4, modèles 5 et 4) et le chemin du lecteur.
// 27/10/2026 : seul changement pour la 19.5, le contrôle du pied de page (v19.5, modèles 6, 5 et 4).
const fs = require("fs");
const { JSDOM } = require("jsdom");
const html = fs.readFileSync(__dirname + "/../lecteur.html", "utf8");

function today(){ return new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()); }
function plus(n){ const p = today().split("-"); return new Date(Date.UTC(+p[0], +p[1]-1, +p[2] + n)).toISOString().slice(0,10); }
const U = i => "https://app.notion.com/p/" + String(i).padStart(32, "a");
const OFFRE = U(100);
const rows = [
  {Identifiant:"o1", Titre:"PO Data", Entreprise:"Acme", Plateforme:"LinkedIn", Lien:"https://www.linkedin.com/jobs/view/123/", "date:Date de détection:start": today(), url: OFFRE,
   Contrat: JSON.stringify(["Freelance","CDI"]), "À vérifier": JSON.stringify(["Temps de travail","Télétravail"])},
  {Identifiant:"o2", Titre:"BA Assurance", Entreprise:"Beta", Plateforme:"Collective", Lien:"https://www.collective.work/jobs/fr/ba-x", "date:Date de détection:start": today(), url: U(101),
   "Contrat (v1.4)": "freelance", "À vérifier": JSON.stringify(["Freelance","Lieu"])},
  {Identifiant:"o3", Titre:"Scrum Master", Entreprise:"Gamma", Plateforme:"Free-Work", Lien:"https://www.free-work.com/fr/tech-it/job-mission/scrum-master/sm-1", "date:Date de détection:start": today(), url: U(102)}
];
const cands = [
  {Titre:"A prep", Statut:"À préparer", Origine:"Offre d'emploi", "date:Date:start": plus(-2), Offre: JSON.stringify([OFFRE]), url:U(1)},
  {Titre:"B envoyee", Statut:"Candidature envoyée", Origine:"Offre d'emploi", "date:Date:start": plus(-9), Lien:"https://www.free-work.com/fr/tech-it/job-mission/x/y", url:U(2)},
  {Titre:"C relancee", Statut:"Relancée", Origine:"Offre d'emploi", "date:Date:start": plus(-3), url:U(3)},
  {Titre:"D prospection", Statut:"Candidature envoyée", Origine:"Prospection directe", "date:Date:start": plus(-20), url:U(4)},
  {Titre:"E process", Statut:"Processus en cours", Origine:"Prospection directe", "date:Date:start": plus(-1), "Prochaine action":"Entretien mardi", url:U(5)},
  {Titre:"F a clore", Statut:"Candidature envoyée", Origine:"Offre d'emploi", "date:Date:start": plus(-14), url:U(6)},
  {Titre:"G ancien", Statut:"Entretien", Origine:"Autre", "date:Date:start": plus(-4), url:U(7)},
  {Titre:"H reportee", Statut:"Relancée", Origine:"Offre d'emploi", "date:Date:start": plus(-20), "date:Date de relance:start": plus(3), url:U(8)},
  {Titre:"I perdue", Statut:"Perdue", Origine:"Offre d'emploi", "date:Date:start": plus(-30), url:U(9)}
];
const P = (nom, v, i) => ({"Paramètre": nom, Valeur: v, "À supprimer": "__NO__", url: U(200 + i)});
const params = [P("Postes recherchés", "Product Owner; Business Analyst", 1), P("Prénom", "Camille", 2), P("Version du modèle", "2", 3),
  P("Types de collaboration acceptés", "Freelance; Portage salarial", 4), P("Temps de travail", "plein ou partiel", 5),
  P("Modes de travail acceptés", "présentiel; hybride; télétravail total", 6), P("Jours de télétravail minimum", "", 7),
  P("Dernière exécution Offres", new Date().toISOString(), 8)];
const updates = [], creations = [];
const views = {"view://40234f6d-2f8d-81a4-876f-000c78dc5ec2": rows, "view://40234f6d-2f8d-812f-986f-000c19c1da3b": cands, "view://40234f6d-2f8d-8145-ac7f-000c080d3e63": params};
const mcp = { callTool: async (srv, tool, input) => {
  if (tool === "notion-query-data-sources") return {payload: JSON.stringify({results: JSON.parse(JSON.stringify(views[input.data.view_url] || [])), has_more:false})};
  if (tool === "notion-update-page") { updates.push(input); return {payload:"{}"}; }
  if (tool === "notion-create-pages") { creations.push(input); throw {code:"upstream_error", retryable:true, retryAfterMs:1}; }
  return {payload:"{}"};
}};
const dom = new JSDOM(html, {runScripts:"dangerously", url:"https://claude.ai/artifact/x", pretendToBeVisual:true,
  beforeParse(w){ w.localStorage.setItem("lecteur-config", JSON.stringify({page:"https://app.notion.com/p/cfg", bases:{"Offres":{db:"https://app.notion.com/p/off",ds:"ds-off",view:"view://40234f6d-2f8d-81a4-876f-000c78dc5ec2"},"Paramètres":{db:"https://app.notion.com/p/par",ds:"ds-par",view:"view://40234f6d-2f8d-8145-ac7f-000c080d3e63"},"Candidatures":{db:"https://app.notion.com/p/can",ds:"ds-can",view:"view://40234f6d-2f8d-812f-986f-000c19c1da3b"}}})); w.claude = {use: async k => k === "mcp" ? mcp : {}}; w.scrollTo = () => {}; w.open = () => null; w.HTMLElement.prototype.scrollIntoView = function(){}; }});
const w = dom.window, $ = id => w.document.getElementById(id);
const wait = ms => new Promise(r => setTimeout(r, ms));
let ok = 0, ko = 0;
function check(name, cond, info){ if (cond) { ok++; console.log("OK  " + name); } else { ko++; console.log("KO  " + name + (info ? " -> " + info : "")); } }
function ligne(titre){ return [...$("candGroups").querySelectorAll("li")].find(li => li.querySelector(".cname").textContent === titre); }
function groupe(titre){ const g = [...$("candGroups").querySelectorAll(".cgrp")].find(s => s.querySelector("h3").textContent.startsWith(titre)); return g ? [...g.querySelectorAll(".cname")].map(x => x.textContent) : null; }
function choisir(sel, v){ sel.value = v; sel.dispatchEvent(new w.Event("change")); }

(async () => {
  await wait(400);
  // ---- Zone Candidatures (reprise v17) ----
  const clo = updates.find(u => u.properties.Statut === "Perdue");
  check("clôture auto de F (envoyée il y a 14 j)", clo && clo.page_id.endsWith("6") && updates.length === 1, JSON.stringify(updates));
  check("H (relance reportée) non clôturée", !updates.some(u => u.page_id.endsWith("8")));
  check("zone visible", !$("candView").hidden);
  check("groupe À envoyer", JSON.stringify(groupe("À envoyer")) === JSON.stringify(["A prep"]), JSON.stringify(groupe("À envoyer")));
  check("groupe En attente (tri par échéance)", JSON.stringify(groupe("En attente de réponse")) === JSON.stringify(["D prospection","H reportee","B envoyee","C relancee"]), JSON.stringify(groupe("En attente de réponse")));
  check("groupe Processus en cours", JSON.stringify(groupe("Processus en cours")) === JSON.stringify(["E process"]));
  check("groupe Autre statut (valeur inconnue)", JSON.stringify(groupe("Autre statut")) === JSON.stringify(["G ancien"]));
  check("F sortie de la liste", !ligne("F a clore"));
  check("v18 : candidature Perdue lue par la vue sans filtre, non affichée", !ligne("I perdue"));
  check("titre zone", $("candH").textContent === "Candidatures (7)", $("candH").textContent);
  const e = t => ligne(t).querySelector(".ech").textContent;
  check("échéance B", e("B envoyee") === "Envoyée il y a 9 j · clôture auto dans 5 j", e("B envoyee"));
  check("échéance H (report)", e("H reportee") === "Relancée il y a 20 j · clôture auto dans 3 j", e("H reportee"));
  check("échéance A", e("A prep") === "Créée il y a 2 j", e("A prep"));
  const pl = t => ligne(t).querySelector(".plat").textContent;
  check("pastille A depuis l'offre reliée", pl("A prep") === "LinkedIn");
  check("pastille B depuis le lien", pl("B envoyee") === "Free-Work");
  const btns = t => [...ligne(t).querySelectorAll(".cbtns button")].map(b => b.textContent).join("|");
  check("boutons Processus", btns("E process") === "Gagnée|Perdue");
  updates.length = 0;
  [...ligne("A prep").querySelectorAll("button")].find(b => /Marquer envoyée/.test(b.textContent)).click();
  await wait(50);
  check("Marquer envoyée écrit le statut", updates[0] && updates[0].properties.Statut === "Candidature envoyée" && updates[0].properties["date:Date:start"] === today());
  updates.length = 0;
  choisir(ligne("D prospection").querySelector("select.menu"), "s:Abandonnée");
  await wait(50);
  check("Abandonner via menu", updates[0] && updates[0].properties.Statut === "Abandonnée" && !ligne("D prospection"));

  // ---- v18 : schéma modèle 1 ----
  const items = [...$("list").querySelectorAll("li.clic")];
  const tags = li => [...li.querySelectorAll(".verif")].map(x => x.textContent).join("|");
  check("étiquettes modèle 1", tags(items[0]) === "⚠ Temps de travail à vérifier|⚠ Télétravail à vérifier", tags(items[0]));
  check("ancienne étiquette Freelance lue comme Contrat", tags(items[1]) === "⚠ Contrat à vérifier|⚠ Lieu à vérifier", tags(items[1]));
  items[0].click(); await wait(20);
  check("méta : Contrat en liste", /· Freelance, CDI ·/.test($("rmeta").textContent), $("rmeta").textContent);
  check("bandeau À vérifier en lecture", $("rverif").textContent === "⚠ À vérifier : temps de travail non indiqué ; télétravail non précisé.", $("rverif").textContent);
  $("next").dispatchEvent(new w.MouseEvent("click")); await wait(20);
  check("méta : repli sur Contrat (v1.4)", /· Freelance ·/.test($("rmeta").textContent), $("rmeta").textContent);
  $("back").click(); await wait(20);
  check("pied de page : version et modèle", /^Lecteur v19\.5 \(modèles 6, 5 et 4, Notion en modèle 2 : mise à jour à appliquer\)\./.test($("foot").textContent), $("foot").textContent);

  // ---- v18 : réglages ----
  $("reglBtn").click(); await wait(20);
  check("titre des réglages avec le prénom", $("reglH").textContent === "Réglages de la veille de Camille", $("reglH").textContent);
  const leg = [...$("reglBody").querySelectorAll("legend")].map(l => l.textContent);
  check("nouveaux réglages affichés", JSON.stringify(leg) === JSON.stringify(["Types de collaboration acceptés","Temps de travail","Modes de travail acceptés"]), JSON.stringify(leg));
  const cases = [...$("reglBody").querySelectorAll("fieldset")[0].querySelectorAll("input")];
  check("types cochés depuis Paramètres", cases.map(c => c.checked).join() === "true,true,false,false");
  cases[2].checked = true; cases[2].dispatchEvent(new w.Event("change"));
  const radios = [...$("reglBody").querySelectorAll("fieldset")[1].querySelectorAll("input")];
  check("temps de travail sélectionné", radios[1].checked);
  radios[0].checked = true; radios[0].dispatchEvent(new w.Event("change"));
  const j = $("reglJours"); j.value = "2"; j.dispatchEvent(new w.Event("input"));
  updates.length = 0;
  $("reglSave").click(); await wait(100);
  const v = id => (updates.find(u => u.page_id.endsWith(String(200 + id))) || {properties:{}}).properties.Valeur;
  check("écriture types de collaboration", v(4) === "Freelance; Portage salarial; CDI", v(4));
  check("écriture temps de travail", v(5) === "plein seulement", v(5));
  check("écriture jours minimum", v(7) === "2", v(7));
  check("modes inchangés non écrits", v(6) === undefined);
  check("message de succès", /Réglages enregistrés/.test($("reglMsg").textContent), $("reglMsg").textContent);
  const m = [...$("reglBody").querySelectorAll("fieldset")[2].querySelectorAll("input")];
  m.forEach(c => { c.checked = false; c.dispatchEvent(new w.Event("change")); });
  $("reglSave").click(); await wait(50);
  check("au moins un mode exigé", /au moins un mode/.test($("reglMsg").textContent), $("reglMsg").textContent);
  // ---- v18.1 : une création qui échoue n'est pas relancée d'office ----
  $("reglFermer").click(); await wait(20);
  const bc = [...$("list").querySelectorAll("button")].find(b => b.textContent === "Créer la candidature");
  bc.click(); await wait(100);
  check("création non relancée d'office après une erreur", creations.length === 1, String(creations.length));
  check("échec de création affiché", /Échec/.test($("list").textContent));
  console.log("\n" + ok + " OK, " + ko + " KO");
  process.exit(ko ? 1 : 0);
})();
