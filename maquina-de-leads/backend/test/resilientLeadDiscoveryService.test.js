const test = require('node:test');
const assert = require('node:assert/strict');

const { validateDiscoveryResult } = require('../src/services/resilientLeadDiscoveryService');

test('validateDiscoveryResult rejects silent zero-result discovery', () => {
  assert.throws(
    () => validateDiscoveryResult({ queries: 12, rawResults: 0, providerErrors: 12 }, 'niche-test'),
    (error) => {
      assert.equal(error.code, 'DISCOVERY_ZERO_RESULTS');
      assert.match(error.message, /Nenhum provedor retornou resultados/);
      assert.match(error.message, /providerErrors=12/);
      return true;
    }
  );
});

test('validateDiscoveryResult accepts discovery with raw results', () => {
  const result = { queries: 4, rawResults: 10, candidates: 3, inserted: 2, providerErrors: 0 };
  assert.equal(validateDiscoveryResult(result, 'niche-test'), result);
});
