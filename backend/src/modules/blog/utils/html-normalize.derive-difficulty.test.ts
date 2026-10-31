import { deriveDifficulty } from './html-normalize.utils';

// FH-16 : difficulté et durée ne se déduisent plus du nombre d'étapes S4 ;
// le niveau de sécurité garde sa règle (présence S4_DEPOSE / S5).
describe('deriveDifficulty', () => {
  const steps = (n: number) =>
    `<ol>${Array.from({ length: n }, (_, i) => `<li>Étape ${i + 1}</li>`).join('')}</ol>`;

  it.each([3, 6, 12])('S4_DEPOSE à %i étapes : ni difficulté ni durée', (n) => {
    const r = deriveDifficulty([{ sectionType: 'S4_DEPOSE', html: steps(n) }]);
    expect(r.difficulty).toBeNull();
    expect(r.durationMin).toBeNull();
  });

  it('niveau de sécurité inchangé selon S4_DEPOSE et S5', () => {
    const depose = { sectionType: 'S4_DEPOSE', html: steps(3) };
    const s5 = { sectionType: 'S5', html: '<ul><li>Huile chaude</li></ul>' };
    expect(deriveDifficulty([depose, s5]).safetyLevel).toBe('élevé');
    expect(deriveDifficulty([depose]).safetyLevel).toBe('moyen');
    expect(deriveDifficulty([s5]).safetyLevel).toBe('moyen');
    expect(deriveDifficulty([]).safetyLevel).toBe('faible');
  });
});
