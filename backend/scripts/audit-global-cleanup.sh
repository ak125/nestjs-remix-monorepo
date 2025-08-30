#!/bin/bash

# 🧹 Script de nettoyage global du projet
# Objectif: Identifier tous les fichiers redondants dans le projet

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🧹 AUDIT GLOBAL DE NETTOYAGE"
echo "============================="
echo "📅 Date: $(date)"
echo "📂 Projet: $(basename "$PROJECT_ROOT")"
echo ""

cd "$PROJECT_ROOT"

echo "🔍 FICHIERS POTENTIELLEMENT REDONDANTS"
echo "======================================"

echo ""
echo "📊 FICHIERS DE TEST/DEBUG:"
echo "-------------------------"
find src -name "*test*.ts" -o -name "*debug*.ts" -o -name "*fix*.ts" | head -20

echo ""
echo "📊 FICHIERS MINIMAUX/ALTERNATIFS:"
echo "--------------------------------"
find src -name "*minimal*.ts" -o -name "*simple*.ts" -o -name "*basic*.ts" | head -20

echo ""
echo "📊 FICHIERS ENHANCED/AMÉLIORÉS:"
echo "------------------------------"
find src -name "*enhanced*.ts" -o -name "*improved*.ts" -o -name "*v2*.ts" -o -name "*new*.ts" | head -20

echo ""
echo "📊 FICHIERS DE SAUVEGARDE:"
echo "-------------------------"
find src -name "*backup*.ts" -o -name "*old*.ts" -o -name "*legacy*.ts" -o -name "*temp*.ts" | head -20

echo ""
echo "📊 DOUBLES CONTRÔLEURS:"
echo "----------------------"
find src -name "*.controller.ts" | sort | uniq -d

echo ""
echo "📊 DOUBLES SERVICES:"
echo "-------------------"
find src -name "*.service.ts" | xargs basename -s .service.ts | sort | uniq -d

echo ""
echo "📊 DOUBLES MODULES:"
echo "------------------"
find src -name "*.module.ts" | xargs basename -s .module.ts | sort | uniq -d

echo ""
echo "💡 RECOMMANDATIONS"
echo "=================="
echo "1. Examiner chaque catégorie de fichiers"
echo "2. Identifier les vrais doublons"
echo "3. Créer des sauvegardes avant suppression"
echo "4. Tester après chaque nettoyage"
echo ""
echo "🎯 Utilisez les scripts spécialisés pour chaque module"
