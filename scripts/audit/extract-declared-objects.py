#!/usr/bin/env python3
"""Extrait les objets que CHAQUE migration déclare créer, et émet la requête
catalogue qui vérifie leur existence.

Pourquoi : `infra.schema_migrations` dit qu'une migration est `applied`. Sur ce
projet, 270 des 300 lignes `applied` sont des **baselines** (`--baseline` : la
migration est marquée appliquée SANS être exécutée, parce qu'on suppose que
l'objet est déjà là par un autre canal). Rien n'a jamais vérifié cette
supposition. Le 2026-09-07, l'échantillon a trouvé 24 relations, 10 fonctions,
3 types et 1 valeur d'enum déclarés par des migrations `applied` et absents de
TOUS les schémas — dont 10 relations lues par du code applicatif.

Ce script ne se connecte PAS à la base : il produit le SQL de vérification, à
exécuter en lecture seule. Séparer l'extraction (déterministe, testable hors
ligne) de la vérification (qui a besoin d'un accès) garde l'outil rejouable.

    python3 scripts/audit/extract-declared-objects.py /tmp/declared.json

Limites assumées : analyse par expressions régulières, pas un parseur SQL. Elle
sur-détecte (fragments de `CREATE TABLE IF NOT EXISTS` mal découpés) et
sous-détecte (DDL construit dynamiquement dans un DO $$). Les partitions datées
sont écartées. C'est un instrument de dépistage, pas une preuve : chaque absence
signalée se confirme au catalogue avant toute conclusion.
"""
import re, json, pathlib, sys
D = pathlib.Path("backend/supabase/migrations")
pats = {
 "table": re.compile(r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_.\"]+)", re.I),
 "view":  re.compile(r"CREATE\s+(?:OR\s+REPLACE\s+)?(?:MATERIALIZED\s+)?VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_.\"]+)", re.I),
 "function": re.compile(r"CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([a-zA-Z0-9_.\"]+)\s*\(", re.I),
 "type": re.compile(r"CREATE\s+TYPE\s+([a-zA-Z0-9_.\"]+)", re.I),
 "enumvalue": re.compile(r"ALTER\s+TYPE\s+([a-zA-Z0-9_.\"]+)\s+ADD\s+VALUE\s+(?:IF\s+NOT\s+EXISTS\s+)?'([^']+)'", re.I),
}
out = {}
for f in sorted(D.glob("*.sql")):
    if f.name.endswith(".down.sql"): continue
    txt = f.read_text(encoding="utf-8", errors="replace")
    # retirer les commentaires ligne pour éviter les faux positifs
    body = "\n".join(l.split("--")[0] for l in txt.splitlines())
    decl = []
    for kind, rx in pats.items():
        for m in rx.finditer(body):
            if kind == "enumvalue":
                decl.append([kind, m.group(1).strip('"').lower(), m.group(2)])
            else:
                n = m.group(1).strip('"').lower()
                if n.startswith("__seo_crux_field_history_2026"): continue  # partitions datées
                decl.append([kind, n, None])
    if decl: out[f.stem] = decl
json.dump(out, open(sys.argv[1], "w"), indent=0)
print(f"  {len(out)} migrations déclarent {sum(len(v) for v in out.values())} objets")
