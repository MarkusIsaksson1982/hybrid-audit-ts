/**
 * Second domain for the same pipeline: software-license (SAM) audit rules.
 * Shows that the Finding/Action contract, LLM adapters and dedupe are domain-agnostic:
 * only the deterministic rules change.
 */
import { SEVERITY_RANK, type Finding } from './types.js';

export interface License {
  id: string;
  product: string;
  seats: number;
  assigned: number;
  /** seats with no usage in the last 90 days */
  inactive90d: number;
  costPerSeat: number;
  /** ISO date (YYYY-MM-DD) */
  renewal: string;
}

export interface LicenseRuleOptions { today?: string; renewalWindowDays?: number; minWasteCost?: number; }

const DAY = 86_400_000;

/** Deterministic license rules: over-deployment, unused seats (by wasted cost), upcoming renewal with waste. */
export function evaluateLicenses(licenses: License[], opts: LicenseRuleOptions = {}): Finding[] {
  const today = Date.parse(opts.today ?? new Date().toISOString().slice(0, 10));
  const window = opts.renewalWindowDays ?? 60;
  const minWaste = opts.minWasteCost ?? 1000;
  const out: Finding[] = [];
  for (const l of licenses) {
    if (l.assigned > l.seats) {
      out.push({ entityId: l.id, action: 'true_up_or_reclaim', severity: 'high', source: 'rule',
        reason: `${l.product}: ${l.assigned} assigned > ${l.seats} seats (compliance risk)` });
    }
    const unused = Math.max(0, l.seats - l.assigned) + l.inactive90d;
    const waste = unused * l.costPerSeat;
    if (unused > 0 && waste >= minWaste) {
      out.push({ entityId: l.id, action: 'reclaim_seats', severity: waste >= 10 * minWaste ? 'high' : 'medium', source: 'rule',
        reason: `${l.product}: ${unused} unused/inactive seats ≈ ${Math.round(waste)} per period` });
    }
    const days = Math.round((Date.parse(l.renewal) - today) / DAY);
    if (days >= 0 && days <= window && unused > 0) {
      out.push({ entityId: l.id, action: 'right_size_before_renewal', severity: days <= 14 ? 'high' : 'medium', source: 'rule',
        reason: `${l.product}: renews in ${days} days with ${unused} seats to cut` });
    }
  }
  return out.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || a.entityId.localeCompare(b.entityId));
}
