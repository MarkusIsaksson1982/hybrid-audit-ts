/** Shared contract for ad-audit-mini (fixed; model-written modules must satisfy it under `strict`). */
export type Severity = 'high' | 'medium' | 'low';
export const SEVERITY_RANK: Record<Severity, number> = { high: 3, medium: 2, low: 1 };
export type CampaignStatus = 'active' | 'paused' | 'limited_by_budget';
export interface Campaign { id: string; name: string; spend: number; conversionValue: number; status: CampaignStatus; disapprovedProducts: number; }
export interface Finding { entityId: string; action: string; severity: Severity; source: string; reason?: string; }
export interface Action { entityId: string; action: string; severity: Severity; sources: string[]; reasons: string[]; }
export interface RuleOptions { minRoas?: number; }
export interface Rule { id: string; evaluate(c: Campaign, opts: Required<RuleOptions>): Finding[]; }
/** A provider adapter turns one provider's raw text into a candidate list (unknown items, validated later). */
export interface ProviderAdapter { provider: string; extract(raw: string): unknown[] | null; }
export interface ParseResult { findings: Finding[]; dropped: number; }
