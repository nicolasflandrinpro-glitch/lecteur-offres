// Relais entre le lecteur d'offres (page) et l'extension (v0.6, 23/10/2026).
// Le lecteur envoie { source: "lecteur-offres", type, ... } ; le relais transmet au script de fond
// et renvoie au lecteur { source: "lecteur-offres-ext", type, ... }.
// Types : ping → presente ; ouvrir → ouvert ; ouvrir-recherche → recherche-ouverte ; lire-import → import ;
// import-traite → (rien). Le script de fond peut aussi annoncer import-dispo.
// v0.6 : capacité « verifier » retirée (contrôle des offres Free-Work fait par la brique Offres).
(function () {
  var VERSION = "0.6";
  function poster(m) { try { m.source = "lecteur-offres-ext"; window.postMessage(m, "*"); } catch (e) {} }
  function annoncer() { poster({ type: "presente", version: VERSION, capacites: ["ouvrir", "import", "file"] }); }
  function envoyer(msg, rep) {
    try {
      chrome.runtime.sendMessage(msg, function (r) {
        if (chrome.runtime.lastError) { rep({ ok: false, erreur: chrome.runtime.lastError.message }); return; }
        rep(r || { ok: false, erreur: "pas de réponse" });
      });
    } catch (e) {
      rep({ ok: false, erreur: "extension rechargée : recharge la page du lecteur" });
    }
  }
  window.addEventListener("message", function (ev) {
    if (ev.source !== window) return;
    var d = ev.data;
    if (!d || d.source !== "lecteur-offres") return;
    if (d.type === "ping") { annoncer(); envoyer({ type: "lecteur-present" }, function () {}); return; }
    if (d.type === "ouvrir" && typeof d.url === "string") {
      envoyer({ type: "ouvrir", url: d.url }, function (r) { poster({ type: "ouvert", ok: !!r.ok, erreur: r.erreur || "", url: d.url }); });
      return;
    }
    if (d.type === "ouvrir-recherche" && typeof d.url === "string") {
      envoyer({ type: "ouvrir-recherche", url: d.url }, function (r) { poster({ type: "recherche-ouverte", ok: !!r.ok, erreur: r.erreur || "" }); });
      return;
    }
    if (d.type === "lire-import") {
      envoyer({ type: "lire-import" }, function (r) { poster({ type: "import", ok: !!r.ok, erreur: r.erreur || "", imports: r.imports || [] }); });
      return;
    }
    if (d.type === "import-traite" && typeof d.id === "string") {
      envoyer({ type: "import-traite", id: d.id, bilan: String(d.bilan || "") }, function () {});
    }
  });
  try {
    chrome.runtime.onMessage.addListener(function (msg) {
      if (msg && msg.type === "import-dispo") poster({ type: "import-dispo", id: msg.id, posts: msg.posts, recherche: msg.recherche || "" });
    });
  } catch (e) {}
  annoncer();
  document.addEventListener("DOMContentLoaded", annoncer);
})();
