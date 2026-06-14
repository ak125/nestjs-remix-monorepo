import {
  classifyCannibalizedPage,
  ClusterContext,
  LoserPageInput,
} from '../cannibalization-classifier';

const cluster: ClusterContext = {
  competingPages: 5,
  winnerPosition: 3,
  clusterClicks: 2,
};

const base: LoserPageInput = {
  position: 50,
  impressions: 0,
  clicks: 0,
  isWinner: false,
};

describe('classifyCannibalizedPage', () => {
  it('winner → keep / HIGH', () => {
    const r = classifyCannibalizedPage({ ...base, position: 3, isWinner: true }, cluster);
    expect(r.action).toBe('keep');
    expect(r.confidence_level).toBe('HIGH');
  });

  it('loser profond + 0 clic + écart large → canonical_candidate / HIGH', () => {
    const r = classifyCannibalizedPage({ ...base, position: 60, impressions: 20, clicks: 0 }, cluster);
    expect(r.action).toBe('canonical_candidate');
    expect(r.confidence_level).toBe('HIGH');
  });

  it('quasi invisible (impr<=1, 0 clic, distancée) → noindex_candidate / MEDIUM', () => {
    const r = classifyCannibalizedPage({ ...base, position: 30, impressions: 1, clicks: 0 }, cluster);
    expect(r.action).toBe('noindex_candidate');
    expect(r.confidence_level).toBe('MEDIUM');
  });

  it('loser avec clics propres → differentiate / LOW', () => {
    const r = classifyCannibalizedPage({ ...base, position: 12, impressions: 40, clicks: 3 }, cluster);
    expect(r.action).toBe('differentiate');
    expect(r.confidence_level).toBe('LOW');
  });

  it('loser proche du winner (écart < 10) sans clic → differentiate / MEDIUM', () => {
    const r = classifyCannibalizedPage({ ...base, position: 8, impressions: 15, clicks: 0 }, cluster);
    expect(r.action).toBe('differentiate');
    expect(r.confidence_level).toBe('MEDIUM');
  });

  it('canonical_candidate exige position profonde (>=40), sinon pas canonical', () => {
    // écart large (>=10) mais position 20 (<40), 0 clic, impressions 20
    const r = classifyCannibalizedPage({ ...base, position: 20, impressions: 20, clicks: 0 }, cluster);
    expect(r.action).not.toBe('canonical_candidate');
  });

  it('reason est toujours renseigné', () => {
    const r = classifyCannibalizedPage(base, cluster);
    expect(r.reason.length).toBeGreaterThan(0);
  });
});
