#!/usr/bin/env python3
"""
Analyse approfondie des pièces sans position détectée
Cherche tous les critères alternatifs contenant "avant", "arrière", "essieu"
"""

import os
from supabase import create_client, Client
from dotenv import load_dotenv
from collections import defaultdict

# Charger les variables d'environnement
load_dotenv('../backend/.env')

# Connexion Supabase
url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
supabase: Client = create_client(url, key)

print("🔍 Analyse approfondie des positions dans pieces_criteria")
print("=" * 80)

# 1. Charger toutes les pièces plaquettes pour le véhicule de test
print("\n📦 Chargement des pièces...")
pieces_response = supabase.table('pieces_relation_type') \
    .select('rtp_piece_id') \
    .eq('rtp_type_id', 18376) \
    .eq('rtp_pg_id', 402) \
    .limit(100) \
    .execute()

piece_ids = [str(p['rtp_piece_id']) for p in pieces_response.data]
print(f"✅ {len(piece_ids)} pièces chargées")

# 2. Charger TOUS les critères pour ces pièces
print(f"\n🔧 Chargement de TOUS les critères pour {len(piece_ids)} pièces...")
all_criterias = supabase.table('pieces_criteria') \
    .select('pc_piece_id, pc_cri_id, pc_cri_value') \
    .in_('pc_piece_id', piece_ids) \
    .execute()

print(f"✅ {len(all_criterias.data)} critères chargés")

# 3. Charger les noms des critères
print("\n📋 Chargement des noms de critères...")
criteria_names = supabase.table('pieces_criteria_link') \
    .select('pcl_cri_id, pcl_cri_criteria') \
    .execute()

criteria_map = {str(c['pcl_cri_id']): c['pcl_cri_criteria'] for c in criteria_names.data}
print(f"✅ {len(criteria_map)} noms de critères chargés")

# 4. Grouper les critères par pièce
print("\n🔍 Analyse des critères par pièce...")
pieces_criterias = defaultdict(list)
for crit in all_criterias.data:
    pieces_criterias[str(crit['pc_piece_id'])].append({
        'id': str(crit['pc_cri_id']),
        'value': crit['pc_cri_value'],
        'name': criteria_map.get(str(crit['pc_cri_id']), f"critère {crit['pc_cri_id']}")
    })

# 5. Identifier les pièces AVEC et SANS critère 100 (Côté d'assemblage)
pieces_avec_100 = []
pieces_sans_100 = []

for piece_id, crits in pieces_criterias.items():
    has_100 = any(c['id'] == '100' for c in crits)
    if has_100:
        pieces_avec_100.append(piece_id)
    else:
        pieces_sans_100.append(piece_id)

print(f"\n📊 Résultats:")
print(f"✅ Pièces AVEC critère 100 (Côté d'assemblage): {len(pieces_avec_100)}")
print(f"❌ Pièces SANS critère 100: {len(pieces_sans_100)}")
print(f"📈 Taux de couverture: {len(pieces_avec_100) / len(piece_ids) * 100:.1f}%")

# 6. Chercher des critères alternatifs contenant des mots-clés de position
print("\n🔎 Recherche de critères alternatifs contenant des mots-clés de position...")
print("   (avant, arrière, essieu, front, rear, axle)")

keywords = ['avant', 'arrière', 'arriere', 'essieu', 'front', 'rear', 'axle']
alternative_criterias = defaultdict(list)

for crit_id, crit_name in criteria_map.items():
    crit_lower = crit_name.lower()
    for keyword in keywords:
        if keyword in crit_lower:
            alternative_criterias[crit_id].append(crit_name)
            break

print(f"\n✅ {len(alternative_criterias)} critères alternatifs trouvés:")
for crit_id, names in sorted(alternative_criterias.items(), key=lambda x: int(x[0])):
    print(f"   🎯 [{crit_id}] {names[0]}")

# 7. Vérifier si les pièces SANS critère 100 ont des critères alternatifs
print(f"\n🔍 Analyse des {len(pieces_sans_100)} pièces SANS critère 100...")
pieces_with_alternatives = 0
alternative_usage = defaultdict(int)

for piece_id in pieces_sans_100[:20]:  # Analyser les 20 premières
    crits = pieces_criterias[piece_id]
    has_alternative = False
    
    for crit in crits:
        if crit['id'] in alternative_criterias:
            has_alternative = True
            alternative_usage[crit['id']] += 1
            print(f"\n🔧 Pièce {piece_id}:")
            print(f"   ✅ A le critère alternatif [{crit['id']}] {crit['name']}: \"{crit['value']}\"")
    
    if has_alternative:
        pieces_with_alternatives += 1
    elif len(crits) > 0:
        print(f"\n🔧 Pièce {piece_id}:")
        print(f"   ❌ Aucun critère de position (ni 100, ni alternatif)")
        print(f"   📋 {len(crits)} critères disponibles:")
        for crit in crits[:3]:
            print(f"      • [{crit['id']}] {crit['name']}: \"{crit['value']}\"")

print(f"\n📊 Résumé des critères alternatifs utilisés:")
if alternative_usage:
    for crit_id, count in sorted(alternative_usage.items(), key=lambda x: x[1], reverse=True):
        crit_name = criteria_map.get(crit_id, f"critère {crit_id}")
        print(f"   🎯 [{crit_id}] {crit_name}: {count} pièces")
else:
    print("   ❌ Aucun critère alternatif trouvé sur les 20 premières pièces")

print(f"\n📈 {pieces_with_alternatives} / 20 pièces ont un critère alternatif")

# 8. Statistiques finales
print("\n" + "=" * 80)
print("📊 STATISTIQUES FINALES")
print("=" * 80)
print(f"Total pièces analysées: {len(piece_ids)}")
print(f"Pièces avec critère 100 (Côté d'assemblage): {len(pieces_avec_100)} ({len(pieces_avec_100) / len(piece_ids) * 100:.1f}%)")
print(f"Pièces sans critère 100: {len(pieces_sans_100)} ({len(pieces_sans_100) / len(piece_ids) * 100:.1f}%)")
print(f"Critères alternatifs identifiés: {len(alternative_criterias)}")
print()
print("✅ Analyse terminée")
