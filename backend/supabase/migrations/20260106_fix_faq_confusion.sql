-- =============================================================================
-- CORRECTION CONFUSIONS FAQ FREINAGE
-- ID 70 (Mâchoires) et ID 123 (Tambours)
-- Supprimer les comparaisons avec d'autres pièces (plaquettes, disques)
-- =============================================================================

-- ID 70: Mâchoires de frein
-- Problème: FAQ #3 et #4 mentionnent "plaquettes" (confusion)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_faq = '[
    {"question": "Mâchoires OE ou adaptables : que choisir ?", "answer": "Les mâchoires adaptables (TRW, Bosch, Valeo) offrent d excellentes performances. Vérifiez le diamètre du tambour et la largeur des garnitures."},
    {"question": "Comment savoir si mes mâchoires sont usées ?", "answer": "Frein à main inefficace, bruit de frottement métallique à l arrière, tambour rayé à l intérieur, épaisseur de garniture inférieure à 2mm."},
    {"question": "Tous les combien changer les mâchoires ?", "answer": "Entre 80 000 et 120 000 km en moyenne. Les mâchoires arrière sont moins sollicitées que le freinage avant, d où leur durée de vie supérieure."},
    {"question": "Peut-on changer ses mâchoires soi-même ?", "answer": "Oui mais opération technique. Il faut déposer le tambour et les ressorts. Comptez 1h par côté. Attention au remontage des ressorts dans le bon ordre."},
    {"question": "Quelle erreur éviter avec les mâchoires ?", "answer": "Ne pas toucher les garnitures avec des mains grasses. Vérifier l état des cylindres de roue. Toujours changer par paire (essieu)."}
  ]'::jsonb,
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '70';

-- ID 123: Tambours de frein
-- Problème: FAQ #3 mentionne "disques" (confusion)
UPDATE __seo_gamme_purchase_guide SET
  sgpg_faq = '[
    {"question": "Tambour OE ou adaptable : que choisir ?", "answer": "Les tambours adaptables de qualité (TRW, Brembo) sont fiables et économiques. Vérifiez le diamètre intérieur exact et le nombre de trous."},
    {"question": "Comment savoir si mon tambour est usé ?", "answer": "Rainures profondes à l intérieur du tambour, diamètre intérieur au-delà du maximum (gravé sur le tambour), freinage arrière bruyant."},
    {"question": "Tous les combien changer les tambours ?", "answer": "Entre 100 000 et 150 000 km. Les tambours s usent lentement car le freinage arrière est moins sollicité. Vérifiez le diamètre à chaque changement de mâchoires."},
    {"question": "Peut-on rectifier un tambour ?", "answer": "Oui si le diamètre reste sous le maximum autorisé. Mais la rectification coûte souvent presque autant qu un tambour neuf."},
    {"question": "Quelle erreur éviter avec les tambours ?", "answer": "Ne pas forcer pour déposer un tambour grippé (utiliser un extracteur). Nettoyer la poussière de frein (nocive). Changer par paire."}
  ]'::jsonb,
  sgpg_updated_at = NOW()
WHERE sgpg_pg_id = '123';

-- Vérification
SELECT sgpg_pg_id, sgpg_intro_title,
       sgpg_faq->>2 as faq_3
FROM __seo_gamme_purchase_guide
WHERE sgpg_pg_id IN ('70', '123');
