// Tests jsdom du lecteur 20 : bandeau d'actions (afficheur, passage lancé et suivi, mise à jour, débrief) et réglages refondus
// (sections, Enregistrer grisé, barre de fermeture, heure de passage par update_trigger, postes proches par sample, aide LinkedIn).
// Usage : node lecteur/tests/tests-v20.js (lecteur/lecteur.html = page de l'artefact sans la ligne d'enveloppe)
const fs = require("fs"); const { JSDOM } = require("jsdom");
const html = fs.readFileSync(__dirname + "/../lecteur.html", "utf8");
const wait = ms => new Promise(r => setTimeout(r, ms));
const U = i => "https://app.notion.com/p/" + String(i).padStart(32, "a");
const P = (nom, v, i) => ({"Paramètre": nom, Valeur: v, "À supprimer": "__NO__", url: U(300 + i)});
let ok = 0, ko = 0;
function check(n, c, i){ if (c) { ok++; console.log("OK  " + n); } else { ko++; console.log("KO  " + n + (i ? " -> " + i : "")); } }
const cfg = {page:"https://app.notion.com/p/cfg", bases:{"Offres":{db:"x",ds:"ds-off",view:"view://v-off"},"Paramètres":{db:"x",ds:"ds-par",view:"view://v-par"},"Candidatures":{db:"x",ds:"ds-can",view:"view://v-can"},"Sources":{db:"x",ds:"ds-src",view:"view://v-src"}}};
const auj = new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const hp = iso => new Intl.DateTimeFormat("fr-FR",{timeZone:"Europe/Paris",hour:"2-digit",minute:"2-digit"}).format(new Date(iso));
const jj = iso => { const d = new Intl.DateTimeFormat("fr-CA",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(iso)).split("-"); return d[2] + "/" + d[1]; };
// Dernière exécution aujourd'hui, 7 minutes après l'heure de passage (fuseau de Paris).
function finApres(heure, min){
  const [h, m] = heure.split(":").map(Number), t = h * 60 + m + min;
  const base = new Date(auj + "T12:00:00Z"), dec = (+hp(base).split(":")[0]) - 12; // décalage de Paris (1 ou 2 h)
  return new Date(Date.UTC(+auj.slice(0,4), +auj.slice(5,7) - 1, +auj.slice(8,10), Math.floor(t / 60) - dec, t % 60)).toISOString();
}
async function scenario(o){
  o = o || {};
  const par = [P("Postes recherchés", "Product Owner; Business Analyst", 1), P("Postes proches", "Scrum Master", 2), P("Version du modèle", o.modele || "8", 3),
    P("Dernière exécution Offres", o.derniere === undefined ? new Date(Date.now() - 2 * 86400000).toISOString() : o.derniere, 4),
    P("Heure de passage", o.heure || "08:45", 5), P("Types de collaboration acceptés", "Freelance", 6), P("Temps de travail", "plein ou partiel", 7),
    P("Modes de travail acceptés", "présentiel; hybride; télétravail total", 8), P("Jours de télétravail minimum", "", 9), P("Dernier débrief", o.debrief || "", 10)];
  if (o.tache !== null) par.push(P("Tâche Brique Offres", o.tache || "trig_OFFRES1", 11));
  if (o.kit !== null) par.push(P("Version du kit", o.kit || "v5.2", 12));
  if (o.dispo !== null) par.push(P("Version disponible", o.dispo === undefined ? "v5.2" : o.dispo, 13));
  const offres = [{Titre: "PO", Identifiant: "1", Plateforme: "LinkedIn", Lien: "https://www.linkedin.com/jobs/view/1/", "date:Date de détection:start": auj, url: U(700)}];
  const src = [{Nom:"Free-Work", Type:"mail", Actif:"__YES__", Identifiant:"S08", Plateforme:"Free-Work", "Domaine des offres":"free-work.com", "Adresse ou URL":"jobs@free-work.com", "Dernière erreur":"", url:U(401)}];
  const journal = [];
  const mcp = { callTool: async (srv, tool, input) => {
    if (srv === "Claude Code Remote") {
      if (o.ccErreur && o.ccErreur[tool]) throw o.ccErreur[tool];
      journal.push({cc: tool, input});
      if (tool === "fire_trigger" && o.retour) setTimeout(() => { par[3].Valeur = new Date().toISOString(); offres.push({Titre: "BA", Identifiant: "2", Plateforme: "LinkedIn", "date:Date de détection:start": auj, url: U(701)}, {Titre: "PO 2", Identifiant: "3", Plateforme: "LinkedIn", "date:Date de détection:start": auj, url: U(702)}); }, o.retour);
      return {payload: "{}"};
    }
    if (tool === "notion-query-data-sources") { const v = {"view://v-off": offres, "view://v-can": [], "view://v-par": par, "view://v-src": src}; return {payload: JSON.stringify({results: JSON.parse(JSON.stringify(v[input.data.view_url] || [])), has_more:false})}; }
    if (tool === "notion-update-page") { journal.push({maj: input}); const p = par.find(x => x.url.replace(/-/g, "").endsWith(input.page_id)); if (p && input.properties.Valeur !== undefined) p.Valeur = input.properties.Valeur; return {payload: "{}"}; }
    return {payload: "{}"};
  }};
  const sample = {json: async prompt => { journal.push({sample: prompt}); await new Promise(r => setTimeout(r, 30)); if (o.sampleErreur) throw o.sampleErreur; return o.propositions || ["Product Owner", "Proxy Product Owner", "Chef de projet MOA", "Scrum Master"]; }};
  const dom = new JSDOM(html, {runScripts:"dangerously", url:"https://claude.ai/artifact/t", pretendToBeVisual:true,
    beforeParse(w){ w.localStorage.setItem("lecteur-config", JSON.stringify(cfg)); w.LECTEUR_SONDE_MS = 40;
      w.LECTEUR_MINUTE_MS = o.minute || 20; w.LECTEUR_PASS_SONDE_MS = 30; w.LECTEUR_PASS_ABANDON_MS = o.abandon || 2000;
      w.claude = {use: async k => k === "mcp" ? mcp : k === "sample" ? sample : {}};
      w.scrollTo = () => {}; w.open = () => null; w.HTMLElement.prototype.scrollIntoView = function(){}; }});
  const w = dom.window, $ = id => w.document.getElementById(id);
  const btn = (t, root) => [...(root || w.document).querySelectorAll("button")].find(b => b.textContent === t);
  await wait(400);
  return {w, $, btn, journal, par};
}
(async () => {
  // ---- Afficheur ----
  let r = await scenario({derniere: finApres("08:45", 7)});
  const fin = r.par[3].Valeur;
  check("bandeau visible", !r.$("bandeau").hidden);
  check("afficheur : DERNIER PASSAGE jj/mm hh:mm", r.$("affDernier").textContent === "DERNIER PASSAGE  " + jj(fin) + "  " + hp(fin), r.$("affDernier").textContent);
  const demain = new Date(Date.now() + 86400000);
  check("afficheur : PROCHAIN demain 08:45 (brique passée aujourd'hui)", r.$("affProchain").textContent === "PROCHAIN  " + jj(demain.toISOString()) + "  08:45", r.$("affProchain").textContent);
  check("afficheur : KIT v5.2  À JOUR", r.$("affKit").textContent === "KIT v5.2" && r.$("affMaj").textContent === "À JOUR", r.$("affKit").textContent + " / " + r.$("affMaj").textContent);
  check("« Mettre à jour » masqué sans version plus récente", r.$("majBtn").hidden);
  check("pied de page v20, modèle 8", /^Lecteur v20 \(modèles 8, 7, 6, 5 et 4\)\./.test(r.$("foot").textContent), r.$("foot").textContent);
  r = await scenario({derniere: ""});
  check("afficheur : DERNIER PASSAGE  AUCUN et PROCHAIN  AUJOURD'HUI", r.$("affDernier").textContent === "DERNIER PASSAGE  AUCUN" && r.$("affProchain").textContent === "PROCHAIN  AUJOURD'HUI  08:45", r.$("affDernier").textContent + " / " + r.$("affProchain").textContent);
  r = await scenario({dispo: "v5.3"});
  check("afficheur : MISE À JOUR v5.3 DISPONIBLE", r.$("affMaj").textContent === "MISE À JOUR v5.3 DISPONIBLE" && r.$("affMaj").className === "majdispo", r.$("affMaj").textContent);
  check("« Mettre à jour » visible, lien claude.ai/new?q=", !r.$("majBtn").hidden && decodeURIComponent(r.$("majBtn").href) === "https://claude.ai/new?q=Mets à jour le lecteur d'offres." && r.$("majBtn").target === "_blank", r.$("majBtn").href);
  r.$("majBtn").dispatchEvent(new r.w.MouseEvent("click", {bubbles: true, cancelable: true})); await wait(10);
  check("message après « Mettre à jour »", r.$("passZone").textContent === "Un onglet claude.ai s'ouvre avec la phrase « Mets à jour le lecteur d'offres. » déjà écrite. Choisis Cowork, puis envoie : rien ne part sans toi.", r.$("passZone").textContent);
  r = await scenario({dispo: null, kit: "v5.1"});
  check("ligne « Version disponible » absente (modèle 7) : KIT v5.1 seul", r.$("affKit").textContent === "KIT v5.1" && r.$("affMaj").textContent === "", r.$("affMaj").textContent);
  // ---- Débrief ----
  check("débrief replié par défaut", r.$("debView").hidden && r.$("debTog").getAttribute("aria-expanded") === "false");
  r.$("debTog").click(); await wait(10);
  check("débrief vide : texte validé", r.$("debView").textContent === "Aucun débrief pour l'instant : la brique Offres n'est pas encore passée.", r.$("debView").textContent);
  r = await scenario({derniere: finApres("08:45", 7), debrief: "Passage du jour<br>12 offres lues ; 3 retenues"});
  r.$("debTog").click(); await wait(10);
  const f2 = r.par[3].Valeur;
  check("débrief déplié : titre et texte", r.$("debView").querySelector("h3").textContent === "Dernier débrief du " + jj(f2) + " à " + hp(f2) && r.$("debView").querySelector("pre").textContent === "Passage du jour\n12 offres lues ; 3 retenues", r.$("debView").textContent);
  check("bouton déplié : « ▾ Dernier débrief »", r.$("debTog").textContent === "▾ Dernier débrief" && r.$("debTog").getAttribute("aria-expanded") === "true");
  // ---- Lancer un passage ----
  r = await scenario({tache: null});
  check("sans « Tâche Brique Offres » : bouton grisé, info-bulle", r.$("passBtn").disabled && r.$("passBtn").title === "Disponible après la mise à jour du kit.", r.$("passBtn").title);
  r = await scenario({derniere: finApres("08:45", 7), retour: 60, minute: 20});
  r.$("passBtn").click(); await wait(15);
  const fire = r.journal.find(x => x.cc === "fire_trigger");
  check("fire_trigger sur la tâche Brique Offres", fire && fire.input.trigger_id === "trig_OFFRES1", JSON.stringify(fire));
  check("pendant : « Passage en cours… », bouton grisé", r.$("passBtn").textContent === "Passage en cours…" && r.$("passBtn").disabled);
  check("afficheur : OFFRES ATTENDUES VERS", /^OFFRES ATTENDUES VERS \d\d:\d\d$/.test(r.$("affProchain").textContent), r.$("affProchain").textContent);
  check("message estimé : « Le dernier passage a pris 7 minutes »", /^La brique Offres tourne dans Cowork\. Le dernier passage a pris 7 minutes : le lecteur relira Notion vers \d\d:\d\d\.Vérifier maintenant$/.test(r.$("passZone").textContent), r.$("passZone").textContent);
  await wait(400);
  check("retour : « Passage terminé à hh:mm : 2 nouvelles offres. »", /^Passage terminé à \d\d:\d\d : 2 nouvelles offres\.$/.test(r.$("passZone").textContent) && /ok/.test(r.$("passZone").className), r.$("passZone").textContent);
  check("liste relue après le retour", r.$("list").querySelectorAll(".title").length === 3, String(r.$("list").querySelectorAll(".title").length));
  check("bouton rendu après le retour", r.$("passBtn").textContent === "▶ Lancer un passage maintenant" && !r.$("passBtn").disabled);
  r = await scenario({derniere: new Date(Date.now() - 2 * 86400000).toISOString(), minute: 5000});
  r.$("passBtn").click(); await wait(15);
  check("sans durée connue : phrase sans durée", /^La brique Offres tourne dans Cowork : le lecteur relira Notion vers \d\d:\d\d\.Vérifier maintenant$/.test(r.$("passZone").textContent), r.$("passZone").textContent);
  const avant = r.journal.length;
  r.btn("Vérifier maintenant", r.$("passZone")).click(); await wait(60);
  check("« Vérifier maintenant » relit Notion, toujours en attente avant l'heure estimée", r.$("passBtn").disabled && /tourne dans Cowork/.test(r.$("passZone").textContent), r.$("passZone").textContent);
  r = await scenario({minute: 10, abandon: 300});
  r.$("passBtn").click(); await wait(100);
  check("après l'heure estimée : « Le passage n'est pas encore revenu. »", r.$("passZone").textContent === "Le passage n'est pas encore revenu.Vérifier maintenant", r.$("passZone").textContent);
  await wait(400);
  check("abandon à 30 minutes : texte validé", r.$("passZone").textContent === "Le passage n'est pas revenu au bout de 30 minutes. Ouvre la tâche « Brique Offres » dans Cowork pour voir où il en est." && /ko/.test(r.$("passZone").className), r.$("passZone").textContent);
  r = await scenario({ccErreur: {fire_trigger: {code: "not_in_manifest"}}});
  r.$("passBtn").click(); await wait(30);
  check("échec du lancement : « Lancement impossible : … »", /^Lancement impossible : accès au connecteur Claude Code Remote refusé/.test(r.$("passZone").textContent) && !r.$("passBtn").disabled, r.$("passZone").textContent);
  // ---- Réglages : structure et textes ----
  r = await scenario({});
  r.$("reglBtn").click(); await wait(80);
  const secs = [...r.$("reglBody").querySelectorAll(".rsec")].map(x => x.textContent);
  check("sections dans l'ordre", secs.join("|") === "POSTES|ZONE DE PRÉSENTIEL|CONDITIONS ÉCARTÉES PAR LE SCRIPT|PASSAGE QUOTIDIEN|PLATEFORMES SUIVIES|RECHERCHES DE POSTS LINKEDIN|PAGE DE CONFIGURATION NOTION", secs.join("|"));
  const txt = r.$("reglBody").textContent.replace(/\u00a0/g, " ");
  check("aide Postes recherchés", txt.indexOf("Claude rapproche chaque offre de ces intitulés par le sens : « PO » vaut Product Owner, une séniorité ou un secteur ajouté au titre ne change pas le poste. Une offre qui ne correspond à aucun poste recherché ni proche est écartée.") >= 0);
  check("aide Zone", txt.indexOf("Claude juge si le lieu de l'offre est dans ta zone, variantes d'écriture et communes comprises.") >= 0);
  check("introduction des conditions", txt.indexOf("Ces critères sont appliqués par le script, sur ce que l'offre affiche. Un fait absent n'écarte rien : l'offre est gardée avec une étiquette « À vérifier ».") >= 0);
  check("conditions : deux colonnes (types et temps à gauche, modes, jours et TJM à droite)", (() => { const c = r.$("reglBody").querySelector(".cols"); return c && c.children.length === 2 && c.children[0].querySelectorAll(".champ").length === 2 && c.children[1].querySelectorAll(".champ").length === 3; })());
  check("aide TJM", txt.indexOf("Écartée si le tarif journalier maximum affiché est sous ce plancher. Tarif non affiché ou non journalier : jamais écartée.") >= 0);
  check("aide heure de passage", txt.indexOf("La tâche planifiée « Brique Offres » passe chaque jour à cette heure. Le changement s'applique dès l'enregistrement.") >= 0 && !r.$("reglHeure").disabled && r.$("reglHeure").value === "08:45");
  check("aide plateformes", txt.indexOf("« Désactiver » et « Réactiver » s'appliquent à l'enregistrement.") >= 0 && /Free-Work● Active/.test(txt));
  check("« Que demander à Claude » absent", txt.indexOf("Que demander à Claude") < 0);
  check("Enregistrer grisé à l'ouverture", r.$("reglSave").disabled && r.$("reglSave").title === "Aucune modification");
  // Fermeture avec modification
  const ih = r.$("reglHeure"); ih.value = "07:30"; ih.dispatchEvent(new r.w.Event("input"));
  check("Enregistrer actif dès la première modification", !r.$("reglSave").disabled);
  r.$("reglFermer").click(); await wait(10);
  check("barre « Tu as des modifications non enregistrées. »", !r.$("reglQuit").hidden && r.$("reglBas").hidden && /^Tu as des modifications non enregistrées\./.test(r.$("reglQuit").textContent) && !r.$("reglView").hidden);
  r.$("quitRetour").click(); await wait(10);
  check("« Revenir aux réglages »", r.$("reglQuit").hidden && !r.$("reglBas").hidden && !r.$("reglView").hidden);
  r.$("reglSave").click(); await wait(120);
  const upd = r.journal.find(x => x.cc === "update_trigger");
  check("update_trigger : cron CRON_TZ=<fuseau> 30 7 * * *", upd && upd.input.trigger_id === "trig_OFFRES1" && /^CRON_TZ=\S+ 30 7 \* \* \*$/.test(upd.input.cron_expression), JSON.stringify(upd));
  const mh = r.journal.find(x => x.maj && x.maj.page_id.endsWith("305"));
  check("ligne « Heure de passage » écrite après la tâche", mh && mh.maj.properties.Valeur === "07:30" && r.journal.indexOf(mh) > r.journal.indexOf(upd));
  check("message de succès avec la nouvelle heure", /Réglages enregistrés\. Ils s'appliquent au prochain passage de la brique Offres \(7 h 30\)/.test(r.$("reglMsg").textContent), r.$("reglMsg").textContent);
  check("Enregistrer regrisé après l'enregistrement", r.$("reglSave").disabled);
  r.$("reglFermer").click(); await wait(20);
  check("fermeture directe sans modification", r.$("reglView").hidden);
  // Échec de update_trigger : heure non modifiée, le reste est enregistré
  r = await scenario({ccErreur: {update_trigger: {code: "tool_error", message: "refus"}}});
  r.$("reglBtn").click(); await wait(80);
  let h2 = r.$("reglHeure"); h2.value = "09:15"; h2.dispatchEvent(new r.w.Event("input"));
  let j = r.$("reglJours"); j.value = "2"; j.dispatchEvent(new r.w.Event("input"));
  r.$("reglSave").click(); await wait(120);
  check("échec update_trigger : texte validé", r.$("reglMsg").textContent === "Heure non modifiée : la tâche a refusé la modification (refus). Les autres réglages sont enregistrés.", r.$("reglMsg").textContent);
  check("échec update_trigger : jours écrits, heure non écrite", r.journal.some(x => x.maj && x.maj.page_id.endsWith("309") && x.maj.properties.Valeur === "2") && !r.journal.some(x => x.maj && x.maj.page_id.endsWith("305")));
  // Heure invalide
  r = await scenario({});
  r.$("reglBtn").click(); await wait(80);
  h2 = r.$("reglHeure"); h2.value = ""; h2.dispatchEvent(new r.w.Event("input"));
  r.$("reglSave").click(); await wait(30);
  check("heure vide : texte validé", r.$("reglMsg").textContent === "L'heure de passage doit être au format HH:MM, par exemple 08:45.", r.$("reglMsg").textContent);
  r.$("reglFermer").click(); await wait(10); r.$("quitSans").click(); await wait(10);
  check("« Fermer sans enregistrer »", r.$("reglView").hidden && !r.journal.some(x => x.maj));
  // Sans tâche : heure grisée
  r = await scenario({tache: null});
  r.$("reglBtn").click(); await wait(80);
  check("sans tâche : heure grisée, texte validé", r.$("reglHeure").disabled && r.$("reglBody").textContent.indexOf("Modifiable après la mise à jour du kit (modèle Notion 8).") >= 0);
  // ---- Postes proches ----
  r = await scenario({});
  r.$("reglBtn").click(); await wait(80);
  r.$("proposBtn").click(); await wait(5);
  check("attente : « Claude cherche des postes proches… »", r.$("reglBody").textContent.indexOf("Claude cherche des postes proches…") >= 0 && r.$("proposBtn").disabled);
  r.$("proposBtn").click(); await wait(80);
  const props = [...r.$("reglBody").querySelectorAll(".propos button.puce")].map(b => b.textContent);
  check("propositions filtrées (déjà listés retirés)", props.join("|") === "+ Proxy Product Owner|+ Chef de projet MOA", props.join("|"));
  check("titre des propositions", r.$("reglBody").textContent.indexOf("Propositions de Claude : clique sur un poste pour l'ajouter, puis Enregistrer.") >= 0);
  check("un seul appel à Claude malgré deux clics", r.journal.filter(x => x.sample).length === 1, String(r.journal.filter(x => x.sample).length));
  r.$("reglBody").querySelector(".propos button.puce").click(); await wait(10);
  check("clic : poste ajouté aux postes proches, Enregistrer actif", /Proxy Product Owner×/.test(r.$("reglBody").textContent) && !r.$("reglSave").disabled);
  r.btn("Ignorer les propositions").click(); await wait(10);
  check("« Ignorer les propositions »", !r.$("reglBody").querySelector(".propos button.puce"));
  r.$("reglSave").click(); await wait(100);
  check("postes proches écrits", r.journal.some(x => x.maj && x.maj.page_id.endsWith("302") && x.maj.properties.Valeur === "Scrum Master; Proxy Product Owner"));
  r = await scenario({propositions: ["Product Owner"]});
  r.$("reglBtn").click(); await wait(80); r.$("proposBtn").click(); await wait(60);
  check("aucune proposition nouvelle : texte validé", r.$("reglBody").textContent.indexOf("Claude n'a proposé aucun nouveau poste proche.") >= 0);
  r = await scenario({sampleErreur: {code: "rate_limited"}});
  r.$("reglBtn").click(); await wait(80); r.$("proposBtn").click(); await wait(60);
  check("échec : « Proposition impossible : … »", r.$("reglBody").textContent.indexOf("Proposition impossible : trop de demandes à Claude, réessaie dans quelques minutes.") >= 0);
  console.log(`\n${ok}/${ok + ko} contrôles OK`); process.exit(ko ? 1 : 0);
})();
