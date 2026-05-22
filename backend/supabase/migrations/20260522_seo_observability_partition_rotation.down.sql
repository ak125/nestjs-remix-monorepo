-- Rollback : rotation des partitions observability timeseries (mensuelles).
--
-- Annule UNIQUEMENT le mécanisme (job cron + fonction). NE TOUCHE PAS aux
-- partitions ni aux données : un rollback de l'outil de rotation ne doit jamais
-- supprimer des timeseries GSC/GA4/CWV. Après ce down, les partitions cessent
-- d'être pré-créées/purgées automatiquement (retour à l'état hardcodé d'avant).
--
-- Idempotent : ré-exécutable sans erreur (mirror des gardes de la migration up).
-- Le runner wrappe déjà chaque fichier dans une transaction : pas de BEGIN/COMMIT.

-- Désenregistrer le job cron (guardé — cron.unschedule lève si le job est absent).
SELECT cron.unschedule('observability-partition-rotation')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'observability-partition-rotation'
);

-- Supprimer la fonction de maintenance.
DROP FUNCTION IF EXISTS public.maintain_observability_partitions(INT, INT);
