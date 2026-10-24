# Hermes: lecture du Command Center existant

Ce raccordement ne calcule aucun KPI ni verdict métier. Le backend DEV reste
l'unique producteur du digest `command-center-digest.v1`.

Chemin: timer de supervision existant (30 minutes) → ExecStartPost sous
`codex-automecanik-relay` → même clé SSH et même commande forcée → unique commande
`automecanik-command-center-v1` → GET fixe sur DEV localhost:3000 → fichier local
`/var/lib/automecanik-supervisor/command-center.json` → outil natif Hermes
`automecanik_command_center(action="digest")`, limité au profil AutoMecanik.

La clé est dédiée au digest (en-tête `X-Command-Center-Key`) et n'ouvre aucune
autre route; ce n'est pas `INTERNAL_API_KEY`. Le collecteur DEV la lit dans
`/home/deploy/.config/automecanik-command-center/digest.key` (fichier régulier
du compte, mode 0600, 64 caractères hexadécimaux), jamais dans `backend/.env`.
Le backend n'en garde que l'empreinte SHA-256 (`COMMAND_CENTER_DIGEST_KEY_SHA256`).
Variable absente ou malformée: clé refusée. Révocation: retirer ou remplacer la
variable, puis redémarrer le backend. Chaque lecture acceptée ou refusée est
journalisée sans la valeur. La clé ne traverse pas SSH. Aucun URL, chemin,
commande ou secret n'est fourni par le modèle. Proxies et redirections HTTP
désactivés; corps limité à 128 Kio; timeout HTTP 15 s et SSH 25 s; une
tentative, aucune relance. L'outil lit uniquement le fichier local en refusant
les liens; il ne déclenche pas de collecte ni de décision.

Erreurs de collecte, `ExecStartPost` sans préfixe `-`:
- DEV, HTTP ou transport indisponible: le fichier passe à `unavailable` avec sa
  raison, sortie 0. Hermes voit la dégradation; l'unité de supervision reste saine.
- Configuration du collecteur invalide: le fichier passe à `unavailable`
  (`collector_config_unavailable`), puis sortie 1.
- Fichier impossible à écrire: sortie 1 (`snapshot_write_failed`). Le précédent
  fichier reste en place et devient `stale` après 2 × cadence + 3 minutes.
Une sortie 1 signale un défaut du collecteur lui-même: l'unité passe en échec,
comme pour les autres défauts du superviseur. Le préfixe `-` masquerait ces deux
cas. Si l'exécution principale du superviseur échoue, la collecte n'a pas lieu et
le fichier devient `stale`.

Le JSON applicatif est conservé sans projection ou recalcul: mode, degraded,
stale_status, generated_at, git_sha et tous les rapports. collected_at et
collection_freshness concernent le transport, jamais la fraîcheur métier.
Le fichier séparé préserve le contrat et le budget du snapshot de supervision
existant. Il ne participe pas aux alertes Telegram. Aucun nouveau timer/service,
compte, clé, dépendance ou profil. Aucune intervention PREPROD ou PROD.

Source du correctif marketing: commit a2c7f773c47372d86b28ced1648cfe731219a0a5,
scripts/marketing/hermes/marketing_profile.py (PR #1865). Export inchangé vers
automecanik-marketing-profile-1.0.3, sans recopier les skills par profil.

Qualification: `python3 -B test_command_center.py`. Tests marketing natifs:
utiliser le Python du runtime Hermes, HERMES_HOME du profil AutoMecanik et
MARKETING_MODULE pointant sur le module à qualifier, puis
`test_marketing_native.py`. Les fixtures sont synthétiques. La validation réelle
doit observer séparément HTTP DEV, transport SSH, fichier, découverte native et
session WebUI; elle ne certifie pas les 24 métiers ou PROD.

Installation opérateur: exporter command_center.py, install.py et source.json
(commit et SHA-256), ainsi que le module marketing exact pour Hermes. Lancer
`sudo python3 install.py dev` sur DEV et `sudo python3 install.py hermes` sur
Hermes. L'installateur sauvegarde les fichiers remplacés avec leurs permissions
sous /var/lib/automecanik-command-center-install/<commit de source.json> (la
première installation, 25837bd34, a les siennes sous .../20261022). Il vérifie
tous les fichiers avant la première écriture et refuse, sans rien modifier, une
sauvegarde existante dont le contenu diffère du fichier à remplacer, puis
effectue des remplacements atomiques. Sur Hermes uniquement:
`systemctl daemon-reload`; collecter avec l'identité et le groupe du superviseur;
recharger WebUI et gateway AutoMecanik lorsqu'ils sont inactifs. Ne pas lancer le
superviseur complet pour qualifier, car il peut émettre ses alertes existantes.

Rollback opérateur: restaurer, depuis le répertoire de sauvegarde du commit à
retirer, les fichiers qu'il contient (version précédente) en conservant
owner/mode; pour revenir à l'état d'avant la première installation, restaurer
endpoint.py sur DEV et __init__.py sur Hermes depuis .../20261022 et retirer le drop-in
70-command-center.conf créé par cette installation; daemon-reload et reload des
deux processus Hermes à l'arrêt de leurs missions. Les exports et preuves peuvent
rester pour audit. Aucun redémarrage applicatif ni restauration DB nécessaire.
