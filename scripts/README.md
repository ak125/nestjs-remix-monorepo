# 📜 Scripts de Nettoyage et Consolidation

Ce dossier contient les scripts de maintenance, nettoyage et consolidation du monorepo.

## 🚀 Utilisation rapide

### Script principal (recommandé)

```bash
./scripts/secure-cleanup.sh
```

Menu interactif avec toutes les options disponibles.

## 📋 Scripts disponibles

### 🧹 Nettoyage et Consolidation

| Script | Description | Usage |
|--------|-------------|-------|
| `secure-cleanup.sh` | **Script principal** - Menu interactif | `./scripts/secure-cleanup.sh` |
| `cleanup-consolidation.sh` | Nettoyage des fichiers compilés, caches, documentation | `./scripts/cleanup-consolidation.sh` |
| `cleanup-dependencies.sh` | Analyse des dépendances redondantes | `./scripts/cleanup-dependencies.sh` |
| `update-package-json.sh` | Mise à jour automatique des package.json | `./scripts/update-package-json.sh` |

### 🔧 Utilitaires existants

| Script | Description |
|--------|-------------|
| `clean-project.sh` | Nettoyage basique du projet |
| `clean-obsolete-files.sh` | Suppression des fichiers obsolètes |
| `security-check.sh` | Vérification de sécurité |

### 🔍 SEO et Analyse

| Script | Description |
|--------|-------------|
| `seo-analysis.sh` | Analyse SEO complète |
| `seo-metadata-analyzer.sh` | Analyse des métadonnées |
| `seo-monitoring.sh` | Monitoring SEO |
| `seo-performance.sh` | Performance SEO |

### 🧪 Tests

| Script | Description |
|--------|-------------|
| `test-catalog-conseils.sh` | Test du catalogue conseils |
| `test-meilisearch.sh` | Test de Meilisearch |
| `test-products-improvements.sh` | Test des améliorations produits |
| `test-performance.sh` | Test de performance du serveur en production |

### ⚙️ Configuration

| Script | Description |
|--------|-------------|
| `init-meilisearch.sh` | Initialisation de Meilisearch |
| `generate-caddy-config.sh` | Génération config Caddy |
| `generate-modules.sh` | Génération de modules |

### ✅ Validation

| Script | Description |
|--------|-------------|
| `validate-architecture.sh` | Validation de l'architecture |
| `validate-payment-separation.sh` | Validation séparation paiements |
| `validate-complete-payment-architecture.sh` | Validation architecture paiements |

## 🎯 Scénarios d'utilisation

### Premier nettoyage complet

```bash
# 1. Lancer le script principal
./scripts/secure-cleanup.sh

# 2. Choisir l'option 5 (Tout exécuter)

# 3. Suivre les instructions affichées
```

### Nettoyage rapide avant commit

```bash
# Nettoyer les fichiers compilés et caches
./scripts/cleanup-consolidation.sh
```

### Audit des dépendances

```bash
# Analyser les dépendances redondantes
./scripts/cleanup-dependencies.sh

# Voir le rapport généré
cat docs/DEPENDENCIES-CLEANUP-*.md
```

### Mise à jour des package.json

```bash
# ⚠️ Crée un backup automatique
./scripts/update-package-json.sh
```

## 📊 Rapports générés

Les scripts génèrent automatiquement des rapports dans `docs/`:

- `CLEANUP-REPORT-YYYY-MM-DD.md` - Rapport de nettoyage
- `DEPENDENCIES-CLEANUP-YYYY-MM-DD.md` - Analyse des dépendances

## 🔒 Sécurité

### Backups automatiques

Tous les scripts destructifs créent des backups automatiques :

```
.cleanup-backup-YYYYMMDD-HHMMSS/
.package-backup-YYYYMMDD-HHMMSS/
```

### Restauration

En cas de problème :

```bash
# Lister les backups
ls -la | grep backup

# Restaurer depuis un backup
cp -r .cleanup-backup-XXXXXXX-XXXXXX/* .
```

## ⚙️ Configuration

### Prérequis

- Bash 4.0+
- NPM 8.0+
- Git

### Permissions

Les scripts sont automatiquement rendus exécutables :

```bash
chmod +x scripts/*.sh
```

## 🐛 Dépannage

### Script ne s'exécute pas

```bash
# Vérifier les permissions
ls -l scripts/

# Rendre exécutable
chmod +x scripts/nom-du-script.sh

# Exécuter avec bash explicitement
bash scripts/nom-du-script.sh
```

### Erreur "command not found"

```bash
# Exécuter depuis la racine du monorepo
cd /workspaces/nestjs-remix-monorepo

# Puis relancer le script
./scripts/nom-du-script.sh
```

### Backup occupe trop d'espace

```bash
# Lister les backups
find . -name '.cleanup-backup-*' -o -name '.package-backup-*'

# Supprimer les anciens backups (après vérification)
rm -rf .cleanup-backup-* .package-backup-*
```

## 📖 Documentation

- **Guide complet**: Voir `docs/CONSOLIDATION-GUIDE.md`
- **Architecture**: Voir `docs/GETTING-STARTED.md`
- **Contribution**: Voir `README.md`

## 🔗 Liens utiles

- [Documentation NestJS](https://docs.nestjs.com)
- [Documentation Remix](https://remix.run/docs)
- [Turbo Documentation](https://turbo.build/repo/docs)
- [NPM Workspaces](https://docs.npmjs.com/cli/v8/using-npm/workspaces)

## 📝 Notes

- Toujours exécuter depuis la **racine du monorepo**
- Les scripts créent des **backups automatiques**
- Consulter les **rapports générés** dans `docs/`
- Tester après chaque opération majeure

## 🤝 Contribution

Pour ajouter un nouveau script :

1. Créer le script dans `scripts/`
2. Le rendre exécutable : `chmod +x scripts/nom.sh`
3. Ajouter la documentation ici
4. Tester en environnement de dev
5. Commiter avec un message descriptif

---

**Dernière mise à jour**: 2025-10-06
