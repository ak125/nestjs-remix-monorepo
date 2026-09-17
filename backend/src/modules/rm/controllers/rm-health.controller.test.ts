/**
 * GET /api/rm/health — la réponse doit être vraie, et muette sur la posture de sécurité.
 *
 * Incident du 2026-09-17 (PROD) : l'endpoint répondait
 *   HTTP 200 {"success":true,"status":"error",
 *             "message":"RPC blocked by safety gate: rm_health (DENYLIST_P2_SECURITY_DEFINER)"}
 *
 * Deux défauts distincts, aucun n'étant la garde RPC — qui, elle, faisait son travail :
 * cet endpoint ne porte AUCUN `@UseGuards`, et un appelant anonyme ne doit pas
 * déclencher une fonction SECURITY DEFINER.
 *
 *  1. VERT-MAIS-FAUX — code 200 et `success: true` alors que le corps annonce une
 *     erreur. Tout moniteur qui lit le statut HTTP voit un système sain.
 *  2. DIVULGATION — le motif nommait la garde, son palier de politique et la fonction
 *     visée, à un appelant non authentifié.
 *
 * Invisible en CI : `RPC_GATE_ENFORCE_LEVEL` vaut P2 en PROD et P1 en PREPROD, donc
 * l'appel passe toutes les sondes de pré-production (docker-compose.prod.yml:19 vs
 * docker-compose.preprod.yml:21).
 */
import { ServiceUnavailableException } from '@nestjs/common';

import { RmController } from './rm.controller';

type Health = Record<string, unknown>;

function controllerReturning(health: Health): RmController {
  // Instanciation manuelle : seul `rmBuilder` est sollicité par `getHealth()`.
  // Un paramètre ajouté au constructeur ferait tomber ce test en TS2554 — c'est
  // voulu (cf. feedback_constructor_signature_change_grep_all_new_callsites).
  return new RmController(
    { getHealth: async () => health } as never,
    {} as never,
    {} as never,
  );
}

describe('GET /api/rm/health', () => {
  it('refuse de répondre 200 quand la santé est indéterminable', async () => {
    const c = controllerReturning({
      status: 'error',
      message:
        'RPC blocked by safety gate: rm_health (DENYLIST_P2_SECURITY_DEFINER)',
    });

    await expect(c.getHealth()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('ne divulgue ni la garde, ni son palier, ni le nom de la fonction', async () => {
    const leak =
      'RPC blocked by safety gate: rm_health (DENYLIST_P2_SECURITY_DEFINER)';
    const c = controllerReturning({ status: 'error', message: leak });

    const body = await c.getHealth().then(
      () => {
        throw new Error('getHealth() aurait dû lever');
      },
      (e: ServiceUnavailableException) => JSON.stringify(e.getResponse()),
    );

    // Assertion sur les FRAGMENTS, pas sur le message entier : une reformulation
    // du motif amont ne doit pas rouvrir la fuite en silence.
    for (const secret of [
      'DENYLIST',
      'SECURITY_DEFINER',
      'rm_health',
      'safety gate',
    ]) {
      expect(body).not.toContain(secret);
    }
  });

  it('répond normalement quand la santé est disponible', async () => {
    const c = controllerReturning({ status: 'ok', listings: 42 });

    await expect(c.getHealth()).resolves.toEqual({
      success: true,
      status: 'ok',
      listings: 42,
    });
  });
});
