#!/bin/bash

# Script pour corriger automatiquement les variables non utilisÃ©es
# en les prÃ©fixant avec _

echo "ðŸ”§ Correction automatique des variables non utilisÃ©es..."

# Fonction pour traiter les imports non utilisÃ©s
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

# Fonction pour traiter les paramÃ¨tres de fonction non utilisÃ©s
fix_unused_params() {
    local file="$1"
    local param="$2"
    
    # Renommer le paramÃ¨tre avec _
    sed -i "s/\b${param}\b:/_${param}:/g" "$file"
}

# Fonction pour traiter les variables assignÃ©es mais non utilisÃ©es
fix_unused_assignments() {
    local file="$1"
    local var="$2"
    
    # const var = ... â†’ const _var = ...
    sed -i "s/const ${var} =/const _${var} =/g" "$file"
    # let var = ... â†’ let _var = ...  
    sed -i "s/let ${var} =/let _${var} =/g" "$file"
    # { var, ... } â†’ { _var, ... }
    sed -i "s/{ ${var},/{ _${var},/g" "$file"
    sed -i "s/, ${var},/, _${var},/g" "$file"
    sed -i "s/, ${var} }/, _${var} }/g" "$file"
}

# Traiter tous les fichiers avec des warnings
npm run lint 2>&1 | grep "^/" | sort | uniq | while read -r file; do
    if [ -f "$file" ]; then
        echo "ðŸ“ Traitement: $file"
        
        # Corriger les catch blocks
        fix_catch_errors "$file"
        
        # Note: Pour les autres cas, il faut Ãªtre plus prudent car sed peut crÃ©er des bugs
        # On laisse les corrections manuelles pour les cas complexes
    fi
done

echo "âœ… Corrections automatiques terminÃ©es!"
echo "âš ï¸  VÃ©rifiez les modifications avec 'git diff' avant de commit"
echo "ðŸ” Relancez 'npm run lint' pour voir les warnings restants"
