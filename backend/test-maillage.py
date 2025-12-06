#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Test du maillage interne - Vérifie que les liens sont correctement générés
"""

import json
import urllib.request
import re

def fetch_api_data():
    """Récupère les données de l'API"""
    url = "http://localhost:3000/api/gamme-rest/402/page-data-rpc-v2"
    with urllib.request.urlopen(url) as response:
        return json.loads(response.read().decode('utf-8'))

def create_gamme_keywords(catalogue_famille):
    """Crée un dictionnaire des mots-clés pour le maillage"""
    keywords = {}
    
    if not catalogue_famille:
        return keywords
    
    for item in catalogue_famille:
        if not item.get('name') or not item.get('alias') or not item.get('id'):
            continue
        
        name = item['name'].lower()
        keywords[name] = item
        
        # Ajouter le pluriel
        if not name.endswith('s'):
            keywords[name + 's'] = item
        
        # Gérer les accents
        if name.startswith('é'):
            keywords[name.replace('é', 'e')] = item
            keywords[(name + 's').replace('é', 'e')] = item
    
    return keywords

def find_gamme_mentions(text, keywords):
    """Trouve les mentions de gammes dans un texte"""
    mentions = []
    text_lower = text.lower()
    
    # Trier par longueur décroissante pour matcher les plus longs d'abord
    sorted_keywords = sorted(keywords.keys(), key=len, reverse=True)
    
    for keyword in sorted_keywords:
        if keyword in text_lower:
            gamme = keywords[keyword]
            mentions.append({
                'keyword': keyword,
                'gamme_name': gamme['name'],
                'link': f"/pieces/{gamme['alias']}-{gamme['id']}.html"
            })
    
    return mentions

def main():
    print("=" * 60)
    print("🔗 TEST DU MAILLAGE INTERNE - Page Plaquette de frein (402)")
    print("=" * 60)
    
    # 1. Récupérer les données
    print("\n📡 Récupération des données de l'API...")
    try:
        data = fetch_api_data()
        print("✅ Données récupérées avec succès")
    except Exception as e:
        print(f"❌ Erreur: {e}")
        return
    
    # 2. Vérifier catalogueMameFamille
    catalogue = data.get('catalogueMameFamille', {})
    items = catalogue.get('items', [])
    
    print(f"\n📦 Catalogue Même Famille:")
    print(f"   Titre: {catalogue.get('title', 'N/A')}")
    print(f"   Nombre d'items: {len(items)}")
    
    if items:
        print("\n   Gammes disponibles pour maillage:")
        for item in items[:10]:
            print(f"   - {item.get('name')} → {item.get('alias')}-{item.get('id')}")
    
    # 3. Créer les mots-clés
    keywords = create_gamme_keywords(items)
    print(f"\n🔑 Mots-clés générés: {len(keywords)}")
    print("   Exemples:")
    for i, (k, v) in enumerate(list(keywords.items())[:10]):
        print(f"   - '{k}' → {v['name']}")
    
    # 4. Tester avec les informations
    informations = data.get('informations', {})
    info_items = informations.get('items', [])
    
    print(f"\n📚 Test avec Informations ({len(info_items)} items):")
    
    mentions_found = 0
    for i, info in enumerate(info_items[:15]):
        mentions = find_gamme_mentions(info, keywords)
        if mentions:
            mentions_found += len(mentions)
            print(f"\n   [{i+1}] \"{info[:80]}...\"")
            for m in mentions:
                print(f"       🔗 '{m['keyword']}' → {m['link']}")
    
    print(f"\n   ✅ Total mentions trouvées: {mentions_found}")
    
    # 5. Tester avec les conseils
    conseils = data.get('conseils', {})
    conseil_items = conseils.get('items', [])
    
    print(f"\n💡 Test avec Conseils ({len(conseil_items)} items):")
    
    for conseil in conseil_items[:5]:
        content = conseil.get('content', '')
        mentions = find_gamme_mentions(content, keywords)
        if mentions:
            print(f"\n   [{conseil.get('id')}] {conseil.get('title', 'N/A')[:50]}")
            for m in mentions:
                print(f"       🔗 '{m['keyword']}' → {m['link']}")
    
    # 6. Résumé
    print("\n" + "=" * 60)
    print("📊 RÉSUMÉ DU MAILLAGE")
    print("=" * 60)
    print(f"   Gammes disponibles: {len(items)}")
    print(f"   Mots-clés générés: {len(keywords)}")
    print(f"   Informations: {len(info_items)} items")
    print(f"   Conseils: {len(conseil_items)} items")
    
    # Test spécifique "disques de frein"
    print("\n🎯 Test spécifique 'disques de frein':")
    test_text = "Les plaquettes de frein servent à bloquer les disques de frein"
    
    if 'disques de frein' in keywords:
        gamme = keywords['disques de frein']
        print(f"   ✅ 'disques de frein' trouvé → {gamme['name']} ({gamme['alias']}-{gamme['id']})")
    elif 'disque de frein' in keywords:
        gamme = keywords['disque de frein']
        print(f"   ✅ 'disque de frein' trouvé (singulier) → {gamme['name']} ({gamme['alias']}-{gamme['id']})")
    else:
        print("   ❌ 'disque de frein' non trouvé dans les keywords")
        print(f"   Keywords contenant 'disque': {[k for k in keywords.keys() if 'disque' in k]}")

if __name__ == "__main__":
    main()
