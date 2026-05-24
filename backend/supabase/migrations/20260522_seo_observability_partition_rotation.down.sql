-- Rollback : rotation des partitions observability timeseries (mensuelles).
--
-- Annule UNIQUEMENT le mécanisme (job cron + fonction). NE TOUCHE PAS aux
-- partitions ni aux données : un rollback de l'outil de rotation ne doit jamais
-- supprimer des timeseries GSC/GA4/CWV. Après ce down, les partitions cessent
-- d'être pré-créées/purgées automatiquement (retour à l'état hardcodé d'avant).
--
-- Idempotent : ré-exécutable sans erreur (mirror des gardes de la migration up).
-- Le runner wrappe déjà chaque fichier dans une transaction : pas de BEGIN/COMMIT.

-- Désenregistrer les jobs cron (guardé — cron.unschedule lève si le job est absent).
SELECT cron.unschedule('observability-partition-rotation')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'observability-partition-rotation'
);

-- quality-history : on retire UNIQUEMENT le cron ajouté ici. La fonction
-- ensure_next_quality_history_partition() appartient à 20260507 (ADR-050) et
-- n'est PAS supprimée par ce rollback.
SELECT cron.unschedule('quality-history-partition-rotation')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'quality-history-partition-rotation'
);

-- Supprimer la fonction de maintenance créée par cette migration.
DROP FUNCTION IF EXISTS public.maintain_observability_partitions(INT, INT);
