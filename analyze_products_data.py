#!/usr/bin/env python3
"""
🚗 EXPLORATEUR DE DONNÉES PRODUCTS
Analyse des données réelles du système automobile
"""

import json
import requests
from datetime import datetime

# Configuration API
API_BASE = "http://localhost:3000"
HEADERS = {"internal-call": "true"}

def print_header(title):
    print(f"\n{'='*60}")
    print(f"🚗 {title}")
    print(f"{'='*60}")

def print_section(title):
    print(f"\n📊 {title}")
    print("-" * 40)

def get_api_data(endpoint):
    """Récupère les données depuis l'API"""
    try:
        url = f"{API_BASE}{endpoint}"
        print(f"🔗 Appel API: {endpoint}")
        response = requests.get(url, headers=HEADERS, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"❌ Erreur API {endpoint}: {e}")
        return None

def analyze_stats():
    """Analyse les statistiques globales"""
    print_section("STATISTIQUES GLOBALES")
    
    stats = get_api_data("/api/products/stats")
    if stats:
        print(f"📦 Produits totaux: {stats.get('totalProducts', 0):,}")
        print(f"🏷️ Catégories: {stats.get('totalCategories', 0):,}")
        print(f"🚗 Marques: {stats.get('totalBrands', 0):,}")
        print(f"⚠️ Stock faible: {stats.get('lowStockItems', 0):,}")
        print(f"✅ Produits actifs: {stats.get('activeProducts', 0):,}")

def analyze_gammes():
    """Analyse les gammes de produits"""
    print_section("GAMMES DE PRODUITS")
    
    gammes = get_api_data("/api/products/gammes")
    if gammes:
        print(f"📊 Total gammes récupérées: {len(gammes)}")
        
        # Analyse des statuts
        active_count = sum(1 for g in gammes if g.get('is_active', False))
        top_count = sum(1 for g in gammes if g.get('is_top', False))
        
        print(f"✅ Gammes actives: {active_count} ({active_count/len(gammes)*100:.1f}%)")
        print(f"⭐ Gammes TOP: {top_count} ({top_count/len(gammes)*100:.1f}%)")
        
        # Échantillon des gammes
        print(f"\n📋 ÉCHANTILLON DES 20 PREMIÈRES GAMMES:")
        for i, gamme in enumerate(gammes[:20], 1):
            status = "✅" if gamme.get('is_active') else "❌"
            top = "⭐" if gamme.get('is_top') else "  "
            print(f"{i:2d}. {status} {top} [{gamme.get('id')}] {gamme.get('name')[:60]}")
        
        if len(gammes) > 20:
            print(f"... et {len(gammes) - 20} autres gammes")

def analyze_pieces():
    """Analyse les pièces du catalogue"""
    print_section("CATALOGUE DE PIÈCES")
    
    # Récupérer un échantillon de pièces
    pieces_data = get_api_data("/api/products/pieces-catalog?limit=50")
    if pieces_data and 'products' in pieces_data:
        pieces = pieces_data['products']
        print(f"📊 Échantillon récupéré: {len(pieces)} pièces")
        
        # Analyse des statuts
        active_count = sum(1 for p in pieces if p.get('piece_activ', False))
        top_count = sum(1 for p in pieces if p.get('piece_top', False))
        
        print(f"✅ Pièces actives: {active_count} ({active_count/len(pieces)*100:.1f}%)")
        print(f"⭐ Pièces TOP: {top_count} ({top_count/len(pieces)*100:.1f}%)")
        
        # Échantillon des pièces
        print(f"\n📋 ÉCHANTILLON DES 15 PREMIÈRES PIÈCES:")
        for i, piece in enumerate(pieces[:15], 1):
            status = "✅" if piece.get('piece_activ') else "❌"
            top = "⭐" if piece.get('piece_top') else "  "
            name = piece.get('piece_name', 'Sans nom')[:50]
            sku = piece.get('piece_sku', 'N/A')
            print(f"{i:2d}. {status} {top} [{piece.get('piece_id')}] {name} | SKU: {sku}")

def analyze_brands():
    """Analyse les marques automobiles"""
    print_section("MARQUES AUTOMOBILES")
    
    try:
        brands = get_api_data("/api/products/brands")
        if brands:
            print(f"📊 Total marques: {len(brands)}")
            # Afficher quelques marques
            for i, brand in enumerate(brands[:10], 1):
                print(f"{i:2d}. {brand}")
        else:
            print("⚠️ Aucune marque trouvée ou endpoint non disponible")
    except Exception as e:
        print(f"⚠️ Analyse des marques non disponible: {e}")

def main():
    """Fonction principale"""
    print_header("ANALYSE DES DONNÉES PRODUCTS")
    print(f"🕐 Analyse effectuée le: {datetime.now().strftime('%d/%m/%Y à %H:%M:%S')}")
    print(f"🔗 API Backend: {API_BASE}")
    
    # Analyses
    analyze_stats()
    analyze_gammes()
    analyze_pieces()
    analyze_brands()
    
    print_header("ANALYSE TERMINÉE")
    print("💡 Utilisez le fichier products-data-viewer.html pour une interface web")
    print("🚀 Le système Products est opérationnel avec des données réelles !")

if __name__ == "__main__":
    main()
