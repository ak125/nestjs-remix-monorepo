/**
 * Enveloppe bcrypt des anciennes empreintes de mot de passe (mandat AP).
 * LECTURE SEULE PAR DÉFAUT.
 *
 * Sans `PASSWORD_WRAP_CONFIRM=APPLY` : comptes par format avant, nombre de
 * lignes à envelopper, aucune écriture. Avec : enveloppe par lots, puis comptes
 * après. Relançable sans risque : ce qui est déjà enveloppé n'est pas relu.
 *
 * Préalable : la version de l'application qui sait valider les enveloppes doit
 * être servie partout où des clients se connectent (PROD), sinon les comptes
 * enveloppés ne peuvent plus se connecter.
 *
 * Lancement, depuis backend/ d'un checkout compilé contenant ce fichier :
 *   node dist/workers/run-legacy-password-wrap.js                 # lecture
 *   PASSWORD_WRAP_CONFIRM=APPLY node dist/workers/run-legacy-password-wrap.js
 * Variables lues : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, et en option
 * PASSWORD_WRAP_MAX_ROWS (borne par table).
 */
import { createClient } from '@supabase/supabase-js';
import { PasswordCryptoService } from '../shared/crypto/password-crypto.service';
import { runLegacyHashWrap } from '../shared/crypto/legacy-hash-wrap.runner';
import { SupabaseWrapStore } from '../shared/crypto/legacy-hash-wrap.supabase-store';
import {
  isWrapApplyConfirmed,
  parseMaxRows,
  PASSWORD_WRAP_CONFIRM_ENV,
  PASSWORD_WRAP_CONFIRM_VALUE,
} from './run-legacy-password-wrap.guard';

/* eslint-disable no-console */
async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
    process.exit(2);
  }
  const apply = isWrapApplyConfirmed();
  const maxRowsPerTarget = parseMaxRows();
  console.log(
    apply
      ? `PASSWORD_WRAP mode=APPLY maxRowsPerTarget=${maxRowsPerTarget ?? 'none'}`
      : `PASSWORD_WRAP mode=READ-ONLY (set ${PASSWORD_WRAP_CONFIRM_ENV}=${PASSWORD_WRAP_CONFIRM_VALUE} to write)`,
  );

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const reports = await runLegacyHashWrap(
    new SupabaseWrapStore(client),
    new PasswordCryptoService(),
    { apply, maxRowsPerTarget, log: (line) => console.log(line) },
  );
  console.log('PASSWORD_WRAP_SUMMARY ' + JSON.stringify(reports));
  const failed = reports.reduce((n, r) => n + r.failed, 0);
  process.exit(failed > 0 ? 1 : 0);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('PASSWORD_WRAP aborted:', (error as Error).message);
    process.exit(1);
  });
}
