#!/usr/bin/env python3
# Brique Offres v1.9 générique : lit offres.json (faits relevés) et config.json (Paramètres et Sources recopiés), applique les critères, écrit notion.json.
# Usage : python3 offres.py offres.json config.json ; avant le dédoublonnage : python3 offres.py --empreintes offres.json config.json (identifiants generique_suivi)
# Évolution : un critère = une fonction c_<nom> + une entrée dans CRITERES + un gabarit à l'étape 5 du prompt ; un gabarit de mail = une entrée dans GABARITS + une section à l'étape 4.
import json, sys, re, unicodedata, hashlib, datetime
from urllib.parse import urlsplit, parse_qsl

VERSION_BRIQUE, MODELE_ATTENDU, MODELE_TOLERE = "1.9", "5", "4"   # modèle N-1 toléré : nouveautés du modèle N sautées, avec avertissement
# v1.9 : script téléchargé depuis le dépôt GitHub (tag figé) ; modèle 5 = modèle 4 + ligne Paramètres « Dernier débrief » ; modèle 4 : débrief non écrit

# ---- Table de correspondance (seul endroit où figurent les noms Notion utilisés par le script) ----
PARAM = {"version": "Version du modèle", "prenom": "Prénom", "postes": "Postes recherchés", "proches": "Postes proches",
         "contrats": "Types de collaboration acceptés", "temps": "Temps de travail", "modes": "Modes de travail acceptés",
         "jours": "Jours de télétravail minimum", "zone": "Zone de présentiel", "plancher": "TJM plancher",
         "ignores": "Expéditeurs ignorés", "detectes": "Expéditeurs détectés", "messagerie": "Messagerie"}
PROP = {"titre": "Titre", "id": "Identifiant", "org": "Entreprise", "plateforme": "Plateforme", "lien": "Lien", "lieu": "Lieu",
        "contrat": "Contrat", "verif": "À vérifier", "date": "Date de détection", "com": "Commentaire", "metier": "Métier",
        "proche": "Métier proche", "tjm": "TJM", "erreur": "Dernière erreur", "retiree": "Retirée le"}
# ---- Catalogue des gabarits de mail (v1.8) : préfixe vide permis, entreprise facultative, poste « inconnu » permis, lien reconstruit, lien de suivi ----
GABARITS = {"linkedin_digest":        {"sans_prefixe": True,  "org_facultative": False, "inconnu": True,  "suivi": False, "lien": lambda i, s: f"https://www.linkedin.com/jobs/view/{i}/"},
            "collective_opportunite": {"sans_prefixe": False, "org_facultative": False, "inconnu": False, "suivi": False, "lien": None},
            "freework_alerte":        {"sans_prefixe": False, "org_facultative": True,  "inconnu": False, "suivi": False, "lien": None},
            "generique":              {"sans_prefixe": False, "org_facultative": True,  "inconnu": False, "suivi": False, "lien": None},
            "generique_suivi":        {"sans_prefixe": False, "org_facultative": True,  "inconnu": False, "suivi": True,  "lien": None}}
TYPES = ["Freelance", "Portage salarial", "CDI", "CDD"]          # types de collaboration paramétrables
EXCLUS = ["Intérim", "Alternance", "Stage"]                     # toujours écartés
MODES = ["présentiel", "hybride", "télétravail total"]
VERIF = {"Poste": "intitulé illisible", "Contrat": "type de collaboration non indiqué", "Lieu": "lieu non indiqué ou hors zone sans mode de travail",
         "Temps de travail": "temps de travail non indiqué", "Télétravail": "télétravail non précisé"}
# ---- Liens de service (v1.8, règle 1) : mot entier dans le domaine et les segments du chemin, premier mot seulement du dernier segment (slug de l'offre) ----
MOTS_SERVICE = ("unsubscribe", "desabonn", "disable", "notification", "alert", "account", "login", "help", "aide", "search", "recherche")
SUFFIXES = ("", "s", "e", "es", "er", "ement", "ements", "ing", "ings")
PARAMS_SERVICE = ("signature", "token")
N_DETECTES, JOURS_DETECTES, LIM_TEXTE = 20, 30, 1900

def norm(s): return " ".join(unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode().lower().split())
def liste(v): return [x.strip() for x in re.split(r"[;,]", str(v or "")) if x.strip()]
def lignes(v): return [x.strip() for x in re.split(r"<br\s*/?>|\n", str(v or "")) if x.strip()]
def domaine(v): return re.sub(r"^(https?://)?(www\.)?", "", str(v or "").strip().lower()).split("/")[0]
def sur_domaine(lien, dom): return bool(dom) and bool(re.match(r"https://([a-z0-9-]+\.)*" + re.escape(dom) + r"(/|$)", str(lien or "")))
def mots(s): return [t for t in re.split(r"[^a-z0-9]+", norm(s)) if t]
def mot_service(t): return next((m for m in MOTS_SERVICE if t.startswith(m) and (t[len(m):] in SUFFIXES or m == "desabonn")), "")
def lien_service(lien):
    try: u = urlsplit(str(lien or "")); hote = u.hostname or ""
    except ValueError: return "adresse illisible"
    for k, _ in parse_qsl(u.query, keep_blank_values=True):
        if k.strip().lower() in PARAMS_SERVICE: return f"paramètre {k.strip().lower()}"
    segs = [x for x in u.path.split("/") if x]
    toks = mots(hote.replace(".", " ")) + [t for x in segs[:-1] for t in mots(x)] + mots(segs[-1])[:1] if segs else mots(hote.replace(".", " "))
    m = next((mot_service(t) for t in toks if mot_service(t)), "")
    return f"mot « {m} »" if m else ""
def empreinte(o): return hashlib.sha256("|".join(norm(o.get(k)) for k in ("titre", "org", "lieu")).encode("utf-8")).hexdigest()[:12]
def jfr(d): return "/".join(reversed(str(d).split("-")))
def propre(s): return " ".join(re.sub(r"<br\s*/?>|;", ",", str(s or "")).split())

ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
D = json.load(open(ARGS[0], encoding="utf-8")); K = json.load(open(ARGS[1], encoding="utf-8"))

# ---- Mode --empreintes (v1.8) : identifiant <préfixe>-<12 caractères de l'empreinte titre, entreprise, lieu> des offres generique_suivi ----
if "--empreintes" in sys.argv:
    G_SRC = {str(s.get("id") or ""): s for s in K.get("sources", [])}; CONNUS = set(str(i) for i in K.get("ids_offres", [])); n = 0
    for o in D.get("offres", []):
        s = G_SRC.get(str(o.get("source")))
        if s and str(s.get("gabarit") or "").strip() == "generique_suivi":
            o["id"] = f'{str(s.get("prefixe") or "").strip().lower()}-{empreinte(o)}'; n += 1
            print(f'EMPREINTE {o["id"]} ; {o.get("titre")} ; {"deja_vue" if o["id"] in CONNUS else "nouvelle"}')
    json.dump(D, open(ARGS[0], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"EMPREINTES calculees={n}"); sys.exit(0)

err, errc, avert, avert_src = [], [], [], []
TEST = bool(K.get("test"))
RAW = {norm(k): v for k, v in K.get("parametres", {}).items()}
def par(cle):
    p = norm(PARAM[cle])
    for k, v in RAW.items():
        if k.startswith(p): return str(v or "").strip()
    return ""
AUJ = str(D.get("date_iso", "")); JFR = jfr(AUJ); HM = str(D.get("debut_iso", ""))[11:16]

# ---- Lecture des réglages (valeur absente ou illisible : critère inactif, avertissement) ----
if par("version") not in (MODELE_ATTENDU, MODELE_TOLERE):
    print(f"MODELE : « {PARAM['version']} » vaut « {par('version')} », attendu « {MODELE_ATTENDU} » ou « {MODELE_TOLERE} » (brique {VERSION_BRIQUE})"); sys.exit(2)
ANCIEN = par("version") == MODELE_TOLERE
if ANCIEN: avert.append(f"modèle Notion {MODELE_TOLERE} : « Dernier débrief » non écrit ; passez au modèle {MODELE_ATTENDU} (procédure « mettre à jour » du dépôt lecteur-offres)")
MESSAGERIES = {"gmail": "Gmail", "outlook": "Outlook", "fastmail": "Fastmail"}
MSG = MESSAGERIES.get(norm(par("messagerie")))
if not MSG: err.append(f"ligne Paramètres « {PARAM['messagerie']} » vide ou inconnue (« {par('messagerie')} ») : Gmail, Outlook ou Fastmail")
R = {}
R["postes"] = {norm(p): p for p in liste(par("postes"))}; R["proches"] = {norm(p): p for p in liste(par("proches"))}
if not R["postes"]: err.append("aucun poste recherché dans Paramètres")
t = set()
for x in liste(par("contrats")):
    n = norm(x); m = "Freelance" if "freelance" in n or "independant" in n else "Portage salarial" if "portage" in n else "CDI" if n == "cdi" else "CDD" if n.startswith("cdd") else None
    if m: t.add(m)
    else: avert.append(f"type de collaboration inconnu ignoré : « {x} »")
if not t: t = set(TYPES); avert.append("types de collaboration absents : les quatre types sont acceptés")
R["contrats"] = t
n = norm(par("temps"))
R["temps"] = "les deux" if not n or ("plein" in n and "partiel" in n) else "partiel" if "partiel" in n else "plein" if "plein" in n else "les deux"
if n and not any(w in n for w in ("plein", "partiel")): avert.append(f"temps de travail illisible (« {par('temps')} ») : critère inactif")
m = set()
for x in liste(par("modes")):
    n = norm(x); m.add("présentiel" if "presentiel" in n else "hybride" if "hybride" in n else "télétravail total" if "teletravail" in n or "remote" in n else "?")
if "?" in m: avert.append("mode de travail inconnu ignoré"); m.discard("?")
R["modes"] = m or set(MODES)
j = par("jours"); R["jours"] = int(j) if re.fullmatch(r"[1-5]", j) else None
if j and R["jours"] is None: avert.append(f"jours de télétravail minimum illisibles (« {j} ») : critère inactif")
R["zone"] = bool(par("zone"))
if not R["zone"]: avert.append("zone de présentiel vide : aucune offre écartée pour son lieu")
p = par("plancher"); R["plancher"] = int(p) if re.fullmatch(r"\d{2,5}", p) else None
if p and R["plancher"] is None: avert.append(f"TJM plancher illisible (« {p} ») : critère inactif")

# ---- Sources mail actives : plateforme, préfixe d'identifiant et domaine des offres lus dans Sources (mode test : la seule source testée) ----
SRC, OPTS = {}, set(K.get("plateformes_offres") or [])
if not OPTS: err.append("plateformes_offres absent de config.json (valeurs de la colonne Offres « Plateforme »)")
for s in K.get("sources", []):
    i, g = str(s.get("id") or ""), str(s.get("gabarit") or "").strip()
    pl, px, dm = str(s.get("plateforme") or "").strip(), str(s.get("prefixe") or "").strip().lower(), domaine(s.get("domaine"))
    s.update(id=i, gabarit=g, plateforme=pl, prefixe=px, domaine=dm, lisible=g in GABARITS and (pl in OPTS or TEST)); SRC[i] = s
    if TEST:
        if not re.fullmatch(r"[A-Za-z0-9_-]{1,20}", i): errc.append(f"identifiant de source « {i} » invalide (1 à 20 lettres, chiffres, tirets)")
        a, rech = str(s.get("adresse") or "").strip(), s.get("recherche_expediteur")   # v1.8 (24/10) : « EXPÉDITEUR - » permis, expéditeur retrouvé par la tâche
        if not a and isinstance(rech, dict):
            nv = len([x for x in rech.get("vus") or [] if str(x).strip()])
            errc.append(f"expéditeur introuvable : aucun mail portant des offres parmi {nv} expéditeurs vus sur 7 jours" if nv else f"expéditeur introuvable : aucun mail de « {dm or '-'} » ou « {pl or '-'} » sur 7 jours")
        elif "@" not in a: errc.append(f"expéditeur « {a} » invalide (adresse attendue)")
        if g not in GABARITS: errc.append(f"gabarit « {g} » inconnu de la brique {VERSION_BRIQUE} (connus : {', '.join(GABARITS)})"); continue
        if pl and pl not in OPTS: avert_src.append(f"plateforme « {pl} » absente des valeurs de la colonne Offres « {PROP['plateforme']} » : à ajouter avant d'activer la source")
    if g not in GABARITS: continue                     # gabarit inconnu : source non lue (étape 4), erreur de lecture attendue
    if not pl: errc.append(f"source {i} : colonne Plateforme vide"); continue
    if px and not re.fullmatch(r"[a-z]{2,6}", px): errc.append(f"source {i} : préfixe d'identifiant « {px} » invalide (2 à 6 lettres minuscules)")
    if not px and not GABARITS[g]["sans_prefixe"]: errc.append(f"source {i} : préfixe d'identifiant obligatoire pour le gabarit {g}")
    if not dm and GABARITS[g]["lien"] is None and not GABARITS[g]["suivi"]: errc.append(f"source {i} : domaine des offres obligatoire pour le gabarit {g}")
PFX = {}
for s in SRC.values():
    if s["lisible"]: PFX.setdefault(s["prefixe"], set()).add(s["plateforme"])
for px, pls in PFX.items():
    if len(pls) > 1: errc.append(f"préfixe d'identifiant « {px or '(vide)'} » partagé par plusieurs plateformes : " + ", ".join(sorted(pls)))
if TEST and len(SRC) != 1: errc.append("mode test : config.json doit contenir une seule source, la source testée")
def lignes_exp(s):
    a, r = str(s.get("adresse") or "").strip().lower(), s.get("recherche_expediteur")
    vus = [] if not isinstance(r, dict) else [x for x in dict.fromkeys(str(v).strip().lower() for v in r.get("vus") or []) if x and x != a]
    return ([f"expéditeur ; {a} ; {'retrouvé' if isinstance(r, dict) else 'fourni'}"] if "@" in a else []) + (["autres expéditeurs vus ; " + ", ".join(vus[:5])] if vus else [])
if TEST and errc:
    s0 = next(iter(SRC.values()), {})
    txt = "<br>".join([f"{JFR} {HM} ; {s0.get('id', '?')} ; {s0.get('gabarit', '?')} ; erreur"] + lignes_exp(s0) + ["erreur : " + propre(e) for e in errc])[:LIM_TEXTE]
    json.dump({"dernier_test": txt}, open("notion.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("TEST_ERREUR :"); [print(" -", e) for e in errc]; sys.exit(3)
err += errc

# ---- Critères : chaque fonction renvoie ("ok" | "ecarte", motif) et ajoute les étiquettes À vérifier dans av ----
def c_poste(o, av):
    p = norm(o.get("poste"))
    if p == "inconnu": av.append("Poste"); return "ok", ""
    if p in R["postes"]: o["_metier"] = R["postes"][p]; return "ok", ""
    if p in R["proches"]: o["_metier"] = PROP["proche"]; return "ok", ""
    return "ecarte", "poste hors des postes recherchés et proches"
def c_contrat(o, av):
    T = set(o.get("contrats") or []); o["_contrats"] = [x for x in TYPES if x in T]
    if T:
        if T & R["contrats"]: return "ok", ""
        return "ecarte", "type de collaboration non accepté (" + ", ".join(sorted(T)) + ")"
    if o.get("unite") in ("an", "mois"):
        if R["contrats"] & {"CDI", "CDD"}: av.append("Contrat"); return "ok", ""
        return "ecarte", "rémunération salariale sans type de collaboration accepté"
    av.append("Contrat"); return "ok", ""
def c_temps(o, av):
    if R["temps"] == "les deux": return "ok", ""
    t = o.get("temps")
    if t is None: av.append("Temps de travail"); return "ok", ""
    return ("ok", "") if t == R["temps"] else ("ecarte", f"temps {t}, accepté : {R['temps']}")
def c_localisation(o, av):
    md, z = o.get("mode"), o.get("zone")
    if md is None:
        if R["zone"] and z != "dans": av.append("Lieu")
        if "présentiel" not in R["modes"] or R["jours"]: av.append("Télétravail")
        return "ok", ""
    if md not in R["modes"]: return "ecarte", f"mode {md} non accepté"
    if md == "télétravail total": return "ok", ""
    if R["zone"]:
        if z == "hors": return "ecarte", "lieu hors de la zone de présentiel"
        if z is None: av.append("Lieu")
    if md == "hybride" and R["jours"]:
        jt = o.get("jours_teletravail")
        if jt is None: av.append("Télétravail")
        elif jt < R["jours"]: return "ecarte", f"{jt} j de télétravail, minimum {R['jours']}"
    return "ok", ""
def c_tjm(o, av):
    if R["plancher"] and o.get("tarif_min") is not None and o.get("unite") == "jour" and o["tarif_max"] < R["plancher"]:
        return "ecarte", f"tarif maximum {o['tarif_max']} € par jour sous le plancher {R['plancher']}"
    return "ok", ""
CRITERES = [("poste", c_poste), ("contrat", c_contrat), ("temps", c_temps), ("localisation", c_localisation), ("tjm", c_tjm)]

# ---- Contrôles de forme des faits relevés ----
ENUM = {"temps": ("plein", "partiel"), "mode": tuple(MODES), "zone": ("dans", "hors")}
O = D.get("offres", []); CONNUS = set(str(i) for i in K.get("ids_offres", []))
if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", AUJ): err.append("date_iso invalide (AAAA-MM-JJ)")
ids = [str(o.get("id")) for o in O]
if len(ids) != len(set(ids)): err.append("identifiants en double : " + ", ".join(sorted({i for i in ids if ids.count(i) > 1})))
for o in O:
    i, s = str(o.get("id")), SRC.get(str(o.get("source")))
    if not s or not s["lisible"]: err.append(f"source « {o.get('source')} » absente des sources mail actives lisibles : " + i); continue
    G = GABARITS[s["gabarit"]]; o["_src"] = s
    if s["prefixe"]:
        if not re.fullmatch(re.escape(s["prefixe"]) + r"-[a-z0-9][a-z0-9-]*", i): err.append(f"identifiant invalide (attendu « {s['prefixe']}-<slug en minuscules> ») : " + i)
    elif not re.fullmatch(r"\d{6,12}", i): err.append("identifiant invalide (nombre de 6 à 12 chiffres) : " + i)
    if i in CONNUS: err.append("offre déjà présente dans la base Offres (à compter dans deja_vues) : " + i)
    if G["lien"]: o["lien"] = o.get("lien") or G["lien"](i, s)
    elif G["suivi"]:
        if i != f"{s['prefixe']}-{empreinte(o)}": err.append("identifiant generique_suivi différent de l'empreinte (lance offres.py --empreintes) : " + i)
        if not re.fullmatch(r"https://\S+", str(o.get("lien") or "")): err.append("lien de suivi absent ou hors https : " + i)
    elif not sur_domaine(o.get("lien"), s["domaine"]): err.append(f"lien absent ou hors du domaine {s['domaine']} : " + i)
    if not G["suivi"]:
        ms = lien_service(o.get("lien"))
        if ms: err.append(f"lien de service ({ms}) : ce n'est pas une offre, retire-la de offres et des compteurs, et range le lien dans liens_ecartes : " + i)
    if s["gabarit"] == "collective_opportunite" and o.get("lien") not in ["https://www.collective.work/jobs/" + l + "/" + i[len(s["prefixe"]) + 1:] for l in ("fr", "en")]: err.append("lien Collective incohérent : " + i)
    if not (o.get("titre") and (o.get("org") or G["org_facultative"])): err.append("titre ou org manquant : " + i)
    if norm(o.get("poste")) == "inconnu" and not G["inconnu"]: err.append("poste « inconnu » réservé aux titres LinkedIn tronqués ou illisibles : " + i)
    if not o.get("poste"): err.append("poste manquant (libellé de la liste, « hors_liste » ou « inconnu ») : " + i)
    bad = [x for x in (o.get("contrats") or []) if x not in TYPES + EXCLUS]
    if bad: err.append(f"contrats invalides {bad} (valeurs : {', '.join(TYPES + EXCLUS)}) : " + i)
    for k, vals in ENUM.items():
        if o.get(k) is not None and o[k] not in vals: err.append(f"{k} invalide « {o[k]} » (valeurs : {', '.join(vals)} ou null) : " + i)
    jt = o.get("jours_teletravail")
    if jt is not None and not (isinstance(jt, int) and 0 <= jt <= 5): err.append("jours_teletravail invalide (entier 0 à 5 ou null) : " + i)
    if o.get("tarif_min") is not None and (o.get("unite") not in ("jour", "mois", "an") or o.get("tarif_max") is None or o["tarif_min"] > o["tarif_max"]): err.append("tarif incohérent : " + i)
n = D.get("deja_vues", 0) + D.get("doublons_plateformes", 0) + len(O)
if D.get("offres_uniques") != n: err.append(f"compteurs : offres_uniques {D.get('offres_uniques')} ≠ déjà vues + doublons plateformes + offres examinées ({n})")
NA = D.get("non_affichees", [])
for x in NA:
    if not (x.get("alerte") and isinstance(x.get("annoncees"), int) and isinstance(x.get("lues"), int) and x["annoncees"] > x["lues"]): err.append("non_affichees : entrée incohérente (alerte, annoncees > lues) : " + str(x.get("alerte")))
LE = D.get("liens_ecartes", [])
if not isinstance(LE, list) or any(not (isinstance(x, dict) and x.get("lien") and x.get("motif")) for x in LE): err.append("liens_ecartes : liste d'objets {lien, motif} attendue"); LE = []
LECT = {m["id"]: (m.get("erreur") or "").strip() for m in D.get("lectures_mail", [])}
for s in SRC.values():
    if s["id"] not in LECT: err.append("source mail active sans compte rendu de lecture : " + s["id"])
    elif s["gabarit"] not in GABARITS and not LECT[s["id"]]: err.append(f"source {s['id']} : gabarit « {s['gabarit']} » inconnu, erreur de lecture attendue")
    elif s["plateforme"] and s["gabarit"] in GABARITS and not s["lisible"] and not LECT[s["id"]]: err.append(f"source {s['id']} : plateforme « {s['plateforme']} » absente des valeurs de la colonne Offres « {PROP['plateforme']} », erreur de lecture attendue")
# ---- Offres retirées (v1.6) : contrôlées à l'étape 5 ter, seulement parmi les candidats listés dans config.json ----
CAND = {str(c.get("id")): c for c in ([] if TEST else K.get("candidats_retrait", []))}
RET = D.get("retrait", {"controlees": [], "retirees": [], "erreurs": []})
for k in ("controlees", "retirees", "erreurs"):
    if not isinstance(RET.get(k), list): err.append(f"retrait.{k} doit être une liste d'identifiants")
if not err:
    for i in RET["controlees"] + RET["erreurs"]:
        if str(i) not in CAND: err.append("retrait : identifiant hors des candidats de config.json : " + str(i))
    for i in RET["retirees"]:
        if str(i) not in [str(x) for x in RET["controlees"]]: err.append("retrait : offre retirée non contrôlée : " + str(i))
    if len(RET["controlees"]) + len(RET["erreurs"]) > 40: err.append("retrait : 40 offres contrôlées au plus par passage")
# ---- Expéditeurs détectés (v1.8, étape 6 ter) : liste cumulée, sans les sources ni les expéditeurs ignorés, 30 jours, 20 au plus ----
DET = D.get("expediteurs_detectes")
if DET is not None and not TEST:
    if not isinstance(DET, list) or any(not (isinstance(x, dict) and "@" in str(x.get("adresse") or "") and isinstance(x.get("mails"), int) and x["mails"] >= 1
                                             and re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(x.get("dernier") or ""))) for x in DET):
        err.append("expediteurs_detectes : liste d'objets {adresse, nom, mails (entier ≥ 1), objet, dernier (AAAA-MM-JJ)} attendue")
if err: print("ERREURS :"); [print(" -", e) for e in err]; sys.exit(1)

# ---- Décision ----
CPT = {c: 0 for c, _ in CRITERES}; N_OFF, ECART, ECART_T = [], [], []
for o in O:
    av, verdict = [], None
    for nom, f in CRITERES:
        r, motif = f(o, av)
        if r == "ecarte": verdict = (nom, motif); break
    if verdict:
        CPT[verdict[0]] += 1; ECART.append(f'{verdict[0]} ; {o["titre"]} ; {o.get("org") or ""} ; {verdict[1]} ; {o["id"]}'); ECART_T.append((o, verdict[1])); continue
    av = [a for a in VERIF if a in av]
    com = ("À vérifier : " + " ; ".join(VERIF[a] for a in av) + ". " if av else "") + str(o.get("pourquoi") or "")
    p = {PROP["titre"]: o["titre"], PROP["id"]: str(o["id"]), PROP["org"]: o.get("org") or "", PROP["plateforme"]: o["_src"]["plateforme"],
         PROP["lien"]: o["lien"], PROP["lieu"]: o.get("lieu") or ("Télétravail total" if o.get("mode") == "télétravail total" else ""),
         PROP["contrat"]: o["_contrats"], PROP["verif"]: av, f"date:{PROP['date']}:start": AUJ, f"date:{PROP['date']}:is_datetime": 0, PROP["com"]: com.strip()[:1900]}
    if o.get("_metier"): p[PROP["metier"]] = o["_metier"]
    if o.get("tarif_min") is not None and o.get("unite") == "jour": p[PROP["tjm"]] = round((o["tarif_min"] + o["tarif_max"]) / 2)
    N_OFF.append({"id": str(o["id"]), "properties": p})
N_SRC = []
for s in SRC.values():
    avant, e = (s.get("erreur") or "").strip(), LECT[s["id"]]
    if e and not avant: N_SRC.append({"page": s["page"], "id": s["id"], "properties": {PROP["erreur"]: f"{JFR} : {e}"}})
    elif avant and not e: N_SRC.append({"page": s["page"], "id": s["id"], "properties": {PROP["erreur"]: ""}})
PARAM_NA = "<br>".join(f'{JFR} ; {x["alerte"]} ; {x["annoncees"]} annoncées, {x["lues"]} lues ; {x.get("lien") or "lien non relevé"}' for x in NA)
N_RET = [{"page": CAND[str(i)]["page"], "id": str(i), "properties": {f"date:{PROP['retiree']}:start": AUJ, f"date:{PROP['retiree']}:is_datetime": 0}} for i in RET["retirees"]]

TXT_DET, NOUV, N_RETIRES = None, [], 0
if DET is not None and not TEST:
    anciens = {}
    for l in lignes(par("detectes")):
        f = [x.strip() for x in l.split(" ; ")]
        if len(f) >= 4 and "@" in f[0]:
            mm, dd = re.match(r"(\d+)", f[2]), re.search(r"(\d{2})/(\d{2})/(\d{4})", f[3])
            anciens[f[0].lower()] = {"adresse": f[0].lower(), "nom": f[1], "mails": int(mm.group(1)) if mm else 1,
                                     "dernier": f"{dd.group(3)}-{dd.group(2)}-{dd.group(1)}" if dd else AUJ, "objet": " ; ".join(f[4:])}
    det = {k: dict(v) for k, v in anciens.items()}
    for x in DET:
        a = str(x["adresse"]).strip().lower(); e = det.get(a)
        if e: e.update(mails=e["mails"] + x["mails"], dernier=max(e["dernier"], x["dernier"]), nom=x.get("nom") or e["nom"], objet=x.get("objet") or e["objet"])
        else: det[a] = {"adresse": a, "nom": x.get("nom") or "", "mails": x["mails"], "dernier": x["dernier"], "objet": x.get("objet") or ""}
    IGN = [re.sub(r"^@", "", norm(e).replace(" ", "")) for e in re.split(r"[;,\n]|<br\s*/?>", par("ignores")) if e.strip()]
    ADR = {str(a or "").strip().lower() for a in K.get("adresses_sources", [])} | {str(s.get("adresse") or "").strip().lower() for s in SRC.values()}
    def ignore(a): return any(a == e or a.endswith("@" + e) or a.endswith("." + e) for e in IGN)
    lim = (datetime.date.fromisoformat(AUJ) - datetime.timedelta(days=JOURS_DETECTES)).isoformat()
    garde = sorted((e for a, e in det.items() if not ignore(a) and a not in ADR and e["dernier"] >= lim), key=lambda e: (e["dernier"], e["adresse"]), reverse=True)[:N_DETECTES]
    TXT_DET = "<br>".join(f'{e["adresse"]} ; {propre(e["nom"])} ; {e["mails"]} mails ; dernier {jfr(e["dernier"])} ; {propre(e["objet"])[:120]}' for e in garde)
    NOUV = [e for e in garde if e["adresse"] not in anciens]; N_RETIRES = len(anciens) - (len(garde) - len(NOUV))

TXT_TEST = None
if TEST:
    s0 = next(iter(SRC.values()))
    res = "concluant" if N_OFF or ECART else "aucune offre"
    L = [f"{JFR} {HM} ; {s0['id']} ; {s0['gabarit']} ; {res}" + (" ; suggestion : generique_suivi" if not O and s0["gabarit"] == "generique" and D.get("suivi_detecte") else ""),
         f"mails={D.get('mails_lus', 0)} offres={len(O)} gardées={len(N_OFF)} écartées={len(ECART)} déjà vues={D.get('deja_vues', 0)} liens écartés={len(LE)}"]
    L += lignes_exp(s0) + ["attention : " + propre(a) for a in avert_src]
    L += [f'offre ; {propre(x["properties"][PROP["titre"]])} ; {propre(x["properties"][PROP["org"]])} ; gardée ; {x["properties"][PROP["lien"]]}' for x in N_OFF]
    L += [f'offre ; {propre(o["titre"])} ; {propre(o.get("org"))} ; écartée : {propre(mo)} ; {o["lien"]}' for o, mo in ECART_T]
    L += [f'lien écarté ; {propre(x["motif"])} ; {x["lien"]}' for x in LE]
    TXT_TEST = ""
    for k, l in enumerate(L):
        cand = (TXT_TEST + "<br>" if TXT_TEST else "") + l
        if len(cand) > LIM_TEXTE - 20: TXT_TEST += f"<br>… ({len(L) - k} lignes tronquées)"; break
        TXT_TEST = cand
    json.dump({"dernier_test": TXT_TEST, "ecartees": ECART}, open("notion.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
else:
    json.dump({"offres_a_creer": N_OFF, "sources_a_maj": N_SRC, "non_affichees": PARAM_NA, "ecartees": ECART, "retirees_a_maj": N_RET, "expediteurs_detectes": TXT_DET},
              open("notion.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"OK brique {VERSION_BRIQUE}, modèle {par('version')}, prénom « {par('prenom')} »" + (" ; TEST SOURCE" if TEST else ""))
print("REGLAGES " + " ; ".join([f"contrats={'/'.join(x for x in TYPES if x in R['contrats'])}", f"temps={R['temps']}", f"modes={'/'.join(x for x in MODES if x in R['modes'])}",
      f"jours_min={R['jours'] or '-'}", f"zone={'oui' if R['zone'] else 'non'}", f"plancher={R['plancher'] or '-'}", f"messagerie={MSG}"]))
print("SOURCES " + " ; ".join(f"{s['id']}={s['plateforme'] or '?'}/{s['gabarit'] or '?'}/{s['prefixe'] or '-'}/{s['domaine'] or '-'}" for s in SRC.values()))
for a in avert + avert_src: print("AVERTISSEMENT", a)
print(f'COMPTEURS mails={D.get("mails_lus", 0)} uniques={D["offres_uniques"]} doublons={D.get("doublons", 0)} deja_vues={D.get("deja_vues", 0)} doublons_plateformes={D.get("doublons_plateformes", 0)} '
      + " ".join(f"ecartees_{c}={v}" for c, v in CPT.items()) + f" retenues={len(N_OFF)}")
print("A_VERIFIER " + " ".join(f"{a.replace(' ', '_')}={sum(a in x['properties'][PROP['verif']] for x in N_OFF)}" for a in VERIF))
if TEST:
    print(f"TEST liens_ecartes={len(LE)} longueur_resultat={len(TXT_TEST)}")
    print("NOTION test : seule écriture, la Valeur de « Dernier test de source » (dernier_test de notion.json)")
else:
    print(f"RETRAITS candidats={len(CAND)} controlees={len(RET['controlees'])} retirees={len(N_RET)} erreurs={len(RET['erreurs'])}")
    print("DETECTES " + ("non_lus" if TXT_DET is None else f"nouveaux={len(NOUV)} total={len(lignes(TXT_DET))} retires={N_RETIRES}"))
    for e in NOUV[:5]: print(f'DETECTE {e["adresse"]} ; {propre(e["nom"])} ; {e["mails"]} mails ; {propre(e["objet"])[:120]}')
    print("DEBRIEF " + (f"non_ecrit (modèle {MODELE_TOLERE})" if ANCIEN else "a_ecrire (ligne « Dernier débrief »)"))
    print(f"NOTION offres_a_creer={len(N_OFF)} retirees_a_maj={len(N_RET)} sources_a_maj={len(N_SRC)} erreurs_sources={sum(1 for v in LECT.values() if v)} alertes_tronquees={len(NA)} offres_non_affichees={sum(x['annoncees'] - x['lues'] for x in NA)} detectes_a_ecrire={'non' if TXT_DET is None else 'oui'}")
