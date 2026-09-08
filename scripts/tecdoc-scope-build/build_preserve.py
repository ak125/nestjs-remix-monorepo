#!/usr/bin/env python3
"""Genere audit/massdoc-tecdoc-preservation-manifest-2026-03.json.

Fige les RESULTATS APPLICATIFS produits par la campagne TecDoc de mars 2026.
Meme serialisation canonique que l'artefact de perimetre : cles triees, UTF-8,
separateurs compacts, bloc 'seal' exclu du hachage, aucun horodatage de generation
dans la zone hachee.

Chaque ensemble porte une EMPREINTE calculee cote serveur :
    md5(string_agg(<cle>::text, ',' ORDER BY <cle>))
Rejouer exactement la meme requete apres un nettoyage et comparer l'empreinte
constitue le test AVANT == APRES. Une empreinte differente = ECHEC, STOP.
"""
import hashlib, json, sys

ensembles = [
  {"nom":"auto_type — types crees/remappes par la campagne",
   "table":"public.auto_type","filtre":"type_id_i BETWEEN 60000 AND 83456","cle":"type_id_i",
   "cardinal":23457,"borne_min":60000,"borne_max":83456,
   "empreinte_md5":"8c0370a62481a77810d7b9d6ff3f743b","confidence":"KNOWN"},
  {"nom":"auto_modele — modeles ajoutes",
   "table":"public.auto_modele","filtre":"modele_is_new::text = '1'","cle":"modele_id",
   "cardinal":7088,"borne_min":65,"borne_max":667022,
   "empreinte_md5":"b3a824a363dd655a4543a2dd56b9fa5b","confidence":"KNOWN"},
  {"nom":"pieces — cohorte introduite par la campagne",
   "table":"public.pieces","filtre":"piece_year::text = '2025'","cle":"piece_id",
   "cardinal":119702,"borne_min":12151739,"borne_max":12516015,
   "empreinte_md5":"1dc356832e4282d505fa6c3185c0c503","confidence":"KNOWN"},
  {"nom":"pieces — sous-ensemble affiche de la cohorte",
   "table":"public.pieces","filtre":"piece_year::text = '2025' AND piece_display","cle":"piece_id",
   "cardinal":84033,"borne_min":12151739,"borne_max":12516015,
   "empreinte_md5":"573f3dbb18e6a87306522c7de869a74f","confidence":"KNOWN"},
  {"nom":"pieces_gamme — gammes creees par la campagne (bande reservee)",
   "table":"public.pieces_gamme","filtre":"pg_id >= 60000","cle":"pg_id",
   "cardinal":876,"borne_min":60000,"borne_max":61103,
   "empreinte_md5":"3ff8875e19000315dabe88f23b67317e","confidence":"KNOWN",
   "note":("Provenance etablie par la BANDE D'IDENTIFIANTS, pas par le nom. pieces_gamme n'a "
           "aucune colonne de date. La table se scinde en deux bandes disjointes : 8843 gammes "
           "sous 10000 et 876 de 60000 a 61103, rien entre les deux — meme convention de bande "
           "reservee que auto_type. Seules 18 des 876 portent 'TecDoc' dans leur nom : filtrer "
           "sur le libelle en manquerait 858.")},
  {"nom":"tecdoc_map.type_id_remap — mapping d'identite vehicule (ancien -> nouveau)",
   "table":"tecdoc_map.type_id_remap","filtre":"(aucun)","cle":"old_id||'>'||new_id",
   "cardinal":23457,"borne_min":100001,"borne_max":801701,
   "empreinte_md5":"5dec18e5dc69765d998beda5680b418f","confidence":"KNOWN",
   "note":"Cardinal identique a la plage auto_type 60000-83456 : correspondance 1:1. Sert les 301 en PROD."},
  {"nom":"tecdoc_map.gamme_registry — filiation gamme source -> pg_id",
   "table":"tecdoc_map.gamme_registry","filtre":"pg_id IS NOT NULL","cle":"pg_id_source||'>'||pg_id",
   "cardinal":9702,"borne_min":1,"borne_max":61103,
   "empreinte_md5":"0a2ef785f1b820e7405f375819450a96","confidence":"KNOWN",
   "note":"976 lignes supplementaires en mapping_confidence='low' ont pg_id NULL : gammes source jamais mappees."},
  {"nom":"tecdoc_map.linkage_target_registry — cibles de liaison",
   "table":"tecdoc_map.linkage_target_registry","filtre":"(aucun)","cle":"id",
   "cardinal":43484,"borne_min":5,"borne_max":43488,
   "empreinte_md5":"30c9a6f68a2dbd74020d35c9a146abda","confidence":"KNOWN"},
  {"nom":"tecdoc_map.article_registry — ancrage piece_id <-> ARTNR/DLNR",
   "table":"tecdoc_map.article_registry","filtre":"(aucun)","cle":"rollup source_dlnr:count",
   "cardinal":3240177,"borne_min":None,"borne_max":None,
   "empreinte_md5":"8f1183fcb7aa9c71ac9ac6c485c943b8","confidence":"KNOWN",
   "note":("Empreinte calculee sur le rollup par source_dlnr (229 DLNR distincts), pas sur les "
           "3,24 M identifiants : un string_agg complet batirait une chaine de ~50 Mo cote serveur. "
           "A noter : 229 DLNR ici contre 149 charges dans t400 — ce registre DEBORDE le perimetre "
           "de la campagne de mars 2026.")},
]

cardinalites_relations = [
  {"table":"public.pieces_relation_type","n_live_tup":368304446,"n_dead_tup":31608007,
   "reltuples":367854592,"mesure_exacte":"UNKNOWN","confidence":"INFERRED",
   "note":("Un count exact exigerait un parcours sequentiel de 49 Go (EXPLAIN : Parallel Seq Scan, "
           "cout 6058859). Non lance : hors budget de requete autorise. 31,6 M de tuples morts.")},
  {"table":"public.pieces_relation_criteria","n_live_tup":158120540,"n_dead_tup":1305323,
   "reltuples":158120544,"mesure_exacte":"UNKNOWN","confidence":"INFERRED"},
  {"table":"public.pieces_ref_search","n_live_tup":72879106,"n_dead_tup":312819,
   "reltuples":72796264,"mesure_exacte":"UNKNOWN","confidence":"INFERRED"},
  {"table":"public.pieces_criteria","n_live_tup":17931380,"n_dead_tup":3317288,
   "reltuples":17874924,"mesure_exacte":"UNKNOWN","confidence":"INFERRED"},
  {"table":"public.pieces_ref_oem","n_live_tup":15386354,"n_dead_tup":0,
   "reltuples":15386354,"mesure_exacte":"UNKNOWN","confidence":"INFERRED"},
  {"table":"public.pieces_media_img","n_live_tup":9593115,"n_dead_tup":1821391,
   "reltuples":9576492,"mesure_exacte":"UNKNOWN","confidence":"INFERRED"},
  {"table":"public.pieces","n_live_tup":4131445,"n_dead_tup":9319,
   "reltuples":4131445,"mesure_exacte":4131445,"confidence":"KNOWN"},
  {"table":"public.pieces_gamme","n_live_tup":9719,"n_dead_tup":1,
   "reltuples":9719,"mesure_exacte":9719,"confidence":"KNOWN"},
  {"table":"public.auto_type","n_live_tup":53959,"n_dead_tup":4440,
   "reltuples":53959,"mesure_exacte":53959,"confidence":"KNOWN"},
  {"table":"public.auto_modele","n_live_tup":8150,"n_dead_tup":0,
   "reltuples":8150,"mesure_exacte":8150,"confidence":"KNOWN"},
  {"table":"public.auto_marque","n_live_tup":117,"n_dead_tup":49,
   "reltuples":114,"mesure_exacte":117,"confidence":"KNOWN",
   "note":"reltuples (114) est PERIME : le compte exact est 117. Ne jamais utiliser reltuples comme reference."},
]

hachee = {
  "manifest_version": "2026-03-preservation-v1",
  "objet": ("Resultats applicatifs produits par la campagne TecDoc de mars 2026 qui DOIVENT survivre "
            "intacts a tout retrait ulterieur de staging."),
  "invariant": "AVANT cleanup == APRES cleanup, pour chaque ensemble ci-dessous. Un seul ecart => VERDICT ECHEC, STOP, aucun DROP suivant.",
  "methode_de_controle": {
    "principe": "Rejouer la requete d'empreinte de chaque ensemble et comparer au champ empreinte_md5.",
    "forme_de_la_requete": "SELECT count(*), min(<cle>), max(<cle>), md5(string_agg(<cle>::text, ',' ORDER BY <cle>)) FROM <table> WHERE <filtre>",
    "determinisme": "L'ORDER BY dans string_agg rend l'empreinte independante du plan d'execution et de l'ordre physique des lignes.",
  },
  "tables_intouchables": {
    "projections_applicatives": ["public.auto_marque","public.auto_modele","public.auto_type","public.pieces",
      "public.pieces_gamme","public.pieces_relation_type","public.pieces_relation_criteria","public.pieces_criteria",
      "public.pieces_ref_search","public.pieces_ref_oem","public.pieces_media_img"],
    "registres_tecdoc_primaires": ["tecdoc_map.type_id_remap","tecdoc_map.article_registry","tecdoc_map.linkage_target_registry"],
    "regle": "Ni DROP, ni TRUNCATE, ni DELETE, ni ALTER destructif sur ces tables, en aucune phase du nettoyage.",
  },
  "ensembles_figes": ensembles,
  "cardinalites_relations_finales": cardinalites_relations,
  "lacunes_assumees": [
    "Les identifiants ne sont pas stockes en clair : seule leur empreinte l'est. Si un controle APRES echoue, l'empreinte dit QUE l'ensemble a change, pas QUELS identifiants manquent. Exporter les listes completes avant tout DROP si ce niveau de diagnostic est voulu.",
    "Les cardinalites exactes des 6 grosses tables de relations ne sont pas mesurees : chacune exigerait un parcours sequentiel de plusieurs dizaines de Go. n_live_tup en tient lieu, et c'est une ESTIMATION.",
    "Aucun lien prouve piece -> DLNR d'origine pour la cohorte 2025 : public.pieces ne porte pas de colonne dlnr. Le rapprochement passerait par tecdoc_map.article_registry (source_artnr, source_dlnr, piece_id), non mesure ici.",
  ],
}

canon = json.dumps(hachee, sort_keys=True, ensure_ascii=False, separators=(',', ':'))
sha = hashlib.sha256(canon.encode('utf-8')).hexdigest()
document = dict(hachee)
document["seal"] = {"algorithm":"sha256","sha256":sha,
  "canonicalization":"identique a massdoc-tecdoc-import-scope-2026-03.json : sort_keys, UTF-8, separateurs (',',':'), bloc seal exclu."}

sortie = sys.argv[1] if len(sys.argv) > 1 else 'massdoc-tecdoc-preservation-manifest-2026-03.json'
with open(sortie,'w',encoding='utf-8') as f:
    json.dump(document,f,sort_keys=True,ensure_ascii=False,indent=2); f.write('\n')
print(f"ecrit  : {sortie}")
print(f"sha256 : {sha}")
print(f"ensembles figes : {len(ensembles)} | tables de relations suivies : {len(cardinalites_relations)}")
