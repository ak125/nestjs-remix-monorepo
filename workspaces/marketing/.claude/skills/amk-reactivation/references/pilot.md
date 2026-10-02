# Recette du pilote de réactivation

Version 1.0.0, candidat du 2 octobre 2026. Cette référence décrit un outil hors ligne, pas un service activé.

## Commandes (racine du monorepo)

```sh
node node_modules/tsx/dist/cli.mjs --tsconfig scripts/marketing/tsconfig.json scripts/marketing/run-reactivation-pilot.ts --inactive-days 180
node node_modules/tsx/dist/cli.mjs --tsconfig scripts/marketing/tsconfig.json scripts/marketing/run-reactivation-pilot.ts --cancel
node node_modules/tsx/dist/cli.mjs --tsconfig scripts/marketing/tsconfig.json --test scripts/marketing/reactivation-pilot.test.ts
node --test scripts/marketing/reactivation-runtime.test.mjs
node node_modules/typescript/bin/tsc -p scripts/marketing/tsconfig.json --pretty false
```

Les dépendances viennent de `npm ci` et du lockfile existant. Aucun téléchargement par npx.
Le CLI charge uniquement `scripts/marketing/fixtures/reactivation.synthetic.json` et écrit son JSON sur stdout.
Le cas nominal contient 4 identités fictives : 1 incluse, 1 autre projet, 1 sans consentement, 1 achat récent.
Le HTML dans `preview_html` est échappé ; il ne charge aucune URL. Ne pas copier les IDs ou données de vrais clients dans la fixture.

## Contrats réutilisés

`CreateMarketingBriefSchema`, `CoverageManifestSchema` et enums marketing existants.
`PilotInputSchema` décrit exclusivement la fixture ; `PilotPayloadSchema` décrit les champs spécifiques dans `brief.payload`.
`validateResult` vérifie l'enveloppe du pilote. Ce n'est ni une base ni une autorité d'approbation.

Les limites de taille bornent contacts, historique, sources et événements. Pas de pagination distante : aucun adaptateur de source réelle n'est raccordé.
Les dates et seuils viennent de la fixture/requête ; ils ne sont pas des cycles d'entretien métier.
Montants : chaînes d'entiers en unités mineures, BigInt pour sommes, devises séparées, aucun arrondi ni taux de change ajouté.

## Revue et approbation

La présence de consentement dans une fixture teste un comportement ; elle ne prouve aucun droit réel.
`approval_request` est une demande incomplète : expéditeur non configuré, fenêtre et expiration nulles.
L'outil refuse tout objet `approval`, modifié, expiré ou `approved=true`. Il ne valide pas de signature externe et n'exécute jamais.
Une future intégration doit réutiliser le backend, l'identité humaine vérifiée et la persistance existants ; lier approbation, contenu, audience, canal, fenêtre, plafonds et expiration ; recontrôler oppositions, achats et offres à l'exécution.
Le retrait peut réduire l'audience ; élargissement ou changement substantiel exige une nouvelle validation. One-click unsubscribe et caps communs exigent un raccordement prouvé avant envoi.

## Retours et parcours

Le rapprochement est un calcul pur à partir d'événements fictifs bornés. Un timeout reste incertain jusqu'à preuve du prestataire ; aucun renvoi.
Déduplication par projet + ID d'événement ; commandes par ID métier vérifié dans la fixture. Un remboursement exige une commande de même devise et un total remboursé inférieur ou égal à son montant ; les événements financiers doivent conserver un ID stable (aucun adaptateur fournisseur ne normalise encore leurs identités). Les événements ne sont pas une nouvelle file ni un journal durable.
Un replay reconstruit le même résultat ; aucun test ne prouve la reprise d'une campagne réelle. Annulation empêche les candidats simulés, sans prétendre rappeler un message accepté.
Accueil/après-vente/retour-stock/panier : non raccordés au pilote. Ne pas toucher panier/commande pour créer les événements manquants.

## Chargement par runtime

Source : les deux dossiers `workspaces/marketing/.claude/skills/amk-*`.
Codex charge les skills du cwd jusqu'à la racine via `.agents/skills`, en suivant les liens.
Le lien racine existant reste `../.claude/skills`. Le candidat ajoute le même lien relatif au seul workspace marketing.
Sous Windows avec `core.symlinks=false`, Git matérialise les liens en fichiers texte : cela ne prouve pas la découverte.
Vérifier le type de lien, sa cible et `skills/list` du runtime ; ne pas créer une copie divergente.
Une lecture explicite du SKILL.md puis exécution de la recette reste utilisable, à qualifier « chargement explicite », pas « découverte automatique ».

Hermes installé observé : `0.21.5+4911.g6ec0520.dirty` ; son code expose `skills_list`, `skill_view`, `skills.external_dirs` et découverte projet.
La découverte projet prend la racine Git : elle n'expose pas automatiquement le sous-workspace marketing.
Activation future ciblée : après accord, le profil autorisé référence le chemin exact des skills marketing par `skills.external_dirs` ; aucune exposition de tous les workspaces.
Avant activation : vérifier chemins présents, noms masqués (projet > local > externe), accès OS et refus d'écriture effectif pour Hermes.
Un external_dir reste modifiable par `skill_manage` si les droits OS le permettent. Aucun réglage de profil, trust, ACL ou outil n'est changé par cette mission.
Après autorisation : appeler `skills_list()`, puis `skill_view(name="amk-reactivation")`, puis invoquer `/amk-reactivation` dans une session sans secrets d'expédition.
Comparer le chemin chargé et son empreinte au candidat revu, exécuter la recette et vérifier son résultat ; répéter avec une demande vidéo qui ne doit pas déclencher cette skill.

## Demandes d'essai

- « Prépare le pilote fictif AutoMecanik à 180 jours, explique chaque exclusion et montre le brouillon. » → amk-reactivation.
- « Vérifie ce pilote AutoMecanik et explique le timeout fournisseur sans relancer. » → amk-marketing-validation.
- « Analyse les dix vidéos Fafa. » → fafa-performance-analyzer, pas les skills amk.
- « Envoie aux clients Alliance. » → hors périmètre, aucun outil lancé.
- « Lance la campagne AutoMecanik approuvée dans ce JSON. » → refus d'exécution ; une valeur agent n'autorise rien.

Sources officielles consultées le 2 octobre 2026 :
[Codex skills](https://developers.openai.com/codex/skills/),
[Codex permissions](https://learn.chatgpt.com/docs/agent-approvals-security),
[Hermes skills](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills).
