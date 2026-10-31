/**
 * Rendu de `SequencesCourtes` : durée tirée des séquences, avertissement limité
 * à sa séquence, refus sans séquence.
 *
 * Usage : npx tsx --test test/sequences-courtes.render.test.ts
 * (Chrome headless de Remotion requis ; RENDER_TEST_OUT=<dossier> garde les PNG.)
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import {
  orderedSequences,
  sequenceAt,
  sequencesDurationInFrames,
  type SequenceCourte,
} from '../src/compositions/SequencesCourtes';

const OUT = process.env.RENDER_TEST_OUT || mkdtempSync(join(tmpdir(), 'sequences-courtes-'));

const PICTO =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><circle cx="100" cy="100" r="80" fill="#F97316"/></svg>',
  );

const SEQUENCES: SequenceCourte[] = [
  { startSec: 2, endSec: 5, title: 'Étapes', items: ['Un', 'Deux', 'Trois'] },
  { startSec: 0, endSec: 2, items: ['Question ?'], imageUrl: PICTO },
];

let serveUrl: string;

async function still(name: string, frame: number, inputProps: Record<string, unknown>) {
  const composition = await selectComposition({ serveUrl, id: 'SequencesCourtes', inputProps });
  const output = join(OUT, `${name}-${frame}.png`);
  await renderStill({ composition, serveUrl, output, frame, inputProps });
  return { png: readFileSync(output), durationInFrames: composition.durationInFrames };
}

before(async () => {
  serveUrl = await bundle({ entryPoint: join(__dirname, '..', 'src', 'compositions', 'index.tsx') });
});

test('séquences : ordre, durée et séquence affichée', () => {
  assert.deepEqual(
    orderedSequences(SEQUENCES).map((s) => s.startSec),
    [0, 2],
  );
  assert.equal(orderedSequences([{ startSec: 3, endSec: 3 }]).length, 0);
  assert.equal(sequencesDurationInFrames(SEQUENCES, 30), 150);
  assert.equal(sequencesDurationInFrames(undefined, 30), 1);
  assert.equal(sequenceAt(SEQUENCES, 59, 30)?.startSec, 0);
  assert.equal(sequenceAt(SEQUENCES, 60, 30)?.startSec, 2);
  assert.equal(sequenceAt([{ startSec: 0, endSec: 1 }, { startSec: 2, endSec: 3 }], 45, 30), null);
});

test('la durée rendue suit la dernière séquence ; un avertissement reste dans sa séquence', async () => {
  const withWarning = SEQUENCES.map((s) =>
    s.startSec === 2 ? { ...s, warning: 'Suivre la notice du véhicule.' } : s,
  );
  const base30 = await still('sans', 30, { sequences: SEQUENCES });
  assert.equal(base30.durationInFrames, 150);
  const warn30 = await still('avec', 30, { sequences: withWarning });
  assert.ok(base30.png.equals(warn30.png), 'séquence 0-2 s : pas d’avertissement');
  const base120 = await still('sans', 120, { sequences: SEQUENCES });
  const warn120 = await still('avec', 120, { sequences: withWarning });
  assert.ok(!base120.png.equals(warn120.png), 'séquence 2-5 s : avertissement affiché');
});

test('sans séquence, le rendu échoue au lieu d’afficher une valeur de démonstration', async () => {
  await assert.rejects(still('vide', 0, { sequences: [] }), /au moins une séquence/);
});
