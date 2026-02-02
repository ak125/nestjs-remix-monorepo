-- Migration: 20260201_insert_filtre_huile_r4_r5
-- Pilote SEO : Filtre à Huile
-- Création : 1 page R4 Reference + 5 pages R5 Diagnostic
-- Source : Plan /home/deploy/.claude/plans/streamed-sleeping-waterfall.md

-- ============================================
-- R4 REFERENCE - Filtre à Huile (pg_id=7)
-- ============================================

INSERT INTO __seo_reference (
  slug,
  title,
  meta_description,
  definition,
  role_mecanique,
  composition,
  confusions_courantes,
  symptomes_associes,
  content_html,
  schema_json,
  pg_id,
  blog_slugs,
  is_published
) VALUES (
  'filtre-a-huile',
  'Filtre à huile : définition, rôle et remplacement | Guide Auto',
  'Découvrez tout sur le filtre à huile : fonction, types (vissé, cartouche), fréquence de changement et symptômes d''usure.',

  -- definition (texte pur, 2-3 paragraphes)
  'Le filtre à huile est un composant essentiel du circuit de lubrification moteur. Il retient les impuretés métalliques, les résidus de combustion et les particules qui circulent dans l''huile moteur.

Situé entre la pompe à huile et les pièces en mouvement, il garantit une huile propre pour protéger pistons, bielles et arbre à cames. Un filtre colmaté réduit le débit d''huile et accélère l''usure du moteur.',

  -- role_mecanique
  'Dans le système de lubrification, le filtre à huile intercepte les contaminants avant qu''ils n''atteignent les pièces en mouvement. La pompe à huile fait circuler le lubrifiant sous pression depuis le carter, à travers le filtre, vers les organes moteur. Le filtre contient un clapet anti-retour qui maintient l''huile dans le circuit au repos, évitant un démarrage à sec.',

  -- composition (array)
  ARRAY[
    'Élément filtrant : papier plissé ou synthétique haute densité',
    'Joint torique : assure l''étanchéité sur le bloc moteur',
    'Clapet anti-retour : maintient l''huile dans le circuit au repos',
    'Valve de dérivation (by-pass) : s''ouvre si le filtre est colmaté',
    'Corps métallique ou plastique : protège l''élément filtrant'
  ],

  -- confusions_courantes (array)
  ARRAY[
    'Filtre à huile ≠ Filtre à air : circuits différents (lubrification vs admission)',
    'Cartouche ≠ Filtre à visser : même fonction, montage différent',
    'Filtre à huile ≠ Crépine pompe : la crépine est un pré-filtre grossier dans le carter',
    'Filtre à huile ≠ Filtre boîte auto : circuit séparé avec huile ATF'
  ],

  -- symptomes_associes (slugs R5 Diagnostic - 5 pages)
  ARRAY['voyant-huile-allume', 'bruit-cliquetis-moteur', 'huile-noire-avant-echeance', 'fuite-filtre-huile', 'filtre-huile-mal-serre'],

  -- content_html (contenu riche avec sections supplémentaires)
  '<article class="prose">
<h2>Qu''est-ce qu''un filtre à huile ?</h2>
<p>Le filtre à huile est un composant essentiel du circuit de lubrification moteur. Il retient les impuretés métalliques, les résidus de combustion et les particules qui circulent dans l''huile moteur.</p>
<p>Situé entre la pompe à huile et les pièces en mouvement, il garantit une huile propre pour protéger pistons, bielles et arbre à cames. Un filtre colmaté réduit le débit d''huile et accélère l''usure du moteur.</p>

<h2>Rôle mécanique</h2>
<p>Dans le système de lubrification, le filtre à huile intercepte les contaminants avant qu''ils n''atteignent les pièces en mouvement. La pompe à huile fait circuler le lubrifiant sous pression depuis le carter, à travers le filtre, vers les organes moteur.</p>
<p>Le filtre contient un clapet anti-retour qui maintient l''huile dans le circuit au repos, évitant un démarrage à sec.</p>

<h2>Ce que le filtre à huile NE fait PAS</h2>
<ul>
<li><strong>Filtrer le carburant</strong> : c''est le rôle du filtre à carburant</li>
<li><strong>Nettoyer l''air d''admission</strong> : c''est le filtre à air</li>
<li><strong>Remplacer la vidange</strong> : il retient les impuretés mais ne régénère pas l''huile</li>
<li><strong>Corriger une fuite</strong> : problème de joint ou carter</li>
</ul>

<h2>Composition</h2>
<ul>
<li><strong>Élément filtrant</strong> : papier plissé ou synthétique haute densité</li>
<li><strong>Joint torique</strong> : assure l''étanchéité sur le bloc moteur</li>
<li><strong>Clapet anti-retour</strong> : maintient l''huile dans le circuit au repos</li>
<li><strong>Valve de dérivation (by-pass)</strong> : s''ouvre si le filtre est colmaté</li>
<li><strong>Corps</strong> : métallique ou plastique, protège l''élément filtrant</li>
</ul>

<h2>Règles de diagnostic</h2>
<ul>
<li>Si voyant huile allumé → vérifier niveau AVANT de suspecter le filtre</li>
<li>Si huile noire rapidement → peut indiquer filtre saturé ou intervalles trop longs</li>
<li>Si fuite au niveau du filtre → vérifier serrage ET état du joint</li>
<li>Toujours remplacer le filtre à chaque vidange, jamais le réutiliser</li>
</ul>

<h2>Compatibilité</h2>
<p>Les références varient selon : motorisation (essence/diesel), année, marque. Certains moteurs utilisent un filtre cartouche dans un boîtier (PSA, VAG récents), d''autres un filtre vissé classique. Toujours vérifier la compatibilité par le sélecteur véhicule.</p>
</article>',

  -- schema_json (JSON-LD DefinedTerm)
  '{"@context": "https://schema.org", "@type": "DefinedTerm", "name": "Filtre à huile", "description": "Composant du circuit de lubrification moteur qui retient les impuretés métalliques et les résidus de combustion circulant dans l''huile moteur", "inDefinedTermSet": {"@type": "DefinedTermSet", "name": "Référence Auto - Pièces Automobiles"}}'::jsonb,

  -- pg_id (gamme filtre huile)
  7,

  -- blog_slugs (liens vers articles R3 - format: conseils/slug)
  ARRAY['conseils/filtre-a-huile'],

  true
) ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  meta_description = EXCLUDED.meta_description,
  definition = EXCLUDED.definition,
  role_mecanique = EXCLUDED.role_mecanique,
  composition = EXCLUDED.composition,
  confusions_courantes = EXCLUDED.confusions_courantes,
  symptomes_associes = EXCLUDED.symptomes_associes,
  content_html = EXCLUDED.content_html,
  schema_json = EXCLUDED.schema_json,
  pg_id = EXCLUDED.pg_id,
  blog_slugs = EXCLUDED.blog_slugs,
  is_published = EXCLUDED.is_published,
  updated_at = NOW();

-- ============================================
-- R5 DIAGNOSTIC - Pages Observable Pro
-- ============================================

-- R5.1: Voyant huile allumé (CRITIQUE - STOP IMMEDIATE)
INSERT INTO __seo_observable (
  slug, title, meta_description,
  observable_type, perception_channel, risk_level, safety_gate,
  symptom_description, sign_description, dtc_codes, dtc_descriptions,
  ctx_phase, ctx_temp, ctx_freq,
  cluster_id, related_gammes, related_references,
  recommended_actions, estimated_repair_cost_min, estimated_repair_cost_max,
  schema_org, is_published
) VALUES (
  'voyant-huile-allume',
  'Voyant huile allumé : causes et que faire | Diagnostic Auto',
  'Votre voyant huile s''allume ou clignote ? Découvrez les causes possibles et les actions à prendre immédiatement.',
  'symptom', 'electronic', 'critique', 'stop_immediate',

  'Le voyant huile (symbole burette) s''allume au tableau de bord. Il peut rester fixe ou clignoter. Ce signal indique un problème dans le circuit de lubrification du moteur.',

  'Vérification du niveau d''huile à la jauge. Inspection visuelle de fuites sous le véhicule. Contrôle de la pression d''huile avec manomètre. Vérification du capteur de pression.',

  ARRAY['P0520', 'P0521', 'P0522', 'P0523', 'P0524'],
  '{"P0520": "Circuit capteur pression huile", "P0521": "Plage/performance capteur", "P0522": "Tension basse capteur", "P0523": "Tension haute capteur", "P0524": "Pression huile trop basse"}'::jsonb,

  ARRAY['demarrage', 'ralenti', 'acceleration'],
  ARRAY['froid', 'chaud'],
  'permanent',

  'lubrification',
  ARRAY[7, 479],  -- filtre-a-huile, kit-vidange
  ARRAY['filtre-a-huile'],

  '[
    {"action": "Arrêter immédiatement le moteur", "urgency": "immediate", "skill_level": "diy", "duration": "1min"},
    {"action": "Vérifier le niveau d''huile à la jauge", "urgency": "immediate", "skill_level": "diy", "duration": "5min"},
    {"action": "Faire remorquer vers un garage si niveau OK", "urgency": "immediate", "skill_level": "professional", "duration": "1h"}
  ]'::jsonb,
  50, 800,

  '{"@context": "https://schema.org", "@type": "MedicalCondition", "name": "Voyant huile allumé", "possibleTreatment": [{"@type": "MedicalTherapy", "name": "Vérification niveau huile"}, {"@type": "MedicalTherapy", "name": "Changement filtre huile"}]}'::jsonb,

  true
) ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  meta_description = EXCLUDED.meta_description,
  symptom_description = EXCLUDED.symptom_description,
  sign_description = EXCLUDED.sign_description,
  dtc_codes = EXCLUDED.dtc_codes,
  dtc_descriptions = EXCLUDED.dtc_descriptions,
  recommended_actions = EXCLUDED.recommended_actions,
  is_published = EXCLUDED.is_published,
  updated_at = NOW();

-- R5.2: Bruit cliquetis moteur (SÉCURITÉ - STOP SOON)
INSERT INTO __seo_observable (
  slug, title, meta_description,
  observable_type, perception_channel, risk_level, safety_gate,
  symptom_description, sign_description, dtc_codes,
  ctx_phase, ctx_temp, ctx_freq,
  cluster_id, related_gammes, related_references,
  recommended_actions, estimated_repair_cost_min, estimated_repair_cost_max,
  is_published
) VALUES (
  'bruit-cliquetis-moteur',
  'Bruit de cliquetis moteur au ralenti : causes et solutions',
  'Votre moteur fait un bruit de claquement ou cliquetis au ralenti ? Découvrez les causes possibles et comment diagnostiquer.',
  'symptom', 'auditory', 'securite', 'stop_soon',

  'Bruit métallique type "clac-clac" ou "tic-tic" au ralenti. Le bruit peut disparaître à chaud ou s''aggraver. Souvent plus audible capot ouvert.',

  'Écoute au stéthoscope mécanique. Vérification du niveau et de la qualité de l''huile. Contrôle des poussoirs hydrauliques. Inspection de la distribution.',

  ARRAY['P0300', 'P0171', 'P0174'],
  ARRAY['ralenti', 'demarrage'],
  ARRAY['froid'],
  'intermittent',

  'lubrification',
  ARRAY[7, 37],  -- filtre-a-huile, poussoir
  ARRAY['filtre-a-huile'],

  '[
    {"action": "Vérifier niveau et état de l''huile", "urgency": "immediate", "skill_level": "diy", "duration": "5min"},
    {"action": "Contrôler dans les 48h par un professionnel", "urgency": "soon", "skill_level": "professional", "duration": "1h"}
  ]'::jsonb,
  100, 1500,

  true
) ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  meta_description = EXCLUDED.meta_description,
  symptom_description = EXCLUDED.symptom_description,
  sign_description = EXCLUDED.sign_description,
  recommended_actions = EXCLUDED.recommended_actions,
  is_published = EXCLUDED.is_published,
  updated_at = NOW();

-- R5.3: Huile noire avant échéance (CONFORT - WARNING)
INSERT INTO __seo_observable (
  slug, title, meta_description,
  observable_type, perception_channel, risk_level, safety_gate,
  symptom_description, sign_description,
  ctx_freq,
  cluster_id, related_gammes, related_references,
  recommended_actions, estimated_repair_cost_min, estimated_repair_cost_max,
  is_published
) VALUES (
  'huile-noire-avant-echeance',
  'Huile moteur très noire avant vidange : normal ou problème ?',
  'Votre huile moteur devient noire rapidement ? Découvrez si c''est normal et quand s''inquiéter.',
  'sign', 'visual', 'confort', 'warning',

  'L''huile sur la jauge est très noire, opaque, bien avant l''échéance de vidange prévue (ex: noire à 5000km pour une vidange tous les 15000km).',

  'Prélèvement d''huile et analyse visuelle. Comparaison avec huile neuve. Vérification du filtre à huile. Contrôle du kilométrage depuis dernière vidange.',

  'progressif',

  'lubrification',
  ARRAY[7, 479],  -- filtre-a-huile, kit-vidange
  ARRAY['filtre-a-huile'],

  '[
    {"action": "Vérifier le kilométrage depuis dernière vidange", "urgency": "scheduled", "skill_level": "diy", "duration": "2min"},
    {"action": "Avancer la prochaine vidange si < 10000km", "urgency": "scheduled", "skill_level": "amateur", "duration": "30min"}
  ]'::jsonb,
  40, 100,

  true
) ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  meta_description = EXCLUDED.meta_description,
  symptom_description = EXCLUDED.symptom_description,
  sign_description = EXCLUDED.sign_description,
  recommended_actions = EXCLUDED.recommended_actions,
  is_published = EXCLUDED.is_published,
  updated_at = NOW();

-- R5.4: Fuite au niveau du filtre (SÉCURITÉ - STOP SOON) - Source: Analyse SEO
INSERT INTO __seo_observable (
  slug, title, meta_description,
  observable_type, perception_channel, risk_level, safety_gate,
  symptom_description, sign_description,
  ctx_phase, ctx_freq,
  cluster_id, related_gammes, related_references,
  recommended_actions, estimated_repair_cost_min, estimated_repair_cost_max,
  is_published
) VALUES (
  'fuite-filtre-huile',
  'Fuite d''huile au niveau du filtre : causes et solutions',
  'Fuite d''huile près du filtre à huile ? Découvrez les causes possibles (joint, serrage, filetage) et comment réparer.',
  'symptom', 'visual', 'securite', 'stop_soon',

  'Présence de traces d''huile ou de gouttes sous le véhicule, au niveau du filtre à huile. La fuite peut être légère (suintement) ou importante (flaque).',

  'Inspection visuelle du filtre et du joint. Vérification du serrage. Contrôle du filetage sur le bloc moteur. Vérification de la propreté de la surface d''appui.',

  ARRAY['arret', 'stationnement'],
  'progressif',

  'lubrification',
  ARRAY[7, 612, 613],  -- filtre-a-huile, joint carter, bouchon carter
  ARRAY['filtre-a-huile'],

  '[
    {"action": "Vérifier le niveau d''huile immédiatement", "urgency": "immediate", "skill_level": "diy", "duration": "5min"},
    {"action": "Resserrer le filtre (1/4 tour après contact)", "urgency": "immediate", "skill_level": "amateur", "duration": "10min"},
    {"action": "Remplacer le filtre si joint abîmé", "urgency": "soon", "skill_level": "amateur", "duration": "30min"}
  ]'::jsonb,
  20, 150,

  true
) ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  meta_description = EXCLUDED.meta_description,
  symptom_description = EXCLUDED.symptom_description,
  sign_description = EXCLUDED.sign_description,
  recommended_actions = EXCLUDED.recommended_actions,
  is_published = EXCLUDED.is_published,
  updated_at = NOW();

-- R5.5: Filtre mal serré conséquences (SÉCURITÉ - WARNING) - Source: Analyse SEO
INSERT INTO __seo_observable (
  slug, title, meta_description,
  observable_type, perception_channel, risk_level, safety_gate,
  symptom_description, sign_description,
  ctx_phase, ctx_freq,
  cluster_id, related_gammes, related_references,
  recommended_actions, estimated_repair_cost_min, estimated_repair_cost_max,
  is_published
) VALUES (
  'filtre-huile-mal-serre',
  'Filtre à huile mal serré : risques et conséquences pour le moteur',
  'Un filtre à huile mal serré peut provoquer fuites et dommages moteur. Découvrez les symptômes et comment corriger.',
  'sign', 'visual', 'securite', 'warning',

  'Après un changement de filtre, vous constatez une fuite d''huile, une odeur de brûlé, ou le voyant huile s''allume. Le filtre peut être trop ou pas assez serré.',

  'Vérification du couple de serrage. Inspection du joint (double joint possible). Contrôle que l''ancien joint n''est pas resté collé. Vérification du niveau d''huile.',

  ARRAY['demarrage', 'ralenti'],
  'permanent',

  'lubrification',
  ARRAY[7],  -- filtre-a-huile uniquement
  ARRAY['filtre-a-huile'],

  '[
    {"action": "Arrêter le moteur et vérifier le niveau", "urgency": "immediate", "skill_level": "diy", "duration": "5min"},
    {"action": "Vérifier absence de double joint", "urgency": "immediate", "skill_level": "amateur", "duration": "10min"},
    {"action": "Resserrer : serrage manuel + 3/4 tour", "urgency": "immediate", "skill_level": "amateur", "duration": "10min"}
  ]'::jsonb,
  0, 50,

  true
) ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  meta_description = EXCLUDED.meta_description,
  symptom_description = EXCLUDED.symptom_description,
  sign_description = EXCLUDED.sign_description,
  recommended_actions = EXCLUDED.recommended_actions,
  is_published = EXCLUDED.is_published,
  updated_at = NOW();

-- ============================================
-- VÉRIFICATION
-- ============================================

-- Vérifier R4 créé
SELECT 'R4 Reference' as type, slug, title FROM __seo_reference WHERE slug = 'filtre-a-huile';

-- Vérifier R5 créés
SELECT 'R5 Diagnostic' as type, slug, safety_gate FROM __seo_observable WHERE related_references @> ARRAY['filtre-a-huile'];
