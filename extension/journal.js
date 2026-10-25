// Affiche le journal de l'import (chrome.storage.local, clé journalImport).
const LIBELLES = {
  url: "Adresse", fichier: "Fichier", type: "Type", taille: "Taille (octets)", erreur: "Erreur",
  verdict: "Verdict", tailleCaracteres: "Taille (caractères)", postsTrouves: "Posts trouvés", attente: "Attente",
  conseil: "Conseil", lecteurs: "Lecteur", bilan: "Bilan"
};

async function afficher() {
  const { journalImport = [] } = await chrome.storage.local.get("journalImport");
  const ol = document.getElementById("liste");
  ol.textContent = "";
  if (!journalImport.length) {
    const li = document.createElement("li"); li.className = "vide";
    li.textContent = "Aucun événement pour l'instant.";
    ol.append(li); return;
  }
  journalImport.forEach(function (e) {
    const li = document.createElement("li");
    if (e.verdict) li.className = /RÉUSSITE/.test(e.verdict) ? "ok" : "ko";
    else if (e.erreur) li.className = "ko";
    const t = document.createElement("div"); t.className = "etape"; t.textContent = e.etape || "";
    const h = document.createElement("div"); h.className = "heure"; h.textContent = e.heure || "";
    const dl = document.createElement("dl");
    Object.keys(e).forEach(function (k) {
      if (k === "etape" || k === "heure") return;
      const v = e[k];
      if (v === undefined || v === null || v === "") return;
      const dt = document.createElement("dt"); dt.textContent = LIBELLES[k] || k;
      const dd = document.createElement("dd"); dd.textContent = typeof v === "boolean" ? (v ? "oui" : "non") : String(v);
      dl.append(dt, dd);
    });
    li.append(t, h, dl); ol.append(li);
  });
}

document.getElementById("actualiser").addEventListener("click", afficher);
document.getElementById("vider").addEventListener("click", async function () {
  await chrome.storage.local.remove("journalImport"); afficher();
});
chrome.storage.onChanged.addListener(function (ch, zone) { if (zone === "local" && ch.journalImport) afficher(); });
afficher();
