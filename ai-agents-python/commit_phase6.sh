#!/bin/bash
# Script de commit et push des nouveaux agents

set -e

cd "$(dirname "$0")"

echo "🚀 Phase 6 - Nouveaux Agents d'Analyse"
echo "======================================"

# Vérifier les fichiers modifiés
echo ""
echo "📋 Fichiers modifiés:"
git status --short

# Ajouter les nouveaux agents
echo ""
echo "➕ Ajout des nouveaux fichiers..."
git add agents/analysis/a1_security.py
git add agents/analysis/a5_complexity.py
git add agents/analysis/a6_dependencies.py
git add agents/fixproof/f0_autoimport.py
git add analyze_all.py
git add core/runner.py
git add reports/

# Afficher le diff
echo ""
echo "📝 Modifications:"
git diff --cached --stat

# Commit
echo ""
read -p "🤔 Commit ces changements? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
    git commit -m "feat: Phase 6 - Add A1, A5, A6 analysis agents + F0 auto-import

- Add A1 Security agent (243 vulnerabilities detected)
- Add A5 Complexity agent (1963 complex functions)
- Add A6 Dependencies agent (221 issues: 31 vulnerable, 190 outdated)
- Add F0 Auto-import agent (606 import fixes)
- Create analyze_all.py: unified analysis workflow
- Generate comprehensive Markdown report
- Update runner.py with new agents

Results:
- Total analysis time: ~53s
- 433 CRITICAL issues detected
- 254 HIGH issues detected
- Full report in reports/FULL_ANALYSIS_REPORT.md"

    echo ""
    echo "✅ Commit créé"
    
    # Push
    echo ""
    read -p "🚀 Push vers GitHub? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]
    then
        git push origin driven-ai
        echo ""
        echo "✅ Push réussi"
    fi
else
    echo "❌ Commit annulé"
fi
