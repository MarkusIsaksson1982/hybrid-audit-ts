import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRules, defaultRules } from '../src/rules.js';
import type { Campaign, Rule } from '../src/types.js';
const C = (o: Partial<Campaign>): Campaign => ({ id: 'c1', name: 'C', spend: 100, conversionValue: 500, status: 'active', disapprovedProducts: 0, ...o });
test('healthy campaign gives no findings', () => { assert.deepEqual(evaluateRules([C({})]), []); });
test('low ROAS below 1 is high severity reduce_budget', () => {
  const f = evaluateRules([C({ conversionValue: 50 })]);
  assert.equal(f.length, 1); assert.equal(f[0].action, 'reduce_budget'); assert.equal(f[0].severity, 'high');
  assert.equal(f[0].entityId, 'c1'); assert.equal(f[0].source, 'rule'); assert.equal(typeof f[0].reason, 'string');
});
test('ROAS between 1 and minRoas is medium', () => { assert.equal(evaluateRules([C({ conversionValue: 150 })])[0].severity, 'medium'); });
test('minRoas option is respected', () => { assert.equal(evaluateRules([C({ conversionValue: 300 })], { minRoas: 4 })[0].action, 'reduce_budget'); });
test('zero spend skips ROAS rules', () => { assert.deepEqual(evaluateRules([C({ spend: 0, conversionValue: 0 })]), []); });
test('budget limited with good ROAS -> increase_budget medium', () => {
  const f = evaluateRules([C({ status: 'limited_by_budget' })]);
  assert.equal(f.length, 1); assert.equal(f[0].action, 'increase_budget'); assert.equal(f[0].severity, 'medium');
});
test('budget limited with bad ROAS does not suggest increase', () => {
  assert.deepEqual(evaluateRules([C({ status: 'limited_by_budget', conversionValue: 50 })]).map((x: { action: string }) => x.action), ['reduce_budget']);
});
test('disapproved products -> fix_feed with severity by count', () => {
  assert.equal(evaluateRules([C({ disapprovedProducts: 3 })])[0].severity, 'low');
  assert.equal(evaluateRules([C({ disapprovedProducts: 10 })])[0].severity, 'high');
  assert.equal(evaluateRules([C({ disapprovedProducts: 3 })])[0].action, 'fix_feed');
});
test('sorted by severity desc then entityId asc', () => {
  const f = evaluateRules([C({ id: 'b', disapprovedProducts: 2 }), C({ id: 'a', conversionValue: 10 }), C({ id: 'c', conversionValue: 150 }), C({ id: 'a2', conversionValue: 120 })]);
  assert.deepEqual(f.map((x: { entityId: string; severity: string }) => x.entityId + ':' + x.severity), ['a:high', 'a2:medium', 'c:medium', 'b:low']);
});
test('defaultRules has the three typed rules', () => { assert.deepEqual(defaultRules.map((r: Rule) => r.id).sort(), ['budget_limited', 'disapproved', 'low_roas']); });
test('custom rules can be plugged in', () => {
  const paused: Rule = { id: 'paused', evaluate: (c: Campaign) => c.status === 'paused' ? [{ entityId: c.id, action: 'review_paused', severity: 'low', source: 'rule' }] : [] };
  assert.deepEqual(evaluateRules([C({ status: 'paused' })], {}, [paused]).map((x: { action: string }) => x.action), ['review_paused']);
});
