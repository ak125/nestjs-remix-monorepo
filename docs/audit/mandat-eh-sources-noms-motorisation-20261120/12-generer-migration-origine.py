#!/usr/bin/env python3
"""Mandat EH, 6.4 : génère la migration gardée qui corrige le nom d'origine
(auto_type.type_name, et type_name_meta quand il est faux aussi), et son retour.

Usage : python3 -I 12-generer-migration-origine.py <decisions.tsv> <dossier migrations> <13-controle-apres.sql>

decisions.tsv (produit par 11-decider.py) : entrent dans la migration les lignes
dont `migration` vaut « origine ». Chaque ligne porte l'état relevé le
2026-11-20 (type_name_avant, meta_avant) et l'état corrigé (type_name_apres,
meta_apres). Ne pas éditer la migration à la main : régénérer.
"""
import csv
import sys

NOM = "20261120_auto_type_name_origine_corrections_mandat_eh"
RAISON = "mandat EH 2026-11-20 : correction de auto_type.type_name (nom d'origine faux, sources extérieures)"
RAISON_RETOUR = "retour du mandat EH 2026-11-20 : type_name et type_name_meta d'origine remis"


def lit(path):
    with open(path, newline="", encoding="utf-8") as f:
        rows = [r for r in csv.DictReader(f, delimiter="\t") if r["migration"] == "origine"]
    for r in rows:
        if r["type_name_avant"] == r["type_name_apres"]:
            raise SystemExit(f"type {r['type_id']} : type_name inchangé, rien à corriger")
        for c in ("type_name_apres", "meta_apres"):
            if not r[c].strip() or r[c] != r[c].strip() or "  " in r[c]:
                raise SystemExit(f"type {r['type_id']} : {c} vide ou mal espacé : {r[c]!r}")
    return sorted(rows, key=lambda r: int(r["type_id"]))


def q(s):
    return "'" + s.replace("'", "''") + "'"


def valeurs(rows, sens):
    a, b = (("avant", "apres") if sens == "up" else ("apres", "avant"))
    lignes = []
    for i, r in enumerate(rows):
        sep = "," if i < len(rows) - 1 else ""
        lignes.append(
            f"    ({int(r['type_id']):>5}, {q(r['type_name_' + a])}, {q(r['meta_' + a])}, "
            f"{q(r['type_name_' + b])}, {q(r['meta_' + b])}){sep}"
            f"  -- {r['marque']} | {r['modele']} | {r['verdict']}"
        )
    return "\n".join(lignes) + "\n    "


CORPS = """-- =============================================================================
-- Migration : {titre}
-- Date      : 2026-11-20 (mandat EH, « 07 Pages et SEO »)
-- Scope     : public.auto_type.type_name de {n} types (et type_name_meta quand
--             il est faux aussi), rien d'autre. Ni type_name_url, ni type_alias,
--             ni URL, ni modèle, ni marque. Aucun DELETE, aucun DDL.
-- Généré par docs/audit/mandat-eh-sources-noms-motorisation-20261120/12-generer-migration-origine.py
-- depuis decisions.tsv (migration = « origine ») : ne pas éditer à la main, régénérer.
-- =============================================================================
--
-- POURQUOI : pour ces {n} types, le nom d'origine (TecDoc ou base ancienne)
-- nomme une autre motorisation que celle décrite par le code moteur, la
-- puissance, la cylindrée et les années du type. Valeur juste et URL des
-- sources par ligne : verdicts-sources.tsv et la PR du mandat EH.
-- type_name alimente le H1 des pages R8 (build_vehicle_page_payload) et, en
-- repli du nom d'affichage, le titre des pages R2 et R8.
--
-- APPLICATION : acte réservé à Marwane, après validation de la liste. Retirer
-- d'abord du bloc VALUES (ici ET dans le .down.sql) toute ligne non validée.
-- À appliquer APRÈS 20261120_auto_type_name_meta_corrections_mandat_ee.sql
-- (ordre alphabétique du runner) ; les deux listes sont disjointes.
--
-- GARDE : chaque type doit exister et porter exactement le couple
-- (type_name, type_name_meta) relevé le 2026-11-20, ou déjà le couple corrigé
-- (rejeu). Toute autre valeur lève une exception avant toute écriture : rien
-- n'est écrit.
-- REJOUABLE : au second passage, 0 ligne écrite, 0 page invalidée.
-- URL : aucune. Les URL des types lisent type_alias, renseigné pour ces {n}
-- types et jamais réécrit ici ; le repli sur type_name
-- (packages/seo-url-contract/src/url-rules.ts:40-49) ne s'applique à aucun.
-- RÉIMPORT : scripts/tecdoc-pipeline/create-vehicles-p4a.py n'insère que des
-- types absents (ON CONFLICT (type_id) DO NOTHING) et n'écrase donc pas
-- cette correction.
-- CACHE : __vehicle_page_cache n'a de déclencheur que sur type_display ; les
-- pages R8 des types modifiés sont invalidées et reconstruites par la
-- fonction canonique mark_stale_with_followup_rebuild (INC-2026-007). Le cache
-- Redis applicatif (TTL 1 h, vehicle-rpc.service.ts) expire de lui-même.
-- {retour}

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15min';

DO $mandat_eh$
DECLARE
  v_ecarts   text;
  v_a_ecrire integer[];
  v_ecrits   integer;
  v_marques  integer;
BEGIN
  CREATE TEMP TABLE mandat_eh_corrections (
    type_id       integer PRIMARY KEY,
    nom_releve    text NOT NULL,
    meta_releve   text NOT NULL,
    nom_cible     text NOT NULL,
    meta_cible    text NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO mandat_eh_corrections (type_id, nom_releve, meta_releve, nom_cible, meta_cible) VALUES
{valeurs};

  -- Garde : existence et couple exact (relevé ou cible), sinon exception et rien d'écrit.
  SELECT string_agg(format('%s : %L / %L', c.type_id,
                           coalesce(t.type_name, CASE WHEN t.type_id IS NULL THEN '<type absent>' ELSE '<NULL>' END),
                           coalesce(t.type_name_meta, '<NULL>')),
                    ' ; ' ORDER BY c.type_id)
    INTO v_ecarts
    FROM mandat_eh_corrections c
    LEFT JOIN public.auto_type t ON t.type_id = c.type_id::text
   WHERE t.type_id IS NULL
      OR t.type_name IS NULL
      OR t.type_name_meta IS NULL
      OR NOT ((t.type_name = c.nom_releve AND t.type_name_meta = c.meta_releve)
           OR (t.type_name = c.nom_cible  AND t.type_name_meta = c.meta_cible));
  IF v_ecarts IS NOT NULL THEN
    RAISE EXCEPTION 'mandat EH : valeur actuelle différente de la valeur relevée, rien n''est écrit. %', v_ecarts;
  END IF;

  SELECT array_agg(c.type_id ORDER BY c.type_id)
    INTO v_a_ecrire
    FROM mandat_eh_corrections c
    JOIN public.auto_type t ON t.type_id = c.type_id::text
   WHERE t.type_name = c.nom_releve
     AND t.type_name_meta = c.meta_releve;

  IF v_a_ecrire IS NULL THEN
    RAISE NOTICE 'mandat EH : déjà appliqué, 0 ligne écrite';
    RETURN;
  END IF;

  UPDATE public.auto_type t
     SET type_name = c.nom_cible,
         type_name_meta = c.meta_cible
    FROM mandat_eh_corrections c
   WHERE t.type_id = c.type_id::text
     AND t.type_name = c.nom_releve
     AND t.type_name_meta = c.meta_releve;
  GET DIAGNOSTICS v_ecrits = ROW_COUNT;
  IF v_ecrits <> cardinality(v_a_ecrire) THEN
    RAISE EXCEPTION 'mandat EH : % lignes écrites pour % attendues', v_ecrits, cardinality(v_a_ecrire);
  END IF;

  v_marques := public.mark_stale_with_followup_rebuild(v_a_ecrire, {raison}, true);
  RAISE NOTICE 'mandat EH : % types corrigés, % pages R8 invalidées et reconstruites', v_ecrits, v_marques;
END
$mandat_eh$;

-- Contrôle après application (lecture seule ; attendu : 0 ligne) :
-- docs/audit/mandat-eh-sources-noms-motorisation-20261120/13-controle-apres.sql
"""


def main():
    rows = lit(sys.argv[1])
    if not rows:
        raise SystemExit("aucune ligne « origine » : pas de migration à générer")
    out = sys.argv[2].rstrip("/")
    n = len(rows)
    up = CORPS.format(titre="corriger le nom d'origine (type_name) des motorisations nommées à tort",
                      n=n, valeurs=valeurs(rows, "up"), raison=q(RAISON),
                      retour=f"RETOUR : {NOM}.down.sql remet les valeurs relevées, avec la même garde.")
    down = CORPS.format(titre="RETOUR — remettre type_name et type_name_meta relevés (mandat EH)",
                        n=n, valeurs=valeurs(rows, "down"), raison=q(RAISON_RETOUR),
                        retour="SENS : ce fichier est le retour ; il remet les valeurs relevées le 2026-11-20.")
    with open(f"{out}/{NOM}.sql", "w", encoding="utf-8") as f:
        f.write(up)
    with open(f"{out}/{NOM}.down.sql", "w", encoding="utf-8") as f:
        f.write(down)
    ctl = ["-- Mandat EH : contrôle après application, lecture seule (sweep-psql ou éditeur SQL).",
           "-- Attendu après la migration : 0 ligne. Après le .down.sql : comparer à nom_releve / meta_releve.",
           "with attendu(type_id, nom_releve, meta_releve, nom_cible, meta_cible) as (values"]
    ctl.append(",\n".join(
        f"  ({int(r['type_id'])}, {q(r['type_name_avant'])}, {q(r['meta_avant'])}, "
        f"{q(r['type_name_apres'])}, {q(r['meta_apres'])})" for r in rows))
    ctl.append(")\nselect a.type_id, t.type_name, t.type_name_meta, a.nom_cible, a.meta_cible\n"
               "  from attendu a\n  left join public.auto_type t on t.type_id = a.type_id::text\n"
               " where (t.type_name, t.type_name_meta) is distinct from (a.nom_cible, a.meta_cible)\n"
               " order by a.type_id;")
    with open(sys.argv[3], "w", encoding="utf-8") as f:
        f.write("\n".join(ctl) + "\n")
    print(n, "lignes")


if __name__ == "__main__":
    main()
