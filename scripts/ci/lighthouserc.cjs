// LHCI 0.15.1 replaces its options when budgetsFile is used, discarding
// includePassedAssertions. Feed the same thresholds to its native assertions.
const budgets = require('../../frontend/lighthouse-budget.json');
if (budgets.length !== 1 || budgets[0].path !== '/*') {
  throw new Error('Review Lighthouse assertion scopes before changing the global timing budget');
}

module.exports = {
  ci: {
    assert: {
      assertions: Object.fromEntries(budgets[0].timings.map(({ metric, budget }) =>
        [metric, ['error', { maxNumericValue: budget }]])),
      includePassedAssertions: true,
    },
  },
};
