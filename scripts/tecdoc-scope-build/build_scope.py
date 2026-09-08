#!/usr/bin/env python3
"""Genere audit/massdoc-tecdoc-import-scope-2026-03.json — perimetre historique fige.

Serialisation canonique (documentee dans l'artefact lui-meme) :
  - JSON UTF-8, ensure_ascii=False
  - cles triees (sort_keys=True) a tous les niveaux
  - separateurs compacts (',', ':') pour eliminer toute variation d'espacement
  - fin de ligne \n unique
  - le bloc "seal" est EXCLU du hachage ; aucun timestamp de generation
    n'entre dans la zone hachee.
"""
import hashlib, json, sys

def charger(nom):
    with open(nom, encoding='utf-8') as f:
        return json.load(f)

sup = charger('suppliers.json')       # dlnr -> [pm_id, pm_name, pm_display]
t400 = charger('t400_counts.json')    # dlnr -> lignes
t232 = charger('t232_counts.json')    # dlnr -> lignes
sl   = charger('sl_counts.json')      # dlnr -> liaisons (110 seulement)
crc  = charger('archive_crc.json')    # dlnr -> {'400':{...}, '232':{...}}
meta = charger('metas.json')          # dlnr -> {rows_parsed, rows_emitted, rows_rejected, duration_ms}

assert set(sup) == set(t400) == set(t232), "cles divergentes"
assert set(sl) <= set(t400), "source_linkages hors perimetre t400"

fournisseurs = []
for d in sorted(sup, key=int):
    pm_id, pm_name, pm_display = sup[d]
    projete = d in sl
    preuves = [
        "archive:SQL-CONVERTED.7z",
        "db:tecdoc_raw.t400",
        "db:tecdoc_raw.t232",
        "db:tecdoc_map.supplier_registry",
        "db:public.__tecdoc_supplier_mapping",
    ]
    if projete:
        preuves.append("db:tecdoc_map.source_linkages")
    if d in meta:
        preuves.append("fs:workdir/400.%04d.meta" % int(d))
    fournisseurs.append({
        "dlnr": int(d),
        "pm_id": pm_id,
        "supplier_name": pm_name,
        "pm_display_actuel": pm_display,
        "source_files_attendus": [
            {"table": "400", "name": f"400.{int(d):04d}.sql"},
            {"table": "232", "name": f"232.{int(d):04d}.sql"},
        ],
        "source_files_retrouves": [
            {"table": t, "name": crc[d][t]["name"], "size": crc[d][t]["size"],
             "crc32": crc[d][t]["crc32"], "modified_dans_archive": crc[d][t]["modified"]}
            for t in ("400", "232") if d in crc and t in crc[d]
        ],
        "source_disponible": ("OUI" if d in crc and {"400", "232"} <= set(crc[d])
                              else ("PARTIEL" if d in crc and crc[d] else "NON")),
        "checksums": {"algorithme": "crc32 (index 7z de l'archive source)",
                      "400": crc.get(d, {}).get("400", {}).get("crc32"),
                      "232": crc.get(d, {}).get("232", {}).get("crc32")},
        "parseur_meta": (
            {"rows_parsed": meta[d]["rows_parsed"], "rows_emitted": meta[d]["rows_emitted"],
             "rows_rejected": meta[d]["rows_rejected"], "duration_ms": meta[d]["duration_ms"],
             "concorde_avec_t400": meta[d]["rows_emitted"] == t400[d]}
            if d in meta else None),
        "t400_rows": t400[d],
        "t232_rows": t232[d],
        "batch_id": None,
        "first_loaded_at": None,
        "last_loaded_at": None,
        "source_linkages_rows": sl.get(d),
        "relations_finales_projetees": "UNKNOWN",
        "projete_en_mars_2026": projete,
        "confidence": "KNOWN",
        "evidence": sorted(preuves),
    })

hachee = {
    "scope_version": "2026-03-reconstructed-v2",
    "campagne": "TecDoc mars 2026 (MassDoc)",
    "methode": {
        "principe": ("Le perimetre est reconstruit depuis l'etat des tables de staging et des "
                     "registres d'identite, JAMAIS depuis la configuration fournisseur vivante. "
                     "public.__tecdoc_supplier_mapping et la vue tecdoc_map.v_projection_scope_suppliers "
                     "sont utilisees en COMPARAISON uniquement."),
        "regle_nommage_shard": ("<table>.<dlnr sur 4 chiffres>.sql — prouvee sur 149/149 DLNR pour t400 "
                                "et 811/811 pour t232 via _source_filename, pas inferee d'un echantillon."),
        "identification_dlnr_t400": ("tecdoc_raw.t400.col_2 EST le DLNR : pour les 149 valeurs distinctes, "
                                     "_source_filename vaut exactement '400.'||lpad(col_2,4,'0')||'.sql'."),
        "regle_de_projection_reconstituee": (
            "Un DLNR a ete projete en mars 2026 si et seulement si (a) un shard 400 existait et a ete "
            "charge dans t400, ET (b) sa marque portait pieces_marque.pm_display='1' a cette date. "
            "Verifie : les 39 DLNR charges sans aucune source_linkage ont tous pm_display dans {0,2,5}, "
            "jamais 1."),
    },
    "sources_de_preuve": [
        {"source": "tecdoc_raw.t400", "prouve": "quels DLNR ont ete charges et en quel volume exact",
         "ne_prouve_pas": "quand (colonnes _loaded_at et _batch_id NULL a 100%)", "confiance": "KNOWN"},
        {"source": "tecdoc_raw.t232", "prouve": "quels DLNR avaient un shard images/documents charge",
         "ne_prouve_pas": "quand (memes colonnes NULL a 100%)", "confiance": "KNOWN"},
        {"source": "tecdoc_map.source_linkages", "prouve": "quels DLNR ont reellement produit des liaisons, et la fenetre temporelle via created_at",
         "ne_prouve_pas": "le lot d'import (batch_id NULL)", "confiance": "KNOWN"},
        {"source": "tecdoc_map.supplier_registry", "prouve": "le mapping dlnr -> pm_id fige au 2026-03-18 18:15:43",
         "ne_prouve_pas": "le nom fournisseur (source_hernr NULL partout)", "confiance": "KNOWN"},
        {"source": "public.__tecdoc_supplier_mapping", "prouve": "le mapping charge le 2026-03-16 01:22:38, 0 override manuel",
         "ne_prouve_pas": "l'etat de pm_display a cette date — seul l'etat COURANT est lisible", "confiance": "KNOWN"},
        {"source": "tecdoc_map.gamme_registry", "prouve": "la filiation gamme source -> pg_id, figee au 2026-03-18 18:16:07",
         "ne_prouve_pas": "quelles gammes ont ete CREEES (aucune date dans pieces_gamme)", "confiance": "KNOWN"},
        {"source": "tecdoc_map.sync_batch", "prouve": "rien — table VIDE (0 ligne)",
         "ne_prouve_pas": "le journal d'import prevu n'a jamais ete alimente", "confiance": "KNOWN"},
        {"source": "fs:/opt/automecanik/data/tecdoc/workdir/*.meta", "prouve": "les volumes reellement emis par le parseur pour 66 shards",
         "ne_prouve_pas": "la date de chargement en base ; le mtime date le parse", "confiance": "KNOWN"},
        {"source": "tecdoc_map.activation_log", "prouve": "413 activations les 2026-03-24 et 03-25, 57376 gammes activees",
         "ne_prouve_pas": "le perimetre fournisseur — la colonne dlnr est NULL sur les 413 lignes", "confiance": "KNOWN"},
        {"source": "archive SQL-CONVERTED.7z", "prouve": "la disponibilite et le CRC32 des 298 shards du perimetre (149 x 400 + 149 x 232)",
         "ne_prouve_pas": "lequel a ete effectivement charge — la date interne est uniformement 2025-05-19", "confiance": "KNOWN"},
    ],
    "chronologie": [
        {"horodatage": "2026-03-16T01:22:38.384829Z", "evenement": "chargement de public.__tecdoc_supplier_mapping (846 lignes, 0 override manuel)", "preuve": "loaded_at", "confidence": "KNOWN"},
        {"horodatage": "2026-03-18T18:15:43.559061Z", "evenement": "peuplement de tecdoc_map.supplier_registry (836 fournisseurs)", "preuve": "created_at", "confidence": "KNOWN"},
        {"horodatage": "2026-03-18T18:16:07.072705Z", "evenement": "peuplement de tecdoc_map.gamme_registry (10678 lignes, 9702 mappees)", "preuve": "created_at", "confidence": "KNOWN"},
        {"horodatage": "2026-03-19T01:55:31.778107Z", "evenement": "premiere source_linkage creee", "preuve": "created_at du min(source_linkage_id)", "confidence": "KNOWN"},
        {"horodatage": "2026-03-24/2026-03-25", "evenement": "vague 1 d'activation : 413 entrees, 57376 gammes activees, 0 rejet", "preuve": "activation_log.created_at", "confidence": "KNOWN"},
        {"horodatage": "2026-03-26T17:42:09.975226Z", "evenement": "derniere source_linkage creee", "preuve": "created_at du max(source_linkage_id)", "confidence": "KNOWN"},
        {"horodatage": "2026-03-26T12:45:32.110839Z", "evenement": "dernier autoanalyze de source_linkages — table figee depuis", "preuve": "pg_stat_all_tables", "confidence": "KNOWN"},
        {"horodatage": "2025-05-19", "evenement": "constitution de l'archive SQL-CONVERTED.7z (date interne uniforme des 20934 entrees)", "preuve": "index 7z", "confidence": "KNOWN"},
        {"horodatage": "2026-03-16T00:15Z / 01:08Z", "evenement": "generation des filelists pour les tables 100/200/207/209 — AUCUNE filelist pour 400 ni 232", "preuve": "mtime de /opt/automecanik/data/tecdoc/filelists/*.txt", "confidence": "INFERRED"},
        {"horodatage": "2026-03-19T00:39:58 / 01:33:20", "evenement": "deux premiers parses de shards 400", "preuve": "mtime des .meta", "confidence": "INFERRED"},
        {"horodatage": "2026-03-23T05:30-05:35", "evenement": "parses des fichiers monolithiques de extract/ (012, 140, 143, ...)", "preuve": "mtime des .parse.log", "confidence": "INFERRED"},
        {"horodatage": "2026-03-23T17:23-23:25", "evenement": "gros des parses de shards 400 (64 fichiers, dont 60 entre 23:21 et 23:25)", "preuve": "mtime des .meta", "confidence": "INFERRED"},
        {"horodatage": "UNKNOWN", "evenement": "chargement effectif des shards dans t400 et t232", "preuve": "aucune — _loaded_at NULL a 100%. Les mtime ci-dessus datent le PARSE, pas le COPY en base.", "confidence": "UNKNOWN"},
    ],
    "cardinaux": {
        "fournisseurs_enregistres_supplier_registry": 836,
        "mapping_supplier_lignes": 846,
        "dlnr_charges_t400": len(t400),
        "dlnr_charges_t232_total_table": 811,
        "dlnr_projetes_mars_2026": len(sl),
        "dlnr_scope_courant_vue": 109,
        "t400_lignes_total": sum(t400.values()),
        "t232_lignes_total_table": 14498915,
        "source_linkages_lignes_total": sum(sl.values()),
    },
    "anomalies": {
        "dlnr_dans_t400_sans_liaison": {
            "nombre": len(set(t400) - set(sl)),
            "lignes_t400_concernees": sum(t400[d] for d in t400 if d not in sl),
            "cause_etablie": "pieces_marque.pm_display != '1' pour les 39 — aucun n'a la valeur 1",
            "dlnr": sorted((int(d) for d in set(t400) - set(sl))),
        },
        "dlnr_avec_liaison_sans_t400": {"nombre": 0, "dlnr": []},
        "dlnr_scope_courant_jamais_charge": {
            "nombre": 1,
            "dlnr": [4836],
            "detail": "VDO pm_id=10330, pm_display='1' : present dans le mapping depuis 2026-03-16 mais aucun shard 400.4836.sql charge.",
        },
        "dlnr_projetes_en_mars_hors_scope_courant": {
            "nombre": 2,
            "dlnr": [253, 6358],
            "detail": ("DIEDERICHS (pm_display passe a '5') et RIDEX (pm_display passe a '0'). "
                       "Un rejeu pilote par la configuration vivante perdrait "
                       "4763696 liaisons et 4778677 lignes t400."),
        },
    },
    "archive_source": {
        "nom": "SQL-CONVERTED.7z",
        "chemins": ["/opt/automecanik/app/.github/SQL-CONVERTED.7z",
                    "/opt/automecanik/app/.archive/docs/SQL-CONVERTED.7z"],
        "copies_identiques": True,
        "taille_octets": 6128758380,
        "md5": "95df97edfbf882eab664aa8fcc839bf4",
        "sha256": "1c81ba483883a32898192be6364ff1e65a9528169c68ed6d8cea54f3b6e08e8b",
        "entrees_totales": 20934,
        "date_interne_uniforme": "2025-05-19",
        "shards_400_disponibles": 1198,
        "shards_232_disponibles": 1222,
        "shards_400_utilises_par_la_campagne": 149,
        "shards_400_jamais_charges": 1049,
        "couverture_du_perimetre": "149/149 DLNR ont leur shard 400 ET leur shard 232 dans l'archive. Aucun manquant.",
        "confidence": "KNOWN",
    },
    "preuves_parseur_sur_disque": {
        "repertoire": "/opt/automecanik/data/tecdoc/workdir",
        "fichiers_meta_400_retrouves": 66,
        "concordent_avec_t400": 61,
        "divergent_de_t400": 5,
        "rejets_declares": 0,
        "divergences": [
            {"dlnr": 123, "supplier": "NISSENS", "rows_emitted": 790974, "t400_rows": 100, "perte_pct": 99.99},
            {"dlnr": 30, "supplier": "BOSCH", "rows_emitted": 9357752, "t400_rows": 69000, "perte_pct": 99.26},
            {"dlnr": 101, "supplier": "FEBI", "rows_emitted": 17421432, "t400_rows": 2558500, "perte_pct": 85.31},
            {"dlnr": 6358, "supplier": "RIDEX", "rows_emitted": 5662767, "t400_rows": 2323000, "perte_pct": 58.98},
            {"dlnr": 113, "supplier": "PAYEN", "rows_emitted": 1259429, "t400_rows": 1085500, "perte_pct": 13.81},
        ],
        "interpretation": ("rows_rejected vaut 0 sur les 66 fichiers : le parseur n'a rien rejete. "
                           "Les 5 ecarts se sont donc produits AU CHARGEMENT, pas au parsing. "
                           "tecdoc_raw.t400 n'est pas une copie fidele de la source pour ces 5 fournisseurs."),
        "confidence": "KNOWN",
    },
    "suppliers": fournisseurs,
}

canon = json.dumps(hachee, sort_keys=True, ensure_ascii=False, separators=(',', ':'))
sha = hashlib.sha256(canon.encode('utf-8')).hexdigest()

document = dict(hachee)
document["seal"] = {
    "algorithm": "sha256",
    "sha256": sha,
    "canonicalization": ("json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(',',':')) "
                         "encode en UTF-8 ; le bloc 'seal' est retire avant hachage ; aucun horodatage "
                         "de generation n'entre dans la zone hachee, le hash est donc reproductible."),
    "verification": "python3 -c \"import json,hashlib;d=json.load(open(F));s=d.pop('seal');print(hashlib.sha256(json.dumps(d,sort_keys=True,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()==s['sha256'])\"",
}

sortie = sys.argv[1] if len(sys.argv) > 1 else 'massdoc-tecdoc-import-scope-2026-03.json'
with open(sortie, 'w', encoding='utf-8') as f:
    json.dump(document, f, sort_keys=True, ensure_ascii=False, indent=2)
    f.write('\n')
print(f"ecrit  : {sortie}")
print(f"sha256 : {sha}")
print(f"fournisseurs : {len(fournisseurs)}")
