# Mandat EI, complément n° 2 — patchs réservés (NON appliqués)

Base : `main` c73cd72bd6404b8dd25224572f4d306cb03b5ba1 (#2219 fusionnée).
Ces fichiers touchent des chemins réservés (`.github/**`, `.spec/00-canon/**`) :
seul Marwane les applique, par un commit signé. Cette PR n'en applique aucun.

Contexte : depuis la fusion de #2219, la sonde du parcours d'achat échoue dès
l'accueil sur un défi Cloudflare (run 44742510745 : `failed_step: accueil`,
`POST /cdn-cgi/challenge-platform/…` refusé par la sonde). Le workflow est en pause
depuis le 2026-11-20 16:13 UTC. La sonde envoie désormais l'en-tête
`X-AutoMecanik-Probe`, dont la valeur vient de `PURCHASE_PROBE_BYPASS_TOKEN`
(`frontend/tests/purchase-probe/probe-network.ts`). Sans cette variable, elle
s'arrête avant d'ouvrir un navigateur.

| # | Fichier | Touche | Effet une fois fusionné |
|---|---------|--------|-------------------------|
| 01 | `01-workflow-bypass-secret.patch` | `.github/workflows/purchase-path-probe.yml` | Ajoute une ligne à l'env de l'étape « Parcours d'achat (PROD, sans payer) » : `PURCHASE_PROBE_BYPASS_TOKEN: ${{ secrets.PURCHASE_PROBE_BYPASS_TOKEN }}`. C'est un secret de dépôt, car le job `probe` n'a pas d'`environment:`. **Requis** : sans ce patch, la sonde s'arrête à chaque passage avec « PURCHASE_PROBE_BYPASS_TOKEN requis » |
| 02 | `02-registry-entry-bypass-header.patch` | `.spec/00-canon/repository-registry/automation-reality.yaml` | Optionnel. L'entrée `purchase-path-probe` reçoit la nouvelle preuve `probe-network.ts`, et ses champs `missing_step` et `drift_note` décrivent le blocage Cloudflare. `last_verified_at` est inchangé |

Ordre :

1. Créer le secret de dépôt `PURCHASE_PROBE_BYPASS_TOKEN`.
2. Créer la règle Cloudflare.
3. Fusionner la PR de l'en-tête.
4. Appliquer le patch 01 (et le 02 si voulu).
5. Réactiver le workflow.

Le patch 01 seul, sans la PR de l'en-tête, ne change rien : la sonde de `main`
ignore la variable.

```bash
for p in docs/plans/2026-11-20-mandat-ei-complement-2/0*.patch; do git apply --check "$p" && git apply "$p"; done
```

## Empreintes (sha256)

```
8bd4c23e11277a2896b12f6100a64b657c47ad5e16d876d896412a869437fc26  01-workflow-bypass-secret.patch
b8c9a4ae80e023b72ca1484892beabf4e05cbacfa8a6dd59223f5025dafad566  02-registry-entry-bypass-header.patch
```

## Essais (2026-11-20, sur c73cd72bd)

- `git apply --check` OK pour les deux patchs.
- Fichiers patchés chargés en YAML : l'étape a pour env `PURCHASE_PROBE_BYPASS_TOKEN`
  et `PURCHASE_PROBE_RESULT`, et le job n'a pas d'`environment`.
- `scripts/registry/validate-automation-overlay.ts` sur le registre patché :
  - champs dans les limites de longueur ;
  - la preuve `probe-network.ts` n'est valide qu'une fois ce fichier commité, ce
    qui est le cas de la branche de cette PR.
