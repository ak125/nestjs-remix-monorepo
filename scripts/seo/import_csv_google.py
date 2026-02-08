#!/usr/bin/env python3
"""
Import CSV Google Keyword Planner vers __seo_keywords_clean

Usage:
    python import_csv_google.py <csv_path> <pg_id>

Exemple:
    python import_csv_google.py "/opt/automecanik/app/Keyword Stats 2026-02-01 at 18_46_51.csv" 7
"""
from __future__ import annotations
import re
import pandas as pd
from typing import Optional, Tuple
import os
import sys
from dotenv import load_dotenv
from supabase import create_client

# Charger .env depuis backend
env_path = '/opt/automecanik/app/backend/.env'
if os.path.exists(env_path):
    load_dotenv(env_path)
else:
    load_dotenv()


# ============================================================
# PATTERNS DE PARSING
# ============================================================

# Mapping modèles (keyword → model normalisé)
MODEL_PATTERNS = [
    # Renault
    (r'clio\s*5|clio\s*v\b', 'clio v'),
    (r'clio\s*4\s*break|clio\s*iv\s*break', 'clio iv break'),
    (r'clio\s*4|clio\s*iv\b', 'clio iv'),
    (r'clio\s*3\s*break|clio\s*iii\s*break', 'clio iii break'),
    (r'clio\s*3|clio\s*iii\b', 'clio iii'),
    (r'clio\s*2|clio\s*ii\b', 'clio ii'),
    (r'clio\s*1|clio\s*i\b', 'clio i'),
    (r'megane\s*4|megane\s*iv\b', 'megane iv'),
    (r'megane\s*3|megane\s*iii\b', 'megane iii'),
    (r'megane\s*2|megane\s*ii\b', 'megane ii'),
    (r'megane\s*1|megane\s*i\b', 'megane i'),
    (r'scenic\s*4|scenic\s*iv\b', 'scenic iv'),
    (r'scenic\s*3|scenic\s*iii\b', 'scenic iii'),
    (r'scenic\s*2|scenic\s*ii\b', 'scenic ii'),
    (r'scenic\s*1|scenic\s*i\b', 'scenic i'),
    (r'twingo\s*3|twingo\s*iii\b', 'twingo iii'),
    (r'twingo\s*2|twingo\s*ii\b', 'twingo ii'),
    (r'twingo\s*1|twingo\s*i\b', 'twingo i'),
    (r'captur\s*2|captur\s*ii\b', 'captur ii'),
    (r'captur\s*1|captur\s*i\b', 'captur'),
    (r'kadjar', 'kadjar'),
    (r'kangoo\s*2|kangoo\s*ii\b', 'kangoo ii'),
    (r'kangoo', 'kangoo'),
    (r'laguna\s*3|laguna\s*iii\b', 'laguna iii'),
    (r'laguna\s*2|laguna\s*ii\b', 'laguna ii'),
    (r'laguna', 'laguna'),
    (r'trafic\s*3|trafic\s*iii\b', 'trafic iii'),
    (r'trafic\s*2|trafic\s*ii\b', 'trafic ii'),
    (r'trafic', 'trafic'),
    (r'master\s*3|master\s*iii\b', 'master iii'),
    (r'master\s*2|master\s*ii\b', 'master ii'),
    (r'master', 'master'),

    # Peugeot
    (r'\b5008\b', '5008'),
    (r'\b3008\s*2|3008\s*ii\b', '3008 ii'),
    (r'\b3008\b', '3008'),
    (r'\b2008\s*2|2008\s*ii\b', '2008 ii'),
    (r'\b2008\b', '2008'),
    (r'\b508\s*2|508\s*ii\b', '508 ii'),
    (r'\b508\b', '508'),
    (r'\b408\b', '408'),
    (r'\b308\s*2|308\s*ii\b', '308 ii'),
    (r'\b308\b', '308'),
    (r'\b208\s*2|208\s*ii\b', '208 ii'),
    (r'\b208\b', '208'),
    (r'\b207\b', '207'),
    (r'\b206\s*\+|206\s*plus\b', '206+'),
    (r'\b206\b', '206'),
    (r'\b107\b', '107'),
    (r'\b106\s*2|106\s*ii\b', '106 ii'),
    (r'\b106\b', '106'),
    (r'partner\s*2|partner\s*ii\b', 'partner ii'),
    (r'partner', 'partner'),
    (r'expert\s*3|expert\s*iii\b', 'expert iii'),
    (r'expert', 'expert'),
    (r'boxer\s*3|boxer\s*iii\b', 'boxer iii'),
    (r'boxer', 'boxer'),

    # Citroen
    (r'c5\s*aircross', 'c5 aircross'),
    (r'c5\s*2|c5\s*ii\b', 'c5 ii'),
    (r'c5\b', 'c5'),
    (r'c4\s*picasso\s*2|c4\s*picasso\s*ii\b', 'c4 picasso ii'),
    (r'c4\s*picasso', 'c4 picasso'),
    (r'c4\s*cactus', 'c4 cactus'),
    (r'c4\s*2|c4\s*ii\b', 'c4 ii'),
    (r'c4\b', 'c4'),
    (r'c3\s*aircross', 'c3 aircross'),
    (r'c3\s*picasso', 'c3 picasso'),
    (r'c3\s*pluriel', 'c3 pluriel'),
    (r'c3\s*3|c3\s*iii\b', 'c3 iii'),
    (r'c3\s*2|c3\s*ii\b', 'c3 ii'),
    (r'c3\b', 'c3 i'),
    (r'c2\b', 'c2'),
    (r'c1\s*2|c1\s*ii\b', 'c1 ii'),
    (r'c1\b', 'c1'),
    (r'berlingo\s*3|berlingo\s*iii\b', 'berlingo iii'),
    (r'berlingo\s*2|berlingo\s*ii\b', 'berlingo ii'),
    (r'berlingo', 'berlingo'),
    (r'jumpy\s*3|jumpy\s*iii\b', 'jumpy iii'),
    (r'jumpy', 'jumpy'),
    (r'jumper\s*3|jumper\s*iii\b', 'jumper iii'),
    (r'jumper', 'jumper'),
    (r'ds3\b', 'ds3'),
    (r'ds4\b', 'ds4'),
    (r'ds5\b', 'ds5'),
    (r'ds7\b', 'ds7'),
    (r'saxo', 'saxo'),
    (r'xsara\s*picasso', 'xsara picasso'),
    (r'xsara', 'xsara'),

    # Volkswagen
    (r'golf\s*8|golf\s*viii\b', 'golf viii'),
    (r'golf\s*7|golf\s*vii\b', 'golf vii'),
    (r'golf\s*6|golf\s*vi\b', 'golf vi'),
    (r'golf\s*5|golf\s*v\b', 'golf v'),
    (r'golf\s*4|golf\s*iv\b', 'golf iv'),
    (r'golf\s*3|golf\s*iii\b', 'golf iii'),
    (r'golf\s*2|golf\s*ii\b', 'golf ii'),
    (r'golf\s*1|golf\s*i\b', 'golf i'),
    (r'polo\s*6|polo\s*vi\b', 'polo vi'),
    (r'polo\s*5|polo\s*v\b', 'polo v'),
    (r'polo\s*4|polo\s*iv\b', 'polo iv'),
    (r'polo', 'polo'),
    (r'passat\s*b8', 'passat b8'),
    (r'passat\s*b7', 'passat b7'),
    (r'passat\s*b6', 'passat b6'),
    (r'passat', 'passat'),
    (r'tiguan\s*2|tiguan\s*ii\b', 'tiguan ii'),
    (r'tiguan', 'tiguan'),
    (r't-roc|troc', 't-roc'),
    (r'touran\s*2|touran\s*ii\b', 'touran ii'),
    (r'touran', 'touran'),
    (r'caddy\s*4|caddy\s*iv\b', 'caddy iv'),
    (r'caddy', 'caddy'),
    (r'transporter\s*t6', 'transporter t6'),
    (r'transporter\s*t5', 'transporter t5'),
    (r'transporter', 'transporter'),

    # Audi
    (r'a1\s*2|a1\s*ii\b', 'a1 ii'),
    (r'a1\b', 'a1'),
    (r'a3\s*8v', 'a3 8v'),
    (r'a3\s*8p', 'a3 8p'),
    (r'a3\b', 'a3'),
    (r'a4\s*b9', 'a4 b9'),
    (r'a4\s*b8', 'a4 b8'),
    (r'a4\s*b7', 'a4 b7'),
    (r'a4\s*b6', 'a4 b6'),
    (r'a4\b', 'a4'),
    (r'a5\b', 'a5'),
    (r'a6\s*c7', 'a6 c7'),
    (r'a6\s*c6', 'a6 c6'),
    (r'a6\b', 'a6'),
    (r'q3\s*2|q3\s*ii\b', 'q3 ii'),
    (r'q3\b', 'q3'),
    (r'q5\s*2|q5\s*ii\b', 'q5 ii'),
    (r'q5\b', 'q5'),
    (r'q7\b', 'q7'),
    (r'tt\b', 'tt'),

    # BMW
    (r'serie\s*1\s*f20|serie\s*1\s*f21', 'serie 1 f20'),
    (r'serie\s*1\s*e87|serie\s*1\s*e81', 'serie 1 e87'),
    (r'serie\s*1', 'serie 1'),
    (r'serie\s*2\s*f22|serie\s*2\s*f23', 'serie 2 f22'),
    (r'serie\s*2', 'serie 2'),
    (r'serie\s*3\s*g20', 'serie 3 g20'),
    (r'serie\s*3\s*f30', 'serie 3 f30'),
    (r'serie\s*3\s*e90', 'serie 3 e90'),
    (r'serie\s*3\s*e46', 'serie 3 e46'),
    (r'serie\s*3', 'serie 3'),
    (r'serie\s*5\s*g30', 'serie 5 g30'),
    (r'serie\s*5\s*f10', 'serie 5 f10'),
    (r'serie\s*5\s*e60', 'serie 5 e60'),
    (r'serie\s*5', 'serie 5'),
    (r'x1\s*f48', 'x1 f48'),
    (r'x1\s*e84', 'x1 e84'),
    (r'x1\b', 'x1'),
    (r'x3\s*g01', 'x3 g01'),
    (r'x3\s*f25', 'x3 f25'),
    (r'x3\b', 'x3'),
    (r'x5\s*g05', 'x5 g05'),
    (r'x5\s*f15', 'x5 f15'),
    (r'x5\b', 'x5'),

    # Ford
    (r'fiesta\s*7|fiesta\s*vii\b', 'fiesta vii'),
    (r'fiesta\s*6|fiesta\s*vi\b', 'fiesta vi'),
    (r'fiesta\s*5|fiesta\s*v\b', 'fiesta v'),
    (r'fiesta', 'fiesta'),
    (r'focus\s*4|focus\s*iv\b', 'focus iv'),
    (r'focus\s*3|focus\s*iii\b', 'focus iii'),
    (r'focus\s*2|focus\s*ii\b', 'focus ii'),
    (r'focus', 'focus'),
    (r'kuga\s*2|kuga\s*ii\b', 'kuga ii'),
    (r'kuga', 'kuga'),
    (r'mondeo\s*5|mondeo\s*v\b', 'mondeo v'),
    (r'mondeo\s*4|mondeo\s*iv\b', 'mondeo iv'),
    (r'mondeo', 'mondeo'),
    (r'c-max|cmax', 'c-max'),
    (r's-max|smax', 's-max'),
    (r'transit\s*custom', 'transit custom'),
    (r'transit\s*connect', 'transit connect'),
    (r'transit', 'transit'),
    (r'ranger', 'ranger'),

    # Fiat
    (r'500\s*x', '500x'),
    (r'500\s*l', '500l'),
    (r'\b500\b', '500'),
    (r'panda\s*3|panda\s*iii\b', 'panda iii'),
    (r'panda', 'panda'),
    (r'punto\s*3|punto\s*iii\b|grande\s*punto', 'punto iii'),
    (r'punto\s*2|punto\s*ii\b', 'punto ii'),
    (r'punto', 'punto'),
    (r'tipo\s*2|tipo\s*ii\b', 'tipo ii'),
    (r'tipo', 'tipo'),
    (r'ducato\s*3|ducato\s*iii\b', 'ducato iii'),
    (r'ducato', 'ducato'),
    (r'doblo\s*2|doblo\s*ii\b', 'doblo ii'),
    (r'doblo', 'doblo'),

    # Opel
    (r'corsa\s*f', 'corsa f'),
    (r'corsa\s*e', 'corsa e'),
    (r'corsa\s*d', 'corsa d'),
    (r'corsa\s*c', 'corsa c'),
    (r'corsa\s*b', 'corsa b'),
    (r'corsa', 'corsa'),
    (r'astra\s*k', 'astra k'),
    (r'astra\s*j', 'astra j'),
    (r'astra\s*h', 'astra h'),
    (r'astra\s*g', 'astra g'),
    (r'astra', 'astra'),
    (r'mokka\s*x', 'mokka x'),
    (r'mokka', 'mokka'),
    (r'crossland', 'crossland'),
    (r'grandland', 'grandland'),
    (r'insignia\s*b', 'insignia b'),
    (r'insignia', 'insignia'),
    (r'zafira\s*c|zafira\s*tourer', 'zafira c'),
    (r'zafira\s*b', 'zafira b'),
    (r'zafira', 'zafira'),
    (r'meriva\s*b', 'meriva b'),
    (r'meriva', 'meriva'),
    (r'vivaro\s*b', 'vivaro b'),
    (r'vivaro', 'vivaro'),
    (r'movano\s*b', 'movano b'),
    (r'movano', 'movano'),

    # Toyota
    (r'yaris\s*4|yaris\s*iv\b', 'yaris iv'),
    (r'yaris\s*3|yaris\s*iii\b', 'yaris iii'),
    (r'yaris', 'yaris'),
    (r'auris\s*2|auris\s*ii\b', 'auris ii'),
    (r'auris', 'auris'),
    (r'corolla\s*e210', 'corolla e210'),
    (r'corolla\s*e160', 'corolla e160'),
    (r'corolla', 'corolla'),
    (r'c-hr|chr', 'c-hr'),
    (r'rav4\s*5|rav4\s*v\b', 'rav4 v'),
    (r'rav4\s*4|rav4\s*iv\b', 'rav4 iv'),
    (r'rav4', 'rav4'),
    (r'aygo\s*x', 'aygo x'),
    (r'aygo', 'aygo'),
    (r'proace', 'proace'),
    (r'hilux', 'hilux'),
    (r'land\s*cruiser', 'land cruiser'),

    # Mercedes
    (r'classe\s*a\s*w177', 'classe a w177'),
    (r'classe\s*a\s*w176', 'classe a w176'),
    (r'classe\s*a\s*w169', 'classe a w169'),
    (r'classe\s*a', 'classe a'),
    (r'classe\s*b\s*w247', 'classe b w247'),
    (r'classe\s*b\s*w246', 'classe b w246'),
    (r'classe\s*b', 'classe b'),
    (r'classe\s*c\s*w205', 'classe c w205'),
    (r'classe\s*c\s*w204', 'classe c w204'),
    (r'classe\s*c\s*w203', 'classe c w203'),
    (r'classe\s*c', 'classe c'),
    (r'classe\s*e\s*w213', 'classe e w213'),
    (r'classe\s*e\s*w212', 'classe e w212'),
    (r'classe\s*e\s*w211', 'classe e w211'),
    (r'classe\s*e', 'classe e'),
    (r'gla\s*h247', 'gla h247'),
    (r'gla\s*x156', 'gla x156'),
    (r'gla\b', 'gla'),
    (r'glc\b', 'glc'),
    (r'gle\b', 'gle'),
    (r'citan', 'citan'),
    (r'vito\s*w447', 'vito w447'),
    (r'vito\s*w639', 'vito w639'),
    (r'vito', 'vito'),
    (r'sprinter\s*3|sprinter\s*iii\b', 'sprinter iii'),
    (r'sprinter', 'sprinter'),
]

# Patterns pour énergie
ENERGY_PATTERNS = [
    (r'\bdci\b|\bhdi\b|\btdi\b|\bcdti\b|\bjtd\b|\bddis\b|\bblue\s*hdi\b|\bd4d\b|\bcdi\b|\bcrdi\b|\bmjtd\b|\bjtdm\b|\bddct\b|\bdiesel\b', 'diesel'),
    (r'\btce\b|\btsi\b|\btfsi\b|\bgti\b|\bvti\b|\bvvti\b|\bvvt-i\b|\bi-vtec\b|\bpuretech\b|\becoboost\b|\bessence\b|\b16v\b|\b8v\b', 'essence'),
]

# Pattern pour variant (motorisation)
VARIANT_PATTERN = r'(\d+[\.,]?\d*)\s*(dci|hdi|tdi|cdti|jtd|tce|tsi|tfsi|gti|vti|puretech|ecoboost|cv|ch|d4d|cdi|crdi|mjtd|jtdm)?(\s*\d{2,3}\s*(cv|ch)?)?'


def parse_keyword(keyword: str) -> dict:
    """
    Parse un keyword pour extraire model, energy, variant
    """
    kw_lower = keyword.lower().strip()

    result = {
        'model': None,
        'energy': None,
        'variant': None,
    }

    # Extraire model
    for pattern, model in MODEL_PATTERNS:
        if re.search(pattern, kw_lower, re.IGNORECASE):
            result['model'] = model
            break

    # Extraire energy
    for pattern, energy in ENERGY_PATTERNS:
        if re.search(pattern, kw_lower, re.IGNORECASE):
            result['energy'] = energy
            break

    # Extraire variant (motorisation)
    match = re.search(VARIANT_PATTERN, kw_lower, re.IGNORECASE)
    if match:
        variant_parts = [p for p in match.groups() if p]
        if variant_parts:
            result['variant'] = ' '.join(variant_parts).strip()

    return result


def get_supabase_client():
    """Créer le client Supabase"""
    url = os.environ.get('SUPABASE_URL')
    key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    if not url or not key:
        print("ERROR: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found")
        sys.exit(1)
    return create_client(url, key)


def import_csv(csv_path: str, pg_id: int, dry_run: bool = False):
    """Import CSV Google Keyword Planner"""
    print(f"{'='*60}")
    print(f"Import CSV Google → __seo_keywords_clean")
    print(f"{'='*60}")
    print(f"  Fichier: {csv_path}")
    print(f"  pg_id: {pg_id}")
    print(f"  dry_run: {dry_run}")

    # 1. Lire CSV (UTF-16)
    print(f"\n[1/4] Lecture CSV...")
    df = pd.read_csv(csv_path, encoding='utf-16', sep='\t', skiprows=2)
    print(f"  → {len(df)} lignes brutes")

    # 2. Renommer colonnes
    df = df.rename(columns={
        'Keyword': 'keyword',
        'Avg. monthly searches': 'volume'
    })

    # 3. Garder seulement keyword + volume
    df = df[['keyword', 'volume']].copy()
    df['volume'] = pd.to_numeric(df['volume'], errors='coerce').fillna(0).astype(int)

    # Filtrer volume > 0 (ignorer keywords sans recherche)
    df = df[df['volume'] > 0]
    print(f"  → {len(df)} keywords avec volume > 0")

    # 4. Parser chaque keyword
    print(f"\n[2/4] Parsing keywords...")
    parsed = df['keyword'].apply(parse_keyword)
    df['model'] = parsed.apply(lambda x: x['model'])
    df['energy'] = parsed.apply(lambda x: x['energy'])
    df['variant'] = parsed.apply(lambda x: x['variant'])
    df['keyword_normalized'] = df['keyword'].str.lower().str.strip()
    df['pg_id'] = pg_id
    df['source'] = 'google_csv'

    # Stats parsing
    with_model = df['model'].notna().sum()
    with_energy = df['energy'].notna().sum()
    with_variant = df['variant'].notna().sum()
    print(f"  → {with_model}/{len(df)} avec model")
    print(f"  → {with_energy}/{len(df)} avec energy")
    print(f"  → {with_variant}/{len(df)} avec variant")

    # 5. Préparer records
    print(f"\n[3/4] Préparation records...")
    records = df[['keyword', 'keyword_normalized', 'volume', 'model', 'energy', 'variant', 'pg_id', 'source']].to_dict('records')

    # Remplacer NaN par None
    for r in records:
        for k, v in r.items():
            if pd.isna(v):
                r[k] = None

    print(f"  → {len(records)} records à insérer")

    if dry_run:
        print(f"\n[DRY RUN] Pas d'insertion")
        # Afficher quelques exemples
        print(f"\nExemples:")
        for r in records[:10]:
            print(f"  {r['keyword'][:50]:50} vol={r['volume']:4} model={r['model'] or '-':15} energy={r['energy'] or '-':8} variant={r['variant'] or '-'}")
        return

    # 6. Insérer dans Supabase
    print(f"\n[4/4] Insertion Supabase...")
    supabase = get_supabase_client()

    BATCH = 500
    inserted = 0
    for i in range(0, len(records), BATCH):
        batch = records[i:i+BATCH]
        try:
            supabase.table('__seo_keywords_clean').upsert(
                batch,
                on_conflict='keyword_normalized,pg_id'
            ).execute()
            inserted += len(batch)
            print(f"    Batch {i+len(batch)}/{len(records)} ✓")
        except Exception as e:
            print(f"    Batch {i+len(batch)}/{len(records)} ✗ {e}")

    print(f"\n{'='*60}")
    print(f"✅ Import terminé")
    print(f"{'='*60}")
    print(f"  Keywords insérés: {inserted}")
    print(f"  Avec model: {with_model}")
    print(f"  Avec energy: {with_energy}")
    print(f"  Avec variant: {with_variant}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python import_csv_google.py <csv_path> <pg_id> [--dry-run]")
        print("Exemple: python import_csv_google.py '/path/to/keywords.csv' 7")
        sys.exit(1)

    csv_path = sys.argv[1]
    pg_id = int(sys.argv[2])
    dry_run = '--dry-run' in sys.argv

    if not os.path.exists(csv_path):
        print(f"ERROR: Fichier non trouvé: {csv_path}")
        sys.exit(1)

    import_csv(csv_path, pg_id, dry_run=dry_run)
