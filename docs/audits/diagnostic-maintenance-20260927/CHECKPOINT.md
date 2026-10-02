# Checkpoint — entretien autonome, 27/09/2026

Objectif autorisé : vérifier le rapport et corriger le code ; « continue » a lancé le lot entretien. Statut : VALIDATED_FOR_SCOPE_ONLY ; audit complet PARTIAL_COVERAGE.

Cible : DEV via `ssh dev-automecanik`, worktree `/opt/automecanik/app/.claude/worktrees/codex-diagnostic-integrity-20260926`, branche `codex/diagnostic-integrity-20260926`, base `4a2871dc4d19067c3ae077d6a79021b49cc60237`. Modifications non commitées. Pas de push/PR/CI/PREPROD/PROD ni écriture DB. Ne pas utiliser le checkout Windows pour coder.

Premier lot intact au démarrage, hashes vérifiés. Ce lot change 19 fichiers code/tests ; candidat cumulé 35. Nouveau parcours entretien dans l’assistant : véhicule, opérations avec date/km individuels, estimations. Entrée API sans symptôme, sélection obligatoire, mélange symptomatique rejeté. Calcul MaintenanceIntelligenceEngine partagé. Zéro/inconnus/brouillon préservés. Pas de niveau de risque, achat ou session artificielle. Estimations génériques et applicabilité non vérifiée affichées. Calendrier : erreur RPC/data absente =>503, vrai [] reste vide.

DB READ ONLY : 30 opérations actives, slugs uniques, bornes présentes positives/ordonnées ; tables __diag_maintenance_* présentes. KG :19 intervalles distincts. Commentaire « ghost » périmé corrigé. Ne pas fusionner les alias implicitement.

Preuves : backend153/11suites +calculateur/calendrier13/2suites ; frontend19/3fichiers +composant9tests. Types complets backend/frontend verts. Lint ciblé vert sauf deux tests historiques backend/tests/unit exclus par parserOptions.project (Jest les compile). Les6tests anciennes navigations du premier lot restent réutilisables. Chromium isolé/API simulées : bureau/mobile390px, historique et requête vérifiés, captures inspectées. Serveur de preuve arrêté. Pas de preuve endpoint réel+DB ni CI.

Livrable local : `C:\Users\Marwane\.codex\artifacts\diagnostic-maintenance-20260927`. Patch cumulé depuis base et patch du lot depuis le premier arbre candidat ; hashes/vérification dans patch-verification.json. Premier livrable diagnostic-integrity-20260927 conservé.

Décisions : source existante du moteur conservée ; calendrier KG distinct, pas de moteur concurrent ni migration. Ne pas confondre estimation générique et applicabilité constructeur. SQL candidat ancien non appliqué.

Prochaine action : établir mapping explicite véhicule/opération et source commune des30op/19intervalles avant personnalisation du calendrier. Restent aussi questions adaptatives, DTC/voyants/texte, mapping KG, MCP et sessions rejouables. Revalider HEAD/status et empreintes avant reprise ; réutiliser les preuves dont le périmètre n’a pas changé.
