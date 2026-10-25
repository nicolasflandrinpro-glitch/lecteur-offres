// Tests jsdom du lecteur 19.2 : plateformes suivies, ajout et test d'une plateforme, activation, expéditeurs détectés.
// Usage : node lecteur/tests/tests-plateformes-v19-2.js (lecteur/lecteur.html = page de l'artefact sans la ligne d'enveloppe)
// 25/10/2026 : seul changement pour la 19.4, le contrôle du pied de page (v19.4, modèles 5 et 4) et le chemin du lecteur.
const fs = require("fs");
const { JSDOM } = require("jsdom");
const html = fs.readFileSync(__dirname + "/../lecteur.html", "utf8");
function today(){ return new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()); }
const U = i => "https://app.notion.com/p/" + String(i).padStart(32, "a");
const P = (nom, v, i) => ({"Paramètre": nom, Valeur: v, "À supprimer": "__NO__", url: U(300 + i)});
const par = [P("Postes recherchés", "Product Owner", 1), P("Prénom", "Camille", 2), P("Version du modèle", "4", 3),
  P("Dernière exécution Offres", new Date().toISOString(), 4), P("Tâche Test de source", "trig_TEST123", 5), P("Dernier test de source", "", 6),
  P("Expéditeurs détectés", "jobs@hiway.fr ; Hiway ; 3 mails ; dernier 23/10/2026 ; Nouvelles missions<br>jobs@autre.fr ; Autre ; 1 mails ; dernier 24/10/2026 ; Offres du jour<br>news@spam.example ; Spam ; 1 mails ; dernier 22/10/2026 ; promo<br>ops@collective.work ; Collective ; 2 mails ; dernier 22/10/2026 ; x", 7),
  P("Expéditeurs ignorés", "@spam.example", 8)];
const src = [
  {Nom:"Free-Work", Type:"mail", Actif:"__YES__", Identifiant:"S08", Gabarit:"freework_alerte", Plateforme:"Free-Work", "Préfixe d'identifiant":"fw", "Domaine des offres":"free-work.com", "Adresse ou URL":"jobs@free-work.com", "Dernière erreur":"", url:U(401)},
  {Nom:"Collective", Type:"mail", Actif:"__YES__", Identifiant:"S06", Gabarit:"collective_opportunite", Plateforme:"Collective", "Préfixe d'identifiant":"cw", "Domaine des offres":"collective.work", "Adresse ou URL":"[ops@collective.work](mailto:ops@collective.work)", "Dernière erreur":"23/10/2026 : recherche Gmail impossible", url:U(402)},
  {Nom:"Veille rss", Type:"rss", Actif:"__YES__", Identifiant:"S12", url:U(403)}
];
let options = [{name:"LinkedIn", color:"blue"}, {name:"Collective", color:"purple"}, {name:"Free-Work", color:"orange"}, {name:"Post LinkedIn", color:"default"}];
const etat = () => `<data-source url="{{collection://ds-off}}">\n<data-source-state>\n${JSON.stringify({name:"Offres", schema:{Plateforme:{name:"Plateforme", type:"select", options}}})}\n</data-source-state>\n</data-source>`;
const views = {"view://v-off": [], "view://v-can": [], "view://v-par": par, "view://v-src": src};
const updates = [], creations = [], fires = [], ddl = [];
let fireErreur = null, reponseTest = null;
const mcp = { callTool: async (srv, tool, input) => {
  if (srv === "Claude Code Remote") {
    if (fireErreur) throw fireErreur;
    fires.push(input);
    if (reponseTest) setTimeout(() => { par[5].Valeur = reponseTest(input); }, 20);
    return {payload: "{}"};
  }
  if (tool === "notion-query-data-sources") return {payload: JSON.stringify({results: JSON.parse(JSON.stringify(views[input.data.view_url] || [])), has_more:false})};
  if (tool === "notion-update-page") { updates.push(input); const p = par.find(x => x.url.replace(/-/g, "").endsWith(input.page_id)); if (p && input.properties.Valeur !== undefined) p.Valeur = input.properties.Valeur; return {payload:"{}"}; }
  if (tool === "notion-fetch") return {payload: JSON.stringify({text: etat()})};
  if (tool === "notion-update-data-source") {
    ddl.push(input);
    const m = input.statements.match(/SELECT\((.*)\)$/); options = m[1].split(", ").map(x => { const k = x.lastIndexOf(":"); return {name: x.slice(1, k - 1).replace(/''/g, "'"), color: x.slice(k + 1)}; });
    return {payload:"{}"};
  }
  if (tool === "notion-create-pages") { creations.push(input); const pr = input.pages[0].properties; src.push(Object.assign({url: U(500 + creations.length)}, pr)); return {payload: JSON.stringify({pages:[{url:U(500)}]})}; }
  return {payload:"{}"};
}};
const cfg = {page:"https://app.notion.com/p/cfg", bases:{"Offres":{db:"x",ds:"ds-off",view:"view://v-off"},"Paramètres":{db:"x",ds:"ds-par",view:"view://v-par"},"Candidatures":{db:"x",ds:"ds-can",view:"view://v-can"},"Sources":{db:"x",ds:"ds-src",view:"view://v-src"}}};
const dom = new JSDOM(html, {runScripts:"dangerously", url:"https://claude.ai/artifact/z", pretendToBeVisual:true,
  beforeParse(w){ w.localStorage.setItem("lecteur-config", JSON.stringify(cfg)); w.LECTEUR_SONDE_MS = 40; w.claude = {use: async k => k === "mcp" ? mcp : {}};
    w.scrollTo = () => {}; w.open = () => null; w.HTMLElement.prototype.scrollIntoView = function(){}; }});
const w = dom.window, $ = id => w.document.getElementById(id), wait = ms => new Promise(r => setTimeout(r, ms));
let ok = 0, ko = 0;
function check(n, c, i){ if (c) { ok++; console.log("OK  " + n); } else { ko++; console.log("KO  " + n + (i ? " -> " + i : "")); } }
const btn = (t, root) => [...(root || w.document).querySelectorAll("button")].find(b => b.textContent === t);
const champ = lib => [...$("platBox").querySelectorAll(".ajout .champ")].find(c => c.querySelector("label").textContent === lib).querySelector("input");
function saisir(lib, v){ const i = champ(lib); i.value = v; i.dispatchEvent(new w.Event("input")); }
const RES_OK = i => `24/10/2026 16:10 ; ${i.text.split(" ")[2]} ; generique ; concluant<br>mails=2 offres=3 gardées=1 écartées=2 déjà vues=0 liens écartés=1<br>expéditeur ; jobs@hiway.fr ; retrouvé<br>autres expéditeurs vus ; news@hiway.fr<br>attention : plateforme « Hiway » absente des valeurs de la colonne Offres « Plateforme » : à ajouter avant d'activer la source<br>offre ; Product Owner Data ; Acme ; gardée ; https://www.hiway.fr/missions/po-data<br>offre ; Dev Java ; Beta ; écartée : poste hors des postes recherchés et proches ; https://www.hiway.fr/missions/dev<br>offre ; Data Engineer ; Gamma ; écartée : poste hors des postes recherchés et proches ; https://www.hiway.fr/missions/de<br>lien écarté ; Postuler ; https://www.hiway.fr/postuler/po-data`;
(async () => {
  await wait(400);
  // ---- Encart des expéditeurs détectés ----
  const det = [...$("detList").querySelectorAll("li")].map(l => l.querySelector(".cname").textContent);
  check("encart visible avec l'expéditeur non suivi seulement", !$("detView").hidden && JSON.stringify(det) === JSON.stringify(["Hiway · jobs@hiway.fr","Autre · jobs@autre.fr"]), JSON.stringify(det));
  check("pied de page 19.4, modèle 4 accepté", /^Lecteur v19\.4 \(modèles 5 et 4\)\./.test($("foot").textContent), $("foot").textContent);
  // ---- Réglages : plateformes suivies ----
  $("reglBtn").click(); await wait(80);
  const lignes = [...$("platBox").querySelectorAll("li.plat-ligne")];
  check("deux sources mail listées (la source rss exclue)", lignes.length === 2, String(lignes.length));
  check("expéditeur lu dans un lien Markdown", /ops@collective\.work · active/.test(lignes[1].textContent), lignes[1].textContent);
  check("dernière erreur affichée en rouge", !!lignes[1].querySelector(".cres.ko") && /recherche Gmail impossible/.test(lignes[1].textContent));
  btn("Désactiver", lignes[0]).click(); await wait(50);
  check("Désactiver écrit Actif décoché", updates.some(u => u.page_id.endsWith("401") && u.properties.Actif === "__NO__"), JSON.stringify(updates));
  check("la ligne passe en désactivée", /Free-Work \(désactivée\)/.test($("platBox").textContent) && !!btn("Réactiver"));
  // ---- Ajout : validations ----
  btn("+ Ajouter une plateforme").click(); await wait(20);
  saisir("Nom de la plateforme", "Free Lance Pro"); saisir("Site (domaine des offres)", "flp.fr");
  check("préfixe proposé d'après le nom", champ("Préfixe d'identifiant").value === "flp", champ("Préfixe d'identifiant").value);
  saisir("Préfixe d'identifiant", "fw");
  btn("Tester").click(); await wait(30);
  check("préfixe déjà pris refusé", /déjà utilisé par Free-Work/.test($("platBox").textContent) && !fires.length, $("platBox").textContent.slice(-300));
  btn("Annuler").click(); await wait(20);
  // ---- Créer depuis l'encart : formulaire prérempli, test, résultat, activation ----
  $("reglFermer").click(); await wait(40);
  btn("Créer", $("detList")).click(); await wait(80);
  check("Créer ouvre les réglages avec le formulaire prérempli", !$("reglView").hidden && champ("Nom de la plateforme").value === "Hiway" && champ("Site (domaine des offres)").value === "hiway.fr" && champ("Adresse d'expéditeur (facultatif)").value === "jobs@hiway.fr");
  check("préfixe proposé hiw", champ("Préfixe d'identifiant").value === "hiw", champ("Préfixe d'identifiant").value);
  saisir("Adresse d'expéditeur (facultatif)", "");
  reponseTest = RES_OK;
  btn("Tester").click(); await wait(10);
  check("tâche de test déclenchée avec la demande attendue", fires[0] && fires[0].trigger_id === "trig_TEST123" && fires[0].text === "TEST SOURCE S13 GABARIT generique PLATEFORME Hiway PRÉFIXE hiw DOMAINE hiway.fr EXPÉDITEUR -", JSON.stringify(fires));
  check("test en cours affiché", /Test en cours, environ 5 min/.test($("platBox").textContent));
  await wait(200);
  const t = $("platBox").textContent;
  check("résultat relu : concluant, expéditeur retrouvé", /Test concluant \(24\/10\/2026 16:10\)/.test(t) && /Expéditeur retrouvé : jobs@hiway\.fr/.test(t), t.slice(-600));
  check("résultat : compteurs, offres gardées et écartées, lien écarté", /2 mail\(s\) lu\(s\), 3 offre\(s\) : 1 gardée/.test(t) && /Offres gardées \(1\)/.test(t) && /Offres écartées \(2\)/.test(t) && /Liens écartés \(1\)/.test(t), t.slice(-600));
  check("bouton Activer présent", !!btn("Activer"));
  btn("Activer").click(); await wait(150);
  check("valeur ajoutée à la colonne Plateforme en gardant les autres", ddl[0] && ddl[0].data_source_id === "ds-off" && ddl[0].statements === "ALTER COLUMN \"Plateforme\" SET SELECT('LinkedIn':blue, 'Collective':purple, 'Free-Work':orange, 'Post LinkedIn':default, 'Hiway':default)", JSON.stringify(ddl));
  const pr = creations[0] && creations[0].pages[0].properties;
  check("ligne Sources créée", pr && creations[0].parent.data_source_id === "ds-src" && pr.Nom === "Hiway" && pr.Type === "mail" && pr.Actif === "__YES__" && pr.Identifiant === "S13" && pr["Adresse ou URL"] === "jobs@hiway.fr" && pr.Gabarit === "generique" && pr.Plateforme === "Hiway" && pr["Préfixe d'identifiant"] === "hiw" && pr["Domaine des offres"] === "hiway.fr", JSON.stringify(pr));
  check("message d'activation et nouvelle ligne listée", /« Hiway » activée \(S13\)/.test($("platBox").textContent) && $("platBox").querySelectorAll("li.plat-ligne").length === 3, $("platBox").textContent.slice(-300));
  // ---- Plateforme connue : gabarit dédié ; suggestion generique_suivi ----
  btn("+ Ajouter une plateforme").click(); await wait(20);
  saisir("Nom de la plateforme", "Welcome"); saisir("Site (domaine des offres)", "welcometothejungle.com");
  reponseTest = i => `24/10/2026 16:30 ; ${i.text.split(" ")[2]} ; generique ; aucune offre ; suggestion : generique_suivi<br>mails=1 offres=0 gardées=0 écartées=0 déjà vues=0 liens écartés=0<br>expéditeur ; alerts@wttj.example ; retrouvé`;
  btn("Tester").click(); await wait(200);
  check("aucune offre : pas d'Activer, bouton Retester en generique_suivi", !btn("Activer") && !!btn("Retester en generique_suivi"), $("platBox").textContent.slice(-400));
  btn("Retester en generique_suivi").click(); await wait(10);
  check("nouveau test en generique_suivi", fires[fires.length - 1].text.indexOf("GABARIT generique_suivi PLATEFORME Welcome PRÉFIXE wel DOMAINE welcometothejungle.com") > 0, fires[fires.length - 1].text);
  await wait(200);
  btn("Annuler").click(); await wait(20);
  btn("+ Ajouter une plateforme").click(); await wait(20);
  saisir("Nom de la plateforme", "LinkedIn Belgique"); saisir("Site (domaine des offres)", "be.linkedin.com"); saisir("Préfixe d'identifiant", "lb");
  reponseTest = null; btn("Tester").click(); await wait(10);
  check("domaine LinkedIn : gabarit linkedin_digest", / GABARIT linkedin_digest /.test(fires[fires.length - 1].text), fires[fires.length - 1].text);
  btn("Annuler").click(); await wait(20);
  // ---- Connecteur indisponible : repli Cowork ----
  fireErreur = {code: "server_not_connected"};
  btn("+ Ajouter une plateforme").click(); await wait(20);
  saisir("Nom de la plateforme", "Malt"); saisir("Site (domaine des offres)", "malt.fr");
  btn("Tester").click(); await wait(30);
  check("déclenchement impossible : cause et consigne Cowork", /connecteur Claude Code Remote n'est pas disponible/.test($("platBox").textContent) && /écris « ajoute la plateforme Malt »/.test($("platBox").textContent), $("platBox").textContent.slice(-400));
  btn("Annuler").click(); fireErreur = null;
  // ---- Ignorer un expéditeur détecté ----
  $("reglFermer").click(); await wait(40);
  check("expéditeur devenu source retiré de l'encart", ![...$("detList").querySelectorAll(".cname")].some(x => /jobs@hiway\.fr/.test(x.textContent)));
  const b = btn("Ignorer", $("detList"));
  if (b) { b.click(); await wait(50); }
  const ig = updates.find(u => u.page_id.endsWith("308"));
  check("Ignorer ajoute l'adresse à Expéditeurs ignorés", ig && ig.properties.Valeur === "@spam.example; jobs@autre.fr", JSON.stringify(updates.slice(-2)));
  check("encart masqué une fois tout ignoré", $("detView").hidden);
  console.log("\n" + ok + " OK, " + ko + " KO"); process.exit(ko ? 1 : 0);
})();
