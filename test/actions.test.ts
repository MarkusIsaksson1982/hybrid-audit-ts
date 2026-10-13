import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLlmFindings, dedupeActions, jsonArrayAdapter } from '../src/actions.js';
import type { Finding, ProviderAdapter } from '../src/types.js';
test('parses fenced JSON with prose and tags provider', () => {
  const t = 'Here you go:\n```json\n[{"entityId":"c1","action":"fix_feed","severity":"high","reason":"feed errors"}]\n```\nThanks';
  const r = parseLlmFindings(t, jsonArrayAdapter('provider-a'));
  assert.equal(r.dropped, 0); assert.equal(r.findings.length, 1);
  assert.equal(r.findings[0].source, 'provider-a'); assert.equal(r.findings[0].reason, 'feed errors');
});
test('accepts an object wrapper {"findings": [...]}', () => {
  const r = parseLlmFindings('{"findings":[{"entityId":"c9","action":"pause","severity":"medium"}]}', jsonArrayAdapter('w'));
  assert.equal(r.findings.length, 1); assert.equal(r.findings[0].entityId, 'c9');
});
test('drops invalid items', () => {
  const t = '[{"entityId":"c1","action":"pause","severity":"low"},{"entityId":5,"action":"x","severity":"low"},{"entityId":"c2","action":"pause","severity":"urgent"},{"action":"pause","severity":"low"}]';
  const r = parseLlmFindings(t, jsonArrayAdapter('b'));
  assert.equal(r.findings.length, 1); assert.equal(r.dropped, 3);
});
test('garbage text yields no findings and does not throw', () => {
  const r = parseLlmFindings('sorry, I cannot help', jsonArrayAdapter('c'));
  assert.deepEqual(r.findings, []); assert.equal(r.dropped, 0);
});
test('custom adapter is used', () => {
  const csv: ProviderAdapter = { provider: 'csv', extract: (raw) => raw.trim().split('\n').map(l => { const [entityId, action, severity] = l.split(','); return { entityId, action, severity }; }) };
  const r = parseLlmFindings('c1,pause,low\nc2,pause,bad', csv);
  assert.equal(r.findings.length, 1); assert.equal(r.findings[0].source, 'csv'); assert.equal(r.dropped, 1);
});
test('dedupe merges by entityId+action, max severity, unique sorted sources', () => {
  const input: Finding[] = [
    { entityId: 'c1', action: 'reduce_budget', severity: 'medium', source: 'rule', reason: 'roas 1.5' },
    { entityId: 'c1', action: 'reduce_budget', severity: 'high', source: 'provider-b', reason: 'wasting spend' },
    { entityId: 'c1', action: 'reduce_budget', severity: 'low', source: 'provider-a', reason: 'roas 1.5' },
    { entityId: 'c1', action: 'fix_feed', severity: 'low', source: 'rule', reason: 'x' },
  ];
  const out = dedupeActions(input);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], { entityId: 'c1', action: 'reduce_budget', severity: 'high', sources: ['provider-a', 'provider-b', 'rule'], reasons: ['roas 1.5', 'wasting spend'] });
  assert.equal(out[1].action, 'fix_feed');
});
test('dedupe output sorted by severity desc, entityId, action', () => {
  const out = dedupeActions([
    { entityId: 'b', action: 'pause', severity: 'medium', source: 'rule' },
    { entityId: 'a', action: 'pause', severity: 'medium', source: 'rule' },
    { entityId: 'a', action: 'fix_feed', severity: 'medium', source: 'rule' },
    { entityId: 'z', action: 'pause', severity: 'high', source: 'rule' },
  ]);
  assert.deepEqual(out.map((x: { entityId: string; action: string }) => x.entityId + '/' + x.action), ['z/pause', 'a/fix_feed', 'a/pause', 'b/pause']);
});
test('empty input', () => { assert.deepEqual(dedupeActions([]), []); });
