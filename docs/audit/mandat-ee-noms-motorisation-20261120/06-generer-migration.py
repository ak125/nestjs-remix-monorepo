#!/usr/bin/env python3
"""Mandat EE, 6.5 : génère la migration gardée et son retour depuis classement.tsv.

Usage : python3 -I 06-generer-migration.py <classement.tsv> <dossier migrations> <07-controle-apres.sql> <exclusions-6-6.tsv>
Entrent dans la migration les lignes au verdict « erreur », sauf celles que
09-collisions.mjs écarte (exclusions-6-6.tsv : la correction rendrait identique
le nom R8 ou le titre R2 de deux motorisations).
"""
import csv
import sys

NOM = "20261120_auto_type_name_meta_corrections_mandat_ee"
RAISON = "mandat EE 2026-11-20 : correction de auto_type.type_name_meta (liste validée par Marwane)"


def lit(path, exclusions):
    with open(exclusions, newline="", encoding="utf-8") as f:
        exclues = {r["type_id"] for r in csv.DictReader(f, delimiter="\t")}
    with open(path, newline="", encoding="utf-8") as f:
        rows = [r for r in csv.DictReader(f, delimiter="\t") if r["verdict"] == "erreur"]
    if not exclues <= {r["type_id"] for r in rows}:
        raise SystemExit(f"exclusions hors des erreurs : {sorted(exclues - {r['type_id'] for r in rows})}")
    return [r for r in rows if r["type_id"] not in exclues]


def q(s):
    return "'" + s.replace("'", "''") + "'"


def valeurs(rows):
    rows = sorted(rows, key=lambda r: int(r["type_id"]))
    lignes = []
    for i, r in enumerate(rows):
        sep = "," if i < len(rows) - 1 else ""
        # Le commentaire vient APRÈS la virgule : sinon elle serait commentée.
        lignes.append(
            f"    ({int(r['type_id']):>5}, {q(r['type_name_meta'])}, {q(r['valeur_corrigee'])}){sep}"
            f"  -- {r['marque']} | {r['modele']} | brut « {r['type_name']} » | {r['regle']}"
        )
    return "\n".join(lignes) + "\n    "


CORPS = """-- =============================================================================
-- Migration : {titre}
-- Date      : 2026-11-20 (mandat EE, « 07 Pages et SEO »)
-- Scope     : public.auto_type.type_name_meta de {n} types affichés, et rien
--             d'autre. Ni type_name, ni modele_name_meta, ni marque_name_meta,
--             ni URL, ni alias. Aucun DELETE, aucun DDL.
-- Généré par docs/audit/mandat-ee-noms-motorisation-20261120/06-generer-migration.py
-- depuis classement.tsv (verdict « erreur ») moins exclusions-6-6.tsv (correction
-- qui rendrait identique un nom R8 ou un titre R2) : ne pas éditer à la main, régénérer.
-- =============================================================================
--
-- POURQUOI : type_name_meta alimente le <title>, la description et les mots-clés
-- des pages R8 (frontend/app/components/vehicle/r8/r8-transform.ts:133-148 et
-- build_vehicle_page_payload). Ces {n} valeurs nomment une autre motorisation
-- ou changent la désignation du moteur (EcoBoost -> Econetic, VVTi -> VTi,
-- 520 i -> 523 i…). Preuves par ligne : PR du mandat EE et classement.tsv.
--
-- APPLICATION : acte réservé à Marwane, après validation de la liste. Retirer
-- d'abord du bloc VALUES (ici ET dans le .down.sql) toute ligne non validée.
-- Workflow apply-supabase-migrations.yml : dry run, puis application, puis le
-- SELECT de contrôle en fin de fichier.
--
-- GARDE : chaque type doit exister et porter exactement la valeur erronée
-- relevée le 2026-11-20, ou déjà la valeur corrigée (rejeu). Toute autre valeur
-- lève une exception avant toute écriture : rien n'est écrit.
-- REJOUABLE : au second passage, 0 ligne écrite, 0 page invalidée.
-- CACHE : __vehicle_page_cache n'a de déclencheur que sur type_display ; les
-- pages R8 des types modifiés sont donc invalidées et reconstruites par la
-- fonction canonique mark_stale_with_followup_rebuild (INC-2026-007). Le cache
-- Redis applicatif (TTL 1 h, vehicle-rpc.service.ts) expire de lui-même.
-- RETOUR : {nom}.down.sql remet les valeurs d'origine, avec la même garde.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15min';

DO $mandat_ee$
DECLARE
  v_ecarts   text;
  v_a_ecrire integer[];
  v_ecrits   integer;
  v_marques  integer;
BEGIN
  CREATE TEMP TABLE mandat_ee_corrections (
    type_id          integer PRIMARY KEY,
    {col_avant}      text NOT NULL,
    {col_apres}      text NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO mandat_ee_corrections (type_id, valeur_erronee, valeur_corrigee) VALUES
{valeurs};

  -- Garde : existence et valeur exacte, sinon exception et rien d'écrit.
  SELECT string_agg(format('%s : %L', c.type_id,
                           coalesce(t.type_name_meta, CASE WHEN t.type_id IS NULL THEN '<type absent>' ELSE '<NULL>' END)),
                    ' ; ' ORDER BY c.type_id)
    INTO v_ecarts
    FROM mandat_ee_corrections c
    LEFT JOIN public.auto_type t ON t.type_id = c.type_id::text
   WHERE t.type_id IS NULL
      OR t.type_name_meta IS NULL
      OR t.type_name_meta NOT IN (c.{col_avant}, c.{col_apres});
  IF v_ecarts IS NOT NULL THEN
    RAISE EXCEPTION 'mandat EE : valeur actuelle différente de la valeur relevée, rien n''est écrit. %', v_ecarts;
  END IF;

  SELECT array_agg(c.type_id ORDER BY c.type_id)
    INTO v_a_ecrire
    FROM mandat_ee_corrections c
    JOIN public.auto_type t ON t.type_id = c.type_id::text
   WHERE t.type_name_meta = c.{col_avant};

  IF v_a_ecrire IS NULL THEN
    RAISE NOTICE 'mandat EE : déjà appliqué, 0 ligne écrite';
    RETURN;
  END IF;

  UPDATE public.auto_type t
     SET type_name_meta = c.{col_apres}
    FROM mandat_ee_corrections c
   WHERE t.type_id = c.type_id::text
     AND t.type_name_meta = c.{col_avant};
  GET DIAGNOSTICS v_ecrits = ROW_COUNT;
  IF v_ecrits <> cardinality(v_a_ecrire) THEN
    RAISE EXCEPTION 'mandat EE : % lignes écrites pour % attendues', v_ecrits, cardinality(v_a_ecrire);
  END IF;

  v_marques := public.mark_stale_with_followup_rebuild(v_a_ecrire, {raison}, true);
  RAISE NOTICE 'mandat EE : % valeurs écrites, % pages R8 invalidées et reconstruites', v_ecrits, v_marques;
END
$mandat_ee$;

-- Contrôle après application (lecture seule ; attendu : 0 ligne) :
-- docs/audit/mandat-ee-noms-motorisation-20261120/07-controle-apres.sql
"""


def main():
    rows = lit(sys.argv[1], sys.argv[4])
    out = sys.argv[2].rstrip("/")
    vals = valeurs(rows)
    commun = dict(n=len(rows), nom=NOM, valeurs=vals, raison=q(RAISON))
    up = CORPS.format(titre="corriger type_name_meta des motorisations classées « erreur »",
                      col_avant="valeur_erronee", col_apres="valeur_corrigee", **commun)
    down = CORPS.format(titre="RETOUR — remettre type_name_meta d'origine (mandat EE)",
                        col_avant="valeur_corrigee", col_apres="valeur_erronee", **commun)
    down = down.replace(q(RAISON), q("retour du mandat EE 2026-11-20 : type_name_meta d'origine remis"))
    down = down.replace("RETOUR : {0}.down.sql remet les valeurs d'origine, avec la même garde.".format(NOM),
                        "SENS : ce fichier est le retour ; il remet la valeur erronée d'origine.")
    with open(f"{out}/{NOM}.sql", "w", encoding="utf-8") as f:
        f.write(up)
    with open(f"{out}/{NOM}.down.sql", "w", encoding="utf-8") as f:
        f.write(down)
    rows_s = sorted(rows, key=lambda r: int(r["type_id"]))
    ctl = ["-- Mandat EE : contrôle après application, lecture seule (sweep-psql ou éditeur SQL).",
           "-- Attendu après la migration : 0 ligne. Après le .down.sql : remplacer valeur_corrigee par valeur_erronee.",
           "with attendu(type_id, valeur_erronee, valeur_corrigee) as (values"]
    ctl.append(",\n".join(f"  ({int(r['type_id'])}, {q(r['type_name_meta'])}, {q(r['valeur_corrigee'])})" for r in rows_s))
    ctl.append(")\nselect a.type_id, t.type_name_meta, a.valeur_corrigee\n  from attendu a\n  left join public.auto_type t on t.type_id = a.type_id::text\n where t.type_name_meta is distinct from a.valeur_corrigee\n order by a.type_id;")
    with open(sys.argv[3], "w", encoding="utf-8") as f:
        f.write("\n".join(ctl) + "\n")
    print(len(rows), "lignes")


if __name__ == "__main__":
    main()
