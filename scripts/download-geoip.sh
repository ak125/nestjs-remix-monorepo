#!/bin/bash

# Script de téléchargement GeoLite2-City.mmdb
# ===========================================
# MaxMind GeoLite2 Free Geolocation Database

echo "🌍 Téléchargement de la GeoLite2 City Database"

# Vérifier si le fichier existe déjà
if [ -f "./geoip/GeoLite2-City.mmdb" ]; then
    echo "✅ GeoLite2-City.mmdb existe déjà"
    echo "📊 Taille: $(ls -lh ./geoip/GeoLite2-City.mmdb | awk '{print $5}')"
    echo "📅 Date: $(ls -l ./geoip/GeoLite2-City.mmdb | awk '{print $6, $7, $8}')"
    read -p "Voulez-vous le remplacer? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Téléchargement annulé"
        exit 0
    fi
fi

# Créer le répertoire geoip s'il n'existe pas
mkdir -p ./geoip

# MÉTHODE 1: Téléchargement direct depuis MaxMind (nécessite une clé API)
# ========================================================================
# Inscription gratuite: https://www.maxmind.com/en/geolite2/signup
# Après inscription, générez une clé de licence et remplacez YOUR_LICENSE_KEY ci-dessous

MAXMIND_LICENSE_KEY="${MAXMIND_LICENSE_KEY:-}"

if [ -n "$MAXMIND_LICENSE_KEY" ]; then
    echo "🔑 Clé de licence détectée, téléchargement depuis MaxMind..."
    
    DOWNLOAD_URL="https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=${MAXMIND_LICENSE_KEY}&suffix=tar.gz"
    
    echo "⬇️  Téléchargement de GeoLite2-City..."
    curl -L -o /tmp/geolite2-city.tar.gz "$DOWNLOAD_URL"
    
    if [ $? -eq 0 ]; then
        echo "📦 Extraction de l'archive..."
        tar -xzf /tmp/geolite2-city.tar.gz -C /tmp
        
        # Trouver le fichier .mmdb dans l'archive extraite
        MMDB_FILE=$(find /tmp -name "GeoLite2-City.mmdb" | head -1)
        
        if [ -n "$MMDB_FILE" ]; then
            mv "$MMDB_FILE" ./geoip/GeoLite2-City.mmdb
            echo "✅ GeoLite2-City.mmdb installé avec succès"
            echo "📊 Taille: $(ls -lh ./geoip/GeoLite2-City.mmdb | awk '{print $5}')"
            
            # Nettoyage
            rm -rf /tmp/geolite2-city.tar.gz /tmp/GeoLite2-City_*
            exit 0
        else
            echo "❌ Erreur: fichier .mmdb non trouvé dans l'archive"
            exit 1
        fi
    else
        echo "❌ Erreur lors du téléchargement"
        exit 1
    fi
fi

# MÉTHODE 2: Téléchargement depuis un miroir alternatif (sans clé API)
# =====================================================================
echo ""
echo "⚠️  Pas de clé de licence MaxMind détectée"
echo ""
echo "Pour télécharger GeoLite2-City.mmdb, vous avez 2 options:"
echo ""
echo "OPTION 1 (Recommandé): Inscription gratuite MaxMind"
echo "  1. Créez un compte: https://www.maxmind.com/en/geolite2/signup"
echo "  2. Générez une clé de licence: https://www.maxmind.com/en/accounts/current/license-key"
echo "  3. Exportez la clé: export MAXMIND_LICENSE_KEY='votre_clé'"
echo "  4. Re-exécutez ce script: ./download-geoip.sh"
echo ""
echo "OPTION 2 (Alternatif): Téléchargement manuel"
echo "  1. Visitez: https://github.com/P3TERX/GeoLite.mmdb"
echo "  2. Téléchargez GeoLite2-City.mmdb"
echo "  3. Placez-le dans: ./geoip/GeoLite2-City.mmdb"
echo ""
echo "OPTION 3 (Mirror GitHub - Non officiel)"
echo "  Téléchargement depuis le mirror P3TERX..."
echo ""

read -p "Télécharger depuis le mirror GitHub non-officiel? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    MIRROR_URL="https://github.com/P3TERX/GeoLite.mmdb/raw/download/GeoLite2-City.mmdb"
    
    echo "⬇️  Téléchargement depuis le mirror..."
    curl -L -o ./geoip/GeoLite2-City.mmdb "$MIRROR_URL"
    
    if [ $? -eq 0 ] && [ -f ./geoip/GeoLite2-City.mmdb ]; then
        echo "✅ GeoLite2-City.mmdb téléchargé avec succès"
        echo "📊 Taille: $(ls -lh ./geoip/GeoLite2-City.mmdb | awk '{print $5}')"
        
        # Vérifier que c'est bien un fichier .mmdb valide (magic bytes)
        if file ./geoip/GeoLite2-City.mmdb | grep -q "data"; then
            echo "✅ Fichier .mmdb valide détecté"
        else
            echo "⚠️  Le fichier téléchargé n'est peut-être pas un .mmdb valide"
            echo "Vérifiez manuellement le contenu du fichier"
        fi
        
        exit 0
    else
        echo "❌ Erreur lors du téléchargement depuis le mirror"
        echo "Veuillez télécharger manuellement depuis MaxMind"
        exit 1
    fi
else
    echo "❌ Téléchargement annulé"
    echo ""
    echo "Pour continuer, obtenez une clé de licence MaxMind gratuite:"
    echo "https://www.maxmind.com/en/geolite2/signup"
    exit 1
fi
