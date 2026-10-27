#!/usr/bin/env python3
# Contrôle des empreintes de versions.json : chaque fichier listé dans « fichiers » doit avoir l'empreinte sha256 indiquée.
# Usage, à la racine du dépôt : python3 verifier-empreintes.py [versions.json]
# Sortie : une ligne par fichier (OK, DIFFÉRENT ou ABSENT), puis le total ; code de sortie 1 si un fichier n'est pas conforme.
import hashlib, json, os, sys
V = sys.argv[1] if len(sys.argv) > 1 else "versions.json"
racine = os.path.dirname(os.path.abspath(V))
fichiers = json.load(open(V, encoding="utf-8")).get("fichiers", {})
ko = 0
for chemin, attendue in fichiers.items():
    p = os.path.join(racine, chemin)
    if not os.path.isfile(p): print(f"ABSENT     {chemin}"); ko += 1; continue
    obtenue = hashlib.sha256(open(p, "rb").read()).hexdigest()
    if obtenue == attendue: print(f"OK         {chemin}")
    else: print(f"DIFFÉRENT  {chemin} : attendue {attendue[:12]}…, obtenue {obtenue[:12]}…"); ko += 1
print(f"\n{len(fichiers) - ko}/{len(fichiers)} fichiers conformes")
sys.exit(1 if ko else 0)
