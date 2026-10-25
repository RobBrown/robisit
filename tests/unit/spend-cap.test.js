// The spend cap's decision: stop only at or above the budget.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

// The function's runtime dependency isn't installed at the repo root; stub it.
const load = Module._load;
Module._load = function (req, ...rest) {
  if (req === '@google-cloud/functions-framework') return { cloudEvent: () => {} };
  return load.call(this, req, ...rest);
};
const { overBudget } = require('../../ops/spend-cap/index.js');
Module._load = load;

test('stops at and above the budget, never below', () => {
  assert.equal(overBudget({ costAmount: 49.99, budgetAmount: 50 }), false);
  assert.equal(overBudget({ costAmount: 50, budgetAmount: 50 }), true);
  assert.equal(overBudget({ costAmount: 73.1, budgetAmount: 50 }), true);
});

test('a malformed notification never disables anything', () => {
  assert.equal(overBudget({}), false);
  assert.equal(overBudget({ costAmount: '60', budgetAmount: 50 }), false);
});
