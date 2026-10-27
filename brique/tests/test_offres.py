#!/usr/bin/env python3
# Jeu de vérification de offres.py (brique Offres v1.10). Usage : python3 test_offres.py [chemin/vers/offres.py]
# Chaque cas : réglages (écarts par rapport à BASE), une offre (faits relevés), résultat attendu (critère d'écart, ou étiquettes À vérifier).
import json, subprocess, sys, os, tempfile, copy, hashlib, unicodedata
SCRIPT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else "offres.py")
BASE = {"Version du modèle": "6", "Prénom": "Camille", "Postes recherchés": "Product Owner; Business Analyst", "Postes proches": "Proxy PO",
        "Types de collaboration acceptés": "Freelance; Portage salarial", "Temps de travail": "plein ou partiel",
        "Modes de travail acceptés": "présentiel; hybride; télétravail total", "Jours de télétravail minimum": "",
        "Zone de présentiel": "Île-de-France",
        "TJM plancher (euros par jour)": "", "Expéditeurs ignorés": "", "Expéditeurs détectés": "", "Messagerie": "Gmail"}
SOURCES = [{"page": "p1", "id": "S01", "erreur": "", "gabarit": "linkedin_digest", "plateforme": "LinkedIn", "prefixe": "", "domaine": "linkedin.com", "adresse": "jobalerts-noreply@linkedin.com"},
           {"page": "p6", "id": "S06", "erreur": "", "gabarit": "collective_opportunite", "plateforme": "Collective", "prefixe": "cw", "domaine": "collective.work", "adresse": "ops@collective.work"},
           {"page": "p8", "id": "S08", "erreur": "", "gabarit": "freework_alerte", "plateforme": "Free-Work", "prefixe": "fw", "domaine": "https://www.free-work.com/", "adresse": "jobs@free-work.com"},
           {"page": "p9", "id": "S09", "erreur": "", "gabarit": "generique", "plateforme": "Malt", "prefixe": "mlt", "domaine": "malt.fr", "adresse": "alertes@malt.fr"},
           {"page": "p11", "id": "S11", "erreur": "", "gabarit": "generique_suivi", "plateforme": "Welcome", "prefixe": "wj", "domaine": "", "adresse": "jobs@wttj.example"}]
def off(i, **k):
    o = {"id": str(i), "source": "S01", "titre": "Product Owner", "org": "Société X", "lieu": "Paris", "poste": "Product Owner",
         "contrats": ["Freelance"], "temps": None, "mode": None, "jours_teletravail": None, "zone": "dans", "pourquoi": "test"}
    o.update(k); return o
def norm(s): return " ".join(unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode().lower().split())
def emp(o): return hashlib.sha256("|".join(norm(o.get(k)) for k in ("titre", "org", "lieu")).encode("utf-8")).hexdigest()[:12]
CAS = [
 ("Poste recherché, freelance, dans la zone", {}, off(100001), ("garde", [])),
 ("Poste proche gardé en Métier proche", {}, off(100002, poste="Proxy PO"), ("garde", [])),
 ("Poste hors liste écarté", {}, off(100003, poste="hors_liste", titre="Développeur Java"), ("ecarte", "poste")),
 ("Titre LinkedIn illisible gardé, Poste à vérifier", {}, off(100004, poste="inconnu", titre="FREELANCE-"), ("garde", ["Poste"])),
 ("CDI seul écarté si seuls Freelance et Portage acceptés", {}, off(100005, contrats=["CDI"]), ("ecarte", "contrat")),
 ("Freelance + CDI gardé (un type accepté suffit)", {}, off(100006, contrats=["Freelance", "CDI"]), ("garde", [])),
 ("Portage seul gardé", {}, off(100007, contrats=["Portage salarial"]), ("garde", [])),
 ("Stage toujours écarté, même si tout est accepté", {"Types de collaboration acceptés": "Freelance; Portage salarial; CDI; CDD"}, off(100008, contrats=["Stage"]), ("ecarte", "contrat")),
 ("CDD gardé si accepté", {"Types de collaboration acceptés": "CDD"}, off(100009, contrats=["CDD"]), ("garde", [])),
 ("Contrat non indiqué : gardé, Contrat à vérifier", {}, off(100010, contrats=[]), ("garde", ["Contrat"])),
 ("Salaire annuel sans type, CDI/CDD non acceptés : écarté", {}, off(100011, contrats=[], tarif_min=50000, tarif_max=60000, unite="an"), ("ecarte", "contrat")),
 ("Salaire annuel sans type, CDI accepté : Contrat à vérifier", {"Types de collaboration acceptés": "Freelance; CDI"}, off(100012, contrats=[], tarif_min=50000, tarif_max=60000, unite="an"), ("garde", ["Contrat"])),
 ("Temps partiel écarté si plein seulement", {"Temps de travail": "plein seulement"}, off(100013, temps="partiel"), ("ecarte", "temps")),
 ("Temps non indiqué, plein seulement : à vérifier", {"Temps de travail": "plein seulement"}, off(100014), ("garde", ["Temps de travail"])),
 ("Temps non indiqué, plein ou partiel : rien à vérifier", {}, off(100015), ("garde", [])),
 ("Présentiel hors zone écarté", {}, off(100016, mode="présentiel", zone="hors", lieu="Lyon"), ("ecarte", "localisation")),
 ("Mode inconnu hors zone : gardé, Lieu à vérifier", {}, off(100017, zone="hors", lieu="Lyon"), ("garde", ["Lieu"])),
 ("Lieu non indiqué : Lieu à vérifier", {}, off(100018, zone=None, lieu=""), ("garde", ["Lieu"])),
 ("Présentiel refusé par les réglages : écarté", {"Modes de travail acceptés": "hybride; télétravail total"}, off(100019, mode="présentiel"), ("ecarte", "localisation")),
 ("Hybride 1 j, minimum 2 j : écarté", {"Jours de télétravail minimum": "2"}, off(100020, mode="hybride", jours_teletravail=1), ("ecarte", "localisation")),
 ("Hybride sans nombre de jours, minimum 2 j : Télétravail à vérifier", {"Jours de télétravail minimum": "2"}, off(100021, mode="hybride"), ("garde", ["Télétravail"])),
 ("Télétravail total hors zone jamais écarté pour la zone", {}, off(100025, mode="télétravail total", zone="hors", lieu="Lyon"), ("garde", [])),
 ("TJM sous le plancher écarté", {"TJM plancher (euros par jour)": "600"}, off(100029, tarif_min=450, tarif_max=550, unite="jour"), ("ecarte", "tjm")),
 ("TJM plancher vide : jamais écarté", {}, off(100030, tarif_min=300, tarif_max=350, unite="jour"), ("garde", [])),
 ("Ordre des critères : poste avant contrat", {}, off(100031, poste="hors_liste", contrats=["CDI"]), ("ecarte", "poste")),
 ("Cumul d'étiquettes", {"Temps de travail": "plein seulement"}, off(100032, contrats=[], zone=None, lieu=""), ("garde", ["Contrat", "Lieu", "Temps de travail"])),
]
def run(params, offres, extra=None, args=()):
    d = tempfile.mkdtemp()
    D = {"date_iso": "2026-10-23", "debut_iso": "2026-10-23T08:45:12+02:00", "mails_lus": 1, "offres_uniques": len(offres), "doublons": 0, "deja_vues": 0, "doublons_plateformes": 0,
         "offres": offres, "lectures_mail": [{"id": s["id"], "erreur": ""} for s in SOURCES], "non_affichees": []}
    K = {"parametres": dict(params), "ids_offres": [], "sources": copy.deepcopy(SOURCES), "plateformes_offres": ["LinkedIn", "Collective", "Free-Work", "Post LinkedIn", "Malt", "Welcome"]}
    if extra: extra(D, K)
    json.dump(D, open(f"{d}/o.json", "w")); json.dump(K, open(f"{d}/c.json", "w"))
    r = subprocess.run([sys.executable, SCRIPT, *args, "o.json", "c.json"], cwd=d, capture_output=True, text=True)
    out = json.load(open(f"{d}/notion.json")) if os.path.exists(f"{d}/notion.json") else None
    r.offres = json.load(open(f"{d}/o.json"))
    return r, out
ko, nb = 0, 0
def verdict(nom, ok, detail=""):
    global ko, nb
    nb += 1; ko += not ok; print(("OK   " if ok else "ÉCHEC") + f" {nom}" + ("" if ok else f" : {detail}"))
for nom, mod, o, att in CAS:
    p = dict(BASE); p.update(mod); r, out = run(p, [copy.deepcopy(o)])
    if r.returncode != 0: res = ("erreur", r.stdout.strip())
    elif out["ecartees"]: res = ("ecarte", out["ecartees"][0].split(" ; ")[0])
    else: res = ("garde", out["offres_a_creer"][0]["properties"]["À vérifier"])
    verdict(nom, res == att, f"attendu {att}, obtenu {res}")
# Garde-fous
r, _ = run({**BASE, "Version du modèle": "2"}, [off(200001)]); verdict("Version du modèle 2 : arrêt (code 2)", r.returncode == 2)
r, _ = run({**BASE, "Postes recherchés": ""}, [off(200002)]); verdict("Aucun poste recherché : erreur", r.returncode == 1 and "aucun poste" in r.stdout)
r, _ = run(BASE, [off(200003, contrats=["Interim"])]); verdict("Valeur de contrat hors liste : erreur", r.returncode == 1)
r, _ = run(BASE, [off(200004)], lambda D, K: K.update(ids_offres=["200004"])); verdict("Offre déjà en base : erreur", r.returncode == 1)
r, _ = run(BASE, [off(200005)], lambda D, K: D.update(offres_uniques=3)); verdict("Compteurs incohérents : erreur", r.returncode == 1)
r, out = run(BASE, [off(200006, poste="Proxy PO", tarif_min=500, tarif_max=700, unite="jour")])
pr = out["offres_a_creer"][0]["properties"]
verdict("Propriétés écrites (Métier proche, TJM moyen, Contrat en liste, lien LinkedIn reconstruit)", pr["Métier"] == "Métier proche" and pr["TJM"] == 600 and pr["Contrat"] == ["Freelance"] and pr["Lien"] == "https://www.linkedin.com/jobs/view/200006/" and pr["Plateforme"] == "LinkedIn")
# Offres retirées (v1.6)
CR = [{"id": "fw-a", "page": "https://app.notion.com/p/a", "lien": "https://www.free-work.com/x/a"}, {"id": "fw-b", "page": "https://app.notion.com/p/b", "lien": "https://www.free-work.com/x/b"}]
r, out = run(BASE, [], lambda D, K: (K.update(candidats_retrait=CR), D.update(offres_uniques=0, retrait={"controlees": ["fw-a", "fw-b"], "retirees": ["fw-b"], "erreurs": []})))
verdict("Offre retirée : écriture de « Retirée le »", r.returncode == 0 and out["retirees_a_maj"] == [{"page": "https://app.notion.com/p/b", "id": "fw-b", "properties": {"date:Retirée le:start": "2026-10-23", "date:Retirée le:is_datetime": 0}}] and "RETRAITS candidats=2 controlees=2 retirees=1 erreurs=0" in r.stdout, r.stdout)
r, _ = run(BASE, [], lambda D, K: (K.update(candidats_retrait=CR), D.update(offres_uniques=0, retrait={"controlees": ["fw-z"], "retirees": [], "erreurs": []}))); verdict("Retrait hors candidats : erreur", r.returncode == 1)
r, _ = run(BASE, [], lambda D, K: (K.update(candidats_retrait=CR), D.update(offres_uniques=0, retrait={"controlees": ["fw-a"], "retirees": ["fw-b"], "erreurs": []}))); verdict("Retirée non contrôlée : erreur", r.returncode == 1)
r, out = run(BASE, []); verdict("Sans contrôle de retrait : rien à écrire", r.returncode == 0 and out["retirees_a_maj"] == [])
# Plateformes lues dans Sources (v1.7)
CW = "https://www.collective.work/jobs/fr/po-data-123"
r, out = run(BASE, [off("cw-po-data-123", source="S06", lien=CW)]); verdict("Collective : plateforme et lien lus dans Sources", r.returncode == 0 and out["offres_a_creer"][0]["properties"]["Plateforme"] == "Collective", r.stdout)
r, _ = run(BASE, [off("cw-po-data-123", source="S06", lien="https://www.collective.work/jobs/fr/autre")]); verdict("Collective : lien incohérent, erreur", r.returncode == 1)
FW = "https://www.free-work.com/fr/tech-it/job-mission/product-owner/po-h-f"
r, out = run(BASE, [off("fw-po-h-f", source="S08", lien=FW, org="")]); verdict("Free-Work : entreprise facultative, domaine saisi avec https://www.", r.returncode == 0 and out["offres_a_creer"][0]["properties"]["Plateforme"] == "Free-Work", r.stdout)
r, _ = run(BASE, [off("fw-po-h-f", source="S08", lien="https://evil.example/fw")]); verdict("Lien hors du domaine des offres : erreur", r.returncode == 1 and "hors du domaine" in r.stdout)
r, _ = run(BASE, [off("fw-po-h-f", source="S08", lien="https://www.free-work.com.evil.io/x")]); verdict("Domaine usurpé (free-work.com.evil.io) : erreur", r.returncode == 1)
ML = "https://www.malt.fr/projects/abc-42"
def sans_malt(D, K): K["plateformes_offres"].remove("Malt")
r, out = run(BASE, [off("mlt-abc-42", source="S09", lien=ML)])
verdict("Gabarit générique : plateforme Malt écrite", r.returncode == 0 and out["offres_a_creer"][0]["properties"]["Plateforme"] == "Malt", r.stdout)
r, _ = run(BASE, [], sans_malt)
verdict("Plateforme absente des valeurs de Offres, lue sans erreur : erreur", r.returncode == 1 and "absente des valeurs" in r.stdout)
def malt_signale(D, K): sans_malt(D, K); D["lectures_mail"][3]["erreur"] = "plateforme « Malt » absente de la colonne Offres Plateforme"
r, out = run(BASE, [], malt_signale); verdict("Plateforme absente signalée : source non lue, reste du passage OK", r.returncode == 0 and any(x["id"] == "S09" for x in out["sources_a_maj"]), r.stdout)
r, _ = run(BASE, [off("mlt-abc-42", source="S09", lien=ML)], malt_signale); verdict("Offre d'une source non lisible : erreur", r.returncode == 1)
def sans_opts(D, K): K["plateformes_offres"] = []
r, _ = run(BASE, [], sans_opts); verdict("plateformes_offres absent : erreur", r.returncode == 1 and "plateformes_offres" in r.stdout)
r, _ = run(BASE, [off("abc-42", source="S09", lien=ML)]); verdict("Identifiant sans le préfixe de sa source : erreur", r.returncode == 1 and "identifiant invalide" in r.stdout)
r, _ = run(BASE, [off("mlt-ABC", source="S09", lien=ML)]); verdict("Identifiant en majuscules : erreur", r.returncode == 1)
r, _ = run(BASE, [off("mlt-abc-42", source="S09", lien=ML, poste="inconnu")]); verdict("Poste « inconnu » hors LinkedIn : erreur", r.returncode == 1)
r, _ = run(BASE, [off("123456", source="S99")]); verdict("Source inconnue : erreur", r.returncode == 1 and "S99" in r.stdout)
def sans_prefixe(D, K): K["sources"][3]["prefixe"] = ""
r, _ = run(BASE, [], sans_prefixe); verdict("Préfixe vide hors LinkedIn : erreur de configuration", r.returncode == 1 and "préfixe d'identifiant obligatoire" in r.stdout)
def meme_prefixe(D, K): K["sources"][3]["prefixe"] = "fw"
r, _ = run(BASE, [], meme_prefixe); verdict("Même préfixe pour deux plateformes : erreur", r.returncode == 1 and "partagé" in r.stdout)
def deux_sources_li(D, K): K["sources"].append({**SOURCES[0], "id": "S02", "page": "p2"}); D["lectures_mail"].append({"id": "S02", "erreur": ""})
r, _ = run(BASE, [], deux_sources_li); verdict("Deux sources pour une même plateforme : accepté", r.returncode == 0, r.stdout)
def sans_plateforme(D, K): K["sources"][3]["plateforme"] = ""
r, _ = run(BASE, [], sans_plateforme); verdict("Colonne Plateforme vide : erreur", r.returncode == 1 and "Plateforme vide" in r.stdout)
def gab_inconnu(D, K): K["sources"].append({"page": "px", "id": "S10", "erreur": "", "gabarit": "indeed_xyz", "plateforme": "Indeed", "prefixe": "in", "domaine": "indeed.com"}); D["lectures_mail"].append({"id": "S10", "erreur": ""})
r, _ = run(BASE, [], gab_inconnu); verdict("Gabarit inconnu lu sans erreur : erreur", r.returncode == 1 and "inconnu" in r.stdout)
def gab_inconnu_signale(D, K): gab_inconnu(D, K); D["lectures_mail"][-1]["erreur"] = "gabarit « indeed_xyz » inconnu de la brique 1.8"
r, out = run(BASE, [], gab_inconnu_signale); verdict("Gabarit inconnu signalé : Dernière erreur écrite, reste du passage OK", r.returncode == 0 and any(x["id"] == "S10" for x in out["sources_a_maj"]), r.stdout)

# ---- Nouveaux en 1.8 : liens de service (règle 1) ----
def lien_ko(nom, ident, lien, src="S09"):
    r, _ = run(BASE, [off(ident, source=src, lien=lien)]); verdict(nom, r.returncode == 1 and "lien de service" in r.stdout, r.stdout)
def lien_ok(nom, ident, lien, src="S09"):
    r, out = run(BASE, [off(ident, source=src, lien=lien)]); verdict(nom, r.returncode == 0 and len(out["offres_a_creer"]) == 1, r.stdout)
lien_ko("Lien de désactivation Free-Work (api.free-work.com/availability/disable-one) : écarté", "fw-disable-one", "https://api.free-work.com/availability/disable-one", "S08")
lien_ko("Sous-domaine d'aide (help.malt.fr) : écarté", "mlt-x", "https://help.malt.fr/article/x")
lien_ko("Paramètre token : écarté", "mlt-abc-42", "https://www.malt.fr/projects/abc-42?token=xyz")
lien_ko("Paramètre signature : écarté", "mlt-abc-42", "https://www.malt.fr/projects/abc-42?Signature=1")
lien_ko("Segment intermédiaire « search » : écarté", "mlt-abc", "https://www.malt.fr/search/abc")
lien_ko("Dernier segment « alerts » : écarté", "mlt-alerts", "https://www.malt.fr/jobs/alerts")
lien_ko("Désabonnement (desabonnement) : écarté", "mlt-x", "https://www.malt.fr/desabonnement/x")
lien_ko("Compte (account/settings) : écarté", "mlt-settings", "https://www.malt.fr/account/settings")
lien_ok("Slug « product-owner-research » : gardé", "mlt-product-owner-research", "https://www.malt.fr/projects/product-owner-research")
lien_ok("Slug « chef-de-projet-helpdesk » : gardé", "mlt-chef-de-projet-helpdesk", "https://www.malt.fr/projects/chef-de-projet-helpdesk")
lien_ok("Slug « charge-de-recherche » : gardé", "mlt-charge-de-recherche", "https://www.malt.fr/projects/charge-de-recherche")
lien_ok("Lien Free-Work d'offre : gardé", "fw-po-h-f", FW, "S08")
# ---- generique_suivi ----
OS = off("", source="S11", titre="Product Owner Data", org="Acme", lieu="Paris", lien="https://click.mailer.example/ls/click?upn=abc&token=1")
OS["id"] = "wj-" + emp(OS)
r, out = run(BASE, [copy.deepcopy(OS)]); verdict("generique_suivi : identifiant d'empreinte, lien de suivi gardé tel quel (règle 1 non appliquée)", r.returncode == 0 and out["offres_a_creer"][0]["properties"]["Lien"] == OS["lien"] and out["offres_a_creer"][0]["properties"]["Plateforme"] == "Welcome", r.stdout)
r, _ = run(BASE, [{**OS, "id": "wj-000000000000"}]); verdict("generique_suivi : identifiant différent de l'empreinte, erreur", r.returncode == 1 and "empreinte" in r.stdout)
r, _ = run(BASE, [{**OS, "lien": "http://click.mailer.example/x"}]); verdict("generique_suivi : lien hors https, erreur", r.returncode == 1 and "https" in r.stdout)
r, _ = run(BASE, [{**OS, "id": ""}], args=("--empreintes",)); verdict("--empreintes : identifiant calculé et écrit dans offres.json", r.returncode == 0 and r.offres["offres"][0]["id"] == OS["id"], r.stdout)
r, _ = run(BASE, [{**OS, "id": ""}], lambda D, K: K.update(ids_offres=[OS["id"]]), args=("--empreintes",)); verdict("--empreintes : offre déjà en base signalée deja_vue", r.returncode == 0 and "deja_vue" in r.stdout, r.stdout)
def sans_domaine_gen(D, K): K["sources"][3]["domaine"] = ""
r, _ = run(BASE, [], sans_domaine_gen); verdict("Domaine vide refusé pour generique, accepté pour generique_suivi", r.returncode == 1 and "S09 : domaine" in r.stdout and "S11 : domaine" not in r.stdout, r.stdout)
# ---- Mode TEST SOURCE ----
TS = {"page": "", "id": "S12", "erreur": "", "gabarit": "generique", "plateforme": "Hiway", "prefixe": "hw", "domaine": "hiway.example", "adresse": "alertes@hiway.example"}
def test_mode(src=TS, **dd):
    def f(D, K):
        K.update(test=True, sources=[dict(src)], candidats_retrait=[{"id": "fw-a", "page": "x", "lien": "y"}]); D["lectures_mail"] = [{"id": src["id"], "erreur": ""}]; D.update(dd)
    return f
OH = off("hw-po-42", source="S12", lien="https://www.hiway.example/missions/po-42")
r, out = run(BASE, [OH], test_mode(liens_ecartes=[{"lien": "https://www.hiway.example/postuler/po-42", "motif": "Postuler"}]))
verdict("TEST SOURCE : plateforme absente des valeurs de Offres acceptée, résultat concluant avec attention", r.returncode == 0 and out["dernier_test"].startswith("23/10/2026 08:45 ; S12 ; generique ; concluant") and "attention : plateforme « Hiway »" in out["dernier_test"], r.stdout)
verdict("TEST SOURCE : notion.json sans écriture d'offre, de source ni de retrait", set(out) == {"dernier_test", "ecartees"}, str(out))
verdict("TEST SOURCE : offre gardée et lien écarté listés", "offre ; Product Owner ; Société X ; gardée ; https://www.hiway.example/missions/po-42" in out["dernier_test"] and "lien écarté ; Postuler ; https://www.hiway.example/postuler/po-42" in out["dernier_test"], out["dernier_test"])
r, out = run(BASE, [off("hw-dev", source="S12", lien="https://www.hiway.example/missions/dev", poste="hors_liste", titre="Développeur")], test_mode())
verdict("TEST SOURCE : offre écartée listée avec son motif", r.returncode == 0 and "écartée : poste hors des postes recherchés et proches" in out["dernier_test"], str(out))
r, out = run(BASE, [], test_mode(offres_uniques=0, suivi_detecte=True))
verdict("TEST SOURCE : aucune offre et liens de suivi, suggestion generique_suivi", r.returncode == 0 and out["dernier_test"].split("<br>")[0].endswith("aucune offre ; suggestion : generique_suivi"), str(out))
r, out = run(BASE, [], test_mode(src={**TS, "prefixe": "H1"}, offres_uniques=0))
verdict("TEST SOURCE : préfixe invalide, code 3 et résultat « erreur » écrit", r.returncode == 3 and " ; erreur" in out["dernier_test"] and "préfixe" in out["dernier_test"], r.stdout)
r, out = run(BASE, [], test_mode(src={**TS, "gabarit": "indeed_xyz"}, offres_uniques=0))
verdict("TEST SOURCE : gabarit inconnu, code 3", r.returncode == 3 and "inconnu" in out["dernier_test"], r.stdout)
r, out = run(BASE, [], test_mode(src={**TS, "adresse": "hiway"}, offres_uniques=0))
verdict("TEST SOURCE : expéditeur sans @, code 3", r.returncode == 3, r.stdout)
many = [off(f"hw-po-{k}", source="S12", lien=f"https://www.hiway.example/missions/po-{k}", titre=f"Product Owner {k} " + "x" * 60) for k in range(60)]
r, out = run(BASE, many, test_mode())
verdict("TEST SOURCE : résultat tronqué sous 1900 caractères", r.returncode == 0 and len(out["dernier_test"]) <= 1900 and "lignes tronquées" in out["dernier_test"], str(len(out["dernier_test"]) if out else r.stdout))
# ---- Expéditeurs détectés (étape 6 ter) ----
def det(liste, **pp):
    def f(D, K): D["expediteurs_detectes"] = liste; K["parametres"].update(pp); K["adresses_sources"] = ["ancienne@inactive.example"]
    return f
X1 = {"adresse": "Jobs@Hiway.example", "nom": "Hiway", "mails": 2, "objet": "Nouvelles missions ; PO", "dernier": "2026-10-22"}
r, out = run(BASE, [], det([X1])); verdict("Expéditeur détecté ajouté (adresse en minuscules, « ; » de l'objet remplacé)", r.returncode == 0 and out["expediteurs_detectes"] == "jobs@hiway.example ; Hiway ; 2 mails ; dernier 22/10/2026 ; Nouvelles missions , PO" and "DETECTES nouveaux=1 total=1 retires=0" in r.stdout and "DETECTE jobs@hiway.example" in r.stdout, str(out) + r.stdout)
r, out = run(BASE, [], det([X1], **{"Expéditeurs détectés": "jobs@hiway.example ; Hiway ; 3 mails ; dernier 20/10/2026 ; ancien objet"}))
verdict("Fusion avec la liste existante : compteur cumulé, date et objet mis à jour", r.returncode == 0 and out["expediteurs_detectes"].startswith("jobs@hiway.example ; Hiway ; 5 mails ; dernier 22/10/2026") and "nouveaux=0 total=1" in r.stdout, str(out))
r, out = run(BASE, [], det([X1], **{"Expéditeurs ignorés": "@hiway.example"})); verdict("Expéditeur ignoré par domaine : retiré", r.returncode == 0 and out["expediteurs_detectes"] == "", str(out))
r, out = run(BASE, [], det([{**X1, "adresse": "ops@collective.work"}])); verdict("Adresse d'une source active : retirée", r.returncode == 0 and out["expediteurs_detectes"] == "", str(out))
r, out = run(BASE, [], det([{**X1, "adresse": "ancienne@inactive.example"}])); verdict("Adresse d'une source inactive (adresses_sources) : retirée", r.returncode == 0 and out["expediteurs_detectes"] == "", str(out))
r, out = run(BASE, [], det([], **{"Expéditeurs détectés": "vieux@site.example ; Vieux ; 1 mails ; dernier 01/09/2026 ; x<br>jobs@hiway.example ; Hiway ; 1 mails ; dernier 20/10/2026 ; y"}))
verdict("Expéditeur sans mail depuis plus de 30 jours : retiré", r.returncode == 0 and out["expediteurs_detectes"].startswith("jobs@hiway.example") and "vieux@" not in out["expediteurs_detectes"] and "retires=1" in r.stdout, str(out) + r.stdout)
r, out = run(BASE, [], det([{**X1, "adresse": f"a{k}@site{k}.example", "dernier": f"2026-10-{k + 1:02d}"} for k in range(22)]))
verdict("Au plus 20 expéditeurs, les plus récents gardés", r.returncode == 0 and len(out["expediteurs_detectes"].split("<br>")) == 20 and "a21@" in out["expediteurs_detectes"] and "a0@" not in out["expediteurs_detectes"], str(out))
r, out = run(BASE, []); verdict("Étape 6 ter non faite : rien à écrire", r.returncode == 0 and out["expediteurs_detectes"] is None and "DETECTES non_lus" in r.stdout, r.stdout)
r, _ = run(BASE, [], det([{"adresse": "sans-arobase", "mails": 1, "dernier": "2026-10-22"}])); verdict("Expéditeur détecté mal formé : erreur", r.returncode == 1 and "expediteurs_detectes" in r.stdout)
r, out = run(BASE, [], lambda D, K: (test_mode()(D, K), D.update(offres_uniques=0, expediteurs_detectes=[X1])))
verdict("TEST SOURCE : expéditeurs détectés ignorés", r.returncode == 0 and "expediteurs_detectes" not in out, str(out))
# ---- Modèle N-1 toléré (v1.9 : modèle 4) ----
M4 = {**BASE, "Version du modèle": "4"}
r, out = run(M4, [off(300001)], det([X1])); verdict("Modèle 4 : passage OK, offre créée, expéditeurs détectés écrits, avertissement, débrief non écrit", r.returncode == 0 and len(out["offres_a_creer"]) == 1 and out["expediteurs_detectes"].startswith("jobs@hiway.example") and "AVERTISSEMENT modèle Notion 4" in r.stdout and "DEBRIEF non_ecrit" in r.stdout, r.stdout)
r, out = run(M4, [OH], test_mode()); verdict("Modèle 4 : TEST SOURCE, résultat écrit", r.returncode == 0 and out["dernier_test"].startswith("23/10/2026 08:45 ; S12") and "seule écriture" in r.stdout, r.stdout)
r, out = run(M4, [], test_mode(src={**TS, "prefixe": "H1"}, offres_uniques=0)); verdict("Modèle 4 : TEST SOURCE mal réglé, code 3 et résultat « erreur » écrit", r.returncode == 3 and " ; erreur" in out["dernier_test"], r.stdout)
# ---- Messagerie (v1.8) ----
r, _ = run({**BASE, "Messagerie": ""}, [off(400001)]); verdict("Messagerie vide en modèle 5 : erreur", r.returncode == 1 and "Messagerie" in r.stdout, r.stdout)
r, _ = run({**BASE, "Messagerie": "Orange"}, [off(400002)]); verdict("Messagerie inconnue : erreur", r.returncode == 1 and "Orange" in r.stdout, r.stdout)
r, _ = run({**BASE, "Messagerie": "outlook"}, [off(400003)]); verdict("Messagerie Outlook (casse libre) : acceptée", r.returncode == 0 and "messagerie=Outlook" in r.stdout, r.stdout)
r, _ = run({**BASE, "Messagerie": "Fastmail"}, [off(400004)]); verdict("Messagerie Fastmail : acceptée", r.returncode == 0 and "messagerie=Fastmail" in r.stdout, r.stdout)
r, _ = run({k: v for k, v in M4.items() if k != "Messagerie"}, [off(400005)]); verdict("Modèle 4 sans ligne Messagerie : erreur (plus de repli Gmail)", r.returncode == 1 and "Messagerie" in r.stdout, r.stdout)
# ---- Expéditeur retrouvé par le test de source (évolution 1.8 du 24/10, « EXPÉDITEUR - ») ----
r, out = run(BASE, [OH], test_mode())
verdict("TEST SOURCE : expéditeur fourni, ligne « expéditeur ; <adresse> ; fourni »", r.returncode == 0 and "<br>expéditeur ; alertes@hiway.example ; fourni" in out["dernier_test"] and "autres expéditeurs vus" not in out["dernier_test"], out["dernier_test"])
TR = {**TS, "adresse": "Missions@Hiway.example", "recherche_expediteur": {"vus": ["missions@hiway.example", "news@hiway.example", "news@hiway.example", "compte@hiway.example"]}}
r, out = run(BASE, [OH], test_mode(src=TR))
verdict("TEST SOURCE : expéditeur retrouvé, ligne « retrouvé » et autres expéditeurs vus sans doublon", r.returncode == 0 and "<br>expéditeur ; missions@hiway.example ; retrouvé<br>autres expéditeurs vus ; news@hiway.example, compte@hiway.example" in out["dernier_test"], out["dernier_test"])
r, out = run(BASE, [], test_mode(src={**TS, "adresse": "", "recherche_expediteur": {"vus": []}}, offres_uniques=0))
verdict("TEST SOURCE : expéditeur introuvable, aucun mail : code 3, cause écrite", r.returncode == 3 and "expéditeur introuvable : aucun mail de « hiway.example » ou « Hiway » sur 7 jours" in out["dernier_test"] and "expéditeur ;" not in out["dernier_test"], str(out))
r, out = run(BASE, [], test_mode(src={**TS, "adresse": "", "recherche_expediteur": {"vus": ["news@hiway.example", "compte@hiway.example"]}}, offres_uniques=0))
verdict("TEST SOURCE : expéditeur introuvable, mails sans offres : code 3, adresses vues listées", r.returncode == 3 and "aucun mail portant des offres parmi 2 expéditeurs vus" in out["dernier_test"] and "autres expéditeurs vus ; news@hiway.example, compte@hiway.example" in out["dernier_test"], str(out))
r, out = run(BASE, [], test_mode(src={**TS, "adresse": ""}, offres_uniques=0))
verdict("TEST SOURCE : expéditeur vide sans recherche : code 3, expéditeur invalide", r.returncode == 3 and "invalide" in out["dernier_test"], str(out))
# ---- Nouveaux en 1.9 ----
r, _ = run({**BASE, "Version du modèle": "3"}, [off(500001)]); verdict("1.10 : modèle 3 refusé (code 2)", r.returncode == 2 and "attendu « 6 », « 5 » ou « 4 »" in r.stdout, r.stdout)
r, _ = run(BASE, [off(500002)]); verdict("1.10 : modèle 6, débrief à écrire, aucun avertissement de modèle", r.returncode == 0 and "DEBRIEF a_ecrire" in r.stdout and "AVERTISSEMENT modèle" not in r.stdout and "OK brique 1.10, modèle 6" in r.stdout, r.stdout)
r, _ = run(M4, [off(500003)]); verdict("1.9 : avertissement du modèle 4 renvoie à la procédure « mettre à jour »", r.returncode == 0 and "procédure « mettre à jour »" in r.stdout and "page des mises à jour" not in r.stdout, r.stdout)
r, _ = run(BASE, [OH], test_mode()); verdict("1.9 : TEST SOURCE sans ligne DEBRIEF", r.returncode == 0 and "DEBRIEF" not in r.stdout, r.stdout)
r, out = run(BASE, [], test_mode(src={**TS, "gabarit": "indeed_xyz"}, offres_uniques=0)); verdict("1.10 : gabarit inconnu cité avec la brique 1.10", r.returncode == 3 and "inconnu de la brique 1.10" in out["dernier_test"], r.stdout)
# ---- Complément 1.9 du 25/10 : fusion dans un même passage, offres relayées comptées en doublons entre plateformes ----
AT = dict(titre="Senior Product Manager - Open Platforms & Firmware H/F", org="Atos")
FA = [off(4473151322, lieu="Paris", **AT), off(4473147558, lieu="Les Clayes-sous-Bois", **AT), off(4473154238, lieu="Paris", **AT), off(4473139800, lieu="Les Clayes-sous-Bois", **AT)]
r, out = run(BASE, FA); c = out["offres_a_creer"] if out else []
verdict("Fusion : 4 offres Atos du même passage donnent une offre, premier identifiant gardé", r.returncode == 0 and len(c) == 1 and c[0]["id"] == "4473151322", r.stdout)
verdict("Fusion : lieux distincts regroupés « Paris ; Les Clayes-sous-Bois »", bool(c) and c[0]["properties"]["Lieu"] == "Paris ; Les Clayes-sous-Bois", str(c))
verdict("Fusion : compteur doublons_passage=3 et retenues=1", "doublons_passage=3 " in r.stdout and "retenues=1" in r.stdout, r.stdout)
verdict("Fusion : ligne FUSION avec les quatre identifiants", "FUSION Senior Product Manager - Open Platforms & Firmware H/F ; Atos ; 4473151322, 4473147558, 4473154238, 4473139800" in r.stdout, r.stdout)
r, out = run(BASE, [off(510001, titre="Product  OWNER", org="Société X"), off(510002, titre="product owner", org="societe x", lieu="Nanterre")])
verdict("Fusion : casse, accents et espaces ignorés", r.returncode == 0 and len(out["offres_a_creer"]) == 1 and out["offres_a_creer"][0]["properties"]["Lieu"] == "Paris ; Nanterre", r.stdout)
r, out = run(BASE, [off(510003, org="Alpha"), off(510004, org="Beta")])
verdict("Fusion : même titre, entreprises différentes : deux offres", r.returncode == 0 and len(out["offres_a_creer"]) == 2 and "doublons_passage=0 " in r.stdout and "FUSION" not in r.stdout, r.stdout)
FW = lambda i: off(f"fw-po-{i}", source="S08", org="", lien=f"https://www.free-work.com/fr/tech-it/job-mission/product-owner/po-{i}")
r, out = run(BASE, [FW(1), FW(2)])
verdict("Fusion : entreprise vide (Free-Work) jamais fusionnée", r.returncode == 0 and len(out["offres_a_creer"]) == 2 and "doublons_passage=0 " in r.stdout, r.stdout)
r, out = run(BASE, [off(510005, lieu="Paris"), off(510006, lieu="paris"), off(510007, lieu="")])
verdict("Fusion : lieu répété ou vide non ajouté", r.returncode == 0 and len(out["offres_a_creer"]) == 1 and out["offres_a_creer"][0]["properties"]["Lieu"] == "Paris", str(out and out["offres_a_creer"]))
r, out = run(BASE, [off(510008, poste="hors_liste"), off(510009, poste="Product Owner")])
verdict("Fusion : faits de la première lue gardés (groupe écarté une seule fois)", r.returncode == 0 and len(out["ecartees"]) == 1 and not out["offres_a_creer"] and "doublons_passage=1 " in r.stdout, r.stdout)
def relais(D, K): D["offres_uniques"], D["doublons_plateformes"] = 10, 4
r, out = run(BASE, [off(520000 + k, titre=f"PO {k}") for k in range(6)], relais)
verdict("Offres Free-Work relayées par LinkedIn comptées en doublons entre plateformes : identité respectée", r.returncode == 0 and "uniques=10 doublons=0 deja_vues=0 doublons_plateformes=4 doublons_passage=0 " in r.stdout, r.stdout)
# ---- Nouveaux en 1.10 : modèle 6, modèle 5 toléré, consigne « Prochain passage » ----
M5 = {**BASE, "Version du modèle": "5"}
r, _ = run(M5, [off(530001)]); verdict("1.10 : modèle 5 toléré, débrief à écrire, avertissement « Prochain passage »", r.returncode == 0 and "DEBRIEF a_ecrire" in r.stdout and "AVERTISSEMENT modèle Notion 5 : pas de ligne « Prochain passage »" in r.stdout, r.stdout)
def consigne(role, val, deb="2026-10-27T11:00:00+01:00"):
    r = subprocess.run([sys.executable, SCRIPT, "--consigne", role, val, deb], capture_output=True, text=True); return r.returncode, r.stdout
T = "2026-10-27T09:50:00+00:00"; DEM = "TEST SOURCE S09 GABARIT generique PLATEFORME Malt PRÉFIXE mlt DOMAINE malt.fr EXPÉDITEUR -"
c, o = consigne("offres", ""); verdict("Consigne : vide, passage normal, rien à effacer", c == 0 and o.strip() == "CONSIGNE mode=normal effacer=non motif=aucune consigne", o)
c, o = consigne("offres", f"{T} ; MODE SANS ÉCRITURE"); verdict("Consigne : mode sans écriture récent, appliqué et effacé", c == 0 and "mode=sans_ecriture effacer=oui" in o, o)
c, o = consigne("offres", f"{T} ; mode sans ecriture"); verdict("Consigne : casse et accents ignorés", c == 0 and "mode=sans_ecriture" in o, o)
c, o = consigne("offres", f"2026-10-27T08:00:00+00:00 ; MODE SANS ÉCRITURE"); verdict("Consigne : plus de 30 minutes, périmée, effacée", c == 0 and "mode=normal effacer=oui motif=consigne périmée (120 min)" in o, o)
c, o = consigne("offres", f"2026-10-27T10:20:00+00:00 ; MODE SANS ÉCRITURE"); verdict("Consigne : datée de plus de 5 minutes après le début, périmée", c == 0 and "mode=normal effacer=oui" in o, o)
c, o = consigne("offres", f"{T} ; {DEM}"); verdict("Consigne : test de source vu par la brique Offres, gardé pour la tâche de test", c == 0 and "mode=normal effacer=non" in o and "DEMANDE" not in o, o)
c, o = consigne("test", f"{T} ; {DEM}"); verdict("Consigne : test de source appliqué, effacé, demande recopiée", c == 0 and "mode=test effacer=oui" in o and o.strip().endswith("DEMANDE " + DEM), o)
c, o = consigne("test", f"{T} ; MODE SANS ÉCRITURE"); verdict("Consigne : mode sans écriture vu par la tâche de test, gardé", c == 0 and "mode=normal effacer=non" in o, o)
c, o = consigne("offres", "n'importe quoi"); verdict("Consigne : illisible, effacée", c == 0 and "mode=normal effacer=oui motif=consigne illisible" in o, o)
c, o = consigne("offres", "2026-10-27T09:50:00 ; MODE SANS ÉCRITURE"); verdict("Consigne : date sans fuseau, illisible", c == 0 and "consigne illisible" in o, o)
c, o = consigne("offres", f"{T} ; ARRÊTE TOUT"); verdict("Consigne : demande inconnue, passage normal, effacée", c == 0 and "mode=normal effacer=oui motif=consigne inconnue" in o, o)
c, o = consigne("offres", f"{T} ; MODE SANS ÉCRITURE", "hier"); verdict("Consigne : debut_iso illisible, erreur", c == 1 and "ERREURS" in o, o)
c, o = consigne("offres", f"{T}<br> ; MODE SANS ÉCRITURE"); verdict("Consigne : balise <br> tolérée", c == 0 and "mode=sans_ecriture" in o, o)
print(f"\n{nb - ko}/{nb} contrôles OK"); sys.exit(1 if ko else 0)
