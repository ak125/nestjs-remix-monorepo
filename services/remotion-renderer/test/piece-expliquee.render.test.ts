/**
 * Rendu de `PieceExpliquee` : accroche, titres et avertissements par fenêtre.
 *
 * Usage : npx tsx --test test/piece-expliquee.render.test.ts
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
  PIECE_EXPLIQUEE_WINDOWS,
  pieceExpliqueeWindowAt,
} from '../src/compositions/PieceExpliquee';

const OUT = process.env.RENDER_TEST_OUT || mkdtempSync(join(tmpdir(), 'piece-expliquee-'));

const WITH_PROPS = {
  hook: 'Ton filtre à huile : vissé ou cartouche ?',
  titles: { whenToChange: 'Quand le changer' },
  windowWarnings: {
    wearSigns: 'Voyant d’huile allumé : suivre la notice du véhicule.',
    closer: 'Référence à confirmer via le sélecteur véhicule AutoMecanik.',
  },
};

let serveUrl: string;

async function still(name: string, frame: number, inputProps: Record<string, unknown>) {
  const composition = await selectComposition({ serveUrl, id: 'PieceExpliquee', inputProps });
  const output = join(OUT, `${name}-${frame}.png`);
  await renderStill({ composition, serveUrl, output, frame, inputProps });
  return readFileSync(output);
}

before(async () => {
  serveUrl = await bundle({ entryPoint: join(__dirname, '..', 'src', 'compositions', 'index.tsx') });
});

test('fenêtres : chaque frame appartient à une seule fenêtre', () => {
  assert.equal(pieceExpliqueeWindowAt(0), 'intro');
  assert.equal(pieceExpliqueeWindowAt(119), 'intro');
  assert.equal(pieceExpliqueeWindowAt(120), 'function');
  assert.equal(pieceExpliqueeWindowAt(420), 'wearSigns');
  assert.equal(pieceExpliqueeWindowAt(719), 'wearSigns');
  assert.equal(pieceExpliqueeWindowAt(720), 'whenToChange');
  assert.equal(pieceExpliqueeWindowAt(960), 'closer');
  assert.equal(pieceExpliqueeWindowAt(1199), 'closer');
  assert.deepEqual(PIECE_EXPLIQUEE_WINDOWS.wearSigns, [420, 720]);
});

test('l’accroche, le titre et les avertissements changent leur seule fenêtre', async () => {
  const frames = { intro: 60, function: 270, wearSigns: 570, whenToChange: 840, closer: 1080 };
  for (const [window, frame] of Object.entries(frames)) {
    const base = await still('defaut', frame, {});
    const withProps = await still('props', frame, WITH_PROPS);
    // Seule la fenêtre « function » ne reçoit ni accroche, ni titre, ni avertissement.
    if (window === 'function') {
      assert.ok(base.equals(withProps), `${window} (${frame}) ne doit pas changer`);
    } else {
      assert.ok(!base.equals(withProps), `${window} (${frame}) doit changer`);
    }
  }
});

test('un avertissement de fenêtre ne déborde pas sur la fenêtre voisine', async () => {
  const onlyWear = { windowWarnings: { wearSigns: WITH_PROPS.windowWarnings.wearSigns } };
  assert.ok(!(await still('defaut', 570, {})).equals(await still('wear', 570, onlyWear)));
  assert.ok((await still('defaut', 840, {})).equals(await still('wear', 840, onlyWear)));
});
