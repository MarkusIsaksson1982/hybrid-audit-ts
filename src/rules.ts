import { SEVERITY_RANK } from './types.js';
import type { Campaign, Finding, Rule, RuleOptions } from './types.js';

/** Compute ROAS for a campaign. */
function roasOf(c: Campaign): number {
  return c.conversionValue / c.spend;
}

/** Flag spend with ROAS below threshold. */
const lowRoas: Rule = {
  id: 'low_roas',
  evaluate(c: Campaign, opts: Required<RuleOptions>): Finding[] {
    if (c.spend <= 0) return [];
    const roas = roasOf(c);
    if (roas >= opts.minRoas) return [];
    return [
      {
        entityId: c.id,
        action: 'reduce_budget',
        severity: roas < 1 ? 'high' : 'medium',
        source: 'rule',
        reason: `ROAS ${roas.toFixed(2)} below threshold ${opts.minRoas}`,
      },
    ];
  },
};

/** Flag budget-limited campaigns with healthy ROAS. */
const budgetLimited: Rule = {
  id: 'budget_limited',
  evaluate(c: Campaign, opts: Required<RuleOptions>): Finding[] {
    if (c.spend <= 0) return [];
    if (c.status !== 'limited_by_budget') return [];
    const roas = roasOf(c);
    if (roas < opts.minRoas) return [];
    return [
      {
        entityId: c.id,
        action: 'increase_budget',
        severity: 'medium',
        source: 'rule',
        reason: `ROAS ${roas.toFixed(2)} meets threshold ${opts.minRoas} but status is limited_by_budget`,
      },
    ];
  },
};

/** Flag campaigns with disapproved products. */
const disapproved: Rule = {
  id: 'disapproved',
  evaluate(c: Campaign, _opts: Required<RuleOptions>): Finding[] {
    if (c.disapprovedProducts <= 0) return [];
    return [
      {
        entityId: c.id,
        action: 'fix_feed',
        severity: c.disapprovedProducts >= 10 ? 'high' : 'low',
        source: 'rule',
        reason: `${c.disapprovedProducts} disapproved products`,
      },
    ];
  },
};

/** Default rule set. */
export const defaultRules: Rule[] = [lowRoas, budgetLimited, disapproved];

/** Evaluate rules for all campaigns, sorted by severity then entity. */
export function evaluateRules(
  campaigns: Campaign[],
  opts: RuleOptions = {},
  rules: Rule[] = defaultRules,
): Finding[] {
  const minRoas = opts.minRoas ?? 2;
  const resolved: Required<RuleOptions> = { minRoas };
  const out: Finding[] = [];
  for (const c of campaigns) {
    for (const r of rules) {
      out.push(...r.evaluate(c, resolved));
    }
  }
  out.sort(
    (a, b) =>
      SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
      a.entityId.localeCompare(b.entityId),
  );
  return out;
}
