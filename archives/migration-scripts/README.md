# Scripts de Migration Archivés

Ce dossier contient les scripts Python utilisés pour les migrations ponctuelles du projet, notamment la migration du design system.

## 📁 Structure

### design-system/
Scripts de migration du design system (batches 9-32) :
- `migrate-batch*.py` - Scripts de migration par batch
- `fix-*.py` - Scripts de correction
- `adapt-*.py` - Scripts d'adaptation
- `analyze-*.py` - Scripts d'analyse

### Racine
- `generate-*.py` - Scripts de génération de rapports
- `validate-urls-sample.py` - Script d'exemple de validation URLs

## ⚠️ Important

Ces scripts sont **archivés** car ils ont été utilisés pour des migrations ponctuelles déjà effectuées. Ils sont conservés pour :

1. **Référence historique** : Comprendre comment les migrations ont été faites
2. **Documentation** : Approche utilisée pour le design system
3. **Réutilisation** : Potentiel template pour futures migrations

## 🚫 Ne PAS utiliser

Ces scripts ne sont **pas maintenus** et peuvent ne plus fonctionner avec la version actuelle du code.

Pour de nouvelles migrations, créez de nouveaux scripts dans `/scripts` et archivez-les ici une fois terminés.

## 📊 Statistiques

- **Total de scripts** : 42
- **Migration design system** : 37 batches
- **Scripts de génération** : 5
- **Date d'archivage** : 2 novembre 2025

---

**Note** : Si vous avez besoin de réutiliser un concept de migration, consultez d'abord la documentation du design system dans `/docs/design-system/`.
