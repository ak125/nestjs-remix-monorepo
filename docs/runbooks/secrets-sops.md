# Runbook — SOPS + age secret management

> **Status** : PR-A introduit l'infrastructure SOPS pour les secrets Sentry uniquement. PR-B+ migrera les autres secrets (DB, Redis, Paybox) du `.env` plain VPS vers `secrets/*.sops.env` selon le même pattern.

## Pourquoi SOPS + age

- **Encrypted at rest in git** — les secrets vivent dans le monorepo, déchiffrés en mémoire seulement au moment du `docker compose up`
- **Audit trail = git log** — qui a changé quelle valeur, quand
- **Multi-recipient** — chaque fichier peut être déchiffré par owner OU dev VPS OU prod VPS, plus de _single point of failure_
- **Aucune dépendance réseau** au déploiement (pas de SaaS qui peut être down)
- **Standard de facto** — utilisé par Mozilla, k8s, terraform, ansible

## Bootstrap — une seule fois par environnement

### 1. Installer sops + age (local + VPS)

```bash
./scripts/secrets/install-sops.sh
```

Le script télécharge les binaires officiels (sops 3.9.1, age 1.2.0) et les place dans `/usr/local/bin`. Idempotent.

### 2. Générer une clé age

Sur **chaque** machine qui doit pouvoir déchiffrer (ta machine dev, le VPS DEV, le VPS PROD plus tard) :

```bash
mkdir -p ~/.config/sops/age
age-keygen -o ~/.config/sops/age/keys.txt
chmod 600 ~/.config/sops/age/keys.txt

# Notez la "Public key: age1...." affichée — c'est elle qui va dans .sops.yaml
grep '# public key:' ~/.config/sops/age/keys.txt
```

**Sauvegarder la clé privée** :

| Machine | Backup |
|---------|--------|
| Ta machine dev | Bitwarden / 1Password / disque chiffré externe |
| VPS DEV | Bitwarden + clone vers VPS PROD pour failover (optionnel) |
| VPS PROD | Bitwarden + recovery procedure documentée |

> ⚠️ **Perdre une clé privée = perdre l'accès aux secrets historiques.** Le backup n'est pas optionnel.

### 3. Mettre à jour `.sops.yaml`

Remplacer les `age1PLACEHOLDER_...` par les vraies clés publiques collectées à l'étape 2 :

```yaml
keys:
  - &owner_fafa age1abc123...   # ta clé publique
  - &dev_vps age1def456...      # clé publique du VPS DEV
```

```bash
git add .sops.yaml
git commit -s -m 'chore(sops): register dev_vps + owner age recipients'
```

### 4. Créer le premier fichier encrypté (Sentry)

**Sur ta machine dev** (qui a maintenant les deux clés publiques dans `.sops.yaml`) :

```bash
# Créer un fichier dotenv en clair, dans /tmp pour ne PAS le committer accidentellement
cat > /tmp/sentry.env <<'EOF'
SENTRY_DSN=https://78d046f8...4511342994784336
VITE_SENTRY_DSN=https://b236f551...4511343000223824
SENTRY_AUTH_TOKEN=sntryu_...
SENTRY_ORG=auto-pieces-equipement
SENTRY_PROJECT_BACKEND=automecanik-backend-dev
SENTRY_PROJECT_FRONTEND=automecanik-frontend-dev
SENTRY_ENVIRONMENT=dev
EOF

# Encrypt vers le repo
sops encrypt /tmp/sentry.env > secrets/sentry.dev.sops.env

# Effacer la version cleartext (tmpfs ou shred)
shred -u /tmp/sentry.env

# Vérifier que c'est bien chiffré (doit afficher du base64 + 'sops:' yaml)
head -5 secrets/sentry.dev.sops.env

# Vérifier que tu peux le déchiffrer
sops decrypt secrets/sentry.dev.sops.env

# Commit
git rm secrets/sentry.dev.sops.env.PLACEHOLDER
git add secrets/sentry.dev.sops.env
git commit -s -m 'chore(secrets): bootstrap sentry.dev.sops.env (PR-A)'
```

### 5. Pull sur VPS DEV + tester

```bash
ssh deploy@46.224.118.55
cd /opt/automecanik/app
git pull
sops decrypt secrets/sentry.dev.sops.env
# → doit afficher le contenu cleartext si la clé du VPS est bien dans .sops.yaml
# → erreur "no key could decrypt" = .sops.yaml ne contient pas la bonne clé publique du VPS
```

## Workflow quotidien

### Ajouter / modifier une variable

```bash
sops edit secrets/sentry.dev.sops.env
# → ouvre $EDITOR avec le cleartext, ré-encrypte automatiquement à la sauvegarde

git diff secrets/sentry.dev.sops.env  # diff lisible (clés visibles, valeurs encrypted)
git commit -s -m 'chore(secrets): rotate SENTRY_AUTH_TOKEN'
```

### Vérifier qu'aucun plaintext ne s'est glissé

Hook pre-commit (à brancher dans `.husky/pre-commit`) :

```bash
./scripts/secrets/check-no-plaintext.sh
```

Le script échoue si un `secrets/*.env` (sans `.sops.` infix) est commité, ou si un `*.sops.env` n'est pas réellement chiffré.

### Lancer une commande avec les secrets injectés

```bash
./scripts/secrets/run-with-secrets.sh secrets/sentry.dev.sops.env -- \
  docker compose -f docker-compose.preprod.yml up -d monorepo_preprod
```

Le script déchiffre en mémoire, source les variables dans son env, fait `exec` du sous-processus. Aucun fichier décrypté ne touche le disque.

## Rotation d'un secret compromis

```bash
# 1. Générer un nouveau secret côté Sentry (ou l'API concernée)
# 2. Éditer le fichier sops
sops edit secrets/sentry.dev.sops.env  # remplacer la valeur

# 3. Commit + push
git commit -s -m 'chore(secrets): rotate SENTRY_AUTH_TOKEN after exposure'
git push

# 4. Pull + redéploy sur VPS
ssh deploy@46.224.118.55 'cd /opt/automecanik/app && git pull && \
  ./scripts/secrets/run-with-secrets.sh secrets/sentry.dev.sops.env -- \
  docker compose -f docker-compose.preprod.yml restart monorepo_preprod'

# 5. Révoquer l'ancienne valeur côté Sentry (API console)
```

> ⚠️ **L'ancien blob encrypted reste dans git history.** N'importe qui ayant **les clés privées historiques** peut le déchiffrer. La rotation ne devient effective qu'**après** révocation côté provider (Sentry API).

## Ajouter un nouveau recipient (nouvelle machine, nouvel opérateur)

```bash
# 1. Sur la nouvelle machine
age-keygen -o ~/.config/sops/age/keys.txt
grep '# public key:' ~/.config/sops/age/keys.txt
# Copier la clé publique age1...

# 2. Sur ta machine dev (qui a déjà accès)
# Ajouter la clé publique dans .sops.yaml sous l'alias adapté
$EDITOR .sops.yaml

# 3. Ré-encrypter chaque fichier pour qu'il accepte la nouvelle clé
for f in secrets/*.sops.env; do
  sops updatekeys -y "$f"
done

# 4. Commit
git add .sops.yaml secrets/
git commit -s -m 'chore(sops): add <new-recipient> to <files>'
```

## Retirer un recipient (machine compromise / ex-opérateur)

```bash
# 1. Retirer la clé publique de .sops.yaml
$EDITOR .sops.yaml

# 2. Re-key tous les fichiers concernés
for f in secrets/*.sops.env; do
  sops updatekeys -y "$f"
done

# 3. Commit
git commit -s -m 'chore(sops): remove <recipient>'

# 4. CRITIQUE — rotater chaque secret
# Le blob encrypted historique reste lisible avec la clé privée retirée.
# Seule la rotation des valeurs invalide réellement la fuite.
sops edit secrets/<file>.sops.env  # changer chaque valeur
git commit -s -m 'chore(secrets): rotate after recipient removal'
```

## CI integration (futur)

Si CI doit accéder aux secrets (build-time source maps Sentry, etc.) :

1. Générer une paire de clés CI dédiée (`age-keygen -o ci.key`)
2. Stocker la **clé privée** dans GitHub Secrets en **dernier recours** (variable `SOPS_AGE_KEY`)
3. Workflow : `echo "$SOPS_AGE_KEY" > ~/.config/sops/age/keys.txt && ./scripts/secrets/run-with-secrets.sh ...`

> **Note PR-A** : pas de CI integration. Les source maps Sentry seront uploadées **post-deploy depuis le VPS**, pas au build CI. Le token n'a donc pas besoin d'aller dans GitHub Secrets.

## Troubleshooting

| Erreur | Cause probable | Fix |
|--------|----------------|-----|
| `no key could decrypt the data` | La clé du host n'est pas dans `.sops.yaml` | Étape 4 ci-dessus + `updatekeys` |
| `failed to load aws kms key` | `.sops.yaml` mal formé | Vérifier l'indentation YAML |
| `sops: command not found` | Binaire absent | `./scripts/secrets/install-sops.sh` |
| `age: no identities provided` | `~/.config/sops/age/keys.txt` absent ou perms incorrectes | Régénérer la clé + `chmod 600` |

## Références

- [SOPS docs](https://github.com/getsops/sops)
- [age docs](https://github.com/FiloSottile/age)
- [`.sops.yaml`](../../.sops.yaml) — config locale
- [`secrets/README.md`](../../secrets/README.md) — inventaire des fichiers
