#!/usr/bin/env python3
"""
fix-vehicles-massdoc.py — Correction robuste véhicules TecDoc (id >= 100K)

Phase 1: Corriger naming types + modèles (énergie, accents, NULL name_url)
Phase 2: Créer mapping type_id (KTYPNR → séquentiel 60000+, trié par marque/modèle)
Phase 3: Remap type_id dans toutes les tables enfants + PK

PAS de remap modele_id (déjà convention massdoc marque_id*1000+seq)

Usage:
  python3 fix-vehicles-massdoc.py --dry-run                # Affiche sans modifier
  python3 fix-vehicles-massdoc.py --dry-run --phase naming  # Naming seul
  python3 fix-vehicles-massdoc.py --execute --phase naming  # Naming seul
  python3 fix-vehicles-massdoc.py --execute --phase remap   # Remap type_id seul
  python3 fix-vehicles-massdoc.py --execute                 # Tout

Connexion directe port 5432 (pas de statement_timeout).
"""

import argparse
import csv
import os
import re
import sys
import unicodedata
from datetime import datetime
from functools import partial

# Force unbuffered output for real-time logs
print = partial(print, flush=True)

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("psycopg2 requis: pip install psycopg2-binary")
    sys.exit(1)

# ─── Config ───────────────────────────────────────────────
DB_DIRECT = {
    'host': 'db.cxpojprgwgubzjyqzmoq.supabase.co',
    'port': 5432,
    'dbname': 'postgres',
    'user': 'postgres',
    'password': 'T7qrnbWg7MwqkF7v',
    'options': '-c statement_timeout=0',
}

TYPE_ID_START = 60000       # Legacy max = 59999
TECDOC_THRESHOLD = 100000   # TecDoc IDs commencent ici
BATCH_SIZE = 2000           # IDs par batch pour grosses tables

# ─── Mapping énergie TecDoc → massdoc ─────────────────────
# Ordre: les plus spécifiques d'abord
ENERGY_MAP = [
    (re.compile(r'Essence-Électrique', re.IGNORECASE), 'Hybrid'),
    (re.compile(r'Diesel-Électrique', re.IGNORECASE), 'Hybrid Diesel'),
    (re.compile(r'Essence[/-]GPL', re.IGNORECASE), 'GPL'),
    (re.compile(r'Essence[/-]Ethanol', re.IGNORECASE), 'Flexfuel'),
    (re.compile(r'Essence[/-]GNV', re.IGNORECASE), 'GNV'),
    (re.compile(r'Essence[/-]CNG', re.IGNORECASE), 'CNG'),
]

# Codes chassis avec underscores à stripper: (LB_, LP_), (HV0P, HV0U, UV10,...)
# MAIS on garde: (Phase 1), (E36), (W177), (F30-F35), (CA1)
CHASSIS_CODE_RE = re.compile(
    r'\s*\('
    r'[A-Z0-9]{2,5}[_,]'   # Commence par code avec _ ou ,
    r'[^)]*'
    r'\)\s*$'
)


# ─── Helpers ──────────────────────────────────────────────

def slugify(text):
    """Slugify massdoc: translitération Unicode complète + lowercase + hyphens."""
    if not text:
        return ''
    # NFKD decompose: é → e + accent combinant
    text = unicodedata.normalize('NFKD', text)
    # Supprimer les combining characters (accents)
    text = ''.join(c for c in text if not unicodedata.combining(c))
    text = text.lower()
    # Tout sauf alphanum → tiret
    text = re.sub(r'[^a-z0-9]+', '-', text)
    # Supprimer doubles tirets et tirets début/fin
    text = re.sub(r'-+', '-', text)
    text = text.strip('-')
    return text


def fix_energy(name):
    """Remplace les noms d'énergie TecDoc par convention massdoc."""
    if not name:
        return name or ''
    result = name
    for pattern, replacement in ENERGY_MAP:
        result = pattern.sub(replacement, result)
    return result


def strip_chassis_codes(name):
    """Strip codes chassis (ABC_, DEF_) mais garde (Phase X), (E36) etc."""
    if not name:
        return name
    result = CHASSIS_CODE_RE.sub('', name).strip()
    return result if result else name


def compute_name_url(type_name):
    """Calcule name_url massdoc: énergie + strip codes chassis."""
    if not type_name:
        return ''
    result = fix_energy(type_name)
    result = strip_chassis_codes(result)
    return result.strip()


def connect():
    print(f"  Connexion à {DB_DIRECT['host']}:{DB_DIRECT['port']}...")
    conn = psycopg2.connect(**DB_DIRECT)
    conn.autocommit = False
    return conn


def ts():
    return datetime.now().strftime('%H:%M:%S')


# ============================================================
# PHASE 1 : NAMING (types + modèles)
# ============================================================

def phase_naming(conn, dry_run, log_dir):
    """Corrige name_url et alias pour tous les types/modèles TecDoc."""
    cur = conn.cursor()

    fixes_types = []
    fixes_modeles = []

    # ── Types ──
    print(f"\n  [{ts()}] Chargement des types >= {TECDOC_THRESHOLD}...")
    cur.execute("""
        SELECT type_id, type_name, type_name_url, type_alias, type_display
        FROM auto_type
        WHERE type_id::int >= %s
        ORDER BY type_id::int
    """, (TECDOC_THRESHOLD,))
    types = cur.fetchall()
    print(f"  [{ts()}] {len(types)} types chargés")

    for type_id, name, name_url, alias, display in types:
        new_name_url = name_url
        new_alias = alias
        fix_reasons = []

        # Cas 1: name_url NULL ou vide
        if not name_url or name_url.strip() == '':
            new_name_url = compute_name_url(name)
            fix_reasons.append('null_name_url')

        # Cas 2: name_url contient énergie TecDoc
        elif any(p.search(name_url) for p, _ in ENERGY_MAP):
            new_name_url = compute_name_url(name_url)
            fix_reasons.append('energy_fix')

        # Cas 3: name_url = name brut avec codes chassis
        elif name_url == name and CHASSIS_CODE_RE.search(name):
            new_name_url = strip_chassis_codes(name)
            fix_reasons.append('chassis_strip')

        # Recalculer alias depuis name_url (corrigé ou existant)
        base_for_alias = new_name_url if new_name_url else name
        expected_alias = slugify(base_for_alias)

        if expected_alias and expected_alias != (alias or ''):
            new_alias = expected_alias
            if 'alias_regen' not in fix_reasons:
                fix_reasons.append('alias_regen')

        if fix_reasons:
            fixes_types.append({
                'id': type_id,
                'display': display,
                'old_name_url': name_url or '',
                'new_name_url': new_name_url or '',
                'old_alias': alias or '',
                'new_alias': new_alias or '',
                'reasons': ','.join(fix_reasons),
            })
            if not dry_run:
                cur.execute("""
                    UPDATE auto_type
                    SET type_name_url = %s, type_alias = %s
                    WHERE type_id = %s
                """, (new_name_url, new_alias, type_id))

    # ── Modèles ──
    print(f"\n  [{ts()}] Chargement des modèles >= {TECDOC_THRESHOLD}...")
    cur.execute("""
        SELECT modele_id, modele_name, modele_name_url, modele_alias, modele_display
        FROM auto_modele
        WHERE modele_id >= %s
        ORDER BY modele_id
    """, (TECDOC_THRESHOLD,))
    modeles = cur.fetchall()
    print(f"  [{ts()}] {len(modeles)} modèles chargés")

    for modele_id, name, name_url, alias, display in modeles:
        new_name_url = name_url
        new_alias = alias
        fix_reasons = []

        # Cas 1: name_url NULL ou vide
        if not name_url or name_url.strip() == '':
            new_name_url = strip_chassis_codes(name)
            fix_reasons.append('null_name_url')

        # Cas 2: name_url = name brut avec codes chassis à underscores
        elif name_url == name and CHASSIS_CODE_RE.search(name):
            new_name_url = strip_chassis_codes(name)
            fix_reasons.append('chassis_strip')

        # Recalculer alias
        base_for_alias = new_name_url if new_name_url else name
        expected_alias = slugify(base_for_alias)

        if not alias or alias.strip() == '' or expected_alias != alias:
            new_alias = expected_alias
            if 'alias_regen' not in fix_reasons:
                fix_reasons.append('alias_regen')

        if fix_reasons:
            fixes_modeles.append({
                'id': modele_id,
                'display': display,
                'old_name_url': name_url or '',
                'new_name_url': new_name_url or '',
                'old_alias': alias or '',
                'new_alias': new_alias or '',
                'reasons': ','.join(fix_reasons),
            })
            if not dry_run:
                cur.execute("""
                    UPDATE auto_modele
                    SET modele_name_url = %s, modele_alias = %s
                    WHERE modele_id = %s
                """, (new_name_url, new_alias, modele_id))

    # ── Export CSV ──
    for label, data in [('types', fixes_types), ('modeles', fixes_modeles)]:
        path = os.path.join(log_dir, f'naming_fixes_{label}.csv')
        with open(path, 'w', newline='') as f:
            if data:
                w = csv.DictWriter(f, fieldnames=data[0].keys())
                w.writeheader()
                w.writerows(data)
        print(f"  [{ts()}] {len(data)} {label} → {path}")

    # ── Résumé ──
    live_types = sum(1 for f in fixes_types if str(f['display']) == '1')
    print(f"\n  Types à corriger:   {len(fixes_types)} (dont {live_types} LIVE)")
    print(f"  Modèles à corriger: {len(fixes_modeles)}")

    if fixes_types:
        print("\n  Échantillon types:")
        for f in fixes_types[:10]:
            line = f"    #{f['id']}: [{f['reasons']}]"
            if f['old_name_url'] != f['new_name_url']:
                line += f" name_url '{f['old_name_url']}' → '{f['new_name_url']}'"
            if f['old_alias'] != f['new_alias']:
                line += f" alias '{f['old_alias']}' → '{f['new_alias']}'"
            print(line)

    if fixes_modeles:
        print("\n  Échantillon modèles:")
        for f in fixes_modeles[:5]:
            print(f"    #{f['id']}: [{f['reasons']}] alias '{f['old_alias']}' → '{f['new_alias']}'")

    if not dry_run:
        conn.commit()
        print(f"\n  [{ts()}] COMMIT naming OK")
    else:
        conn.rollback()

    return len(fixes_types), len(fixes_modeles)


# ============================================================
# PHASE 2 : CRÉER MAPPING TYPE_ID
# ============================================================

def phase_create_mapping(conn, log_dir):
    """Crée la table tecdoc_map.type_id_remap avec mapping séquentiel."""
    cur = conn.cursor()

    print(f"\n  [{ts()}] Création mapping type_id...")

    cur.execute("CREATE SCHEMA IF NOT EXISTS tecdoc_map")

    # Drop et recréer pour être propre
    cur.execute("DROP TABLE IF EXISTS tecdoc_map.type_id_remap")
    cur.execute("""
        CREATE TABLE tecdoc_map.type_id_remap (
            old_id      INTEGER PRIMARY KEY,
            new_id      INTEGER NOT NULL UNIQUE,
            type_name   TEXT,
            marque_id   INTEGER,
            modele_name TEXT,
            remapped_at TIMESTAMPTZ DEFAULT now()
        )
    """)

    # Mapping trié par marque → modèle → type_name → old_id
    cur.execute("""
        INSERT INTO tecdoc_map.type_id_remap (old_id, new_id, type_name, marque_id, modele_name)
        SELECT
            t.type_id::int AS old_id,
            (%s - 1 + ROW_NUMBER() OVER (
                ORDER BY COALESCE(m.modele_marque_id, 0),
                         t.type_modele_id::int,
                         t.type_name,
                         t.type_id::int
            ))::int AS new_id,
            t.type_name,
            m.modele_marque_id,
            m.modele_name
        FROM auto_type t
        LEFT JOIN auto_modele m ON m.modele_id::text = t.type_modele_id
        WHERE t.type_id::int >= %s
    """, (TYPE_ID_START, TECDOC_THRESHOLD))

    count = cur.rowcount
    conn.commit()

    # Stats
    cur.execute("SELECT MIN(new_id), MAX(new_id) FROM tecdoc_map.type_id_remap")
    min_id, max_id = cur.fetchone()

    print(f"  [{ts()}] {count} types mappés : {min_id} → {max_id}")

    # Échantillon
    cur.execute("""
        SELECT old_id, new_id, type_name, marque_id, modele_name
        FROM tecdoc_map.type_id_remap
        ORDER BY new_id
        LIMIT 15
    """)
    print("\n  Échantillon mapping:")
    for old, new, name, marque, modele in cur.fetchall():
        print(f"    {old:>8} → {new:>6}  [{marque or '?'}] {modele or '?'} / {name}")

    # Export CSV
    cur.execute("SELECT old_id, new_id, type_name, marque_id, modele_name FROM tecdoc_map.type_id_remap ORDER BY new_id")
    path = os.path.join(log_dir, 'mapping_type_id.csv')
    with open(path, 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(['old_id', 'new_id', 'type_name', 'marque_id', 'modele_name'])
        w.writerows(cur.fetchall())
    print(f"\n  [{ts()}] CSV mapping → {path}")

    return count


# ============================================================
# PHASE 3 : REMAP TYPE_ID
# ============================================================

def phase_remap_type(conn, dry_run):
    """Remap type_id dans toutes les tables.

    Gère les FK constraints en désactivant les checks via session_replication_role.
    Détecte et saute les tables déjà remappées (reprise après échec partiel).
    """
    cur = conn.cursor()

    # Charger les IDs
    cur.execute("SELECT old_id FROM tecdoc_map.type_id_remap ORDER BY old_id")
    all_old_ids = [r[0] for r in cur.fetchall()]
    n_ids = len(all_old_ids)
    n_batches = (n_ids + BATCH_SIZE - 1) // BATCH_SIZE

    if n_ids == 0:
        print("  ERREUR: mapping vide, lancer --phase mapping d'abord")
        return []

    print(f"  [{ts()}] {n_ids} IDs à remapper, {n_batches} batches de {BATCH_SIZE}")

    results = []

    # ── Toutes les tables à remapper ──
    all_tables = [
        ('auto_type_number_code', 'tnc_type_id', 'text'),
        ('__cross_gamme_car_new', 'cgc_type_id', 'text'),
        ('pieces_relation_criteria', 'rcp_type_id', 'integer'),
        ('pieces_relation_type', 'rtp_type_id', 'integer'),
    ]

    # ── Détection reprise : quelles tables sont déjà remappées ? ──
    tables_to_process = []
    for table, col, col_type in all_tables:
        cast = '::int' if col_type == 'text' else ''
        cur.execute(f"SELECT COUNT(*) FROM {table} WHERE {col}{cast} >= %s", (TECDOC_THRESHOLD,))
        remaining = cur.fetchone()[0]
        if remaining == 0:
            print(f"  [{ts()}] SKIP {table}.{col} — déjà remappé (0 IDs >= {TECDOC_THRESHOLD})")
            results.append((table, col, 0, 'SKIP'))
        else:
            tables_to_process.append((table, col, col_type, remaining))
            print(f"  [{ts()}] TODO {table}.{col} — {remaining:,} lignes à remapper")

    if not tables_to_process and not dry_run:
        print(f"\n  [{ts()}] Toutes les tables enfants sont déjà remappées.")
        # Vérifier si auto_type doit encore être remappé
        cur.execute("SELECT COUNT(*) FROM auto_type WHERE type_id::int >= %s", (TECDOC_THRESHOLD,))
        at_remaining = cur.fetchone()[0]
        if at_remaining == 0:
            print(f"  [{ts()}] auto_type aussi déjà remappé. Rien à faire.")
            results.append(('auto_type', 'type_id + type_id_i (PK)', 0, 'SKIP'))
            return results

    # ── Désactiver les FK constraints (session-level) ──
    if not dry_run and tables_to_process:
        print(f"\n  [{ts()}] Désactivation FK checks (session_replication_role = replica)...")
        cur.execute("SET session_replication_role = 'replica'")
        conn.commit()
        print(f"  [{ts()}] FK checks désactivés.")

    # ── Traitement des tables ──
    SMALL_THRESHOLD = 100_000  # tables < 100K lignes = single UPDATE

    for table, col, col_type, est_count in tables_to_process:
        is_big = est_count > SMALL_THRESHOLD
        cast_old = '::int' if col_type == 'text' else ''
        cast_new = '::text' if col_type == 'text' else ''

        if is_big:
            # ── Grosse table : batched ──
            print(f"\n  [{ts()}] UPDATE {table}.{col} (~{est_count:,} lignes, {n_batches} batches)...")
            total = 0

            if dry_run:
                total = est_count
            else:
                for batch_idx in range(n_batches):
                    batch_ids = all_old_ids[batch_idx * BATCH_SIZE:(batch_idx + 1) * BATCH_SIZE]
                    cur.execute(f"""
                        UPDATE {table} t
                        SET {col} = m.new_id{cast_new}
                        FROM tecdoc_map.type_id_remap m
                        WHERE t.{col}{cast_old} = m.old_id
                          AND m.old_id = ANY(%s)
                    """, (batch_ids,))
                    batch_count = cur.rowcount
                    total += batch_count
                    conn.commit()

                    if (batch_idx + 1) % 3 == 0 or batch_idx == n_batches - 1:
                        pct = (batch_idx + 1) * 100 // n_batches
                        print(f"  [{ts()}]   batch {batch_idx+1}/{n_batches} ({pct}%) — {total:,} lignes cumulées")

            results.append((table, col, total, 'DONE'))
            print(f"  [{ts()}] → {total:,} lignes total")
        else:
            # ── Petite table : single UPDATE ──
            print(f"\n  [{ts()}] UPDATE {table}.{col} (~{est_count:,} lignes)...")
            if dry_run:
                cnt = est_count
            else:
                cur.execute(f"""
                    UPDATE {table} t
                    SET {col} = m.new_id{cast_new}
                    FROM tecdoc_map.type_id_remap m
                    WHERE t.{col}{cast_old} = m.old_id
                """)
                cnt = cur.rowcount
                conn.commit()
            results.append((table, col, cnt, 'DONE'))
            print(f"  [{ts()}] → {cnt:,} lignes")

    # ── auto_type PK en dernier ──
    print(f"\n  [{ts()}] UPDATE auto_type (type_id PK + type_id_i)...")
    if dry_run:
        cur.execute("SELECT COUNT(*) FROM auto_type WHERE type_id::int >= %s", (TECDOC_THRESHOLD,))
        cnt = cur.fetchone()[0]
    else:
        cur.execute("""
            UPDATE auto_type t
            SET type_id   = m.new_id::text,
                type_id_i = m.new_id
            FROM tecdoc_map.type_id_remap m
            WHERE t.type_id::int = m.old_id
        """)
        cnt = cur.rowcount
        conn.commit()
    results.append(('auto_type', 'type_id + type_id_i (PK)', cnt, 'DONE'))
    print(f"  [{ts()}] → {cnt:,} types remappés")

    # ── Réactiver les FK constraints ──
    if not dry_run:
        print(f"\n  [{ts()}] Réactivation FK checks (session_replication_role = origin)...")
        cur.execute("SET session_replication_role = 'origin'")
        conn.commit()
        print(f"  [{ts()}] FK checks réactivés.")

    return results


# ============================================================
# VERIFICATION POST-REMAP
# ============================================================

def verify_integrity(conn):
    """Vérifie qu'il ne reste plus de type_id >= THRESHOLD."""
    cur = conn.cursor()
    checks = [
        ("auto_type", "type_id::int"),
        ("auto_type_number_code", "tnc_type_id::int"),
        ("__cross_gamme_car_new", "cgc_type_id::int"),
        ("pieces_relation_type", "rtp_type_id"),
        ("pieces_relation_criteria", "rcp_type_id"),
    ]

    print(f"\n  [{ts()}] Vérification intégrité...")
    all_ok = True
    for table, col in checks:
        try:
            cur.execute(f"SELECT COUNT(*) FROM {table} WHERE {col} >= %s", (TECDOC_THRESHOLD,))
            cnt = cur.fetchone()[0]
            status = 'OK' if cnt == 0 else f'RESTE {cnt:,}'
            print(f"    {table}.{col}: {status}")
            if cnt > 0:
                all_ok = False
        except Exception as e:
            print(f"    {table}.{col}: ERREUR {e}")
            conn.rollback()
            all_ok = False

    return all_ok


# ============================================================
# MAIN
# ============================================================

def main():
    parser = argparse.ArgumentParser(description='Fix TecDoc vehicles → massdoc')
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--dry-run', action='store_true', help='Afficher sans modifier')
    group.add_argument('--execute', action='store_true', help='Appliquer les corrections')
    parser.add_argument('--phase', choices=['naming', 'mapping', 'remap', 'all'],
                        default='all', help='Phase à exécuter')
    args = parser.parse_args()

    dry_run = args.dry_run
    mode = "DRY-RUN" if dry_run else "EXÉCUTION"
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    log_dir = f'/opt/automecanik/app/scripts/logs/vehicle-fix-{timestamp}'
    os.makedirs(log_dir, exist_ok=True)

    print(f"\n{'='*60}")
    print(f"  fix-vehicles-massdoc.py — {mode}")
    print(f"  Phase: {args.phase}")
    print(f"  Connexion directe port 5432 (no timeout)")
    print(f"  Logs: {log_dir}/")
    print(f"{'='*60}")

    conn = connect()
    print(f"  [{ts()}] Connecté.\n")

    try:
        # ── Phase 1: Naming ──
        if args.phase in ('naming', 'all'):
            print("━━━ PHASE 1: Correction naming (name_url + alias) ━━━")
            count_t, count_m = phase_naming(conn, dry_run, log_dir)
            print(f"\n  Résultat: {count_t} types + {count_m} modèles {'proposés' if dry_run else 'corrigés'}")

        # ── Phase 2: Mapping ──
        if args.phase in ('mapping', 'all'):
            print("\n━━━ PHASE 2: Création mapping type_id ━━━")
            count_map = phase_create_mapping(conn, log_dir)
            print(f"\n  Résultat: {count_map} types mappés")
        elif args.phase == 'remap':
            # Vérifier que le mapping existe déjà
            cur_check = conn.cursor()
            cur_check.execute("SELECT COUNT(*) FROM tecdoc_map.type_id_remap")
            existing = cur_check.fetchone()[0]
            if existing == 0:
                print("\n  ERREUR: tecdoc_map.type_id_remap est vide. Lancer --phase mapping d'abord.")
                sys.exit(1)
            print(f"\n  Mapping existant: {existing} entrées (réutilisé)")

        # ── Phase 3: Remap ──
        if args.phase in ('remap', 'all'):
            print("\n━━━ PHASE 3: Remap type_id dans toutes les tables ━━━")
            results = phase_remap_type(conn, dry_run)
            total_rows = sum(r[2] for r in results)
            print(f"\n  Résultat: {total_rows:,} lignes {'comptées' if dry_run else 'mises à jour'}")

            for r in results:
                table, col, cnt = r[0], r[1], r[2]
                status = r[3] if len(r) > 3 else ''
                suffix = f" ({status})" if status else ''
                print(f"    {table}.{col}: {cnt:,}{suffix}")

        # ── Vérification ──
        if not dry_run and args.phase in ('remap', 'all'):
            ok = verify_integrity(conn)
            if ok:
                print("\n  ✓ Aucun type_id >= 100K restant. Intégrité OK.")
            else:
                print("\n  ✗ Des type_id >= 100K restent. Vérifier manuellement.")

        print(f"\n{'='*60}")
        print(f"  Terminé. Logs: {log_dir}/")
        print(f"{'='*60}\n")

    except Exception as e:
        # Réactiver les FK checks même en cas d'erreur
        try:
            cur2 = conn.cursor()
            cur2.execute("SET session_replication_role = 'origin'")
            conn.commit()
            print(f"\n  [{ts()}] FK checks réactivés après erreur.")
        except Exception:
            pass
        conn.rollback()
        print(f"\n  ✗ ERREUR — Rollback : {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        conn.close()


if __name__ == '__main__':
    main()
