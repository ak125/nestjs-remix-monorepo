#!/bin/bash

# 🧪 Test manuel pour fil d'ariane dynamique
# Instructions pour tester dans le navigateur

cat << 'EOF'
🧪 GUIDE DE TEST MANUEL - Fil d'Ariane Dynamique
================================================

Le test curl ne fonctionne pas car l'URL testée n'existe pas dans votre base.

📋 MÉTHODE RECOMMANDÉE : Test dans le navigateur
-------------------------------------------------

1️⃣  OUVRIR UNE PAGE DE PIÈCE
   → Allez sur http://localhost:3000
   → Naviguez vers une page de pièce (catalogue)
   → Exemple : Cliquez sur "Catalogue" puis sur une gamme (Freinage, Filtration, etc.)

2️⃣  VÉRIFIER LE BREADCRUMB SANS VÉHICULE (3 niveaux)
   → Regardez le fil d'ariane en haut de page
   → Vous devriez voir : "Accueil → Pièces → [Nom de la gamme]"
   → C'est le comportement NORMAL sans véhicule sélectionné

3️⃣  AJOUTER UN COOKIE DE VÉHICULE
   → Appuyez sur F12 pour ouvrir DevTools
   → Cliquez sur l'onglet "Console"
   → Collez ce code JavaScript :

document.cookie = 'selected_vehicle=' + encodeURIComponent(JSON.stringify({
  marque_id: 140,
  marque_name: "Renault",
  marque_alias: "renault",
  modele_id: 1234,
  modele_name: "Avantime",
  modele_alias: "avantime",
  type_id: 5678,
  type_name: "2.0 16V",
  type_alias: "2-0-16v",
  selected_at: new Date().toISOString()
})) + '; path=/; max-age=2592000';
location.reload();

4️⃣  VÉRIFIER LE BREADCRUMB AVEC VÉHICULE (4 niveaux)
   → Après le rechargement, regardez le fil d'ariane
   → Vous devriez voir : "Accueil → Pièces → Renault Avantime → [Nom de la gamme]"
   → Un badge bleu devrait apparaître : "🚗 Filtré pour : Renault Avantime"

5️⃣  VÉRIFIER LES LOGS BACKEND
   → Regardez les logs de votre backend
   → Vous devriez voir :
     🚗 Véhicule depuis cookie: Renault Avantime
     🍞 Breadcrumb généré: Accueil → Pièces → Renault Avantime → [Gamme]


✅ RÉSULTATS ATTENDUS
----------------------

SANS cookie (navigation normale) :
  • Breadcrumb : 3 niveaux
  • Pas de badge véhicule
  • Logs : "Aucun véhicule sélectionné"

AVEC cookie (après avoir collé le code) :
  • Breadcrumb : 4 niveaux avec "Renault Avantime"
  • Badge bleu affiché
  • Logs : "Véhicule depuis cookie: Renault Avantime"


🔧 ALTERNATIVE : Utiliser le VehicleSelector
---------------------------------------------

Au lieu de coller du code, vous pouvez utiliser le sélecteur de véhicule sur la page :

1. Cherchez le composant VehicleSelector sur la page
2. Sélectionnez : Renault → Avantime → 2.0 16V
3. La page se recharge automatiquement
4. Le breadcrumb affiche maintenant 4 niveaux


📊 POUR UN TEST CURL QUI FONCTIONNE
------------------------------------

1. Trouvez une URL valide en naviguant dans votre site
2. Exemple d'URLs qui devraient fonctionner :
   • http://localhost:3000/pieces/freinage
   • http://localhost:3000/pieces/filtration
   • http://localhost:3000/pieces/echappement

3. Modifiez la variable TEST_URL dans les scripts :
   
   nano test-curl-final.sh
   
   # Changez la ligne :
   TEST_URL="http://localhost:3000/pieces/freinage"

4. Relancez le test :
   
   ./test-curl-final.sh


🐛 SI ÇA NE FONCTIONNE TOUJOURS PAS
------------------------------------

Vérifiez que :

1. Le backend NestJS tourne (port 3000)
2. La route existe dans votre application
3. Les données existent dans la base de données
4. Regardez les logs backend pour les erreurs

Logs attendus sur une page qui fonctionne :
  ⚡ Requêtes parallèles: XXms
  🔍 Recherche catalogue pour mfId=X, pgIdNum=XX
  📊 Catalogue items trouvés: XX
  🍞 Breadcrumb généré: ...


💡 ASTUCE
---------

Vos logs précédents montraient que la fonctionnalité FONCTIONNE :
  
  🍞 Breadcrumb généré: Accueil → Pièces → Pompe de direction assistée
  🍞 Breadcrumb généré: Accueil → Pièces → Renault Avantime → Pompe de direction assistée

Le problème est juste que l'URL testée en curl n'existe pas dans la base.
Testez directement dans le navigateur ! 🚀

EOF
