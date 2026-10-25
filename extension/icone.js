// v0.6 (23/10/2026) : icône d'onglet « JOB » posée seulement sur les lecteurs dont l'adresse est saisie dans les options.
// claude.ai peut remettre sa propre icône après le chargement : on la surveille et on la remplace à nouveau.
(function () {
  function surLecteur(lecteurs) {
    var ici = "https://claude.ai" + location.pathname.replace(/\/$/, "");
    return (lecteurs || []).some(function (u) { return ici === u || ici.indexOf(u + "/") === 0; });
  }
  chrome.storage.sync.get("reglages", function (o) {
    var r = (o && o.reglages) || {};
    if (!surLecteur(r.lecteurs)) return;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
      '<rect width="64" height="64" rx="12" fill="#0a66c2"/>' +
      '<text x="32" y="41" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="24" font-weight="700" fill="#ffffff">JOB</text></svg>';
    var href = "data:image/svg+xml," + encodeURIComponent(svg);
    var enCours = false;
    function poser() {
      if (enCours || !document.head) return;
      enCours = true;
      try {
        var liens = document.head.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]');
        var notre = document.head.querySelector("link[data-lecteur-icone]");
        liens.forEach(function (l) { if (l !== notre) l.remove(); });
        if (!notre) {
          notre = document.createElement("link");
          notre.rel = "icon"; notre.type = "image/svg+xml"; notre.setAttribute("data-lecteur-icone", "1");
          document.head.appendChild(notre);
        }
        if (notre.href !== href) notre.href = href;
      } finally { enCours = false; }
    }
    function demarrer() {
      poser();
      new MutationObserver(poser).observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ["href", "rel"] });
    }
    if (document.head) demarrer(); else document.addEventListener("DOMContentLoaded", demarrer);
  });
})();
