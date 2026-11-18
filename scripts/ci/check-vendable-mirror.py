#!/usr/bin/env python3
"""Miroir « vendable » (décision 118), côté SQL — et preuve de la migration.

Pourquoi : la définition de « vendable » existe deux fois, par nécessité — dans
l'application (backend/src/database/services/vendable.ts, estVendable) et dans
la base (public.est_vendable). Rien ne les tenait identiques. Les deux lisent
désormais le même échantillon, backend/src/database/services/
vendable.echantillon.json : vendable.miroir.test.ts côté application, ce script
côté base. Un écart avec `attendu`, d'un côté ou de l'autre, fait échouer la CI.

Ce que le script fait jouer à PostgreSQL, sur une base créée pour lui puis
supprimée :
  1. la migration, deux fois de suite (rejouable) ;
  2. public.est_vendable sur chaque cas de l'échantillon ;
  3. public.piece_est_vendable et public.get_sitemap_r2_types_vendables sur un
     jeu d'essai (tables minimales, mêmes noms et types que la base réelle) ;
  4. volatilité STABLE, absence de SECURITY DEFINER, droits d'exécution,
     remplacement de est_vendable par son expression dans la requête appelante ;
  5. le retour arrière, puis la migration à nouveau, puis le retour arrière.

Sortie : un script SQL sur stdout, à passer à `psql -X -v ON_ERROR_STOP=1`.
Aucune connexion ici ; aucune base réelle n'est visée (PostgreSQL éphémère).

Usage : check-vendable-mirror.py [--base NOM]
"""
import json
import os
import sys

RACINE = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
ECHANTILLON = os.path.join(RACINE, "backend", "src", "database", "services", "vendable.echantillon.json")
MIGRATION = os.path.join(RACINE, "backend", "supabase", "migrations", "20261118_est_vendable_definition_unique.sql")
RETOUR = MIGRATION[: -len(".sql")] + ".down.sql"

SIGNATURES = [
    "public.est_vendable(text, text, numeric, boolean)",
    "public.piece_est_vendable(integer)",
    "public.get_sitemap_r2_types_vendables(integer, integer, integer)",
]


def lit(value):
    """Littéral SQL d'une valeur de l'échantillon (None, booléen ou texte)."""
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "true" if value else "false"
    if not isinstance(value, str):
        raise ValueError(f"valeur non textuelle dans l'échantillon : {value!r}")
    return "'" + value.replace("'", "''") + "'"


def lire(path):
    with open(path, encoding="utf-8") as fh:
        return fh.read()


def schema_minimal():
    return """
DO $roles$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I', r);
    END IF;
  END LOOP;
END
$roles$;

-- Mêmes noms et mêmes types que la base réelle (relevé du 2026-11-18).
CREATE TABLE public.pieces (piece_id integer PRIMARY KEY, piece_display boolean NOT NULL);
CREATE TABLE public.pieces_price (
  pri_piece_id_i integer, pri_dispo text, pricing_state text NOT NULL, pri_vente_ttc_n numeric);
CREATE TABLE public.pieces_relation_type (rtp_type_id integer, rtp_piece_id integer, rtp_pg_id integer);
CREATE TABLE public.auto_type (type_id_i integer, type_display text);
"""


def controle_echantillon(cas):
    lignes = ",\n".join(
        "  ({}, {}, {}, {}::numeric, {}, {})".format(
            lit(c["nom"]), lit(c["dispo"]), lit(c["etatTarif"]), lit(c["venteTtc"]),
            lit(c["pieceAffichee"]), lit(c["attendu"]),
        )
        for c in cas
    )
    return f"""
CREATE TABLE public._miroir_cas (
  nom text, dispo text, etat text, prix numeric, affichee boolean, attendu boolean);
INSERT INTO public._miroir_cas VALUES
{lignes};

DO $miroir$
DECLARE c record; ecarts integer := 0;
BEGIN
  FOR c IN
    SELECT nom, attendu, public.est_vendable(dispo, etat, prix, affichee) AS obtenu
      FROM public._miroir_cas
  LOOP
    IF c.obtenu IS DISTINCT FROM c.attendu THEN
      ecarts := ecarts + 1;
      RAISE WARNING 'MIROIR : « % » — est_vendable rend %, attendu %', c.nom, c.obtenu, c.attendu;
    END IF;
  END LOOP;
  IF ecarts > 0 THEN
    RAISE EXCEPTION 'MIROIR ROMPU : % cas sur {len(cas)} en écart entre public.est_vendable et vendable.echantillon.json', ecarts;
  END IF;
END
$miroir$;
\\echo miroir : {len(cas)} cas identiques a l echantillon
"""


JEU_D_ESSAI = r"""
-- Une pièce par cas représentable en table (état du tarif et affichage non nuls).
INSERT INTO public.pieces (piece_id, piece_display)
SELECT row_number() OVER (ORDER BY nom), affichee
  FROM public._miroir_cas WHERE etat IS NOT NULL AND affichee IS NOT NULL;
INSERT INTO public.pieces_price (pri_piece_id_i, pri_dispo, pricing_state, pri_vente_ttc_n)
SELECT row_number() OVER (ORDER BY nom), dispo, etat, prix
  FROM public._miroir_cas WHERE etat IS NOT NULL AND affichee IS NOT NULL;

DO $piece$
DECLARE c record; ecarts integer := 0;
BEGIN
  FOR c IN
    SELECT nom, attendu, public.piece_est_vendable((row_number() OVER (ORDER BY nom))::integer) AS obtenu
      FROM public._miroir_cas WHERE etat IS NOT NULL AND affichee IS NOT NULL
  LOOP
    IF c.obtenu IS DISTINCT FROM c.attendu THEN
      ecarts := ecarts + 1;
      RAISE WARNING 'PIECE : « % » — piece_est_vendable rend %, attendu %', c.nom, c.obtenu, c.attendu;
    END IF;
  END LOOP;
  IF ecarts > 0 THEN RAISE EXCEPTION 'piece_est_vendable : % écart(s)', ecarts; END IF;
END
$piece$;

-- Pièces 9001 à 9005 : agrégation par pièce et lecture gamme × type.
INSERT INTO public.pieces VALUES (9001, true), (9002, true), (9003, false), (9004, true), (9005, true);
INSERT INTO public.pieces_price VALUES
  (9001, '0', 'ACTIVE', 10), (9001, '3', 'ACTIVE', 10),  -- deux lignes, dont une vendable
  (9002, '0', 'ACTIVE', 10),                              -- indisponible
  (9003, '1', 'ACTIVE', 10),                              -- masquée
  (9005, '1', 'FROZEN', 10);                              -- gelée ; 9004 n'a aucun tarif
INSERT INTO public.auto_type VALUES (10, '1'), (11, '0'), (12, '1'), (13, '1'), (14, '1'), (15, '1');
INSERT INTO public.pieces_relation_type (rtp_pg_id, rtp_type_id, rtp_piece_id) VALUES
  (7, 10, 9001),              -- type affiché, pièce vendable          -> retenu
  (7, 10, 9002),
  (7, 11, 9001),              -- type masqué                           -> écarté
  (7, 12, 9002), (7, 12, 9003), (7, 12, 9004), (7, 12, 9005),  -- aucune pièce vendable -> écarté
  (8, 13, 9001),              -- vendable, mais dans la gamme 8
  (7, 15, 9001);              -- hors de la plage demandée ci-dessous

DO $jeu$
DECLARE obtenu integer[];
BEGIN
  IF public.piece_est_vendable(9001) IS NOT TRUE THEN RAISE EXCEPTION 'pièce à deux lignes dont une vendable : attendu vrai'; END IF;
  IF public.piece_est_vendable(9002) IS NOT FALSE THEN RAISE EXCEPTION 'pièce indisponible : attendu faux'; END IF;
  IF public.piece_est_vendable(9003) IS NOT FALSE THEN RAISE EXCEPTION 'pièce masquée : attendu faux'; END IF;
  IF public.piece_est_vendable(9004) IS NOT FALSE THEN RAISE EXCEPTION 'pièce sans tarif : attendu faux'; END IF;
  IF public.piece_est_vendable(9005) IS NOT FALSE THEN RAISE EXCEPTION 'pièce gelée : attendu faux'; END IF;
  IF public.piece_est_vendable(424242) IS NOT FALSE THEN RAISE EXCEPTION 'pièce inconnue : attendu faux, jamais NULL'; END IF;
  IF public.piece_est_vendable(NULL) IS NOT FALSE THEN RAISE EXCEPTION 'identifiant NULL : attendu faux, jamais NULL'; END IF;

  obtenu := public.get_sitemap_r2_types_vendables(7, 1, 14);
  IF obtenu IS DISTINCT FROM ARRAY[10] THEN RAISE EXCEPTION 'gamme 7, types 1 à 14 : attendu {10}, obtenu %', obtenu; END IF;
  obtenu := public.get_sitemap_r2_types_vendables(7, 1, 100);
  IF obtenu IS DISTINCT FROM ARRAY[10, 15] THEN RAISE EXCEPTION 'gamme 7, types 1 à 100 : attendu {10,15} trié, obtenu %', obtenu; END IF;
  obtenu := public.get_sitemap_r2_types_vendables(8, 1, 100);
  IF obtenu IS DISTINCT FROM ARRAY[13] THEN RAISE EXCEPTION 'gamme 8 : attendu {13}, obtenu %', obtenu; END IF;
  obtenu := public.get_sitemap_r2_types_vendables(9, 1, 100);
  IF obtenu IS DISTINCT FROM '{}'::integer[] THEN RAISE EXCEPTION 'gamme sans compatibilité : attendu un tableau vide, jamais NULL, obtenu %', obtenu; END IF;
END
$jeu$;
\echo jeu d essai : piece_est_vendable et get_sitemap_r2_types_vendables conformes
"""


def controle_catalogue():
    sigs = ", ".join(f"'{s}'" for s in SIGNATURES)
    return f"""
DO $catalogue$
DECLARE s text; p pg_proc%ROWTYPE; ligne text;
BEGIN
  FOREACH s IN ARRAY ARRAY[{sigs}] LOOP
    SELECT * INTO p FROM pg_proc WHERE oid = to_regprocedure(s);
    IF NOT FOUND THEN RAISE EXCEPTION '% absente après la migration', s; END IF;
    IF p.provolatile <> 's' THEN RAISE EXCEPTION '% : volatilité %, attendu STABLE', s, p.provolatile; END IF;
    IF p.prosecdef THEN RAISE EXCEPTION '% : SECURITY DEFINER inattendu', s; END IF;
    IF has_function_privilege('anon', s, 'EXECUTE') OR has_function_privilege('authenticated', s, 'EXECUTE') THEN
      RAISE EXCEPTION '% : exécutable par anon ou authenticated', s;
    END IF;
    IF NOT has_function_privilege('service_role', s, 'EXECUTE') THEN
      RAISE EXCEPTION '% : non exécutable par service_role', s;
    END IF;
  END LOOP;

  -- est_vendable doit être remplacée par son expression dans la requête
  -- appelante : si son nom reste dans le plan, elle coûte un appel par ligne.
  FOR ligne IN EXECUTE
    'EXPLAIN (VERBOSE, COSTS OFF) SELECT 1 FROM public.pieces_price pp JOIN public.pieces pc ON pc.piece_id = pp.pri_piece_id_i '
    'WHERE public.est_vendable(pp.pri_dispo, pp.pricing_state, pp.pri_vente_ttc_n, pc.piece_display)'
  LOOP
    IF ligne ~ 'est_vendable' THEN
      RAISE EXCEPTION 'est_vendable n''est plus remplacée par son expression (plan : %)', ligne;
    END IF;
  END LOOP;
END
$catalogue$;
\\echo catalogue : STABLE, sans SECURITY DEFINER, service_role seul, est_vendable remplacee par son expression
"""


def controle_absence():
    sigs = ", ".join(f"'{s}'" for s in SIGNATURES)
    return f"""
DO $absence$
DECLARE s text;
BEGIN
  FOREACH s IN ARRAY ARRAY[{sigs}] LOOP
    IF to_regprocedure(s) IS NOT NULL THEN RAISE EXCEPTION '% existe encore après le retour arrière', s; END IF;
  END LOOP;
END
$absence$;
"""


def build_script(base):
    with open(ECHANTILLON, encoding="utf-8") as fh:
        cas = json.load(fh)["cas"]
    if not cas:
        raise ValueError("échantillon vide")
    up, down = lire(MIGRATION), lire(RETOUR)
    return "\n".join([
        f"DROP DATABASE IF EXISTS {base};",
        f"CREATE DATABASE {base};",
        f"\\connect {base}",
        "SELECT version();",
        schema_minimal(),
        "\\echo == migration (1re application)", up,
        "\\echo == migration (2e application : rejouable)", up,
        controle_echantillon(cas),
        JEU_D_ESSAI,
        controle_catalogue(),
        "\\echo == retour arriere", down, controle_absence(),
        "\\echo == migration apres retour arriere", up, controle_catalogue(),
        "\\echo == retour arriere final", down, controle_absence(),
        "\\connect postgres",
        f"DROP DATABASE {base};",
        f"\\echo MIROIR VENDABLE OK : {len(cas)} cas, migration rejouee, retour arriere verifie",
    ])


def main(argv):
    base = "ct_vendable_miroir"
    if len(argv) == 3 and argv[1] == "--base":
        base = argv[2]
    elif len(argv) != 1:
        sys.stderr.write(__doc__)
        return 2
    if not base.replace("_", "").isalnum() or not base[0].isalpha() or base != base.lower():
        sys.stderr.write("nom de base invalide (minuscules, chiffres, _)\n")
        return 2
    try:
        script = build_script(base)
    except (OSError, ValueError, KeyError) as err:
        sys.stderr.write(f"check-vendable-mirror: {err}\n")
        return 1
    sys.stdout.write(script + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
