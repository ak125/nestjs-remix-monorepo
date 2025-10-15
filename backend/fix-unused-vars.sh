#!/bin/bash

# Script pour corriger automatiquement les variables non utilisées
# en les préfixant avec _

echo "🔧 Correction automatique des variables non utilisées..."

# Fonction pour traiter les imports non utilisés
fix_unused_imports() {
    local file="$1"
    local var="$2"
    
    # Pour les imports de types TypeScript
    sed -i "s/import {\([^}]*\)\b${var}\b\([^}]*\)}/import {\1type ${var} as _${var}\2}/g" "$file"
    # Pour les imports simples
    sed -i "s/import { ${var}/import { type ${var} as _${var}/g" "$file"
}

# Fonction pour traiter les variables dans catch blocks
fix_catch_errors() {
    local file="$1"
    sed -i 's/} catch (error)/} catch (_error)/g' "$file"
    sed -i 's/} catch (err)/} catch (_err)/g' "$file"
    sed -i 's/} catch (e)/} catch (_e)/g' "$file"
    sed -i 's/catch (error) {/catch (_error) {/g' "$file"
    sed -i 's/catch (err) {/catch (_err) {/g' "$file"
    sed -i 's/catch (e) {/catch (_e) {/g' "$file"
    sed -i 's/catch(error)/catch(_error)/g' "$file"
    sed -i 's/catch(err)/catch(_err)/g' "$file"
}

# Fonction pour traiter les paramètres de fonction non utilisés
fix_unused_params() {
    local file="$1"
    local param="$2"
    
    # Renommer le paramètre avec _
    sed -i "s/\b${param}\b:/_${param}:/g" "$file"
}

# Fonction pour traiter les variables assignées mais non utilisées
fix_unused_assignments() {
    local file="$1"
    local var="$2"
    
    # const var = ... → const _var = ...
    sed -i "s/const ${var} =/const _${var} =/g" "$file"
    # let var = ... → let _var = ...  
    sed -i "s/let ${var} =/let _${var} =/g" "$file"
    # { var, ... } → { _var, ... }
    sed -i "s/{ ${var},/{ _${var},/g" "$file"
    sed -i "s/, ${var},/, _${var},/g" "$file"
    sed -i "s/, ${var} }/, _${var} }/g" "$file"
}

# Traiter tous les fichiers avec des warnings
npm run lint 2>&1 | grep "^/" | sort | uniq | while read -r file; do
    if [ -f "$file" ]; then
        echo "📝 Traitement: $file"
        
        # Corriger les catch blocks
        fix_catch_errors "$file"
        
        # Note: Pour les autres cas, il faut être plus prudent car sed peut créer des bugs
        # On laisse les corrections manuelles pour les cas complexes
    fi
done

echo "✅ Corrections automatiques terminées!"
echo "⚠️  Vérifiez les modifications avec 'git diff' avant de commit"
echo "🔍 Relancez 'npm run lint' pour voir les warnings restants"
