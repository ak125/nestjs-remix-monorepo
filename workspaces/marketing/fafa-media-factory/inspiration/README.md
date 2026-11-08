# Inspiration — Creative Pattern Extraction

> **Copyright-safe extraction**. On stocke des **patterns** (metadata structurelle), jamais d'asset source **commité, publié ou réutilisé en sortie**.
> L'analyse éphémère d'une source publique (`/watch` / claude-video, mode `REFERENCE_ANALYSIS_ONLY`) est autorisée ; sa sortie ne devient jamais du contenu.
> `/watch` n'est pas installé sur DEV au 18/10 : l'analyse est alors un visionnage humain (skill `creative-pattern-extractor`).
> Statut `INSPIRED_PATTERN_ONLY` obligatoire avant tout passage en `DRAFT_ONLY`.

## Règle d'or

| Autorisé | Interdit |
|---|---|
| ✅ Analyser hook, structure, durée, rythme, CTA, format, type de plan | ❌ **Committer / publier / réutiliser en sortie** un asset source (frame, cut, montage, texte écran) |
| ✅ **Analyse éphémère** d'une source publique via `/watch` (frames + transcript, `/tmp` hors-repo, auto-cleanup) — `REFERENCE_ANALYSIS_ONLY` | ❌ Recopier un script de trop près (relecture humaine : G5 ne mesure rien en V1, voir Enforcement) |
| ✅ Citer URL source pour traçabilité | ❌ Reprendre montage **frame-by-frame** — plans / cadrages / durées / séquence (voir Enforcement) |
| ✅ Stocker pattern JSONL (metadata structurelle) | ❌ Imiter une personne réelle identifiable |
| ✅ Anonymiser la source dans le brief Fafa | ❌ Reprendre branding concurrent (logos, jingles, mascotte, habillage) |
| ✅ Marquer `do_not_copy_visuals`, `do_not_reuse_script`, `reference_analysis_only` | ❌ Reproduire l'**expression** d'une source (même rebrandée AutoMecanik) |

### Enforcement — analyse en entrée ≠ copie en sortie (anti-loophole)

`/watch` (claude-video) est autorisé **uniquement comme entrée d'analyse**. Son output (frames, transcript, timing) :

- ❌ n'entre **jamais** dans un script / brief / manifest comme contenu réutilisé ;
- ❌ ne sert **jamais** de preuve visuelle (`truth_dependency != illustration` → **FAIL G6**) ;
- ❌ n'autorise **aucune** copie frame-by-frame en sortie, **même avec le branding AutoMecanik/Fafa**.

**Ligne directrice (idée libre / expression protégée)** — on copie la *fonction* d'un beat
(hook → symptôme → cause → test → CTA), jamais l'*expression* (plans, cadrages, durées,
montage, texte exact). Un clone plan-pour-plan avec script réécrit + visuels d'illustration
**passe G5 et G6 mécaniquement mais reste une contrefaçon** (droit d'auteur audiovisuel CPI
+ parasitisme art. 1240 C. civ.) : cette ligne « Interdit » est l'**unique barrière**, pas les gates.
→ `shot-by-shot functional rebuild` = OK · `frame-by-frame copy` = FAIL, rebrand non opposable.

En V1, G5 ne mesure d'ailleurs rien : aucun module ne produit `similarityScore`, et le code rend alors WARN non mesuré
(`backend/src/modules/media-factory/services/video-gates.service.ts:359-366`), et aucun texte de référence n'est conservé (pattern
structurel, source vue en analyse éphémère). Le détail est dans le skill `creative-pattern-extractor` (« G5 Reuse Risk en V1 »).

## Format JSONL de référence (un pattern par ligne)

Seule description du format ; le skill `creative-pattern-extractor` y renvoie. L'objet est montré indenté pour la lecture : dans le
fichier, chaque pattern tient sur une ligne.

```json
{
  "source_url": "https://www.tiktok.com/@example/video/123",
  "platform": "tiktok|youtube|instagram|facebook",
  "niche": "auto repair|car parts|mechanic tips",
  "discovered_at": "2026-05-28",
  "hook_type": "warning_before_purchase|symptom_reveal|piece_explained|...",
  "duration_sec": 31,
  "structure": ["hook", "symptom", "causes", "advice", "cta"],
  "visual_patterns": ["facecam", "close-up part", "caption-heavy"],
  "pace": "fast|medium|slow",
  "caption_density": "high|medium|low",
  "cta_type": "check_compatibility|learn_more|visit_store|...",
  "engagement_signals": {
    "comments_useful": "high|medium|low",
    "shares_proxy": "high|medium|low"
  },
  "risk_flags": ["do_not_copy_visuals", "do_not_reuse_script", "no_person_imitation", "reference_analysis_only"],
  "analysis_method": "human|watch_tool_ephemeral",
  "extracted_at": "2026-05-28",
  "extracted_by": "creative-pattern-extractor-v1"
}
```

## Fichiers attendus

- `patterns/tiktok-auto-repair.jsonl`
- `patterns/youtube-shorts-mechanic.jsonl`
- `patterns/instagram-reels-garage.jsonl`

Aucun n'existe au 18/10 (seul `patterns/.gitkeep`) ; le skill `creative-pattern-extractor` les crée au premier pattern. `*.jsonl`
n'est pas ignoré par git : ces fichiers sont versionnés, donc n'y écrire que des URL publiques et des niveaux, jamais un identifiant
de commentateur ni un extrait de transcript.

## Workflow obligatoire

1. Pattern extrait → `inspiration/patterns/*.jsonl` (statut `PATTERN_EXTRACTED`)
2. Transformation Fafa → brief original avec signature explicite « inspiré du pattern X, œuvre originale Fafa »
3. Statut `INSPIRED_PATTERN_ONLY` porté par `brief.json` : `status`, et `inspiration_pattern_id` pour le pattern
   (`governance/video-brief.schema.json:69-72,77-88` ; `scripts/README.md`, règle anti-régression). La signature de l'étape 2 va
   dans `inspiration.json` (`scripts/README.md:26`, sans schéma).
4. Seulement après → passage en `DRAFT_ONLY`

Aucun contrôle automatique ne vérifie cette signature : G5 du code ne lit que `similarityScore`
(`video-gates.service.ts:355-385`), dont aucun producteur n'existe au 22/10 ; `fafa-brand-safety-reviewer` rend donc G5 UNKNOWN
et signale à part une signature manquante. La signature relève de la relecture de l'owner avant qu'il pose `content_approved`
(`governance/approval-record.schema.json:43-46`) ; le schéma ne contrôle que la présence d'un nom dans `content_approved_by`
(l.79-86), pas qu'un humain a relu.

## Voir aussi

- Skill `[[creative-pattern-extractor]]`
- Règle vault `rules-video-creative-reuse-policy.md` : introuvable au 18/10, ni sur `main` du vault (`eb97222`) ni dans les branches
  du checkout DEV ; aucune règle ratifiée ne porte ce document.
- Gate G5 Reuse Risk + G6 Visual Role (`.spec/00-canon/video-governance-p0.md`)
