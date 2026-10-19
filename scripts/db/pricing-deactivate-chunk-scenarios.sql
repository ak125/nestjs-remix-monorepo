-- Scénarios de scripts/db/test-pricing-deactivate-chunk.sh (une seule session psql,
-- ON_ERROR_STOP : la première assertion fausse arrête le test).

-- 0. Forme des fonctions et droits
SELECT eq('search_path épinglé (chunk)', (SELECT proconfig::text FROM pg_proc WHERE proname='pricing_deactivate_chunk'), '{search_path=public}');
SELECT eq('search_path épinglé (rollback)', (SELECT proconfig::text FROM pg_proc WHERE proname='pricing_deactivate_rollback'), '{search_path=public}');
SELECT eq('INVOKER (chunk)', (SELECT prosecdef FROM pg_proc WHERE proname='pricing_deactivate_chunk'), false);
SELECT eq('INVOKER (rollback)', (SELECT prosecdef FROM pg_proc WHERE proname='pricing_deactivate_rollback'), false);
SELECT eq('anon sans EXECUTE (chunk)', has_function_privilege('anon','pricing_deactivate_chunk(uuid,uuid,text,text,jsonb)','EXECUTE'), false);
SELECT eq('authenticated sans EXECUTE (chunk)', has_function_privilege('authenticated','pricing_deactivate_chunk(uuid,uuid,text,text,jsonb)','EXECUTE'), false);
SELECT eq('service_role EXECUTE (chunk)', has_function_privilege('service_role','pricing_deactivate_chunk(uuid,uuid,text,text,jsonb)','EXECUTE'), true);
SELECT eq('anon sans EXECUTE (rollback)', has_function_privilege('anon','pricing_deactivate_rollback(uuid,text)','EXECUTE'), false);
SELECT eq('authenticated sans EXECUTE (rollback)', has_function_privilege('authenticated','pricing_deactivate_rollback(uuid,text)','EXECUTE'), false);
SELECT eq('service_role EXECUTE (rollback)', has_function_privilege('service_role','pricing_deactivate_rollback(uuid,text)','EXECUTE'), true);
SELECT eq('PUBLIC sans EXECUTE (2 fonctions)', (SELECT count(*) FROM pg_proc p, aclexplode(p.proacl) a
  WHERE p.proname IN ('pricing_deactivate_chunk','pricing_deactivate_rollback') AND a.grantee = 0), 0::bigint);
SELECT eq('témoin : la fixture reproduit le défaut Supabase (anon EXECUTE sur activate)', has_function_privilege('anon','pricing_activate_chunk(uuid,uuid,text,text,jsonb)','EXECUTE'), true);

-- 1. Lots et chunks
INSERT INTO price_import_batches(batch_id, status, supplier_id, operation) VALUES
 ('b1000000-0000-0000-0000-000000000000','COMMITTING','MARQUE_A','DISPO_DEACTIVATION'),
 ('b2000000-0000-0000-0000-000000000000','UPLOADED','MARQUE_A','DISPO_DEACTIVATION'),
 ('b5000000-0000-0000-0000-000000000000','COMMITTING','MARQUE_B',NULL);
INSERT INTO price_import_batch_chunks(chunk_id, batch_id, seq) VALUES
 ('c1000000-0000-0000-0000-000000000000','b1000000-0000-0000-0000-000000000000',0),
 ('c3000000-0000-0000-0000-000000000000','b1000000-0000-0000-0000-000000000000',1),
 ('c4000000-0000-0000-0000-000000000000','b1000000-0000-0000-0000-000000000000',2),
 ('c2000000-0000-0000-0000-000000000000','b2000000-0000-0000-0000-000000000000',0),
 ('c5000000-0000-0000-0000-000000000000','b5000000-0000-0000-0000-000000000000',0);
SELECT price_fp() AS fp0 \gset

-- 2. Refus avant toute écriture
SET ROLE service_role;
SELECT expect_error('refus : lot UPLOADED', $q$SELECT pricing_deactivate_chunk('b2000000-0000-0000-0000-000000000000','c2000000-0000-0000-0000-000000000000','MARQUE_A','t','[{"piece_id_i":1,"pri_type":"0","reason":"CONFIRMED_OUT"}]')$q$, '%not a COMMITTING DISPO_DEACTIVATION%');
-- lot d'import COMMITTING (operation nulle) : seul le contrôle d'opération le refuse
SELECT expect_error('refus : lot d''import COMMITTING (operation nulle)', $q$SELECT pricing_deactivate_chunk('b5000000-0000-0000-0000-000000000000','c5000000-0000-0000-0000-000000000000','MARQUE_B','t','[{"piece_id_i":9,"pri_type":"0","reason":"CONFIRMED_OUT"}]')$q$, '%not a COMMITTING DISPO_DEACTIVATION%');
SELECT expect_error('refus : fournisseur différent du lot', $q$SELECT pricing_deactivate_chunk('b1000000-0000-0000-0000-000000000000','c1000000-0000-0000-0000-000000000000','MARQUE_B','t','[{"piece_id_i":9,"pri_type":"0","reason":"CONFIRMED_OUT"}]')$q$, '%not a COMMITTING DISPO_DEACTIVATION%');
SELECT expect_error('refus : chunk d''un autre lot', $q$SELECT pricing_deactivate_chunk('b1000000-0000-0000-0000-000000000000','c2000000-0000-0000-0000-000000000000','MARQUE_A','t','[{"piece_id_i":1,"pri_type":"0","reason":"CONFIRMED_OUT"}]')$q$, '%not a COMMITTING DISPO_DEACTIVATION%');
RESET ROLE;
SET ROLE anon;
SELECT expect_error('refus : anon (chunk)', $q$SELECT pricing_deactivate_chunk('b1000000-0000-0000-0000-000000000000','c1000000-0000-0000-0000-000000000000','MARQUE_A','t','[]')$q$, 'permission denied for function%');
SELECT expect_error('refus : anon (rollback)', $q$SELECT pricing_deactivate_rollback('b1000000-0000-0000-0000-000000000000','MARQUE_A')$q$, 'permission denied for function%');
RESET ROLE;
SET ROLE authenticated;
SELECT expect_error('refus : authenticated (chunk)', $q$SELECT pricing_deactivate_chunk('b1000000-0000-0000-0000-000000000000','c1000000-0000-0000-0000-000000000000','MARQUE_A','t','[]')$q$, 'permission denied for function%');
RESET ROLE;
SELECT eq('refus : aucun historique écrit', (SELECT count(*) FROM pieces_price_history), 0::bigint);
SELECT eq('refus : aucune dispo changée (seule la 6 est à 0)', (SELECT count(*) FROM pieces_price WHERE pri_dispo='0'), 1::bigint);
SELECT eq('refus : chunks restés PENDING', (SELECT count(*) FROM price_import_batch_chunks WHERE status<>'PENDING'), 0::bigint);

-- 3. Retrait (service_role, comme le backend)
SET ROLE service_role;
SELECT pricing_deactivate_chunk('b1000000-0000-0000-0000-000000000000','c1000000-0000-0000-0000-000000000000','MARQUE_A','op-test','[
 {"piece_id_i":1,"pri_type":"0","reason":"CONFIRMED_OUT"},
 {"piece_id_i":2,"pri_type":"0","reason":"DISCONTINUED_TARIFF"},
 {"piece_id_i":3,"pri_type":"0","reason":"CONFIRMED_OUT"},
 {"piece_id_i":4,"pri_type":"0","reason":"CONFIRMED_OUT"},
 {"piece_id_i":5,"pri_type":"0","reason":"CONFIRMED_OUT"},
 {"piece_id_i":6,"pri_type":"0","reason":"CONFIRMED_OUT"},
 {"piece_id_i":7,"pri_type":"0","reason":"CONFIRMED_OUT"},
 {"piece_id_i":8,"pri_type":"0","reason":"CONFIRMED_OUT"},
 {"piece_id_i":9,"pri_type":"0","reason":"CONFIRMED_OUT"},
 {"piece_id_i":10,"pri_type":"1","reason":"CONFIRMED_OUT"},
 {"piece_id_i":11,"pri_type":"0","reason":"CONFIRMED_OUT"},
 {"piece_id_i":999,"pri_type":"0","reason":"CONFIRMED_OUT"},
 {"piece_id_i":12,"pri_type":"0","reason":"OUT"},
 {"piece_id_i":12,"pri_type":"0"}
]'::jsonb)::text AS r1 \gset
RESET ROLE;
SELECT eq('retrait : compteurs', :'r1'::jsonb, '{"deactivated":5,"skipped":5,"missing":2,"rejected":2}'::jsonb);
SELECT eq('retrait : prix inchangés', price_fp(), :'fp0');
SELECT eq('retrait : lignes retirées', (SELECT string_agg(pri_piece_id||':'||pri_type, ',' ORDER BY pri_piece_id::int, pri_type) FROM pieces_price WHERE pricing_updated_source='deactivate:b1000000-0000-0000-0000-000000000000'), '1:0,2:0,3:0,10:1,11:0');
SELECT eq('retrait : dispo 0, motif, opérateur', (SELECT count(*) FROM pieces_price WHERE pricing_updated_source='deactivate:b1000000-0000-0000-0000-000000000000' AND pri_dispo='0' AND pricing_updated_by='op-test' AND pricing_state_reason LIKE 'DISPO_DEACTIVATION:%'), 5::bigint);
SELECT eq('retrait : motif tarif arrêté', (SELECT pricing_state_reason FROM pieces_price WHERE pri_piece_id='2'), 'DISPO_DEACTIVATION:DISCONTINUED_TARIFF');
SELECT eq('retrait : pièce 10 type 0 intacte', (SELECT pri_dispo||coalesce(pricing_updated_source,'-') FROM pieces_price WHERE pri_piece_id='10' AND pri_type='0'), '1-');
SELECT eq('retrait : autre marque intacte', (SELECT pri_dispo||coalesce(pricing_updated_source,'-') FROM pieces_price WHERE pri_piece_id='9'), '1-');
SELECT eq('retrait : ignorées intactes (FROZEN, MANUAL, 0, null, motif, motif invalide)', (SELECT count(*) FROM pieces_price WHERE pri_piece_id IN ('4','5','6','7','8','12') AND pricing_updated_source IS NULL), 6::bigint);
SELECT eq('retrait : historique, ancienne dispo', (SELECT string_agg(pri_piece_id_i||':'||pri_type||':'||old_dispo||'>'||new_dispo, ',' ORDER BY pri_piece_id_i, pri_type) FROM pieces_price_history WHERE batch_id='b1000000-0000-0000-0000-000000000000'), '1:0:1>0,2:0:2>0,3:0:3>0,10:1:1>0,11:0:1>0');
SELECT eq('retrait : historique, prix old = new', (SELECT count(*) FROM pieces_price_history WHERE batch_id='b1000000-0000-0000-0000-000000000000' AND (
  old_gros_ht IS DISTINCT FROM new_gros_ht OR old_remise IS DISTINCT FROM new_remise OR old_achat_ht IS DISTINCT FROM new_achat_ht
  OR old_marge IS DISTINCT FROM new_marge OR old_vente_ht IS DISTINCT FROM new_vente_ht OR old_vente_ttc IS DISTINCT FROM new_vente_ttc)), 0::bigint);
SELECT eq('retrait : historique rattaché au chunk', (SELECT count(*) FROM pieces_price_history WHERE chunk_id='c1000000-0000-0000-0000-000000000000'), 5::bigint);
SELECT eq('retrait : chunk COMMITTED', (SELECT status FROM price_import_batch_chunks WHERE chunk_id='c1000000-0000-0000-0000-000000000000'), 'COMMITTED');

-- 4. Rejeu des mêmes lignes : tout est ignoré
SET ROLE service_role;
SELECT pricing_deactivate_chunk('b1000000-0000-0000-0000-000000000000','c3000000-0000-0000-0000-000000000000','MARQUE_A','op-test','[{"piece_id_i":1,"pri_type":"0","reason":"CONFIRMED_OUT"},{"piece_id_i":10,"pri_type":"1","reason":"CONFIRMED_OUT"}]')::text AS r2 \gset
RESET ROLE;
SELECT eq('rejeu : tout ignoré', :'r2'::jsonb, '{"deactivated":0,"skipped":2,"missing":0,"rejected":0}'::jsonb);
SELECT eq('rejeu : pas de nouvel historique', (SELECT count(*) FROM pieces_price_history), 5::bigint);

-- 5. Erreur en cours de chunk : tout l'appel est annulé, chunk compris
SET ROLE service_role;
SELECT expect_error('erreur en cours de chunk : appel en échec', $q$SELECT pricing_deactivate_chunk('b1000000-0000-0000-0000-000000000000','c4000000-0000-0000-0000-000000000000','MARQUE_A','op-test','[{"piece_id_i":12,"pri_type":"0","reason":"CONFIRMED_OUT"},{"piece_id_i":"abc","pri_type":"0","reason":"CONFIRMED_OUT"}]')$q$, 'invalid input syntax for type bigint%');
-- témoin : le handler EXCEPTION de l'activation (chunk FAILED puis RAISE) est annulé avec l'appel
SELECT expect_error('témoin activation : appel en échec', $q$SELECT pricing_activate_chunk('b5000000-0000-0000-0000-000000000000','c5000000-0000-0000-0000-000000000000','MARQUE_B','t','[{"piece_id_i":"abc","pri_type":"0","dispo":"1"}]')$q$, 'invalid input syntax for type bigint%');
RESET ROLE;
SELECT eq('erreur : pièce 12 non retirée', (SELECT pri_dispo FROM pieces_price WHERE pri_piece_id='12'), '2');
SELECT eq('erreur : chunk resté PENDING', (SELECT status FROM price_import_batch_chunks WHERE chunk_id='c4000000-0000-0000-0000-000000000000'), 'PENDING');
SELECT eq('erreur : historique inchangé', (SELECT count(*) FROM pieces_price_history), 5::bigint);
SELECT eq('témoin activation : chunk resté PENDING, jamais FAILED', (SELECT status FROM price_import_batch_chunks WHERE chunk_id='c5000000-0000-0000-0000-000000000000'), 'PENDING');

-- 6. Écritures ultérieures sur deux lignes retirées
UPDATE price_import_batches SET status='COMMITTED', completed_at=now() WHERE batch_id='b1000000-0000-0000-0000-000000000000';
INSERT INTO price_import_batches(batch_id, status, supplier_id) VALUES ('b3000000-0000-0000-0000-000000000000','COMMITTING','MARQUE_A');
INSERT INTO price_import_batch_chunks(chunk_id, batch_id, seq) VALUES ('c6000000-0000-0000-0000-000000000000','b3000000-0000-0000-0000-000000000000',0);
SET ROLE service_role;
SELECT pricing_activate_chunk('b3000000-0000-0000-0000-000000000000','c6000000-0000-0000-0000-000000000000','MARQUE_A','op2','[{"piece_id_i":2,"pri_type":"0","dispo":"1"}]')::text AS r3 \gset
RESET ROLE;
SELECT eq('activation ultérieure de la pièce 2 (journalisée)', :'r3'::jsonb, '{"activated":1,"skipped":0,"missing":0,"rejected":0}'::jsonb);
UPDATE price_import_batches SET status='COMMITTED' WHERE batch_id='b3000000-0000-0000-0000-000000000000';
-- édition manuelle non journalisée de la pièce 3
UPDATE pieces_price SET pri_dispo='1' WHERE pri_piece_id='3';

-- 7. Refus du rollback
SET ROLE service_role;
SELECT expect_error('rollback refusé : fournisseur différent', $q$SELECT pricing_deactivate_rollback('b1000000-0000-0000-0000-000000000000','MARQUE_B')$q$, '%not a COMMITTED or FAILED DISPO_DEACTIVATION%');
SELECT expect_error('rollback refusé : lot d''activation', $q$SELECT pricing_deactivate_rollback('b3000000-0000-0000-0000-000000000000','MARQUE_A')$q$, '%not a COMMITTED or FAILED DISPO_DEACTIVATION%');
SELECT expect_error('rollback refusé : lot UPLOADED', $q$SELECT pricing_deactivate_rollback('b2000000-0000-0000-0000-000000000000','MARQUE_A')$q$, '%not a COMMITTED or FAILED DISPO_DEACTIVATION%');
RESET ROLE;

-- 8. Rollback du lot 1
SET ROLE service_role;
SELECT pricing_deactivate_rollback('b1000000-0000-0000-0000-000000000000','MARQUE_A')::text AS r4 \gset
RESET ROLE;
SELECT eq('rollback : compteurs', :'r4'::jsonb, '{"restored":3,"superseded":2}'::jsonb);
SELECT eq('rollback : statut ROLLBACK_PARTIAL', (SELECT status FROM price_import_batches WHERE batch_id='b1000000-0000-0000-0000-000000000000'), 'ROLLBACK_PARTIAL');
SELECT eq('rollback : completed_at posé', (SELECT completed_at IS NOT NULL FROM price_import_batches WHERE batch_id='b1000000-0000-0000-0000-000000000000'), true);
SELECT eq('rollback : dispo d''origine, motif vidé', (SELECT string_agg(pri_piece_id||':'||pri_type||':'||pri_dispo||':'||coalesce(pricing_state_reason,'NULL'), ',' ORDER BY pri_piece_id::int, pri_type) FROM pieces_price WHERE pricing_updated_source='rollback:b1000000-0000-0000-0000-000000000000'), '1:0:1:NULL,10:1:1:NULL,11:0:1:NULL');
SELECT eq('rollback : pièce 2 garde l''activation', (SELECT pri_dispo||':'||pricing_updated_source FROM pieces_price WHERE pri_piece_id='2'), '1:activate:b3000000-0000-0000-0000-000000000000');
SELECT eq('rollback : pièce 3 garde l''édition manuelle', (SELECT pri_dispo||':'||pricing_updated_source FROM pieces_price WHERE pri_piece_id='3'), '1:deactivate:b1000000-0000-0000-0000-000000000000');
SELECT eq('rollback : prix inchangés', price_fp(), :'fp0');
SELECT eq('rollback : pièce 11, prix affiché texte conservé', (SELECT pri_vente_ttc||':'||coalesce(pri_vente_ttc_n::text,'NULL') FROM pieces_price WHERE pri_piece_id='11'), '12.34:NULL');
SELECT eq('rollback : pièce 10 type 0 toujours intacte', (SELECT pri_dispo||coalesce(pricing_updated_source,'-') FROM pieces_price WHERE pri_piece_id='10' AND pri_type='0'), '1-');
SET ROLE service_role;
SELECT expect_error('second rollback refusé', $q$SELECT pricing_deactivate_rollback('b1000000-0000-0000-0000-000000000000','MARQUE_A')$q$, '%not a COMMITTED or FAILED DISPO_DEACTIVATION%');
RESET ROLE;

-- 9. Lot FAILED : rollback complet ; témoin de l'annulation générique sur ce lot
INSERT INTO price_import_batches(batch_id, status, supplier_id, operation) VALUES ('b4000000-0000-0000-0000-000000000000','COMMITTING','MARQUE_A','DISPO_DEACTIVATION');
INSERT INTO price_import_batch_chunks(chunk_id, batch_id, seq) VALUES ('c7000000-0000-0000-0000-000000000000','b4000000-0000-0000-0000-000000000000',0);
SET ROLE service_role;
SELECT pricing_deactivate_chunk('b4000000-0000-0000-0000-000000000000','c7000000-0000-0000-0000-000000000000','MARQUE_A','op3','[{"piece_id_i":11,"pri_type":"0","reason":"CONFIRMED_OUT"},{"piece_id_i":12,"pri_type":"0","reason":"DISCONTINUED_TARIFF"}]')::text AS r5 \gset
RESET ROLE;
SELECT eq('lot 4 : retrait', :'r5'::jsonb, '{"deactivated":2,"skipped":0,"missing":0,"rejected":0}'::jsonb);
UPDATE price_import_batches SET status='FAILED', completed_at=now() WHERE batch_id='b4000000-0000-0000-0000-000000000000';
BEGIN;
SELECT pricing_rollback_batch('b4000000-0000-0000-0000-000000000000','MARQUE_A') \gset generique_
SELECT eq('témoin : l''annulation générique efface le prix affiché de la pièce 11', (SELECT pri_vente_ttc FROM pieces_price WHERE pri_piece_id='11'), NULL::text);
ROLLBACK;
SELECT eq('témoin annulé : pièce 11 encore retirée, prix intact', (SELECT pri_dispo||':'||pri_vente_ttc FROM pieces_price WHERE pri_piece_id='11'), '0:12.34');
SET ROLE service_role;
SELECT pricing_deactivate_rollback('b4000000-0000-0000-0000-000000000000','MARQUE_A')::text AS r6 \gset
RESET ROLE;
SELECT eq('lot FAILED : rollback complet', :'r6'::jsonb, '{"restored":2,"superseded":0}'::jsonb);
SELECT eq('lot FAILED : statut ROLLED_BACK', (SELECT status FROM price_import_batches WHERE batch_id='b4000000-0000-0000-0000-000000000000'), 'ROLLED_BACK');
SELECT eq('lot FAILED : pièces 11 et 12 revendables, dispo d''origine (1 et 2)', (SELECT string_agg(pri_piece_id||':'||pri_dispo||':'||coalesce(pricing_state_reason,'NULL')||':'||pri_vente_ttc, ',' ORDER BY pri_piece_id::int) FROM pieces_price WHERE pri_piece_id IN ('11','12')), '11:1:NULL:12.34,12:2:NULL:12.00');

-- 10. Chacune des deux gardes de l'annulation, seule : tous les writers journalisés
-- actuels changent pricing_updated_source, donc la garde « ligne encore à ce lot »
-- couvre aussi l'entrée d'historique postérieure. Écritures simulées pour isoler :
--   pièce 1 : écriture journalisée postérieure qui laisse la ligne telle quelle ;
--   pièce 12 : ligne passée à une autre marque après le retrait.
INSERT INTO price_import_batches(batch_id, status, supplier_id, operation) VALUES ('b7000000-0000-0000-0000-000000000000','COMMITTING','MARQUE_A','DISPO_DEACTIVATION');
INSERT INTO price_import_batch_chunks(chunk_id, batch_id, seq) VALUES ('c8000000-0000-0000-0000-000000000000','b7000000-0000-0000-0000-000000000000',0);
SET ROLE service_role;
SELECT pricing_deactivate_chunk('b7000000-0000-0000-0000-000000000000','c8000000-0000-0000-0000-000000000000','MARQUE_A','op4','[{"piece_id_i":1,"pri_type":"0","reason":"CONFIRMED_OUT"},{"piece_id_i":11,"pri_type":"0","reason":"CONFIRMED_OUT"},{"piece_id_i":12,"pri_type":"0","reason":"CONFIRMED_OUT"}]')::text AS r7 \gset
RESET ROLE;
SELECT eq('lot 7 : retrait', :'r7'::jsonb, '{"deactivated":3,"skipped":0,"missing":0,"rejected":0}'::jsonb);
UPDATE price_import_batches SET status='COMMITTED', completed_at=now() WHERE batch_id='b7000000-0000-0000-0000-000000000000';
INSERT INTO pieces_price_history(batch_id, pri_piece_id_i, pri_type, old_dispo, new_dispo) VALUES ('b8000000-0000-0000-0000-000000000000', 1, '0', '0', '0');
UPDATE pieces_price SET pri_pm_id='MARQUE_B' WHERE pri_piece_id='12';
SET ROLE service_role;
SELECT pricing_deactivate_rollback('b7000000-0000-0000-0000-000000000000','MARQUE_A')::text AS r8 \gset
RESET ROLE;
SELECT eq('lot 7 : rollback, seule la pièce 11 restaurée', :'r8'::jsonb, '{"restored":1,"superseded":2}'::jsonb);
SELECT eq('lot 7 : statut ROLLBACK_PARTIAL', (SELECT status FROM price_import_batches WHERE batch_id='b7000000-0000-0000-0000-000000000000'), 'ROLLBACK_PARTIAL');
SELECT eq('lot 7 : pièce 1 laissée (entrée d''historique postérieure)', (SELECT pri_dispo||':'||pricing_updated_source FROM pieces_price WHERE pri_piece_id='1'), '0:deactivate:b7000000-0000-0000-0000-000000000000');
SELECT eq('lot 7 : pièce 12 laissée (autre marque)', (SELECT pri_dispo||':'||pricing_updated_source FROM pieces_price WHERE pri_piece_id='12'), '0:deactivate:b7000000-0000-0000-0000-000000000000');
SELECT eq('lot 7 : pièce 11 restaurée', (SELECT pri_dispo||':'||pricing_updated_source FROM pieces_price WHERE pri_piece_id='11'), '1:rollback:b7000000-0000-0000-0000-000000000000');
SELECT eq('fin : prix inchangés', price_fp(), :'fp0');
