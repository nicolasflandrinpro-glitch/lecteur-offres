// Fenêtre de l'icône (v0.6) : choix de la fenêtre de lecture, accès aux réglages et au journal.
const $ = id => document.getElementById(id);

async function etat() {
  const cur = await chrome.windows.getCurrent();
  const { fenetreChoisie } = await chrome.storage.local.get("fenetreChoisie");
  $("etat").textContent = fenetreChoisie === cur.id ? "Cette fenêtre est la fenêtre de lecture." :
    fenetreChoisie ? "Une autre fenêtre est la fenêtre de lecture." : "Une nouvelle fenêtre s'ouvrira à la première offre.";
}

$("choisir").addEventListener("click", async function () {
  const cur = await chrome.windows.getCurrent();
  chrome.runtime.sendMessage({ type: "choisir-fenetre", windowId: cur.id }, etat);
});
$("oublier").addEventListener("click", function () { chrome.runtime.sendMessage({ type: "oublier-fenetre" }, etat); });
$("options").addEventListener("click", function () { chrome.runtime.openOptionsPage(); window.close(); });
$("journal").addEventListener("click", function () { chrome.tabs.create({ url: chrome.runtime.getURL("journal.html") }); window.close(); });
etat();
