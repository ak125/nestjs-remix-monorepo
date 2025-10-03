#!/bin/bash
# Test de l'API pour voir les URLs générées

echo "🔍 Test API - Véhicules compatibles alternateur"
echo ""

curl -s http://localhost:3000/api/blog/article/by-gamme/alternateur | \
  jq '.data.compatibleVehicles[0:3] | .[] | {
    marque: .marque_name,
    modele: .modele_name,
    marque_logo: .marque_logo,
    modele_pic: .modele_pic
  }'
