# 🔍 Guide d'Usage des Outils d'Analyse SEO

## 🚀 **DÉMARRAGE RAPIDE**

### **Test de Connectivité**
```bash
make -f Makefile.seo seo-test
```

### **Analyse Rapide**
```bash
make -f Makefile.seo seo-quick
```

### **Analyse Complète**
```bash
make -f Makefile.seo seo-full
```

---

## 📊 **COMMANDES DISPONIBLES**

| Commande | Description | Durée |
|----------|-------------|-------|
| `seo-test` | Test de connectivité | 5 sec |
| `seo-quick` | Analyse rapide (métadonnées + sitemap) | 30 sec |
| `seo-full` | Analyse complète avec rapport détaillé | 2 min |
| `seo-performance` | Tests de performance des APIs | 1 min |
| `seo-monitoring` | Surveillance en temps réel | ∞ |
| `seo-metadata` | Analyse détaillée des métadonnées | 1 min |
| `seo-url` | Analyse d'une URL spécifique | 10 sec |
| `seo-reports` | Afficher les derniers rapports | 1 sec |
| `seo-clean` | Nettoyer les rapports | 1 sec |

---

## 🎯 **EXEMPLES D'USAGE**

### **1. Analyse Quotidienne**
```bash
# Chaque matin
make -f Makefile.seo seo-quick
```

### **2. Test de Performance**
```bash
# Avant déploiement
make -f Makefile.seo seo-performance
```

### **3. Surveillance Continue**
```bash
# En arrière-plan
make -f Makefile.seo seo-monitoring
```

### **4. Analyse d'une Page Spécifique**
```bash
# Pour une URL précise
make -f Makefile.seo seo-url
# Saisir: products/freinage/plaquettes
```

---

## 📁 **STRUCTURE DES RAPPORTS**

```
reports/
├── seo_report_YYYYMMDD_HHMMSS.md     # Rapport principal
├── metadata_accueil_TIMESTAMP.json   # Métadonnées par page
├── sitemap_index_TIMESTAMP.xml       # Sitemap index
├── sitemap_main_TIMESTAMP.xml        # Sitemap principal
├── robots_TIMESTAMP.txt              # Robots.txt
└── analytics_TIMESTAMP.json          # Analytics (si auth)
```

---

## 🔧 **SCRIPTS INDIVIDUELS**

### **Script Principal**
```bash
./scripts/seo-analysis.sh [--full|--performance|--monitoring]
```

### **Performance**
```bash
./scripts/seo-performance.sh
```

### **Monitoring**
```bash
./scripts/seo-monitoring.sh
```

### **Métadonnées**
```bash
./scripts/seo-metadata-analyzer.sh [url1] [url2] ...
```

---

## 📊 **INTERPRÉTATION DES RÉSULTATS**

### **Codes de Status**
- ✅ **Vert** : Optimal
- 🟡 **Jaune** : Acceptable, amélioration possible
- 🔴 **Rouge** : Problème à corriger

### **Métriques de Performance**
- **< 0.5s** : Excellent
- **0.5-1.0s** : Bon
- **> 1.0s** : À améliorer

### **Validation Métadonnées**
- **Titre** : 30-60 caractères (optimal)
- **Description** : 120-160 caractères (optimal)
- **Mots-clés** : 3-7 mots-clés pertinents

---

## 🔄 **AUTOMATISATION**

### **Crontab pour Analyses Automatiques**
```bash
# Analyse quotidienne à 6h00
0 6 * * * cd /workspaces/nestjs-remix-monorepo && make -f Makefile.seo seo-quick

# Test de performance chaque heure
0 * * * * cd /workspaces/nestjs-remix-monorepo && make -f Makefile.seo seo-performance
```

### **Script de Démarrage**
```bash
#!/bin/bash
# startup-seo.sh
cd /workspaces/nestjs-remix-monorepo
make -f Makefile.seo seo-test && echo "SEO Tools Ready!"
```

---

## 🚨 **DÉPANNAGE**

### **Serveur Indisponible**
```bash
# Vérifier si le backend tourne
curl -s http://localhost:3000 || echo "Serveur arrêté"
```

### **Permissions Scripts**
```bash
# Corriger les permissions
chmod +x scripts/seo-*.sh
```

### **Dépendances Manquantes**
```bash
# Installer jq si manquant
sudo apt-get update && sudo apt-get install -y jq bc
```

---

## 📈 **MONITORING EN PRODUCTION**

### **Surveillance Continue**
```bash
# Terminal 1: Monitoring
make -f Makefile.seo seo-monitoring

# Terminal 2: Logs serveur
tail -f logs/application.log | grep -i seo
```

### **Alertes Automatiques**
```bash
#!/bin/bash
# check-seo-health.sh
result=$(make -f Makefile.seo seo-test 2>&1)
if [[ $result != *"opérationnel"* ]]; then
    echo "ALERTE: SEO Service DOWN" | mail admin@automecanik.com
fi
```

---

**✅ Outils SEO opérationnels et prêts à l'usage !**
