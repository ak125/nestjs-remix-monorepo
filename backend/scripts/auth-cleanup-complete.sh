#!/bin/bash

# 🎯 Script principal de nettoyage du système d'authentification
# Objectif: Orchestrer sauvegarde, nettoyage et validation

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🎯 NETTOYAGE COMPLET DU SYSTÈME D'AUTHENTIFICATION"
echo "=================================================="
echo "📅 Date: $(date)"
echo "📂 Projet: $(basename "$PROJECT_ROOT")"
echo ""

cd "$PROJECT_ROOT"

# Configuration
BACKUP_SCRIPT="$SCRIPT_DIR/backup-auth-cleanup.sh"
CLEANUP_SCRIPT="$SCRIPT_DIR/cleanup-auth-redundant.sh"
VALIDATE_SCRIPT="$SCRIPT_DIR/validate-auth-cleanup.sh"

# Vérifier que tous les scripts existent
for script in "$BACKUP_SCRIPT" "$CLEANUP_SCRIPT" "$VALIDATE_SCRIPT"; do
    if [[ ! -f "$script" ]]; then
        echo "❌ Script manquant: $script"
        exit 1
    fi
done

echo "✅ Tous les scripts de nettoyage sont présents"
echo ""

# Afficher le plan
echo "📋 PLAN D'EXÉCUTION"
echo "==================="
echo "1. 🗄️  Sauvegarde complète des fichiers redondants"
echo "2. 🧹 Suppression des fichiers redondants et de debug" 
echo "3. 🧪 Validation du système après nettoyage"
echo "4. 📊 Rapport final"
echo ""

# Demander confirmation
echo "⚠️  ATTENTION:"
echo "   Cette opération va supprimer définitivement les fichiers redondants."
echo "   Une sauvegarde complète sera créée avant la suppression."
echo ""
read -p "Êtes-vous sûr de vouloir continuer ? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Opération annulée."
    exit 0
fi

echo ""
echo "🚀 DÉBUT DE L'OPÉRATION"
echo "======================="

# Étape 1: Sauvegarde
echo ""
echo "🗄️  ÉTAPE 1: SAUVEGARDE"
echo "======================"
chmod +x "$BACKUP_SCRIPT"
if ! "$BACKUP_SCRIPT"; then
    echo "❌ Échec de la sauvegarde"
    exit 1
fi

echo ""
echo "✅ Sauvegarde terminée avec succès"

# Étape 2: Nettoyage
echo ""
echo "🧹 ÉTAPE 2: NETTOYAGE"
echo "===================="
chmod +x "$CLEANUP_SCRIPT"
if ! "$CLEANUP_SCRIPT"; then
    echo "❌ Échec du nettoyage"
    echo "🔄 Les fichiers sauvegardés peuvent être restaurés depuis le dossier backup/"
    exit 1
fi

echo ""
echo "✅ Nettoyage terminé avec succès"

# Étape 3: Validation
echo ""
echo "🧪 ÉTAPE 3: VALIDATION"
echo "====================="

# Vérifier que le serveur est démarré
if ! pgrep -f "node.*main.js" > /dev/null; then
    echo "⚠️  Serveur non démarré. Démarrage automatique..."
    npm run dev &
    server_pid=$!
    sleep 10
    
    # Vérifier que le serveur a démarré
    if ! pgrep -f "node.*main.js" > /dev/null; then
        echo "❌ Impossible de démarrer le serveur automatiquement"
        echo "   Démarrez manuellement avec: npm run dev"
        echo "   Puis exécutez: $VALIDATE_SCRIPT"
        exit 1
    fi
    
    echo "✅ Serveur démarré automatiquement"
    auto_started=true
else
    echo "✅ Serveur déjà en cours d'exécution"
    auto_started=false
fi

# Attendre un peu plus pour que le serveur soit stable
sleep 5

# Exécuter la validation
chmod +x "$VALIDATE_SCRIPT"
validation_result=0
"$VALIDATE_SCRIPT" || validation_result=$?

# Arrêter le serveur si on l'a démarré automatiquement
if [[ "$auto_started" == "true" ]]; then
    echo ""
    echo "🔄 Arrêt du serveur démarré automatiquement..."
    kill $server_pid 2>/dev/null || true
    sleep 2
fi

# Étape 4: Rapport final
echo ""
echo "📊 RAPPORT FINAL"
echo "================"

# Statistiques avant/après
echo "📈 Statistiques:"

# Compter les fichiers dans la sauvegarde
backup_dir=$(find ../backup -name "auth-cleanup-*" -type d 2>/dev/null | head -1)
if [[ -n "$backup_dir" && -d "$backup_dir" ]]; then
    backed_up_files=$(find "$backup_dir/auth" -name "*.ts" 2>/dev/null | wc -l)
    echo "   📁 Fichiers sauvegardés: $backed_up_files"
    echo "   🗄️  Sauvegarde: $backup_dir"
fi

# Compter les fichiers actuels
current_files=$(find src/auth -name "*.ts" 2>/dev/null | wc -l)
echo "   📁 Fichiers actuels: $current_files"

# Calculer la réduction
if [[ -n "$backed_up_files" ]]; then
    reduction=$((backed_up_files - current_files))
    percentage=$((reduction * 100 / backed_up_files))
    echo "   📉 Réduction: $reduction fichiers (-$percentage%)"
fi

echo ""
echo "🎯 Résultats:"

if [[ $validation_result -eq 0 ]]; then
    echo "✅ Sauvegarde: Réussie"
    echo "✅ Nettoyage: Réussi" 
    echo "✅ Validation: Réussie"
    echo ""
    echo "🎉 OPÉRATION TERMINÉE AVEC SUCCÈS !"
    echo "=================================="
    echo ""
    echo "🚀 Le système d'authentification a été nettoyé et optimisé !"
    echo "📁 Structure simplifiée et code redondant supprimé"
    echo "🧪 Tous les tests d'authentification passent"
    echo ""
    echo "💡 Bénéfices:"
    echo "   • Code plus maintenable"
    echo "   • Moins de confusion dans l'architecture" 
    echo "   • Performance améliorée (moins de fichiers à charger)"
    echo "   • Documentation plus claire"
else
    echo "✅ Sauvegarde: Réussie"
    echo "✅ Nettoyage: Réussi"
    echo "⚠️  Validation: Problèmes détectés"
    echo ""
    echo "⚠️  OPÉRATION PARTIELLEMENT RÉUSSIE"
    echo "==================================="
    echo ""
    echo "🔧 Le nettoyage a été effectué mais des problèmes ont été détectés"
    echo "📝 Consultez les détails de validation ci-dessus"
    echo ""
    echo "🔄 En cas de problème majeur:"
    echo "   1. Consultez les logs de validation"
    echo "   2. Utilisez le script de restauration si nécessaire"
    echo "   3. Vérifiez les imports dans les fichiers restants"
fi

echo ""
echo "📚 Documentation des scripts créés:"
echo "   • $BACKUP_SCRIPT - Sauvegarde des fichiers"
echo "   • $CLEANUP_SCRIPT - Nettoyage des redondances"
echo "   • $VALIDATE_SCRIPT - Validation post-nettoyage"
echo "   • $(basename "$0") - Script principal (ce script)"
echo ""
echo "🔄 Pour restaurer en cas de besoin:"
echo "   • Consultez le dossier backup/ créé"
echo "   • Utilisez le script restore.sh dans la sauvegarde"
