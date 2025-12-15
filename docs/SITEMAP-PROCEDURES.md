# Procédures Sitemap - Automecanik

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SERVEUR PRODUCTION                        │
├─────────────────────────────────────────────────────────────┤
│  NestJS Container                                           │
│  └── /srv/sitemaps (écriture)                               │
│           ↓ (volume mount)                                  │
│  Host: /home/deploy/app/public/sitemaps                     │
│           ↓ (volume mount)                                  │
│  Caddy Container                                            │
│  └── /srv/sitemaps (lecture)                                │
│           ↓                                                 │
│  https://www.automecanik.com/sitemap*.xml                   │
└─────────────────────────────────────────────────────────────┘
```

## Fichiers générés

| Sitemap | Contenu | URLs |
|---------|---------|------|
| sitemap.xml | Index principal | 22 refs |
| sitemap-racine.xml | Homepage | 1 |
| sitemap-categories.xml | Catégories | ~1000 |
| sitemap-constructeurs.xml | Marques | ~35 |
| sitemap-modeles.xml | Modèles | ~47 |
| sitemap-types.xml | Motorisations | ~12,700 |
| sitemap-pieces-1 à 15.xml | Produits | ~714,000 |
| sitemap-blog.xml | Articles blog | ~109 |
| sitemap-pages.xml | Pages statiques | ~9 |

**Total : ~728,000 URLs**

---

## Régénération manuelle

### Depuis le serveur
```bash
curl -X POST "http://localhost:3000/api/sitemap/generate-all"
```

### Avec script
```bash
/home/deploy/scripts/generate-sitemaps.sh
```

### Durée estimée
- ~84 secondes pour 728k URLs

---

## Cron automatique

### Configuration actuelle
```
0 3 * * 0 = Tous les dimanches à 3h00 UTC
```

### Fichiers
- Script : `/home/deploy/scripts/generate-sitemaps.sh`
- Logs : `/var/log/sitemap.log`

### Commandes utiles
```bash
# Voir le cron actuel
crontab -l

# Modifier le cron
crontab -e

# Voir les logs
cat /var/log/sitemap.log
tail -f /var/log/sitemap.log
```

### Changer la fréquence
```bash
crontab -e
# Modifier la ligne :
# Quotidien 3h :     0 3 * * *
# Hebdo dimanche :   0 3 * * 0
# Tous les 3 jours : 0 3 */3 * *
```

---

## Vérifications

### Accessibilité HTTP
```bash
# Depuis le serveur
curl -I https://www.automecanik.com/sitemap.xml
curl -I https://www.automecanik.com/sitemap-pieces-1.xml

# Tous les sitemaps pieces
for i in {1..15}; do
  echo "Testing sitemap-pieces-$i.xml..."
  curl -s -o /dev/null -w "%{http_code}\n" https://www.automecanik.com/sitemap-pieces-$i.xml
done
```

### Fichiers locaux
```bash
ls -la /home/deploy/app/public/sitemaps/
```

### Volume Docker
```bash
docker inspect nestjs-remix-monorepo-prod | grep -A10 Mounts
```

---

## Google Search Console

### URL à soumettre
```
https://www.automecanik.com/sitemap.xml
```

### Procédure
1. Aller sur https://search.google.com/search-console
2. Sélectionner automecanik.com
3. Menu **Sitemaps**
4. Entrer `sitemap.xml`
5. Cliquer **Envoyer**

### Forcer la relecture
- Supprimer le sitemap existant
- Le resoumettre

### Délais Google
- Soumission → Quelques minutes
- Relecture → 24-48 heures
- Stats mises à jour → 2-5 jours

---

## Dépannage

### Erreur "Permission denied"
```bash
chmod 777 /home/deploy/app/public/sitemaps
chmod 666 /home/deploy/app/public/sitemaps/*
```

### Sitemap non accessible (404)
1. Vérifier que le fichier existe :
   ```bash
   ls /home/deploy/app/public/sitemaps/
   ```
2. Vérifier le volume Caddy :
   ```bash
   docker exec nestjs-remix-caddy ls /srv/sitemaps/
   ```
3. Redémarrer Caddy :
   ```bash
   docker restart nestjs-remix-caddy
   ```

### Régénération échoue
1. Vérifier que NestJS tourne :
   ```bash
   curl http://localhost:3000/health
   ```
2. Vérifier les logs :
   ```bash
   docker logs nestjs-remix-monorepo-prod --tail 100
   ```

### Conteneur bloqué au redémarrage
```bash
docker kill nestjs-remix-monorepo-prod
docker compose -f docker-compose.prod.yml -f docker-compose.caddy.yml up -d
```

---

## Configuration Docker

### docker-compose.prod.yml
```yaml
services:
  monorepo_prod:
    volumes:
      - ./public/sitemaps:/srv/sitemaps  # Volume sitemap
```

### docker-compose.caddy.yml
```yaml
services:
  caddy:
    volumes:
      - ./public/sitemaps:/srv/sitemaps:ro  # Lecture seule
```

### Caddyfile
```
@sitemaps path /sitemap*.xml
handle @sitemaps {
    root * /srv/sitemaps
    header Content-Type "application/xml; charset=utf-8"
    file_server
}
```

---

## API Endpoints

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/sitemap/generate-all` | POST | Génère tous les sitemaps |
| `/api/sitemap/unified-status` | GET | Statut du service |

### Paramètres
```
?outputDir=/srv/sitemaps  (défaut)
```

---

## Historique

- **15/12/2025** : Consolidation V5 Unified, 728k URLs
- Volume Docker ajouté
- Cron hebdomadaire configuré
