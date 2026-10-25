// Options de l'extension (v0.6) : adresse du lecteur, écran de la fenêtre de lecture, sous-dossier des enregistrements.
const $ = id => document.getElementById(id);

async function charger() {
  const r = await lireReglages();
  $("lecteurs").value = (r.lecteurs || []).join("\n");
  $("dossier").value = r.dossier || REGLAGES_DEFAUT.dossier;
  const sel = $("ecran"); sel.textContent = "";
  const o0 = document.createElement("option"); o0.value = ""; o0.textContent = "Écran principal"; sel.append(o0);
  try {
    const ecrans = await chrome.system.display.getInfo();
    ecrans.forEach(function (e, i) {
      const o = document.createElement("option"); o.value = e.id;
      o.textContent = (e.name || ("Écran " + (i + 1))) + " (" + e.bounds.width + " × " + e.bounds.height + ")" + (e.isPrimary ? ", principal" : "");
      sel.append(o);
    });
  } catch (e) {}
  sel.value = r.ecran || "";
}

$("enregistrer").addEventListener("click", async function () {
  const msg = $("msg");
  const lignes = $("lecteurs").value.split(/\s+/).map(x => x.trim()).filter(Boolean);
  const lecteurs = [], refusees = [];
  lignes.forEach(function (l) { const v = adresseLecteurValide(l); if (v) { if (lecteurs.indexOf(v) < 0) lecteurs.push(v); } else refusees.push(l); });
  if (refusees.length) { msg.textContent = "Adresse refusée : " + refusees.join(", ") + ". Il faut une adresse https://claude.ai/artifact/…"; msg.className = "ko"; return; }
  const dossier = dossierValide($("dossier").value);
  if (!dossier) { msg.textContent = "Sous-dossier refusé : pas de chemin absolu, de « .. » ni de caractères < > : \" | ? *."; msg.className = "ko"; return; }
  await ecrireReglages({ lecteurs: lecteurs, dossier: dossier, ecran: $("ecran").value });
  msg.textContent = lecteurs.length ? "Réglages enregistrés. Recharge la page du lecteur pour qu'ils s'appliquent." : "Réglages enregistrés, sans adresse de lecteur : l'icône d'onglet ne sera pas posée.";
  msg.className = "ok";
});

charger();
