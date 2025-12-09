#!/bin/bash

# Script de tÃ©lÃ©chargement GeoLite2-City.mmdb
# ===========================================
# MaxMind GeoLite2 Free Geolocation Database

echo "ðŸŒ TÃ©lÃ©chargement de la GeoLite2 City Database"

# VÃ©rifier si le fichier existe dÃ©jÃ 
if [ -f "./geoip/GeoLite2-City.mmdb" ]; then
    echo "âœ… GeoLite2-City.mmdb existe dÃ©jÃ "
    echo "ðŸ“Š Taille: $(ls -lh ./geoip/GeoLite2-City.mmdb | awk '{print $5}')"
    echo "ðŸ“… Date: $(ls -l ./geoip/GeoLite2-City.mmdb | awk '{print $6, $7, $8}')"
    read -p "Voulez-vous le remplacer? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "âŒ TÃ©lÃ©chargement annulÃ©"
        exit 0
    fi
fi

# CrÃ©er le rÃ©pertoire geoip s'il n'existe pas
mkdir -p ./geoip

# MÃ‰THODE 1: TÃ©lÃ©chargement direct depuis MaxMind (nÃ©cessite une clÃ© API)
# ========================================================================
# Inscription gratuite: https://www.maxmind.com/en/geolite2/signup
# AprÃ¨s inscription, gÃ©nÃ©rez une clÃ© de licence et remplacez YOUR_LICENSE_KEY ci-dessous

MAXMIND_LICENSE_KEY="${MAXMIND_LICENSE_KEY:-}"

if [ -n "$MAXMIND_LICENSE_KEY" ]; then
    echo "ðŸ”‘ ClÃ© de licence dÃ©tectÃ©e, tÃ©lÃ©chargement depuis MaxMind..."
    
    DOWNLOAD_URL="https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=${MAXMIND_LICENSE_KEY}&suffix=tar.gz"
    
    echo "â¬‡ï¸  TÃ©lÃ©chargement de GeoLite2-City..."
    curl -L -o /tmp/geolite2-city.tar.gz "$DOWNLOAD_URL"
    
    if [ $? -eq 0 ]; then
        echo "ðŸ“¦ Extraction de l'archive..."
        tar -xzf /tmp/geolite2-city.tar.gz -C /tmp
        
        # Trouver le fichier .mmdb dans l'archive extraite
        MMDB_FILE=$(find /tmp -name "GeoLite2-City.mmdb" | head -1)
        
        if [ -n "$MMDB_FILE" ]; then
            mv "$MMDB_FILE" ./geoip/GeoLite2-City.mmdb
            echo "âœ… GeoLite2-City.mmdb installÃ© avec succÃ¨s"
            echo "ðŸ“Š Taille: $(ls -lh ./geoip/GeoLite2-City.mmdb | awk '{print $5}')"
            
            # Nettoyage
            rm -rf /tmp/geolite2-city.tar.gz /tmp/GeoLite2-City_*
            exit 0
        else
            echo "âŒ Erreur: fichier .mmdb non trouvÃ© dans l'archive"
            exit 1
        fi
    else
        echo "âŒ Erreur lors du tÃ©lÃ©chargement"
        exit 1
    fi
fi

# MÃ‰THODE 2: TÃ©lÃ©chargement depuis un miroir alternatif (sans clÃ© API)
# =====================================================================
echo ""
echo "âš ï¸  Pas de clÃ© de licence MaxMind dÃ©tectÃ©e"
echo ""
echo "Pour tÃ©lÃ©charger GeoLite2-City.mmdb, vous avez 2 options:"
echo ""
echo "OPTION 1 (RecommandÃ©): Inscription gratuite MaxMind"
echo "  1. CrÃ©ez un compte: https://www.maxmind.com/en/geolite2/signup"
echo "  2. GÃ©nÃ©rez une clÃ© de licence: https://www.maxmind.com/en/accounts/current/license-key"
echo "  3. Exportez la clÃ©: export MAXMIND_LICENSE_KEY='votre_clÃ©'"
echo "  4. Re-exÃ©cutez ce script: ./download-geoip.sh"
echo ""
echo "OPTION 2 (Alternatif): TÃ©lÃ©chargement manuel"
echo "  1. Visitez: https://github.com/P3TERX/GeoLite.mmdb"
echo "  2. TÃ©lÃ©chargez GeoLite2-City.mmdb"
echo "  3. Placez-le dans: ./geoip/GeoLite2-City.mmdb"
echo ""
echo "OPTION 3 (Mirror GitHub - Non officiel)"
echo "  TÃ©lÃ©chargement depuis le mirror P3TERX..."
echo ""

read -p "TÃ©lÃ©charger depuis le mirror GitHub non-officiel? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    MIRROR_URL="https://github.com/P3TERX/GeoLite.mmdb/raw/download/GeoLite2-City.mmdb"
    
    echo "â¬‡ï¸  TÃ©lÃ©chargement depuis le mirror..."
    curl -L -o ./geoip/GeoLite2-City.mmdb "$MIRROR_URL"
    
    if [ $? -eq 0 ] && [ -f ./geoip/GeoLite2-City.mmdb ]; then
        echo "âœ… GeoLite2-City.mmdb tÃ©lÃ©chargÃ© avec succÃ¨s"
        echo "ðŸ“Š Taille: $(ls -lh ./geoip/GeoLite2-City.mmdb | awk '{print $5}')"
        
        # VÃ©rifier que c'est bien un fichier .mmdb valide (magic bytes)
        if file ./geoip/GeoLite2-City.mmdb | grep -q "data"; then
            echo "âœ… Fichier .mmdb valide dÃ©tectÃ©"
        else
            echo "âš ï¸  Le fichier tÃ©lÃ©chargÃ© n'est peut-Ãªtre pas un .mmdb valide"
            echo "VÃ©rifiez manuellement le contenu du fichier"
        fi
        
        exit 0
    else
        echo "âŒ Erreur lors du tÃ©lÃ©chargement depuis le mirror"
        echo "Veuillez tÃ©lÃ©charger manuellement depuis MaxMind"
        exit 1
    fi
else
    echo "âŒ TÃ©lÃ©chargement annulÃ©"
    echo ""
    echo "Pour continuer, obtenez une clÃ© de licence MaxMind gratuite:"
    echo "https://www.maxmind.com/en/geolite2/signup"
    exit 1
fi
