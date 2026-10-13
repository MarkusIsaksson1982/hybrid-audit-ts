import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLicenses, type License } from '../src/licenses.js';
import { dedupeActions, jsonArrayAdapter, parseLlmFindings } from '../src/actions.js';
const L = (o: Partial<License>): License => ({ id: 'l1', product: 'P', seats: 10, assigned: 10, inactive90d: 0, costPerSeat: 100, renewal: '2027-12-31', ...o });
const today = '2026-10-13';
test('healthy license gives no findings', () => { assert.deepEqual(evaluateLicenses([L({})], { today }), []); });
test('over-deployment is high severity', () => {
  const f = evaluateLicenses([L({ assigned: 12 })], { today });
  assert.deepEqual(f.map(x => [x.action, x.severity]), [['true_up_or_reclaim', 'high']]);
});
test('unused + inactive seats scale severity by wasted cost', () => {
  assert.equal(evaluateLicenses([L({ assigned: 5, inactive90d: 5 })], { today })[0].severity, 'medium');
  assert.equal(evaluateLicenses([L({ seats: 200, assigned: 100, costPerSeat: 100 })], { today })[0].severity, 'high');
  assert.deepEqual(evaluateLicenses([L({ assigned: 9 })], { today }), []);
});
test('renewal window with seats to cut', () => {
  const f = evaluateLicenses([L({ assigned: 9, renewal: '2026-10-20' })], { today, minWasteCost: 10_000 });
  assert.deepEqual(f.map(x => [x.action, x.severity]), [['right_size_before_renewal', 'high']]);
});
test('same dedupe merges rule and LLM findings for licenses', () => {
  const rule = evaluateLicenses([L({ assigned: 5, inactive90d: 5 })], { today });
  const llm = parseLlmFindings('```json\n[{"entityId":"l1","action":"reclaim_seats","severity":"high","reason":"10 idle seats"}]\n```', jsonArrayAdapter('local-llm'));
  const out = dedupeActions([...rule, ...llm.findings]);
  assert.equal(out.length, 1); assert.equal(out[0].severity, 'high'); assert.deepEqual(out[0].sources, ['local-llm', 'rule']);
});
