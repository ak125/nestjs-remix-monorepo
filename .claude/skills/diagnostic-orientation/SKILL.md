---
name: diagnostic-orientation
description: Use when relaying an existing AutoMecanik diagnostic-engine result (analyze response or saved session) to a human advisor or Hermes, to turn a symptom into questions, checks, allowed catalogue families and human escalation. Excludes running a new analysis, vehicle data audits (vehicle-ops), R5 page content, part references, compatibility claims, prices, stock and any cart or order action.
type: technique
status: experimental
owners: ["@ak125"]
domain: D7
runtime_class: read-only
llm_safe: true
last_verified: "2026-10-21"
metadata:
  version: "1.0.0"
---

# diagnostic-orientation

Relayer sans le recalculer ce que le moteur diagnostic a produit : symptôme →
informations manquantes → hypothèses et vérifications → familles du catalogue
autorisées → escalade humaine. Département `diagnostic` (D7) ; collaborations
`catalog` (familles et pages) et `support` (escalade). Le consommateur est un
conseiller humain ou Hermes préparant un brouillon : la skill n'envoie rien au client.

## Préconditions et entrées

Une seule source, nommée dans la sortie :

- réponse de `POST /api/diagnostic-engine/analyze` déjà obtenue par l'appelant
  (`evidence_pack`, et si présents `intent`, `recommended_actions`, `human_escalation`) ;
- session lue par `GET /api/diagnostic-engine/sessions/<uuid>` (lecture seule,
  champ `session.result`, saisie dans `signal_input` et `vehicle_context`) ;
- aucune : poser des questions et proposer l'escalade, sans hypothèse propre.

Ne pas appeler `analyze` ni `handoff` pour tester ou démontrer : ils écrivent une
session, un cookie véhicule ou un évènement analytique. Contrat et formulations :
[catalog-guard](references/catalog-guard.md).

## Outils et étapes

1. Reprendre le symptôme et le véhicule tels que saisis, sans rien ajouter.
2. Sécurité d'abord : `safety_alert` présent ou `risk_level` = `critical` →
   message de sécurité, contrôle professionnel et escalade humaine en tête ;
   aucune famille du catalogue, même sur demande d'achat (le moteur bloque déjà).
   `intent.safety_rail` = true → escalade et première action reçue en tête.
3. Transformer `factual_inputs_missing` en questions au client. Ne rien supposer.
4. Pour chaque `candidate_hypotheses[]` : `label`, rang relatif (`relative_score`
   n'est pas une probabilité), `evidence_for`, `evidence_against`, et
   `verification_method` si `requires_verification`. Donner `provenance.state` ;
   sans `provenance_summary` ou avec `unavailable`, écrire « provenance non exposée ».
5. Appliquer `catalog_guard.allowed_output_mode` selon la table de la référence.
   Ne citer que `suggested_gammes` (famille, confiance, hypothèse d'origine).
   Aucune référence, marque, prix, stock ni compatibilité, quel que soit le mode :
   la compatibilité se vérifie avec le sélecteur véhicule du catalogue.
6. `human_escalation` est toujours disponible : la proposer à chaque sortie, en
   premier si `priority_boost` = true.
7. Garder `recommended_actions` dans l'ordre reçu ; ne pas cliquer à la place du client.
   En mode `none`, une action `piece` ou `entretien_pack` est une incohérence (le
   moteur les retire) : ne pas la relayer, la signaler.

## Sorties, limites et arrêt

Blocs : Sécurité, À préciser, Pistes à vérifier, Familles du catalogue (ou « pas
d'orientation catalogue à ce stade » avec `reason`), Parler à un humain, Source
(`session_id`, `versions.pipeline_version`, date de session). Une hypothèse n'est
pas une panne confirmée ; une famille n'est pas une recommandation d'achat.

Arrêter et escalader : aucune sortie du moteur ; session introuvable, illisible ou
lecture indisponible (ne pas relancer d'analyse) ; `catalog_guard` absent ou
incohérent (traiter comme `none` et le signaler) ; demande de choisir une pièce,
de commander ou de garantir un montage. Hors périmètre : données véhicule →
`vehicle-ops` ; contenu de page R5 → agents SEO ; panier, prix, stock → humain.

Reprise : relire la session par son identifiant ; une sortie antérieure n'est pas
une source. Doublon : même `session_id` = même résultat ; une nouvelle saisie
relève du produit, pas de la skill.

La session contient la saisie du client et son véhicule : ne pas la copier hors du
support, ni dans un commit, un rapport public ou une mémoire.
