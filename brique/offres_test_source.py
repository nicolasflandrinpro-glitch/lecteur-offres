# Brique Offres v1.12 : code propre au test de source, importé par offres.py quand config.json porte "test": true (tâche « Brique Offres : test de source »).
import json, re, sys

def source(G, s, i, g, pl, dm):
    errc, avert_src, GABARITS, OPTS, PROP, VERSION_BRIQUE = G["errc"], G["avert_src"], G["GABARITS"], G["OPTS"], G["PROP"], G["VERSION_BRIQUE"]
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,20}", i): errc.append(f"identifiant de source « {i} » invalide (1 à 20 lettres, chiffres, tirets)")
    a, rech = str(s.get("adresse") or "").strip(), s.get("recherche_expediteur")
    if not a and isinstance(rech, dict):
        nv = len([x for x in rech.get("vus") or [] if str(x).strip()])
        errc.append(f"expéditeur introuvable : aucun mail portant des offres parmi {nv} expéditeurs vus sur 7 jours" if nv else f"expéditeur introuvable : aucun mail de « {dm or '-'} » ou « {pl or '-'} » sur 7 jours")
    elif "@" not in a: errc.append(f"expéditeur « {a} » invalide (adresse attendue)")
    if g not in GABARITS: errc.append(f"gabarit « {g} » inconnu de la brique {VERSION_BRIQUE} (connus : {', '.join(GABARITS)})"); return False
    if pl and pl not in OPTS: avert_src.append(f"plateforme « {pl} » absente des valeurs de la colonne Offres « {PROP['plateforme']} » : à ajouter avant d'activer la source")
    return True

def erreur(G):
    SRC, JFR, HM, lignes_exp, propre, errc, LIM_TEXTE = G["SRC"], G["JFR"], G["HM"], G["lignes_exp"], G["propre"], G["errc"], G["LIM_TEXTE"]
    s0 = next(iter(SRC.values()), {})
    txt = "<br>".join([f"{JFR} {HM} ; {s0.get('id', '?')} ; {s0.get('gabarit', '?')} ; erreur"] + lignes_exp(s0) + ["erreur : " + propre(e) for e in errc])[:LIM_TEXTE]
    json.dump({"dernier_test": txt}, open("notion.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("TEST_ERREUR :"); [print(" -", e) for e in errc]; sys.exit(3)

def resultat(G):
    SRC, N_OFF, ECART, ECART_T, O, D, LE, JFR, HM, lignes_exp, propre, avert_src, PROP, LIM_TEXTE = G["SRC"], G["N_OFF"], G["ECART"], G["ECART_T"], G["O"], G["D"], G["LE"], G["JFR"], G["HM"], G["lignes_exp"], G["propre"], G["avert_src"], G["PROP"], G["LIM_TEXTE"]
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
    return TXT_TEST

def sortie(G):
    out, LE, TXT_TEST = G["out"], G["LE"], G["TXT_TEST"]
    out(f"TEST liens_ecartes={len(LE)} longueur_resultat={len(TXT_TEST)}")
    out("NOTION test : seule écriture, la Valeur de « Dernier test de source » (dernier_test de notion.json)")

def debrief(G):
    SRC, VERSION_BRIQUE, par, CONS, OUT, lignes, TXT_TEST = G["SRC"], G["VERSION_BRIQUE"], G["par"], G["CONS"], G["OUT"], G["lignes"], G["TXT_TEST"]
    s0 = next(iter(SRC.values()))
    DEB = [f"Brique Offres {VERSION_BRIQUE} ({par('prenom')}) : test de la source {s0['id']} ({s0['gabarit']})", CONS] + [l for l in OUT if l.split(" ")[0] in ("SOURCES", "COMPTEURS", "TEST", "AVERTISSEMENT")] + lignes(TXT_TEST)
    return DEB
