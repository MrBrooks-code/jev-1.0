import test from 'node:test';
import assert from 'node:assert/strict';
import { decide } from '../skills/jev-decide/scripts/decide.mjs';
const input = { question: 'Which suite first?', state: 'Parser changed', options: { unit: 'Parser unit tests', integration: 'Login integration tests' } };
const answer = { type: 'choice', choice: 'unit', confidence: 0.9, probabilities: { unit: 0.95, integration: 0.04, unclear: 0.01 } };
const fake = (a = answer) => async () => ({ ok: true, json: async () => ({ model: 'test-fixture', answers: { decision: a } }) });
test('preview and missing credentials make no network request', async () => {
  const never = () => { throw new Error('Unexpected request'); };
  assert.equal((await decide(input, { fetchImpl: never })).status, 'preview');
  assert.equal((await decide(input, { live: true, fetchImpl: never })).reason, 'missing_api_key');
});
test('live request uses the documented endpoint and returns the supplied candidate', async () => {
  const result = await decide(input, { live: true, key: 'fixture', fetchImpl: async (url, init) => {
    assert.equal(url, 'https://api.typesafe.ai/v1/systemone');
    assert.equal(init.headers.Authorization, 'Bearer fixture');
    assert.equal(JSON.parse(init.body).questions.decision.type, 'choice');
    return fake()();
  } });
  assert.equal(result.selected, 'unit');
});
test('uncertain, unclear, malformed and unavailable results fall back', async () => {
  for (const a of [
    { ...answer, confidence: 0.2 },
    { ...answer, choice: 'unclear', probabilities: { unit: 0.01, integration: 0.01, unclear: 0.98 } },
    { ...answer, choice: 'invented' },
    { ...answer, probabilities: { unit: 0.95 } },
  ]) assert.equal((await decide(input, { live: true, key: 'fixture', fetchImpl: fake(a) })).status, 'fallback');
  const result = await decide(input, { live: true, key: 'fixture', fetchImpl: async () => ({ ok: false, status: 429 }) });
  assert.equal(result.reason, 'http_429');
  assert.equal(result.selected, null);
});
test('invalid inputs are rejected before networking', async () => {
  await assert.rejects(decide({ ...input, min_confidence: 2 }));
  await assert.rejects(decide({ ...input, options: { unclear: 'Maybe', unit: 'Tests' } }));
});

test('close alternatives fall back even with high reported confidence', async () => {
  const a = { ...answer, probabilities: { unit: 0.51, integration: 0.48, unclear: 0.01 } };
  assert.equal((await decide(input, { live: true, key: 'fixture', fetchImpl: fake(a) })).reason, 'close_alternatives');
});
test('private mode, oversized data, and exact key leakage prevent network calls', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return fake()(); };
  assert.equal((await decide(null, { privateMode: true, live: true, fetchImpl })).reason, 'private_request');
  assert.equal((await decide({ ...input, state: 'x'.repeat(49000) }, { live: true, fetchImpl })).reason, 'payload_budget_exceeded');
  assert.equal((await decide({ ...input, state: 'secret-fixture-token' }, { key: 'secret-fixture-token', live: true, fetchImpl })).reason, 'api_key_in_payload');
  assert.equal(calls, 0);
});
