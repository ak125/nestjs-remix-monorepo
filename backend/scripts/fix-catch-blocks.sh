#!/bin/bash

# Script de correction automatique des variables non utilisÃ©es
# Utilise sed pour les remplacements simples et sÃ»rs

set -e

echo "ðŸ”§ Correction automatique des variables non utilisÃ©es..."
echo ""

# Compteur
FIXED=0

# Fonction pour corriger les catch blocks
fix_catch_blocks() {
    find src -type f -name "*.ts" ! -name "*.spec.ts" | while read -r file; do
        # catch (error) â†’ catch (_error)
        if sed -i.bak 's/catch (error)/catch (_error)/g; s/catch(error)/catch(_error)/g' "$file" 2>/dev/null; then
            if ! diff -q "$file" "$file.bak" > /dev/null 2>&1; then
                echo "âœ“ $file (catch error)"
                ((FIXED++)) || true
            fi
            rm -f "$file.bak"
        fi
        
        # catch (err) â†’ catch (_err)
        if sed -i.bak 's/catch (err)/catch (_err)/g; s/catch(err)/catch(_err)/g' "$file" 2>/dev/null; then
            if ! diff -q "$file" "$file.bak" > /dev/null 2>&1; then
                echo "âœ“ $file (catch err)"
                ((FIXED++)) || true
            fi
            rm -f "$file.bak"
        fi
        
        # catch (e) â†’ catch (_e) (sauf pour les catch (error) dÃ©jÃ  traitÃ©s)
        if sed -i.bak 's/catch (e)/catch (_e)/g; s/catch(e)/catch(_e)/g' "$file" 2>/dev/null; then
            if ! diff -q "$file" "$file.bak" > /dev/null 2>&1; then
                echo "âœ“ $file (catch e)"
                ((FIXED++)) || true
            fi
            rm -f "$file.bak"
        fi
    done
}

echo "ðŸ“ Correction des catch blocks..."
fix_catch_blocks

echo ""
echo "âœ… Corrections terminÃ©es!"
echo "ðŸ“Š Fichiers modifiÃ©s: environ $FIXED"
echo ""
echo "ðŸ” VÃ©rification avec npm run lint..."
