/**
 * Miroir « vendable » (décision 118) : la version applicative (estVendable) et
 * la version SQL (public.est_vendable, migration
 * 20261118_est_vendable_definition_unique.sql) lisent le MÊME échantillon,
 * vendable.echantillon.json, et doivent chacune rendre `attendu`.
 *
 *   - ici : estVendable, cas par cas ;
 *   - scripts/ci/check-vendable-mirror.py : public.est_vendable, sur un
 *     PostgreSQL 17 éphémère (job CI « Migration Safety »).
 *
 * Changer une des deux définitions sans l'autre fait échouer l'un des deux
 * contrôles. Changer l'échantillon oblige les deux à suivre.
 *
 * Limite assumée : le prix arrive ici comme le texte d'un numeric PostgreSQL.
 * Les entrées qu'un numeric ne peut pas porter (chaîne vide, texte non
 * numérique) restent couvertes par vendable.test.ts, côté application seul.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { estVendable } from './vendable';

interface CasMiroir {
  nom: string;
  branche: string;
  dispo: string | null;
  etatTarif: string | null;
  venteTtc: string | null;
  pieceAffichee: boolean | null;
  attendu: boolean;
}

const echantillon = JSON.parse(
  readFileSync(join(__dirname, 'vendable.echantillon.json'), 'utf8'),
) as { cas: CasMiroir[] };

/** Chaque branche de la définition doit rester dans l'échantillon (mandat CT §6.3). */
const BRANCHES_REQUISES = [
  'dispo-0',
  'dispo-1',
  'dispo-2',
  'dispo-3',
  'dispo-null',
  'dispo-autre',
  'frozen',
  'etat-autre',
  'etat-null',
  'masquee',
  'affichage-null',
  'prix-nul',
  'prix-negatif',
  'prix-null',
  'prix-non-fini',
];

describe('miroir vendable — échantillon partagé avec public.est_vendable', () => {
  it('couvre chaque branche de la définition', () => {
    const presentes = new Set(echantillon.cas.map((c) => c.branche));
    expect(BRANCHES_REQUISES.filter((b) => !presentes.has(b))).toEqual([]);
  });

  it('nomme chaque cas une seule fois', () => {
    const noms = echantillon.cas.map((c) => c.nom);
    expect(new Set(noms).size).toBe(noms.length);
  });

  it.each(echantillon.cas.map((c) => [c.nom, c] as const))('%s', (_nom, c) => {
    const entree = {
      dispo: c.dispo,
      etatTarif: c.etatTarif,
      pieceAffichee: c.pieceAffichee,
    };
    // Le prix tel que PostgreSQL l'écrit…
    expect(estVendable({ ...entree, venteTtc: c.venteTtc })).toBe(c.attendu);
    // … et tel que PostgREST le rend à l'application (nombre JSON).
    if (c.venteTtc !== null && Number.isFinite(Number(c.venteTtc))) {
      expect(estVendable({ ...entree, venteTtc: Number(c.venteTtc) })).toBe(
        c.attendu,
      );
    }
  });
});
