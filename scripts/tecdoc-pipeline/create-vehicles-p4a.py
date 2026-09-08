#!/usr/bin/env python3
"""
P4a — Create missing auto_modele + auto_type for active constructeurs, post-2010.
V2 — Conventions massdoc verifiees en DB (2026-03-23).

Conventions massdoc:
  modele_id = KMODNR TecDoc directement (PAS marque*1000+seq)
  type_id   = KTYPNR TecDoc directement
  modele_name     = t012 FR brut, tronque a 40 chars
  modele_name_url = regex nettoyage codes chassis (...), tronque a 40 chars
  modele_alias    = slugify(name_url), tronque a 40 chars
  modele_ful_name = MARQUE_NAME + " " + modele_name, tronque a 255 chars
  type_name       = t012 FR brut
  type_name_url   = copie de type_name (reecriture editoriale manuelle ulterieurement)
  type_name_meta  = copie de type_name
  type_alias      = slugify(type_name_url)
  type_liter      = col13 directement (deja en centilitres dans t120)
  type_power_ps   = CH direct (t120.col10)
  type_power_kw   = kW direct (t120.col9)
  display = 0 partout (validation manuelle avant activation)

Gates:
  - ON CONFLICT DO NOTHING sur tous les INSERT
  - JAMAIS toucher aux URLs/alias existants
  - display = 0, relfollow = 0, sitemap = 0

Usage:
  python3 create-vehicles-p4a.py --dry-run    # Audit + rapport
  python3 create-vehicles-p4a.py --execute    # Creer les vehicules
"""
import psycopg2, time, sys, argparse, re, unicodedata

def get_pw():
    with open('/opt/automecanik/app/backend/.env') as f:
        for line in f:
            if line.startswith('SUPABASE_DB_PASSWORD='):
                return line.strip().split('=', 1)[1]
    raise RuntimeError('PW not found')

PW = get_pw()

def get_conn(timeout=600000):
    conn = psycopg2.connect(
        host='aws-0-eu-west-3.pooler.supabase.com', port=6543,
        user='postgres.cxpojprgwgubzjyqzmoq', password=PW, dbname='postgres',
        options=f'-c statement_timeout={timeout}')
    conn.autocommit = True
    return conn

def log(msg):
    ts = time.strftime('%Y-%m-%d %H:%M:%S')
    print(f"[{ts}] {msg}", flush=True)


# ============ Slugify ============

def slugify(text):
    """Slugify massdoc: lowercase, accents->ascii, espaces/points/slashs -> tirets, max 40 chars."""
    if not text:
        return ''
    # Normalize unicode (e -> e, etc.)
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('ascii')
    text = text.lower().strip()
    # Replace . / spaces with -
    text = re.sub(r'[\s./]+', '-', text)
    # Remove anything not alphanumeric or -
    text = re.sub(r'[^a-z0-9-]', '', text)
    # Collapse multiple -
    text = re.sub(r'-+', '-', text).strip('-')
    return text[:40]


def clean_modele_name_url(name):
    """Remove chassis codes in parentheses: (E90), (8VA, 8VF), (B904), etc."""
    if not name:
        return ''
    # Remove (...) containing uppercase letters/numbers/commas/spaces
    cleaned = re.sub(r'\s*\([A-Z0-9,_ ./-]+\)\s*', ' ', name).strip()
    # Remove trailing body qualifiers that are sometimes stripped in massdoc
    # Keep as-is for now — manual review will handle edge cases
    return cleaned[:40]


# ============ Fuel mapping ============

FUEL_MAP = {
    '1': ('Essence', 'Essence'),
    '2': ('Diesel', 'Diesel'),
    '3': ('GPL/GNV', 'GPL/GNV'),
    '4': ('Essence', 'Essence'),
    '5': ('Diesel', 'Diesel'),
    '6': ('Diesel', 'Diesel'),
    '40': ('Electrique', 'Electrique'),
    '46': ('Essence-Electrique', 'Hybride'),
    '47': ('Essence-Electrique', 'Hybride'),
    '48': ('Diesel-Electrique', 'Hybride'),
    '49': ('Essence-Electrique', 'Hybride'),
}


# ============ Step 1: Build HERNR -> marque_id mapping ============

def build_hernr_map(cur):
    """Build HERNR->marque_id + marque_name mapping from existing data."""
    cur.execute("""
    SELECT DISTINCT t110.col5::int as hernr, am.marque_id, am.marque_name
    FROM auto_type at2
    JOIN auto_marque am ON am.marque_id = at2.type_marque_id::int AND am.marque_display = 1
    JOIN tecdoc_raw.t120 t120 ON t120.col3 = at2.type_id
    JOIN tecdoc_raw.t110 t110 ON t110.col3 = t120.col5
    """)
    hernr_map = {}
    marque_names = {}
    for hernr, marque_id, marque_name in cur.fetchall():
        hernr_map[hernr] = marque_id
        marque_names[marque_id] = marque_name
    log(f"  HERNR->marque_id: {len(hernr_map)} mappings, {len(marque_names)} marques actives")
    return hernr_map, marque_names


# ============ Step 2: Build MUSTER -> body type mapping ============

def build_body_map(cur):
    """Build MUSTER->type_body from existing auto_type + t145."""
    cur.execute("""
    SELECT t145.muster, at2.type_body, count(*) as cnt
    FROM tecdoc_raw.t145 t145
    JOIN auto_type at2 ON at2.type_id = t145.ktypnr::text
    WHERE t145.sortnr = 1
    GROUP BY t145.muster, at2.type_body
    ORDER BY t145.muster, count(*) DESC
    """)
    body_map = {}
    for muster, body, cnt in cur.fetchall():
        if muster not in body_map:
            body_map[muster] = body
    log(f"  MUSTER->body: {len(body_map)} mappings")
    return body_map


# ============ Step 3: Find missing modeles ============

def find_missing_modeles(cur, hernr_map):
    """Find KMODNR that are in t110 (active HERNR, post-2010 types) but not in auto_modele."""
    cur.execute("""
    SELECT DISTINCT t110.col3::int as kmodnr, t110.col5::int as hernr,
      t110.col4 as lbeznr, t110.col7 as bjvon, t110.col8 as bjbis
    FROM tecdoc_raw.t120 t120
    JOIN tecdoc_raw.t110 t110 ON t110.col3 = t120.col5
    WHERE t120.col30 != '1'
      AND t120.col7::int >= 201001
      AND t110.col5::int = ANY(%s)
      AND NOT EXISTS (SELECT 1 FROM auto_modele am WHERE am.modele_id = t110.col3::int)
    ORDER BY t110.col5::int, kmodnr
    """, (list(hernr_map.keys()),))
    rows = cur.fetchall()
    log(f"  Missing modeles: {len(rows)}")
    return rows


# ============ Step 4: Resolve names from t012 in bulk ============

def resolve_names_bulk(cur, lbeznr_list):
    """Resolve LBEZNR -> French name from t012 (SPRACHNR=6)."""
    if not lbeznr_list:
        return {}
    # Deduplicate
    unique = list(set(int(x) for x in lbeznr_list if x and str(x).isdigit()))
    if not unique:
        return {}
    cur.execute("""
    SELECT lbeznr, bez FROM tecdoc_raw.t012
    WHERE lbeznr = ANY(%s) AND sprachnr = 6
    """, (unique,))
    return {r[0]: r[1] for r in cur.fetchall()}


# ============ Step 5: Create modeles ============

def create_modeles(cur, hernr_map, marque_names, dry_run=True):
    """Create missing auto_modele entries. modele_id = KMODNR."""
    missing = find_missing_modeles(cur, hernr_map)
    if not missing:
        return 0

    # Resolve all names in bulk
    lbeznr_list = [r[2] for r in missing]
    name_map = resolve_names_bulk(cur, lbeznr_list)

    if dry_run:
        log(f"  DRY-RUN: {len(missing)} modeles would be created")
        # Show examples
        for kmodnr, hernr, lbeznr, bjvon, bjbis in missing[:10]:
            lb = int(lbeznr) if lbeznr and str(lbeznr).isdigit() else None
            name = name_map.get(lb, f"Modele {kmodnr}")[:40]
            name_url = clean_modele_name_url(name)
            alias = slugify(name_url)
            marque_id = hernr_map.get(hernr, '?')
            marque_name = marque_names.get(marque_id, '?')
            log(f"    KMODNR={kmodnr} HERNR={hernr} marque={marque_name} "
                f"name='{name}' name_url='{name_url}' alias='{alias}'")
        if len(missing) > 10:
            log(f"    ... et {len(missing) - 10} de plus")
        return len(missing)

    # Execute
    created = 0
    skipped = 0
    for kmodnr, hernr, lbeznr_ref, bjvon, bjbis in missing:
        marque_id = hernr_map.get(hernr)
        if not marque_id:
            skipped += 1
            continue

        # Resolve name
        lb = int(lbeznr_ref) if lbeznr_ref and str(lbeznr_ref).isdigit() else None
        modele_name = name_map.get(lb, '')[:40]
        if not modele_name:
            modele_name = f"Modele {kmodnr}"[:40]

        name_url = clean_modele_name_url(modele_name)
        alias = slugify(name_url)
        marque_name = marque_names.get(marque_id, '')
        ful_name = f"{marque_name} {modele_name}"[:255]

        # Parse dates
        bjvon_s = str(bjvon) if bjvon else ''
        bjbis_s = str(bjbis) if bjbis and str(bjbis) != '0' else ''
        year_from = int(bjvon_s[:4]) if len(bjvon_s) >= 4 else 0
        month_from = int(bjvon_s[4:6]) if len(bjvon_s) >= 6 else 0
        year_to = int(bjbis_s[:4]) if len(bjbis_s) >= 4 else 0
        month_to = int(bjbis_s[4:6]) if len(bjbis_s) >= 6 else 0

        cur.execute("""
        INSERT INTO auto_modele (modele_id, modele_parent, modele_marque_id, modele_mdg_id,
          modele_alias, modele_name, modele_name_url, modele_name_meta, modele_ful_name,
          modele_month_from, modele_year_from, modele_month_to, modele_year_to,
          modele_body, modele_pic, modele_relfollow, modele_sitemap,
          modele_display, modele_display_v1, modele_sort, modele_is_new)
        VALUES (%s, 0, %s, 0, %s, %s, %s, %s, %s, %s, %s, %s, %s, '', '', 0, 0, 0, 0, 0, 1)
        ON CONFLICT (modele_id) DO NOTHING
        """, (kmodnr, marque_id, alias, modele_name, name_url, modele_name, ful_name,
              month_from, year_from, month_to, year_to))
        created += 1

        if created % 200 == 0:
            log(f"  Progress: {created} modeles created")

    log(f"  Created {created} modeles, skipped {skipped}")
    return created


# ============ Step 6: Find missing vehicles ============

def find_missing_vehicles(cur, hernr_map):
    """Find KTYPNR in t120 (active HERNR, post-2010) not in auto_type."""
    cur.execute("""
    SELECT t120.col3::int as ktypnr, t120.col4 as lbeznr, t120.col5::int as kmodnr,
      t110.col5::int as hernr,
      t120.col7 as bjvon, t120.col8 as bjbis,
      t120.col9 as kw, t120.col10 as ps, t120.col13 as hubraum, t120.col20 as fuel_code
    FROM tecdoc_raw.t120 t120
    JOIN tecdoc_raw.t110 t110 ON t110.col3 = t120.col5
    WHERE t120.col30 != '1'
      AND t120.col7::int >= 201001
      AND t110.col5::int = ANY(%s)
      AND NOT EXISTS (SELECT 1 FROM auto_type at2 WHERE at2.type_id = t120.col3)
    ORDER BY t110.col5::int, t120.col3::int
    """, (list(hernr_map.keys()),))
    rows = cur.fetchall()
    log(f"  Missing vehicles: {len(rows)}")
    return rows


# ============ Step 7: Create vehicles ============

def create_vehicles(cur, hernr_map, marque_names, body_map, dry_run=True):
    """Create missing auto_type entries. type_id = KTYPNR."""
    missing = find_missing_vehicles(cur, hernr_map)
    if not missing:
        return 0

    # Resolve names in bulk
    lbeznr_list = [r[1] for r in missing]
    name_map = resolve_names_bulk(cur, lbeznr_list)

    # Get body types for new vehicles
    ktypnr_list = [r[0] for r in missing]
    cur.execute("""
    SELECT ktypnr, muster FROM tecdoc_raw.t145
    WHERE ktypnr = ANY(%s) AND sortnr = 1
    """, (ktypnr_list,))
    ktypnr_body = {r[0]: r[1] for r in cur.fetchall()}

    # Check which KMODNR exist in auto_modele (after our create_modeles step)
    kmodnr_list = list(set(r[2] for r in missing))
    cur.execute("SELECT modele_id FROM auto_modele WHERE modele_id = ANY(%s)", (kmodnr_list,))
    existing_modeles = {r[0] for r in cur.fetchall()}

    if dry_run:
        no_modele = sum(1 for r in missing if r[2] not in existing_modeles)
        log(f"  DRY-RUN: {len(missing)} vehicles would be created, {no_modele} would be skipped (no modele)")
        for row in missing[:10]:
            ktypnr, lbeznr_ref, kmodnr, hernr, bjvon, bjbis, kw, ps, hubraum, fuel_code = row
            lb = int(lbeznr_ref) if lbeznr_ref and str(lbeznr_ref).isdigit() else None
            type_name = name_map.get(lb, f"Type {ktypnr}")
            liter = str(int(hubraum)) if hubraum and str(hubraum).isdigit() and int(hubraum) > 0 else ''
            alias = slugify(type_name)
            fuel_label = FUEL_MAP.get(fuel_code or '', ('', ''))[0]
            marque_id = hernr_map.get(hernr, '?')
            has_modele = '✓' if kmodnr in existing_modeles else '✗'
            log(f"    KTYPNR={ktypnr} KMODNR={kmodnr}({has_modele}) name='{type_name}' "
                f"alias='{alias}' {ps}ch {liter}cl {fuel_label}")
        if len(missing) > 10:
            log(f"    ... et {len(missing) - 10} de plus")
        return len(missing)

    # Execute
    created = 0
    skipped = 0
    batch_values = []

    for ktypnr, lbeznr_ref, kmodnr, hernr, bjvon, bjbis, kw, ps, hubraum, fuel_code in missing:
        marque_id = hernr_map.get(hernr)
        if not marque_id or kmodnr not in existing_modeles:
            skipped += 1
            continue

        # Resolve type_name
        lb = int(lbeznr_ref) if lbeznr_ref and str(lbeznr_ref).isdigit() else None
        type_name = name_map.get(lb, '')
        if not type_name:
            # Fallback: construct from engine data
            cyl = f"{int(hubraum)/1000:.1f}" if hubraum and str(hubraum).isdigit() and int(hubraum) > 0 else ''
            fuel_label = FUEL_MAP.get(fuel_code or '', ('', ''))[0]
            type_name = f"{cyl} {fuel_label}".strip() or f"Type {ktypnr}"

        # Convention massdoc: type_name_url = copie de type_name (reecriture manuelle ulterieure)
        type_name_url = type_name
        type_name_meta = type_name
        alias = slugify(type_name_url)

        # Parse dates
        bjvon_s = str(bjvon) if bjvon else ''
        bjbis_s = str(bjbis) if bjbis and str(bjbis) != '0' else ''
        year_from = bjvon_s[:4] if len(bjvon_s) >= 4 else ''
        month_from = str(int(bjvon_s[4:6])) if len(bjvon_s) >= 6 else ''
        year_to = bjbis_s[:4] if len(bjbis_s) >= 4 else ''
        month_to = str(int(bjbis_s[4:6])) if len(bjbis_s) >= 6 else ''

        # Fuel
        fuel_label, engine_label = FUEL_MAP.get(fuel_code or '', ('', ''))

        # Body type via t145
        muster = ktypnr_body.get(ktypnr, '')
        type_body = body_map.get(muster, '')

        # Convention massdoc: type_liter = cm3 / 10
        liter = str(int(hubraum)) if hubraum and str(hubraum).isdigit() and int(hubraum) > 0 else ''

        # Shadow _i columns
        year_from_i = int(year_from) if year_from else None
        month_from_i = int(month_from) if month_from else None
        year_to_i = int(year_to) if year_to else None
        month_to_i = int(month_to) if month_to else None

        batch_values.append((
            str(ktypnr), '1', alias, str(kmodnr), str(marque_id),
            type_name, type_name_url, type_name_meta,
            engine_label, fuel_label, ps or '', kw or '', liter,
            month_from, year_from, month_to, year_to,
            type_body, '0', '0', '0',
            ktypnr, 1, kmodnr, marque_id,
            month_from_i, year_from_i, month_to_i, year_to_i
        ))

        if len(batch_values) >= 200:
            _insert_batch(cur, batch_values)
            created += len(batch_values)
            batch_values = []
            if created % 1000 == 0:
                log(f"  Progress: {created} created, {skipped} skipped")

    if batch_values:
        _insert_batch(cur, batch_values)
        created += len(batch_values)

    log(f"  Created {created} vehicles, skipped {skipped}")
    return created


def _insert_batch(cur, batch):
    """Insert a batch of auto_type rows with parameterized query."""
    values = []
    for v in batch:
        vals = []
        for x in v:
            if x is None or x == '':
                vals.append('NULL')
            elif isinstance(x, int):
                vals.append(str(x))
            else:
                vals.append("'" + str(x).replace("'", "''") + "'")
        values.append('(' + ','.join(vals) + ')')

    sql = """INSERT INTO auto_type (
      type_id, type_tmf_id, type_alias, type_modele_id, type_marque_id,
      type_name, type_name_url, type_name_meta,
      type_engine, type_fuel, type_power_ps, type_power_kw, type_liter,
      type_month_from, type_year_from, type_month_to, type_year_to,
      type_body, type_relfollow, type_display, type_sort,
      type_id_i, type_tmf_id_i, type_modele_id_i, type_marque_id_i,
      type_month_from_i, type_year_from_i, type_month_to_i, type_year_to_i
    ) VALUES """ + ','.join(values) + " ON CONFLICT (type_id) DO NOTHING"
    cur.execute(sql)


# ============ Main ============

def main():
    parser = argparse.ArgumentParser(description='P4a — Create missing vehicles (massdoc conventions)')
    parser.add_argument('--dry-run', action='store_true', help='Audit + rapport, no writes')
    parser.add_argument('--execute', action='store_true', help='Create modeles + vehicles')
    args = parser.parse_args()

    if not args.dry_run and not args.execute:
        parser.print_help()
        sys.exit(1)

    conn = get_conn()
    cur = conn.cursor()

    log("=== P4a V2: Create missing vehicles (post-2010, active constructeurs, massdoc conventions) ===")
    log(f"  Mode: {'DRY-RUN' if args.dry_run else 'EXECUTE'}")

    # Step 1: Build mappings
    log("\n--- Step 1: Build mappings ---")
    hernr_map, marque_names = build_hernr_map(cur)
    body_map = build_body_map(cur)

    # Step 2: Create missing modeles (modele_id = KMODNR)
    log("\n--- Step 2: Modeles (modele_id = KMODNR) ---")
    modeles = create_modeles(cur, hernr_map, marque_names, dry_run=args.dry_run)

    # Step 3: Create missing vehicles (type_id = KTYPNR)
    log("\n--- Step 3: Vehicles (type_id = KTYPNR) ---")
    vehicles = create_vehicles(cur, hernr_map, marque_names, body_map, dry_run=args.dry_run)

    log(f"\n=== BILAN ===")
    log(f"  Modeles: {modeles}")
    log(f"  Vehicles: {vehicles}")
    log(f"  Mode: {'DRY-RUN' if args.dry_run else 'EXECUTE'}")
    log(f"  Conventions: modele_id=KMODNR, type_id=KTYPNR, type_liter=cm3/10, display=0")

    cur.close()
    conn.close()


if __name__ == '__main__':
    main()
