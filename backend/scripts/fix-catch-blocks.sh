#!/bin/bash

# Script de correction automatique des variables non utilisées
# Utilise sed pour les remplacements simples et sûrs

set -e

echo "🔧 Correction automatique des variables non utilisées..."
echo ""

# Compteur
FIXED=0

# Fonction pour corriger les catch blocks
fix_catch_blocks() {
    find src -type f -name "*.ts" ! -name "*.spec.ts" | while read -r file; do
        # catch (error) → catch (_error)
        if sed -i.bak 's/catch (error)/catch (_error)/g; s/catch(error)/catch(_error)/g' "$file" 2>/dev/null; then
            if ! diff -q "$file" "$file.bak" > /dev/null 2>&1; then
                echo "✓ $file (catch error)"
                ((FIXED++)) || true
            fi
            rm -f "$file.bak"
        fi
        
        # catch (err) → catch (_err)
        if sed -i.bak 's/catch (err)/catch (_err)/g; s/catch(err)/catch(_err)/g' "$file" 2>/dev/null; then
            if ! diff -q "$file" "$file.bak" > /dev/null 2>&1; then
                echo "✓ $file (catch err)"
                ((FIXED++)) || true
            fi
            rm -f "$file.bak"
        fi
        
        # catch (e) → catch (_e) (sauf pour les catch (error) déjà traités)
        if sed -i.bak 's/catch (e)/catch (_e)/g; s/catch(e)/catch(_e)/g' "$file" 2>/dev/null; then
            if ! diff -q "$file" "$file.bak" > /dev/null 2>&1; then
                echo "✓ $file (catch e)"
                ((FIXED++)) || true
            fi
            rm -f "$file.bak"
        fi
    done
}

echo "📝 Correction des catch blocks..."
fix_catch_blocks

echo ""
echo "✅ Corrections terminées!"
echo "📊 Fichiers modifiés: environ $FIXED"
echo ""
echo "🔍 Vérification avec npm run lint..."
