-- Migration: Fix typos in plaquettes de frein content (pg_id = 402)
-- Date: 2026-01-05

-- 1. Corriger les espaces manquants
UPDATE "__seo_gamme_info"
SET sgi_content = REPLACE(sgi_content, 'Lesplaquettes', 'Les plaquettes')
WHERE sgi_pg_id = 402 AND sgi_content LIKE '%Lesplaquettes%';

UPDATE "__seo_gamme_info"
SET sgi_content = REPLACE(sgi_content, 'unesécurité', 'une sécurité')
WHERE sgi_pg_id = 402 AND sgi_content LIKE '%unesécurité%';

UPDATE "__seo_gamme_info"
SET sgi_content = REPLACE(sgi_content, 'lastabilité', 'la stabilité')
WHERE sgi_pg_id = 402 AND sgi_content LIKE '%lastabilité%';

-- 2. Corriger la conjugaison "on" → "ont"
UPDATE "__seo_gamme_info"
SET sgi_content = REPLACE(sgi_content, 'plaquettes de frein on pour fonction', 'plaquettes de frein ont pour fonction')
WHERE sgi_pg_id = 402 AND sgi_content LIKE '%plaquettes de frein on pour fonction%';

-- 3. Corriger le genre (masculin → féminin pour "plaquettes")
UPDATE "__seo_gamme_info"
SET sgi_content = REPLACE(sgi_content, 'ils ont un fonctionnement', 'elles ont un fonctionnement')
WHERE sgi_pg_id = 402 AND sgi_content LIKE '%plaquettes%' AND sgi_content LIKE '%ils ont un fonctionnement%';

-- 4. Scan global pour d'autres gammes (corrections génériques)
UPDATE "__seo_gamme_info"
SET sgi_content = REPLACE(sgi_content, 'Lesplaquettes', 'Les plaquettes')
WHERE sgi_content LIKE '%Lesplaquettes%';

UPDATE "__seo_gamme_info"
SET sgi_content = REPLACE(sgi_content, 'Lesdisques', 'Les disques')
WHERE sgi_content LIKE '%Lesdisques%';

UPDATE "__seo_gamme_info"
SET sgi_content = REPLACE(sgi_content, 'Lescourroies', 'Les courroies')
WHERE sgi_content LIKE '%Lescourroies%';

-- 5. Corrections dans __seo_gamme_conseil également
UPDATE "__seo_gamme_conseil"
SET sgc_content = REPLACE(sgc_content, 'Lesplaquettes', 'Les plaquettes')
WHERE sgc_content LIKE '%Lesplaquettes%';

UPDATE "__seo_gamme_conseil"
SET sgc_content = REPLACE(sgc_content, 'unesécurité', 'une sécurité')
WHERE sgc_content LIKE '%unesécurité%';

UPDATE "__seo_gamme_conseil"
SET sgc_content = REPLACE(sgc_content, 'lastabilité', 'la stabilité')
WHERE sgc_content LIKE '%lastabilité%';
