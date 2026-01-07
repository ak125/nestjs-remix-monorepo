-- Migration: Contenu Phase 2 pour les 16 gammes Freinage
-- Date: 2026-01-05
-- Description: Ajoute h1_override, how_to_choose, symptoms[], faq JSONB

-- ============================================================================
-- 1. Plaquettes de frein (pg_id: 402)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_h1_override = 'Plaquettes de frein – compatibles avant et arrière',
  sgpg_how_to_choose = 'Le choix des plaquettes de frein dépend de votre usage :

• Usage urbain : plaquettes organiques (moins bruyantes, usure normale)
• Usage mixte : plaquettes semi-métalliques (bon compromis performance/durée)
• Usage sportif : plaquettes céramiques (meilleure endurance thermique)

Privilégiez les marques OE (Brembo, Bosch, TRW, Ferodo) pour une compatibilité garantie avec votre véhicule. Vérifiez toujours la position (avant/arrière) avant de commander.',
  sgpg_symptoms = ARRAY[
    'Bruit de crissement ou grincement au freinage',
    'Vibrations dans la pédale de frein',
    'Voyant d''usure plaquettes allumé au tableau de bord',
    'Allongement de la distance de freinage',
    'Pédale de frein molle ou spongieuse'
  ],
  sgpg_faq = '[
    {"question": "Peut-on changer les plaquettes sans changer les disques ?", "answer": "Oui, si les disques ne sont pas rayés et que leur épaisseur reste dans les tolérances constructeur. Vérifiez l''état de surface et mesurez l''épaisseur avant de décider."},
    {"question": "Combien de temps durent des plaquettes de frein ?", "answer": "En moyenne 30 000 à 50 000 km selon votre conduite et le type de trajet. En ville avec beaucoup de freinages, l''usure est plus rapide."},
    {"question": "Faut-il changer les plaquettes avant et arrière en même temps ?", "answer": "Non, les plaquettes avant s''usent plus vite car elles supportent 70% de l''effort de freinage. Changez-les par essieu (les deux avant ou les deux arrière ensemble)."}
  ]'::jsonb
WHERE sgpg_pg_id = '402';

-- ============================================================================
-- 2. Disque de frein (pg_id: 82)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_h1_override = 'Disques de frein – ventilés et pleins toutes marques',
  sgpg_how_to_choose = 'Le choix du disque de frein dépend de votre véhicule et usage :

• Disques pleins : voitures citadines, usage urbain léger
• Disques ventilés : véhicules puissants, usage mixte ou intensif
• Disques percés/rainurés : usage sportif (meilleure évacuation chaleur)

Respectez toujours le diamètre et l''épaisseur d''origine. Les disques doivent être changés par paire (essieu complet). Marques OE recommandées : Brembo, ATE, TRW, Bosch.',
  sgpg_symptoms = ARRAY[
    'Vibrations au volant lors du freinage',
    'Sillons ou rayures profondes visibles sur le disque',
    'Bord du disque très marqué (lèvre d''usure)',
    'Bruits métalliques au freinage',
    'Épaisseur du disque sous le minimum constructeur'
  ],
  sgpg_faq = '[
    {"question": "Quand faut-il changer les disques de frein ?", "answer": "Généralement entre 60 000 et 80 000 km, ou quand l''épaisseur atteint le minimum indiqué sur le disque. Changez aussi si vous constatez des sillons profonds ou des vibrations."},
    {"question": "Peut-on rectifier un disque de frein au lieu de le changer ?", "answer": "La rectification est rarement recommandée aujourd''hui. Le coût est proche d''un disque neuf et l''épaisseur réduite diminue la sécurité. Préférez le remplacement."},
    {"question": "Faut-il changer les plaquettes avec les disques ?", "answer": "Oui, c''est fortement recommandé. Des plaquettes usées sur des disques neufs créent une usure irrégulière et réduisent l''efficacité du freinage."}
  ]'::jsonb
WHERE sgpg_pg_id = '82';

-- ============================================================================
-- 3. Étrier de frein (pg_id: 78)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_h1_override = 'Étrier de frein – neuf ou reconditionné garanti',
  sgpg_how_to_choose = 'L''étrier de frein est une pièce de sécurité critique :

• Étrier neuf : garantie constructeur, aucun risque de corrosion interne
• Étrier reconditionné : économique, vérifié et remis à neuf avec joints neufs
• Échange standard : vous retournez votre ancien étrier contre un prix réduit

Vérifiez le nombre de pistons et le côté (gauche/droite). Marques fiables : ATE, TRW, Bosch, Lucas. Remplacez toujours les plaquettes avec un nouvel étrier.',
  sgpg_symptoms = ARRAY[
    'Véhicule qui tire d''un côté au freinage',
    'Roue anormalement chaude après conduite',
    'Plaquettes usées de façon inégale',
    'Fuite de liquide de frein au niveau de l''étrier',
    'Bruit de frottement permanent même sans freiner'
  ],
  sgpg_faq = '[
    {"question": "Peut-on changer un seul étrier ?", "answer": "Oui, contrairement aux disques, les étriers peuvent être remplacés individuellement si un seul est défaillant. Cependant, vérifiez l''état de l''autre côté."},
    {"question": "Quelle est la durée de vie d''un étrier de frein ?", "answer": "Un étrier bien entretenu peut durer 150 000 à 200 000 km. La corrosion (sel, humidité) et le manque de purge réduisent sa durée de vie."},
    {"question": "Comment savoir si l''étrier est grippé ?", "answer": "Un étrier grippé provoque une surchauffe de la roue, une usure rapide des plaquettes d''un seul côté, et le véhicule tire au freinage. Vérifiez si le piston se rétracte correctement."}
  ]'::jsonb
WHERE sgpg_pg_id = '78';

-- ============================================================================
-- 4. Témoin d'usure (pg_id: 407)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_h1_override = 'Témoin d''usure plaquettes – capteur électrique',
  sgpg_how_to_choose = 'Le témoin d''usure est un capteur qui alerte quand les plaquettes sont usées :

• Témoin filaire : capteur simple avec fil électrique
• Témoin électronique : capteur avec connecteur, plus précis

Vérifiez la longueur du câble et le type de connecteur pour votre véhicule. Certains véhicules ont 1, 2 ou 4 témoins. Remplacez-le systématiquement avec les plaquettes. Marques : Bosch, Brembo, TRW, Ate.',
  sgpg_symptoms = ARRAY[
    'Voyant d''usure plaquettes allumé au tableau de bord',
    'Témoin visible usé ou coupé',
    'Fil du capteur endommagé ou fondu',
    'Voyant qui reste allumé après changement des plaquettes'
  ],
  sgpg_faq = '[
    {"question": "Le témoin d''usure est-il obligatoire ?", "answer": "Pas obligatoire légalement, mais fortement recommandé. Sans lui, vous n''avez pas d''alerte avant que les plaquettes soient complètement usées, ce qui endommage les disques."},
    {"question": "Pourquoi le voyant reste allumé après changement ?", "answer": "Le témoin est à usage unique : il doit être remplacé avec les plaquettes. Si le voyant reste allumé, le capteur neuf n''est peut-être pas bien connecté."},
    {"question": "Tous les véhicules ont-ils un témoin d''usure ?", "answer": "Non, beaucoup de véhicules n''en ont pas. Dans ce cas, contrôlez visuellement l''épaisseur des plaquettes régulièrement (minimum 3mm)."}
  ]'::jsonb
WHERE sgpg_pg_id = '407';

-- ============================================================================
-- 5. Kit freins arrière (pg_id: 3859)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_h1_override = 'Kit frein arrière complet – tambour ou disque',
  sgpg_how_to_choose = 'Le kit frein arrière regroupe toutes les pièces nécessaires :

• Kit tambour : mâchoires + cylindres + ressorts + accessoires
• Kit disque : plaquettes + disques (parfois étriers)

Achetez un kit complet pour garantir la compatibilité des pièces entre elles. Vérifiez le type de frein arrière de votre véhicule (tambour ou disque). Marques recommandées : Bosch, TRW, Valeo, Ferodo.',
  sgpg_symptoms = ARRAY[
    'Frein à main inefficace ou trop dur',
    'Bruits de grincement à l''arrière',
    'Véhicule qui dévie au freinage',
    'Fuite de liquide de frein aux roues arrière',
    'Usure anormale des pneus arrière'
  ],
  sgpg_faq = '[
    {"question": "Comment savoir si j''ai des freins à tambour ou à disque ?", "answer": "Regardez derrière la roue arrière : un disque est visible avec un étrier, tandis qu''un tambour est un cylindre fermé. Le carnet d''entretien indique aussi cette information."},
    {"question": "Faut-il changer le kit complet ou juste les mâchoires ?", "answer": "Si les cylindres fuient ou sont grippés, changez le kit complet. Sinon, les mâchoires seules suffisent. Les ressorts doivent être remplacés s''ils ont perdu leur tension."},
    {"question": "Les freins arrière s''usent-ils moins vite ?", "answer": "Oui, les freins arrière supportent seulement 30% de l''effort de freinage. Ils s''usent 2 à 3 fois moins vite que les freins avant."}
  ]'::jsonb
WHERE sgpg_pg_id = '3859';

-- ============================================================================
-- 6. Mâchoires de frein (pg_id: 70)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_h1_override = 'Mâchoires de frein – garnitures tambour arrière',
  sgpg_how_to_choose = 'Les mâchoires de frein équipent les freins à tambour arrière :

• Mâchoires standard : usage quotidien, bon rapport qualité/prix
• Mâchoires renforcées : usage intensif ou remorquage

Achetez toujours un jeu complet (4 mâchoires = 2 roues). Vérifiez le diamètre du tambour et la largeur des garnitures. Remplacez les ressorts et accessoires si nécessaire. Marques : Ferodo, Valeo, TRW, Bosch.',
  sgpg_symptoms = ARRAY[
    'Frein à main qui ne tient plus le véhicule',
    'Bruits de grincement ou claquement à l''arrière',
    'Traînée de poudre noire sur les jantes arrière',
    'Course de la pédale de frein anormalement longue',
    'Tambour très chaud après conduite'
  ],
  sgpg_faq = '[
    {"question": "Quelle est la durée de vie des mâchoires de frein ?", "answer": "Les mâchoires durent généralement 80 000 à 120 000 km grâce au faible effort de freinage arrière. Contrôlez-les tous les 40 000 km."},
    {"question": "Faut-il rectifier le tambour avec les mâchoires ?", "answer": "Si le tambour présente des rainures profondes ou est ovalisé, il faut le rectifier ou le remplacer. Un tambour lisse assure un freinage optimal."},
    {"question": "Comment régler les mâchoires après montage ?", "answer": "La plupart des systèmes sont auto-réglants : actionnez plusieurs fois le frein à main et la pédale de frein. Sinon, utilisez le dispositif de réglage manuel derrière le tambour."}
  ]'::jsonb
WHERE sgpg_pg_id = '70';

-- ============================================================================
-- 7. Cylindre de roue (pg_id: 277)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_h1_override = 'Cylindre de roue – récepteur frein tambour',
  sgpg_how_to_choose = 'Le cylindre de roue actionne les mâchoires dans un frein à tambour :

• Vérifiez le diamètre du piston (généralement 19 à 25 mm)
• Choisissez entre cylindre simple ou double piston
• Optez pour un cylindre en aluminium pour une meilleure résistance à la corrosion

Remplacez toujours les deux cylindres (un par roue) pour un freinage équilibré. Marques fiables : ATE, TRW, Bosch, LPR.',
  sgpg_symptoms = ARRAY[
    'Fuite de liquide de frein visible sur le tambour',
    'Traces de liquide sur la garniture des mâchoires',
    'Pédale de frein molle ou qui s''enfonce',
    'Niveau de liquide de frein qui baisse sans raison',
    'Freinage déséquilibré (véhicule tire d''un côté)'
  ],
  sgpg_faq = '[
    {"question": "Peut-on réparer un cylindre de roue qui fuit ?", "answer": "Des kits de réparation existent (joints, pistons), mais le remplacement complet est recommandé pour la sécurité. Le coût de la pièce est modéré."},
    {"question": "Pourquoi les cylindres fuient-ils ?", "answer": "L''humidité dans le liquide de frein corrode l''intérieur du cylindre. C''est pourquoi il faut purger et remplacer le liquide tous les 2 ans."},
    {"question": "Faut-il purger le circuit après changement ?", "answer": "Oui, une purge est obligatoire après remplacement du cylindre pour éliminer l''air du circuit. Commencez par la roue la plus éloignée du maître-cylindre."}
  ]'::jsonb
WHERE sgpg_pg_id = '277';

-- ============================================================================
-- 8. Flexible de frein (pg_id: 83)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_h1_override = 'Flexible de frein – durite haute pression',
  sgpg_how_to_choose = 'Le flexible de frein transmet la pression hydraulique aux étriers/cylindres :

• Flexible caoutchouc (origine) : souple, durée de vie limitée
• Flexible aviation (tressé inox) : plus rigide, meilleure sensation pédale

Vérifiez la longueur et les raccords (type de filetage). Les flexibles se dégradent avec le temps même sans fuir. Remplacez-les tous les 100 000 km ou si fissurés. Marques : ATE, TRW, Ferodo, Goodridge.',
  sgpg_symptoms = ARRAY[
    'Pédale de frein spongieuse ou molle',
    'Fissures ou craquelures visibles sur le flexible',
    'Gonflement du flexible sous pression',
    'Fuite de liquide de frein au niveau des raccords',
    'Freinage retardé ou asymétrique'
  ],
  sgpg_faq = '[
    {"question": "À quelle fréquence changer les flexibles de frein ?", "answer": "Contrôlez-les à chaque révision et changez-les tous les 100 000 km ou 10 ans, même sans symptôme visible. Le caoutchouc se dégrade de l''intérieur."},
    {"question": "Les flexibles aviation sont-ils vraiment meilleurs ?", "answer": "Oui, pour un usage sportif. Ils ne gonflent pas sous pression, offrant une pédale plus ferme et un freinage plus précis. Pour un usage normal, les flexibles d''origine suffisent."},
    {"question": "Peut-on changer un seul flexible ?", "answer": "Oui, si un seul est défaillant. Mais si les flexibles ont le même âge, remplacez-les tous pour éviter une panne prochaine sur les autres."}
  ]'::jsonb
WHERE sgpg_pg_id = '83';

-- ============================================================================
-- 9. Câble frein à main (pg_id: 124)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_h1_override = 'Câble de frein à main – câble de stationnement',
  sgpg_how_to_choose = 'Le câble de frein à main actionne les freins arrière pour le stationnement :

• Câble central : relie le levier au répartiteur
• Câbles latéraux : un par roue arrière

Vérifiez la longueur exacte et le type d''embout. Un câble grippé ou détendu compromet le stationnement en pente. Remplacez si le levier monte trop haut (+ de 8 crans). Marques : Cofle, TRW, ATE, Triscan.',
  sgpg_symptoms = ARRAY[
    'Levier de frein à main qui monte très haut',
    'Véhicule qui recule en pente malgré le frein à main',
    'Frein à main dur ou qui reste bloqué',
    'Gaine du câble rouillée ou fissurée',
    'Câble effiloché visible'
  ],
  sgpg_faq = '[
    {"question": "Comment savoir si le câble est usé ou juste déréglé ?", "answer": "Essayez de régler le tendeur sous le véhicule. Si le réglage est au maximum et le frein à main toujours inefficace, le câble est étiré et doit être remplacé."},
    {"question": "Faut-il changer les deux câbles latéraux ?", "answer": "Recommandé mais pas obligatoire. Si un seul câble est défaillant, vous pouvez le remplacer seul. Les câbles s''usent généralement au même rythme."},
    {"question": "Le câble de frein à main peut-il se bloquer ?", "answer": "Oui, surtout en hiver si de l''eau s''infiltre dans la gaine et gèle. Évitez d''utiliser le frein à main par grand froid prolongé si possible."}
  ]'::jsonb
WHERE sgpg_pg_id = '124';

-- ============================================================================
-- 10. Tambour de frein (pg_id: 123)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_h1_override = 'Tambour de frein – tambour arrière toutes marques',
  sgpg_how_to_choose = 'Le tambour de frein est la pièce contre laquelle frottent les mâchoires :

• Vérifiez le diamètre intérieur (inscrit sur le tambour d''origine)
• Choisissez entre tambour fonte (origine) ou composite (plus léger)
• Remplacez par paire pour un freinage équilibré

Le tambour doit être remplacé s''il est ovalisé, fissuré ou si le diamètre dépasse la limite d''usure. Marques : TRW, Brembo, Valeo, Bosch.',
  sgpg_symptoms = ARRAY[
    'Vibrations au freinage arrière',
    'Bruits de frottement ou grincement',
    'Rainures profondes à l''intérieur du tambour',
    'Tambour fissuré ou déformé',
    'Surchauffe anormale des roues arrière'
  ],
  sgpg_faq = '[
    {"question": "Comment vérifier l''usure d''un tambour ?", "answer": "Mesurez le diamètre intérieur avec un pied à coulisse. La limite d''usure est gravée sur le tambour (ex: MAX Ø 181mm). Si dépassée, remplacez impérativement."},
    {"question": "Peut-on rectifier un tambour usé ?", "answer": "Oui, si le diamètre après rectification reste sous la limite. Mais le coût est proche d''un tambour neuf, donc le remplacement est souvent préférable."},
    {"question": "Pourquoi le tambour peut-il rester collé ?", "answer": "La rouille entre le tambour et le moyeu peut le bloquer. Utilisez un dégrippant et frappez légèrement sur les bords. Certains tambours ont des trous taraudés pour vis d''extraction."}
  ]'::jsonb
WHERE sgpg_pg_id = '123';

-- ============================================================================
-- 11. Maître-cylindre (pg_id: 258)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_h1_override = 'Maître-cylindre de frein – pompe principale',
  sgpg_how_to_choose = 'Le maître-cylindre génère la pression hydraulique pour tout le circuit de freinage :

• Simple circuit : véhicules anciens
• Double circuit (tandem) : sécurité renforcée, un circuit par diagonale

Pièce critique de sécurité : ne jamais prendre de risque sur la qualité. Vérifiez le diamètre du piston et le nombre de sorties. Marques OE : ATE, TRW, Bosch, LPR.',
  sgpg_symptoms = ARRAY[
    'Pédale de frein qui s''enfonce lentement au feu rouge',
    'Pédale molle sans résistance',
    'Fuite de liquide au niveau du bocal ou sous le tablier',
    'Perte d''efficacité du freinage progressive',
    'Voyant de niveau liquide de frein allumé'
  ],
  sgpg_faq = '[
    {"question": "Le maître-cylindre peut-il avoir une fuite interne ?", "answer": "Oui, les joints internes peuvent laisser passer le liquide d''un circuit à l''autre. La pédale s''enfonce sans fuite visible. C''est très dangereux."},
    {"question": "Faut-il remplacer le bocal avec le maître-cylindre ?", "answer": "Pas obligatoire si le bocal est en bon état. Nettoyez-le soigneusement et vérifiez le capteur de niveau. Remplacez le bouchon si le joint est usé."},
    {"question": "Comment purger après changement du maître-cylindre ?", "answer": "Purgez d''abord le maître-cylindre sur l''établi (optionnel mais recommandé), puis purgez tout le circuit en commençant par la roue la plus éloignée."}
  ]'::jsonb
WHERE sgpg_pg_id = '258';

-- ============================================================================
-- 12. Servo-frein (pg_id: 74)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_h1_override = 'Servo-frein – assistance au freinage',
  sgpg_how_to_choose = 'Le servo-frein (mastervac) amplifie l''effort sur la pédale de frein :

• Servo-frein à dépression : utilise le vide moteur (essence) ou une pompe à vide (diesel)
• Servo-frein électrique : véhicules récents, hybrides et électriques

Pièce volumineuse située entre pédale et maître-cylindre. Vérifiez le diamètre et le nombre de goujons de fixation. Marques : ATE, TRW, Bosch, FTE.',
  sgpg_symptoms = ARRAY[
    'Pédale de frein très dure à enfoncer',
    'Effort au freinage anormalement élevé',
    'Sifflement au niveau de la pédale',
    'Pédale qui vibre au freinage',
    'Moteur qui cale au freinage (prise d''air)'
  ],
  sgpg_faq = '[
    {"question": "Comment tester le servo-frein ?", "answer": "Moteur éteint, appuyez plusieurs fois sur la pédale jusqu''à la durcir. Maintenez l''appui et démarrez : la pédale doit s''enfoncer. Sinon, le servo est défaillant."},
    {"question": "Un servo-frein peut-il se réparer ?", "answer": "Des kits de réparation existent mais la membrane interne est souvent irremplaçable. Le remplacement complet est généralement nécessaire."},
    {"question": "Pourquoi le servo siffle-t-il ?", "answer": "Un sifflement indique une prise d''air : clapet anti-retour défectueux, durite percée ou membrane du servo percée. Localisez la fuite avec du spray carburateur."}
  ]'::jsonb
WHERE sgpg_pg_id = '74';

-- ============================================================================
-- 13. Agrégat ABS (pg_id: 415)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_h1_override = 'Bloc ABS – groupe hydraulique antiblocage',
  sgpg_how_to_choose = 'L''agrégat ABS (bloc hydraulique + calculateur) gère l''antiblocage des roues :

• Bloc hydraulique seul : si le calculateur est OK
• Agrégat complet : bloc + calculateur (plus fiable)
• Réparation/reconditionnement : solution économique

Pièce complexe et coûteuse. Vérifiez le numéro OE exact. Après montage, un passage en diagnostic est souvent nécessaire. Marques : Bosch, Continental ATE, TRW.',
  sgpg_symptoms = ARRAY[
    'Voyant ABS allumé en permanence',
    'Voyant ESP ou stabilité allumé',
    'Bruit de pompe au démarrage ou au freinage',
    'Pédale de frein qui pulse sans raison',
    'Codes défaut liés aux électrovannes ABS'
  ],
  sgpg_faq = '[
    {"question": "Peut-on rouler avec le voyant ABS allumé ?", "answer": "Oui, le freinage classique fonctionne toujours. Mais l''ABS et souvent l''ESP sont désactivés : risque accru de blocage des roues sur sol glissant."},
    {"question": "L''agrégat ABS peut-il être réparé ?", "answer": "Oui, des spécialistes peuvent remplacer les composants internes (moteur, électrovannes, condensateurs). C''est souvent moins cher qu''un agrégat neuf."},
    {"question": "Faut-il reprogrammer l''ABS après changement ?", "answer": "Souvent oui. Le calculateur doit être codé au véhicule. Un passage en diagnostic est nécessaire pour effacer les codes et valider le fonctionnement."}
  ]'::jsonb
WHERE sgpg_pg_id = '415';

-- ============================================================================
-- 14. Vis de disque (pg_id: 54)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_h1_override = 'Vis de fixation disque de frein',
  sgpg_how_to_choose = 'Les vis de disque maintiennent le disque sur le moyeu :

• Vis à tête fraisée (conique) : la plus courante
• Vis à tête hexagonale : certains véhicules allemands
• Vis à empreinte Torx : véhicules récents

Utilisez des vis neuves lors du changement de disque. Appliquez du frein-filet moyen. Serrez au couple préconisé (généralement 8-12 Nm). Marques : Febi, Swag, Corteco.',
  sgpg_symptoms = ARRAY[
    'Vis bloquée ou arrondie impossible à dévisser',
    'Vis rouillée ou corrodée',
    'Disque qui bouge légèrement sur le moyeu',
    'Bruit métallique au démarrage'
  ],
  sgpg_faq = '[
    {"question": "Les vis de disque sont-elles vraiment nécessaires ?", "answer": "Elles ne sont pas structurelles : les écrous de roue maintiennent le disque en place. Mais elles facilitent le montage et évitent le voilage du disque."},
    {"question": "Comment débloquer une vis de disque grippée ?", "answer": "Appliquez du dégrippant la veille. Utilisez un tournevis à choc si possible. En dernier recours, percez la tête de la vis et extrayez le corps."},
    {"question": "Faut-il mettre du frein-filet sur les vis neuves ?", "answer": "Oui, un frein-filet moyen (bleu) est recommandé pour éviter le desserrage par vibrations tout en permettant le démontage futur."}
  ]'::jsonb
WHERE sgpg_pg_id = '54';

-- ============================================================================
-- 15. Répartiteur de freinage (pg_id: 73)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_h1_override = 'Répartiteur de freinage – correcteur de force',
  sgpg_how_to_choose = 'Le répartiteur (ou compensateur) ajuste la pression de freinage arrière selon la charge :

• Répartiteur mécanique : avec tirant relié à l''essieu arrière
• Répartiteur fixe : sans correction selon la charge
• Électronique (EBD) : intégré à l''ABS sur véhicules récents

Pièce de sécurité : vérifiez que le répartiteur correspond à votre véhicule. Un réglage peut être nécessaire après montage. Marques : ATE, TRW, Bosch.',
  sgpg_symptoms = ARRAY[
    'Roues arrière qui bloquent trop facilement',
    'Véhicule instable au freinage',
    'Fuite de liquide au niveau du répartiteur',
    'Tirant de répartiteur cassé ou déréglé'
  ],
  sgpg_faq = '[
    {"question": "Comment savoir si le répartiteur est défaillant ?", "answer": "Freinez fort sur sol sec : si l''arrière bloque avant l''avant ou si le véhicule part en travers, le répartiteur peut être en cause."},
    {"question": "Le répartiteur est-il réglable ?", "answer": "Le répartiteur mécanique se règle via la longueur du tirant. Le réglage doit être fait véhicule à vide. Consultez la documentation technique."},
    {"question": "Mon véhicule a-t-il un répartiteur ou un EBD ?", "answer": "Les véhicules avec ABS ont généralement un EBD (répartition électronique). Sans ABS, vous avez un répartiteur mécanique, souvent fixé près de l''essieu arrière."}
  ]'::jsonb
WHERE sgpg_pg_id = '73';

-- ============================================================================
-- 16. Pompe à vide (pg_id: 387)
-- ============================================================================
UPDATE __seo_gamme_purchase_guide SET
  sgpg_h1_override = 'Pompe à vide – assistance freinage diesel',
  sgpg_how_to_choose = 'La pompe à vide crée la dépression nécessaire au servo-frein (moteurs diesel) :

• Pompe à palettes : entraînée par l''arbre à cames
• Pompe électrique : indépendante du moteur (hybrides, stop&start)

Vérifiez le type d''entraînement et le nombre de vis de fixation. Une pompe défaillante rend le freinage très dur. Marques : Pierburg, Hella, Valeo, Bosch.',
  sgpg_symptoms = ARRAY[
    'Pédale de frein très dure sur moteur diesel',
    'Bruit anormal venant du moteur au ralenti',
    'Fuite d''huile au niveau de la pompe',
    'Voyant de frein allumé (certains véhicules)',
    'Perte d''assistance au freinage après quelques freinages'
  ],
  sgpg_faq = '[
    {"question": "Pourquoi les diesels ont-ils une pompe à vide ?", "answer": "Les moteurs diesel n''ont pas de papillon des gaz, donc pas de dépression naturelle. La pompe à vide crée cette dépression pour alimenter le servo-frein."},
    {"question": "La pompe à vide peut-elle fuir de l''huile ?", "answer": "Oui, les joints d''étanchéité peuvent s''user. Une fuite d''huile au niveau de la pompe doit être traitée rapidement pour éviter une panne du servo-frein."},
    {"question": "Comment tester la pompe à vide ?", "answer": "Débranchez la durite du servo-frein et connectez un vacuomètre. Au ralenti, la dépression doit atteindre -0.6 à -0.8 bar. Sinon, la pompe est faible."}
  ]'::jsonb
WHERE sgpg_pg_id = '387';

-- ============================================================================
-- Vérification
-- ============================================================================
-- SELECT sgpg_pg_id, sgpg_h1_override, sgpg_symptoms[1] AS first_symptom
-- FROM __seo_gamme_purchase_guide
-- WHERE sgpg_pg_id IN (402, 82, 78, 407, 3859, 70, 277, 83, 124, 123, 258, 74, 415, 54, 73, 387)
-- ORDER BY sgpg_pg_id;
