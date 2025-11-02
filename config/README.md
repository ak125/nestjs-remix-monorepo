# Configuration

Ce dossier contient les fichiers de configuration du projet.

## Structure

### 🌐 Caddy (`caddy/`)
- `Caddyfile` - Configuration principale de Caddy pour la production
- `Caddyfile.dev` - Configuration Caddy pour le développement
- Fichiers de configuration de redirections

### ⏰ Cron (`cron/`)
- `crontab` - Configuration des tâches cron
- `crontab.example` - Exemple de configuration
- `crontab.seo-monitor` - Tâches de monitoring SEO

### 📊 Vector (`vector/`)
- `vector.toml` - Configuration du pipeline de logs Vector
- `loki-config.yaml` - Configuration Loki pour les logs
- `prometheus.yml` - Configuration Prometheus pour les métriques
- `.env.vector` - Variables d'environnement pour Vector

## Utilisation

Ces fichiers de configuration sont référencés par les fichiers `docker-compose.*.yml` à la racine du projet.

### Caddy
Les fichiers Caddyfile sont montés dans le conteneur Caddy via `docker-compose.caddy.yml`.

### Cron
Les fichiers crontab sont utilisés par `docker-compose.cron.yml`.

### Vector
La configuration Vector est utilisée par `docker-compose.vector.yml` pour le pipeline de logs et métriques.
